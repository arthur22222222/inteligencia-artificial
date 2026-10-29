#!/usr/bin/env python3
"""Servidor da Nexa AI — Python puro (stdlib), SQLite e integracao com n8n."""
from __future__ import annotations

import json
import mimetypes
import os
import re
import sys
import time
import traceback
from collections import defaultdict, deque
from datetime import datetime
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


BASE_DIR = Path(__file__).resolve().parent


def load_env() -> None:
    """Carrega variaveis de um .env local sem sobrescrever o ambiente."""
    env_file = BASE_DIR / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_env()

import db  # noqa: E402  (precisa rodar depois do load_env)
import n8n  # noqa: E402

STATIC_DIR = BASE_DIR / "static"
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))
COOKIE_NAME = "nexa_session"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0") == "1"
SESSION_DAYS = 7
REMEMBER_DAYS = 30
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$")

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json",
}

# Rate limit simples em memoria para login/cadastro.
_attempts: dict[str, deque[float]] = defaultdict(deque)
LOGIN_WINDOW = 300.0
LOGIN_MAX = 12


def _client_ip(handler: BaseHTTPRequestHandler) -> str:
    forwarded = handler.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return handler.client_address[0]


def _rate_limited(key: str, limit: int = LOGIN_MAX, window: float = LOGIN_WINDOW) -> bool:
    now = time.monotonic()
    bucket = _attempts[key]
    while bucket and now - bucket[0] > window:
        bucket.popleft()
    if len(bucket) >= limit:
        return True
    bucket.append(now)
    return False


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class NexaHandler(BaseHTTPRequestHandler):
    server_version = "NexaAI/1.0"
    protocol_version = "HTTP/1.1"

    # ------------------------------------------------------------------ utils
    def log_message(self, fmt: str, *args) -> None:
        stamp = datetime.now().strftime("%H:%M:%S")
        sys.stderr.write(f"[{stamp}] {self.address_string()} {fmt % args}\n")

    def _send_json(self, status: int, data: dict | list, extra_headers: dict[str, str] | None = None) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            raise ApiError(400, "Requisição inválida.")
        if length > 200_000:
            raise ApiError(413, "Conteúdo muito grande.")
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ApiError(400, "JSON inválido.")
        if not isinstance(data, dict):
            raise ApiError(400, "Esperado um objeto JSON.")
        return data

    def _cookie_token(self) -> str:
        raw = self.headers.get("Cookie", "")
        if not raw:
            return ""
        cookie = SimpleCookie()
        try:
            cookie.load(raw)
        except Exception:
            return ""
        morsel = cookie.get(COOKIE_NAME)
        return morsel.value if morsel else ""

    def _current_user(self) -> dict | None:
        return db.user_from_session(self._cookie_token())

    def _require_user(self) -> dict:
        user = self._current_user()
        if not user:
            raise ApiError(401, "Faça login para continuar.")
        return user

    def _session_cookie(self, token: str, max_age: int) -> str:
        parts = [
            f"{COOKIE_NAME}={token}",
            "Path=/",
            f"Max-Age={max_age}",
            "HttpOnly",
            "SameSite=Lax",
        ]
        if COOKIE_SECURE:
            parts.append("Secure")
        return "; ".join(parts)

    def _security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

    def _send_static(self, path: str, head_only: bool = False) -> None:
        relative = unquote(path).lstrip("/") or "index.html"
        candidate = (STATIC_DIR / relative).resolve()
        if STATIC_DIR.resolve() not in candidate.parents and candidate != STATIC_DIR.resolve():
            raise ApiError(404, "Não encontrado.")
        if not candidate.is_file():
            # Rotas da SPA podem cair no index; arquivos ausentes devem dar 404.
            if Path(relative).suffix:
                raise ApiError(404, "Arquivo não encontrado.")
            candidate = STATIC_DIR / "index.html"
        try:
            content = candidate.read_bytes()
        except OSError:
            raise ApiError(404, "Arquivo não encontrado.")
        suffix = candidate.suffix.lower()
        ctype = MIME_TYPES.get(suffix) or mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(content)))
        self._security_headers()
        if suffix == ".html":
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        if not head_only:
            self.wfile.write(content)

    # --------------------------------------------------------------- dispatch
    def do_HEAD(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._send_json(404, {"error": "Não encontrado."})
            return
        try:
            self._send_static(parsed.path, head_only=True)
        except ApiError as exc:
            self._send_json(exc.status, {"error": exc.message})

    def do_GET(self) -> None:
        self._handle("GET")

    def do_POST(self) -> None:
        self._handle("POST")

    def _handle(self, method: str) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)
        try:
            if path.startswith("/api/"):
                self._route_api(method, path, query)
            elif method == "GET":
                self._send_static(parsed.path)
            else:
                raise ApiError(405, "Método não permitido.")
        except ApiError as exc:
            self._send_json(exc.status, {"error": exc.message})
        except BrokenPipeError:
            pass
        except Exception:
            traceback.print_exc()
            try:
                self._send_json(500, {"error": "Erro interno. Tente novamente."})
            except Exception:
                pass

    def _route_api(self, method: str, path: str, query: dict) -> None:
        if method == "GET" and path == "/api/health":
            self._send_json(200, {"ok": True, "time": db.now_iso()})
            return

        if method == "GET" and path == "/api/me":
            user = self._current_user()
            self._send_json(200, {"user": user})
            return

        if method == "POST" and path == "/api/auth/register":
            self._register()
            return
        if method == "POST" and path == "/api/auth/login":
            self._login()
            return
        if method == "POST" and path == "/api/auth/logout":
            self._logout()
            return

        if method == "GET" and path == "/api/services":
            self._send_json(200, {"services": db.list_services()})
            return
        if method == "GET" and path == "/api/availability":
            self._availability(query)
            return

        if method == "GET" and path == "/api/appointments":
            user = self._require_user()
            self._send_json(200, {"appointments": db.list_appointments(user["id"])})
            return
        if method == "POST" and path == "/api/appointments":
            self._create_appointment()
            return
        match = re.fullmatch(r"/api/appointments/(\d+)/cancel", path)
        if method == "POST" and match:
            self._cancel_appointment(int(match.group(1)))
            return
        match = re.fullmatch(r"/api/appointments/(\d+)/reschedule", path)
        if method == "POST" and match:
            self._reschedule_appointment(int(match.group(1)))
            return

        if method == "GET" and path == "/api/integrations":
            self._get_integration()
            return
        if method == "POST" and path == "/api/integrations/config":
            self._save_integration()
            return
        if method == "POST" and path == "/api/integrations/test":
            self._test_integration()
            return

        raise ApiError(404, "Rota não encontrada.")

    # ------------------------------------------------------------------ auth
    def _register(self) -> None:
        if _rate_limited(f"register:{_client_ip(self)}", limit=20, window=3600):
            raise ApiError(429, "Muitas tentativas. Aguarde alguns minutos.")
        data = self._read_json()
        name = str(data.get("name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))

        if len(name) < 2 or len(name) > 80:
            raise ApiError(400, "Informe seu nome completo.")
        if not EMAIL_RE.match(email) or len(email) > 160:
            raise ApiError(400, "Informe um e-mail válido.")
        if len(password) < 8:
            raise ApiError(400, "A senha precisa ter pelo menos 8 caracteres.")
        if len(password) > 128:
            raise ApiError(400, "A senha é muito longa.")

        try:
            user = db.create_user(name, email, password)
        except ValueError as exc:
            raise ApiError(409, str(exc))

        token = db.create_session(user["id"], SESSION_DAYS)
        n8n.send_event_async("user.registered", user)
        self._send_json(
            201,
            {"user": user},
            {"Set-Cookie": self._session_cookie(token, SESSION_DAYS * 86400)},
        )

    def _login(self) -> None:
        ip = _client_ip(self)
        data = self._read_json()
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        remember = data.get("remember") is True

        if _rate_limited(f"login:{ip}"):
            raise ApiError(429, "Muitas tentativas de login. Aguarde 5 minutos.")

        record = db.get_user_by_email(email)
        if not record or not db.verify_password(password, record["password_hash"]):
            raise ApiError(401, "E-mail ou senha incorretos.")

        days = REMEMBER_DAYS if remember else SESSION_DAYS
        token = db.create_session(record["id"], days)
        user = db.get_user(record["id"])
        self._send_json(200, {"user": user}, {"Set-Cookie": self._session_cookie(token, days * 86400)})

    def _logout(self) -> None:
        token = self._cookie_token()
        if token:
            db.delete_session(token)
        self._send_json(
            200,
            {"ok": True},
            {"Set-Cookie": self._session_cookie("", 0)},
        )

    # ----------------------------------------------------------- appointments
    def _availability(self, query: dict) -> None:
        day = (query.get("date") or [""])[0]
        raw_service = (query.get("service_id") or [""])[0]
        if not day:
            raise ApiError(400, "Informe a data.")
        try:
            service_id = int(raw_service)
        except (TypeError, ValueError):
            raise ApiError(400, "Informe o serviço.")
        try:
            slots = db.get_availability(day, service_id)
        except ValueError as exc:
            raise ApiError(400, str(exc))
        self._send_json(200, {"date": day, "service_id": service_id, "slots": slots})

    def _create_appointment(self) -> None:
        user = self._require_user()
        data = self._read_json()
        try:
            service_id = int(data.get("service_id"))
        except (TypeError, ValueError):
            raise ApiError(400, "Selecione um serviço.")
        day = str(data.get("date", "")).strip()
        start = str(data.get("time", "")).strip()
        notes = str(data.get("notes", ""))

        try:
            appointment = db.create_appointment(user["id"], service_id, day, start, notes)
        except ValueError as exc:
            raise ApiError(409, str(exc))

        n8n.send_event_async("appointment.created", user, appointment)
        self._send_json(201, {"appointment": appointment, "n8n": {"configured": bool(n8n.webhook_url())}})

    def _cancel_appointment(self, appointment_id: int) -> None:
        user = self._require_user()
        try:
            appointment = db.cancel_appointment(appointment_id, user["id"])
        except ValueError as exc:
            raise ApiError(400, str(exc))
        n8n.send_event_async("appointment.cancelled", user, appointment)
        self._send_json(200, {"appointment": appointment})

    def _reschedule_appointment(self, appointment_id: int) -> None:
        user = self._require_user()
        data = self._read_json()
        day = str(data.get("date", "")).strip()
        start = str(data.get("time", "")).strip()
        notes = data.get("notes")
        if notes is not None:
            notes = str(notes)

        try:
            appointment = db.reschedule_appointment(appointment_id, user["id"], day, start, notes)
        except db.SlotUnavailableError as exc:
            raise ApiError(409, str(exc))
        except ValueError as exc:
            raise ApiError(400, str(exc))

        n8n.send_event_async("appointment.rescheduled", user, appointment)
        self._send_json(
            200,
            {
                "appointment": appointment,
                "previous": appointment.get("previous"),
                "n8n": {"configured": bool(n8n.webhook_url())},
            },
        )

    # ------------------------------------------------------------ integrations
    def _get_integration(self) -> None:
        user = self._require_user()
        url = n8n.webhook_url()
        self._send_json(
            200,
            {
                "configured": bool(url),
                "webhook_url": url,
                "logs": db.list_webhook_logs(user["id"]),
                "events": [
                    "user.registered",
                    "appointment.created",
                    "appointment.rescheduled",
                    "appointment.cancelled",
                    "integration.test",
                ],
            },
        )

    def _save_integration(self) -> None:
        self._require_user()
        data = self._read_json()
        url = str(data.get("webhook_url", "")).strip()
        if len(url) > 500:
            raise ApiError(400, "URL muito longa.")
        if url and not (url.startswith("http://") or url.startswith("https://")):
            raise ApiError(400, "A URL deve começar com http:// ou https://.")
        db.set_setting("n8n_webhook_url", url)
        self._send_json(200, {"ok": True, "configured": bool(url), "webhook_url": url})

    def _test_integration(self) -> None:
        user = self._require_user()
        data = self._read_json()
        url = data.get("webhook_url")
        result = n8n.test_connection(user, str(url).strip() if isinstance(url, str) else None)
        self._send_json(200 if result["ok"] else 502, result)


def main() -> None:
    db.init_db()
    server = ThreadingHTTPServer((HOST, PORT), NexaHandler)
    server.daemon_threads = True
    display_host = "localhost" if HOST in ("0.0.0.0", "127.0.0.1") else HOST
    print("\n  ✦ Nexa AI rodando")
    print(f"  → http://{display_host}:{PORT}")
    print("  Conta demo: demo@nexa.ai / demo1234\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando servidor...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
