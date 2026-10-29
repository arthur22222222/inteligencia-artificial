import { icon } from "./icons.js";

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function formatDate(iso, options = {}) {
  const date = parseDate(iso);
  if (!date) return "—";
  const { short = false, withWeekday = true, uppercase = false } = options;
  if (short) {
    const result = `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()].slice(0, 3)}`;
    return uppercase ? result.toUpperCase() : result;
  }
  const base = `${date.getDate()} de ${MONTHS[date.getMonth()]}`;
  const result = withWeekday ? `${WEEKDAYS[date.getDay()]}, ${base}` : base;
  return uppercase ? result.replace(/^./, (c) => c.toUpperCase()) : result;
}

export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function addDaysISO(iso, days) {
  const date = parseDate(iso);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatCurrency(cents) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function durationLabel(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

export function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function toast(message, type = "success", title = "") {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  const iconName = type === "error" ? "alert" : type === "info" ? "sparkles" : "check";
  el.innerHTML = `
    <span class="toast-icon">${icon(iconName, 18)}</span>
    <span class="toast-body">
      ${title ? `<strong>${escapeHtml(title)}</strong>` : ""}
      <span>${escapeHtml(message)}</span>
    </span>
    <button class="toast-close" aria-label="Fechar">${icon("x", 15)}</button>
  `;
  root.append(el);
  const remove = () => {
    el.classList.add("toast-out");
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector(".toast-close").addEventListener("click", remove);
  setTimeout(remove, type === "error" ? 6500 : 4200);
}

export function confirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Voltar",
  danger = false,
}) {
  return new Promise((resolve) => {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal-backdrop" data-close>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-icon ${danger ? "danger" : ""}">${icon(danger ? "alert" : "sparkles", 24)}</div>
          <h3 id="modal-title">${escapeHtml(title)}</h3>
          <p>${escapeHtml(message)}</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-cancel>${escapeHtml(cancelLabel)}</button>
            <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm>${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>
    `;
    const close = (value) => {
      root.innerHTML = "";
      document.removeEventListener("keydown", onKey);
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === "Escape") close(false);
    };
    root.querySelector("[data-close]").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) close(false);
    });
    root.querySelector("[data-cancel]").addEventListener("click", () => close(false));
    root.querySelector("[data-confirm]").addEventListener("click", () => close(true));
    document.addEventListener("keydown", onKey);
    setTimeout(() => root.querySelector("[data-confirm]")?.focus(), 30);
  });
}

export function setLoading(button, loading, label = "Processando...") {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = `<span class="spinner"></span> ${escapeHtml(label)}`;
  } else {
    button.disabled = false;
    button.classList.remove("is-loading");
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

export function statusBadge(status) {
  const map = {
    confirmed: { label: "Confirmado", icon: "check" },
    cancelled: { label: "Cancelado", icon: "x" },
    completed: { label: "Concluído", icon: "check" },
  };
  const item = map[status] || { label: status, icon: "clock" };
  return `<span class="badge badge-${status}">${icon(item.icon, 13)}${item.label}</span>`;
}

export function emptyState({ iconName = "calendar", title, text, action = "" }) {
  return `<div class="empty-state">
    <span class="empty-icon">${icon(iconName, 26)}</span>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
    ${action}
  </div>`;
}

export function revealOnScroll(scope = document) {
  const items = $$("[data-reveal]", scope);
  if (!items.length) return;
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("revealed"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );
  items.forEach((item) => observer.observe(item));
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}
