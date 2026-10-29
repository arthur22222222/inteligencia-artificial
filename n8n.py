"""Integracao com n8n: dispara eventos para um Webhook configurado."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

import db

DEFAULT_TIMEOUT = float(os.environ.get("N8N_TIMEOUT", "8"))


def webhook_url() -> str:
    return (db.get_setting("n8n_webhook_url", os.environ.get("N8N_WEBHOOK_URL", "")) or "").strip()


def build_payload(event: str, user: dict[str, Any], appointment: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "event": event,
        "source": "nexa-ai",
        "sent_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "user": {
            "id": user.get("id"),
            "name": user.get("name"),
            "email": user.get("email"),
        },
    }
    if appointment:
        payload["appointment"] = {
            "id": appointment.get("id"),
            "date": appointment.get("date"),
            "time": appointment.get("time"),
            "end_time": appointment.get("end_time"),
            "status": appointment.get("status"),
            "notes": appointment.get("notes", ""),
            "service": appointment.get("service"),
        }
        if appointment.get("previous"):
            payload["appointment"]["previous"] = appointment["previous"]
    return payload


def _post(url: str, payload: dict[str, Any], timeout: float = DEFAULT_TIMEOUT) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "NexaAI/1.0",
            "X-Webhook-Source": "nexa-ai",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            snippet = response.read(600).decode("utf-8", errors="replace")
            return {
                "ok": 200 <= response.status < 300,
                "status_code": response.status,
                "detail": snippet or "Recebido pelo n8n.",
            }
    except urllib.error.HTTPError as exc:
        snippet = exc.read(600).decode("utf-8", errors="replace")
        return {"ok": False, "status_code": exc.code, "detail": snippet or str(exc.reason)}
    except urllib.error.URLError as exc:
        return {"ok": False, "status_code": None, "detail": f"Falha de conexão: {exc.reason}"}
    except (TimeoutError, ValueError) as exc:
        return {"ok": False, "status_code": None, "detail": f"Erro: {exc}"}


def send_event(
    event: str,
    user: dict[str, Any],
    appointment: dict[str, Any] | None = None,
    *,
    override_url: str | None = None,
) -> dict[str, Any]:
    """Envia o evento de forma sincrona (o chamador decide se usa thread)."""
    url = (override_url if override_url is not None else webhook_url()).strip()
    payload = build_payload(event, user, appointment)

    if not url:
        result = {"ok": False, "status_code": None, "detail": "Webhook do n8n não configurado."}
        db.add_webhook_log(user.get("id"), event, "skipped", None, result["detail"], payload)
        return result

    if not (url.startswith("http://") or url.startswith("https://")):
        result = {"ok": False, "status_code": None, "detail": "A URL deve começar com http:// ou https://."}
        db.add_webhook_log(user.get("id"), event, "error", None, result["detail"], payload)
        return result

    result = _post(url, payload)
    db.add_webhook_log(
        user.get("id"),
        event,
        "success" if result["ok"] else "error",
        result.get("status_code"),
        str(result.get("detail", "")),
        payload,
    )
    return result


def send_event_async(event: str, user: dict[str, Any], appointment: dict[str, Any] | None = None) -> None:
    """Dispara o webhook em segundo plano para nao travar a resposta HTTP."""
    import threading

    def worker() -> None:
        try:
            send_event(event, user, appointment)
        except Exception as exc:  # pragma: no cover - protecao do thread
            try:
                db.add_webhook_log(
                    user.get("id"), event, "error", None, f"Erro inesperado: {exc}", build_payload(event, user, appointment)
                )
            except Exception:
                pass

    threading.Thread(target=worker, daemon=True, name="n8n-webhook").start()


def test_connection(user: dict[str, Any], url: str | None = None) -> dict[str, Any]:
    payload = {
        "event": "integration.test",
        "source": "nexa-ai",
        "sent_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "user": {"id": user.get("id"), "name": user.get("name"), "email": user.get("email")},
        "message": "Teste de conexão da Nexa AI. Se você recebeu isso, seu webhook está funcionando!",
    }
    target = (url if url is not None else webhook_url()).strip()
    if not target:
        return {"ok": False, "status_code": None, "detail": "Informe a URL do webhook."}
    if not (target.startswith("http://") or target.startswith("https://")):
        return {"ok": False, "status_code": None, "detail": "A URL deve começar com http:// ou https://."}
    result = _post(target, payload)
    db.add_webhook_log(
        user.get("id"),
        "integration.test",
        "success" if result["ok"] else "error",
        result.get("status_code"),
        str(result.get("detail", "")),
        payload,
    )
    return result
