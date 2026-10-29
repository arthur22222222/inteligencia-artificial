"""Camada de dados da Nexa AI (SQLite, sem dependencias externas)."""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import date as date_cls, datetime, time, timedelta
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("DB_PATH", BASE_DIR / "data" / "nexa.db"))


class SlotUnavailableError(ValueError):
    """Conflito de horário: outro agendamento ocupou o intervalo."""

SERVICES_SEED = [
    {
        "slug": "estrategia-ia",
        "name": "Sessão de Estratégia IA",
        "description": "Mapeamento de oportunidades e um plano de ação para aplicar IA no seu negócio.",
        "duration_min": 60,
        "price_cents": 49000,
        "icon": "sparkles",
        "color": "violet",
    },
    {
        "slug": "automacao-n8n",
        "name": "Automação com n8n",
        "description": "Construímos juntos um fluxo real conectando seus apps, agentes e dados.",
        "duration_min": 90,
        "price_cents": 89000,
        "icon": "workflow",
        "color": "cyan",
    },
    {
        "slug": "consultoria-express",
        "name": "Consultoria Express",
        "description": "Uma dúvida específica? Resolva em 30 minutos com um especialista.",
        "duration_min": 30,
        "price_cents": 29000,
        "icon": "zap",
        "color": "amber",
    },
    {
        "slug": "diagnostico-dados",
        "name": "Diagnóstico de Dados",
        "description": "Avaliação da maturidade dos seus dados e roadmap de implementação.",
        "duration_min": 60,
        "price_cents": 59000,
        "icon": "chart",
        "color": "emerald",
    },
]

# Grade comercial: seg-sex, das 09:00 as 18:00, slots de 30 em 30 minutos.
BUSINESS_START = time(9, 0)
BUSINESS_END = time(18, 0)
SLOT_STEP_MIN = 30
MAX_DAYS_AHEAD = 90


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def get_conn():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Senhas e sessoes
# ---------------------------------------------------------------------------
PBKDF2_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), expected)
    except (ValueError, TypeError):
        return False


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(user_id: int, days: int = 7) -> str:
    token = secrets.token_urlsafe(32)
    created = datetime.now().astimezone()
    expires = created + timedelta(days=days)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)",
            (_hash_token(token), user_id, created.isoformat(timespec="seconds"), expires.isoformat(timespec="seconds")),
        )
    return token


def delete_session(token: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))


def user_from_session(token: str) -> dict[str, Any] | None:
    if not token:
        return None
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT u.* FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            """,
            (_hash_token(token), datetime.now().astimezone().isoformat(timespec="seconds")),
        ).fetchone()
    # Nunca devolve o hash da senha para a camada HTTP/serialização.
    return _public_user(dict(row)) if row else None


# ---------------------------------------------------------------------------
# Usuarios
# ---------------------------------------------------------------------------
def create_user(name: str, email: str, password: str) -> dict[str, Any]:
    email = email.strip().lower()
    with get_conn() as conn:
        exists = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if exists:
            raise ValueError("Este e-mail já está cadastrado.")
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash, created_at) VALUES (?,?,?,?)",
            (name.strip(), email, hash_password(password), now_iso()),
        )
        user_id = cur.lastrowid
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _public_user(dict(row))


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
    return dict(row) if row else None


def get_user(user_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _public_user(dict(row)) if row else None


def _public_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "created_at": row["created_at"],
    }


# ---------------------------------------------------------------------------
# Servicos (catalogo)
# ---------------------------------------------------------------------------
def list_services() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM services WHERE active = 1 ORDER BY sort_order, id").fetchall()
    return [dict(r) for r in rows]


def get_service(service_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM services WHERE id = ? AND active = 1", (service_id,)).fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Agendamentos
# ---------------------------------------------------------------------------
def _hm_to_minutes(value: str) -> int:
    h, m = value.split(":")
    return int(h) * 60 + int(m)


def _minutes_to_hm(value: int) -> str:
    return f"{value // 60:02d}:{value % 60:02d}"


def _appointments_for_date(
    conn: sqlite3.Connection, day: str, exclude_id: int | None = None
) -> list[tuple[int, int]]:
    sql = """
        SELECT a.time, s.duration_min FROM appointments a
        JOIN services s ON s.id = a.service_id
        WHERE a.date = ? AND a.status = 'confirmed'
    """
    params: list[Any] = [day]
    if exclude_id is not None:
        sql += " AND a.id != ?"
        params.append(exclude_id)
    rows = conn.execute(sql, params).fetchall()
    return [(_hm_to_minutes(r["time"]), r["duration_min"]) for r in rows]


def _validate_slot(service: dict[str, Any], day: str, start_time: str) -> tuple[date_cls, int, int]:
    """Valida data/horário comercial e devolve (data, início em minutos, fim em minutos)."""
    try:
        parsed = date_cls.fromisoformat(day)
        datetime.strptime(start_time, "%H:%M")
    except ValueError as exc:
        raise ValueError("Data ou horário inválido.") from exc

    today = date_cls.today()
    if parsed < today or parsed > today + timedelta(days=MAX_DAYS_AHEAD):
        raise ValueError("Data fora do período permitido.")
    if parsed.weekday() >= 5:
        raise ValueError("Atendemos apenas de segunda a sexta.")

    start = _hm_to_minutes(start_time)
    end = start + int(service["duration_min"])
    if start < _hm_to_minutes(BUSINESS_START.strftime("%H:%M")) or end > _hm_to_minutes(
        BUSINESS_END.strftime("%H:%M")
    ):
        raise ValueError("Horário fora do expediente (09h às 18h).")
    if start % SLOT_STEP_MIN != 0:
        raise ValueError("Escolha um horário válido.")
    if parsed == today and start <= datetime.now().hour * 60 + datetime.now().minute:
        raise ValueError("Escolha um horário futuro.")
    return parsed, start, end


def get_availability(day: str, service_id: int) -> list[dict[str, Any]]:
    service = get_service(service_id)
    if not service:
        raise ValueError("Serviço não encontrado.")

    parsed = date_cls.fromisoformat(day)
    today = date_cls.today()
    if parsed < today:
        raise ValueError("Escolha uma data futura.")
    if parsed > today + timedelta(days=MAX_DAYS_AHEAD):
        raise ValueError(f"Escolha uma data dentro dos próximos {MAX_DAYS_AHEAD} dias.")
    if parsed.weekday() >= 5:
        return []

    duration = int(service["duration_min"])
    open_min = _hm_to_minutes(BUSINESS_START.strftime("%H:%M"))
    close_min = _hm_to_minutes(BUSINESS_END.strftime("%H:%M"))
    now = datetime.now()
    with get_conn() as conn:
        booked = _appointments_for_date(conn, day)

    slots: list[dict[str, Any]] = []
    start = open_min
    while start + duration <= close_min:
        overlap = any(start < b_start + b_dur and b_start < start + duration for b_start, b_dur in booked)
        if parsed == today and start <= now.hour * 60 + now.minute:
            overlap = True
        slots.append({"time": _minutes_to_hm(start), "available": not overlap})
        start += SLOT_STEP_MIN
    return slots


def create_appointment(user_id: int, service_id: int, day: str, start_time: str, notes: str) -> dict[str, Any]:
    service = get_service(service_id)
    if not service:
        raise ValueError("Serviço não encontrado.")
    _parsed, start, end = _validate_slot(service, day, start_time)

    with get_conn() as conn:
        conn.execute("BEGIN IMMEDIATE")
        booked = _appointments_for_date(conn, day)
        if any(start < b_start + b_dur and b_start < end for b_start, b_dur in booked):
            raise SlotUnavailableError("Este horário acabou de ser reservado. Escolha outro.")
        cur = conn.execute(
            """
            INSERT INTO appointments (user_id, service_id, date, time, notes, status, created_at)
            VALUES (?,?,?,?,?, 'confirmed', ?)
            """,
            (user_id, service_id, day, start_time, notes.strip()[:800], now_iso()),
        )
        appointment_id = cur.lastrowid
        row = _appointment_row(conn, appointment_id)

    data = _serialize_appointment(row)
    data["event"] = "appointment.created"
    return data


def reschedule_appointment(
    appointment_id: int, user_id: int, day: str, start_time: str, notes: str | None = None
) -> dict[str, Any]:
    """Move um agendamento ativo para outro horário, mantendo o mesmo serviço."""
    with get_conn() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = _appointment_row(conn, appointment_id, user_id)
        if row["status"] != "confirmed":
            raise ValueError("Este agendamento não está ativo.")
        original_dt = datetime.fromisoformat(f"{row['date']}T{row['time']}:00")
        if original_dt < datetime.now():
            raise ValueError("Não é possível reagendar um agendamento passado.")
        if day == row["date"] and start_time == row["time"]:
            raise ValueError("Escolha uma data ou um horário diferente do atual.")

        _parsed, start, end = _validate_slot(row, day, start_time)
        booked = _appointments_for_date(conn, day, exclude_id=appointment_id)
        if any(start < b_start + b_dur and b_start < end for b_start, b_dur in booked):
            raise SlotUnavailableError("Este horário acabou de ser reservado. Escolha outro.")

        previous = {
            "date": row["date"],
            "time": row["time"],
            "end_time": _minutes_to_hm(_hm_to_minutes(row["time"]) + int(row["duration_min"])),
        }
        new_notes = row["notes"] if notes is None else notes.strip()[:800]
        conn.execute(
            """
            UPDATE appointments
            SET date = ?, time = ?, notes = ?, rescheduled_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (day, start_time, new_notes, now_iso(), appointment_id, user_id),
        )
        updated = _appointment_row(conn, appointment_id, user_id)

    data = _serialize_appointment(updated)
    data["event"] = "appointment.rescheduled"
    data["previous"] = previous
    return data


def list_appointments(user_id: int) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT a.*, s.name AS service_name, s.description AS service_description,
                   s.duration_min, s.price_cents, s.icon AS service_icon, s.color AS service_color
            FROM appointments a JOIN services s ON s.id = a.service_id
            WHERE a.user_id = ?
            ORDER BY a.date DESC, a.time DESC
            """,
            (user_id,),
        ).fetchall()
    return [_serialize_appointment(dict(r)) for r in rows]


def get_appointment(appointment_id: int, user_id: int | None = None) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = _appointment_row(conn, appointment_id, user_id)
    return _serialize_appointment(row) if row else None


def _appointment_row(conn: sqlite3.Connection, appointment_id: int, user_id: int | None = None) -> dict[str, Any]:
    sql = """
        SELECT a.*, s.name AS service_name, s.description AS service_description,
               s.duration_min, s.price_cents, s.icon AS service_icon, s.color AS service_color
        FROM appointments a JOIN services s ON s.id = a.service_id
        WHERE a.id = ?
    """
    params: list[Any] = [appointment_id]
    if user_id is not None:
        sql += " AND a.user_id = ?"
        params.append(user_id)
    row = conn.execute(sql, params).fetchone()
    if not row:
        raise ValueError("Agendamento não encontrado.")
    return dict(row)


def cancel_appointment(appointment_id: int, user_id: int) -> dict[str, Any]:
    with get_conn() as conn:
        row = _appointment_row(conn, appointment_id, user_id)
        if row["status"] != "confirmed":
            raise ValueError("Este agendamento não está ativo.")
        appointment_dt = datetime.fromisoformat(f"{row['date']}T{row['time']}:00")
        if appointment_dt < datetime.now():
            raise ValueError("Não é possível cancelar um agendamento passado.")
        conn.execute(
            "UPDATE appointments SET status = 'cancelled', cancelled_at = ? WHERE id = ? AND user_id = ?",
            (now_iso(), appointment_id, user_id),
        )
        updated = _appointment_row(conn, appointment_id, user_id)
    data = _serialize_appointment(updated)
    data["event"] = "appointment.cancelled"
    return data


def _serialize_appointment(row: dict[str, Any]) -> dict[str, Any]:
    end_min = _hm_to_minutes(row["time"]) + int(row["duration_min"])
    return {
        "id": row["id"],
        "date": row["date"],
        "time": row["time"],
        "end_time": _minutes_to_hm(end_min),
        "status": row["status"],
        "notes": row.get("notes") or "",
        "created_at": row["created_at"],
        "cancelled_at": row.get("cancelled_at"),
        "rescheduled_at": row.get("rescheduled_at"),
        "n8n_status": row.get("n8n_status"),
        "service": {
            "id": row["service_id"],
            "name": row["service_name"],
            "description": row["service_description"],
            "duration_min": row["duration_min"],
            "price_cents": row["price_cents"],
            "icon": row["service_icon"],
            "color": row["service_color"],
        },
    }


# ---------------------------------------------------------------------------
# Configuracoes e logs da integracao n8n
# ---------------------------------------------------------------------------
def get_setting(key: str, default: str | None = None) -> str | None:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (key, value, now_iso()),
        )


def add_webhook_log(
    user_id: int | None,
    event: str,
    status: str,
    status_code: int | None,
    detail: str,
    payload: dict[str, Any],
) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO webhook_logs (user_id, event, status, status_code, detail, payload, created_at)
            VALUES (?,?,?,?,?,?,?)
            """,
            (user_id, event, status, status_code, detail[:500], _json(payload), now_iso()),
        )


def list_webhook_logs(user_id: int, limit: int = 12) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM webhook_logs WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    out = []
    for row in rows:
        item = dict(row)
        item.pop("payload", None)
        out.append(item)
    return out


def _json(value: Any) -> str:
    import json

    return json.dumps(value, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Inicializacao
# ---------------------------------------------------------------------------
def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                duration_min INTEGER NOT NULL,
                price_cents INTEGER NOT NULL,
                icon TEXT NOT NULL,
                color TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                service_id INTEGER NOT NULL REFERENCES services(id),
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'confirmed',
                n8n_status TEXT,
                created_at TEXT NOT NULL,
                cancelled_at TEXT,
                rescheduled_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date, status);
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS webhook_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                event TEXT NOT NULL,
                status TEXT NOT NULL,
                status_code INTEGER,
                detail TEXT NOT NULL DEFAULT '',
                payload TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            );
            """
        )
        # Migração leve para bancos criados antes do reagendamento.
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(appointments)").fetchall()}
        if "rescheduled_at" not in columns:
            conn.execute("ALTER TABLE appointments ADD COLUMN rescheduled_at TEXT")
        for index, service in enumerate(SERVICES_SEED):
            conn.execute(
                """
                INSERT INTO services (slug, name, description, duration_min, price_cents, icon, color, active, sort_order)
                VALUES (?,?,?,?,?,?,?,1,?)
                ON CONFLICT(slug) DO UPDATE SET
                    name = excluded.name, description = excluded.description,
                    duration_min = excluded.duration_min, price_cents = excluded.price_cents,
                    icon = excluded.icon, color = excluded.color, sort_order = excluded.sort_order
                """,
                (
                    service["slug"],
                    service["name"],
                    service["description"],
                    service["duration_min"],
                    service["price_cents"],
                    service["icon"],
                    service["color"],
                    index,
                ),
            )
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('n8n_webhook_url', ?, ?)",
            (os.environ.get("N8N_WEBHOOK_URL", ""), now_iso()),
        )
        _seed_demo(conn)


def _seed_demo(conn: sqlite3.Connection) -> None:
    """Cria uma conta de demonstracao com historico para facilitar o teste."""
    exists = conn.execute("SELECT id FROM users WHERE email = 'demo@nexa.ai'").fetchone()
    if exists:
        return
    user_id = conn.execute(
        "INSERT INTO users (name, email, password_hash, created_at) VALUES (?,?,?,?)",
        ("Ana Martins", "demo@nexa.ai", hash_password("demo1234"), now_iso()),
    ).lastrowid

    def next_weekday(offset: int) -> str:
        day = date_cls.today() + timedelta(days=offset)
        while day.weekday() >= 5:
            day += timedelta(days=1)
        return day.isoformat()

    services = conn.execute("SELECT id FROM services ORDER BY sort_order").fetchall()
    rows = [
        (user_id, services[0]["id"], next_weekday(2), "10:00", "Quero mapear automações para o time comercial.", "confirmed"),
        (user_id, services[1]["id"], next_weekday(5), "14:00", "Integrar CRM + WhatsApp com n8n.", "confirmed"),
        (user_id, services[2]["id"], (date_cls.today() - timedelta(days=12)).isoformat(), "11:00", "Dúvida sobre agentes de atendimento.", "completed"),
    ]
    for row in rows:
        conn.execute(
            """
            INSERT INTO appointments (user_id, service_id, date, time, notes, status, created_at)
            VALUES (?,?,?,?,?,?,?)
            """,
            (*row, now_iso()),
        )
