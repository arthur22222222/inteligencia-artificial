import { api } from "../api.js";
import { icon } from "../icons.js";
import {
  confirmDialog,
  durationLabel,
  emptyState,
  escapeHtml,
  formatCurrency,
  formatDate,
  statusBadge,
  toast,
} from "../ui.js";

function appointmentDate(item) {
  return new Date(`${item.date}T${item.time}:00`);
}

function isPast(item) {
  return appointmentDate(item) < new Date();
}

export async function renderAppointments(root, ctx) {
  let appointments = [];
  let activeTab = "upcoming";

  try {
    const response = await api.appointments();
    appointments = response.appointments;
  } catch (error) {
    root.innerHTML = emptyState({
      iconName: "alert",
      title: "Não foi possível carregar seus agendamentos",
      text: error.message,
      action: '<button class="btn btn-primary" onclick="location.reload()">Tentar novamente</button>',
    });
    toast(error.message, "error");
    return () => {};
  }

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h2>Seus horários, organizados.</h2>
        <p class="muted">Acompanhe, gerencie e cancele sessões com um clique.</p>
      </div>
      <a class="btn btn-primary btn-sm" href="#/app/agendar">${icon("plus", 15)} Novo agendamento</a>
    </div>

    <div class="tabs" id="tabs" role="tablist">
      <button class="tab active" data-tab="upcoming" role="tab">${icon("calendar", 15)} Próximos <span class="tab-count" id="count-upcoming">0</span></button>
      <button class="tab" data-tab="history" role="tab">${icon("clock", 15)} Histórico <span class="tab-count" id="count-history">0</span></button>
      <button class="tab" data-tab="cancelled" role="tab">${icon("x", 15)} Cancelados <span class="tab-count" id="count-cancelled">0</span></button>
    </div>

    <div id="appointments-list"></div>
  `;

  const list = root.querySelector("#appointments-list");

  function groups() {
    const upcoming = appointments
      .filter((item) => item.status === "confirmed" && !isPast(item))
      .sort((a, b) => appointmentDate(a) - appointmentDate(b));
    const history = appointments
      .filter((item) => item.status === "completed" || (item.status === "confirmed" && isPast(item)))
      .sort((a, b) => appointmentDate(b) - appointmentDate(a));
    const cancelled = appointments
      .filter((item) => item.status === "cancelled")
      .sort((a, b) => appointmentDate(b) - appointmentDate(a));
    return { upcoming, history, cancelled };
  }

  function updateCounts() {
    const data = groups();
    root.querySelector("#count-upcoming").textContent = data.upcoming.length;
    root.querySelector("#count-history").textContent = data.history.length;
    root.querySelector("#count-cancelled").textContent = data.cancelled.length;
  }

  function card(item) {
    const past = isPast(item);
    const displayStatus = item.status === "confirmed" && past ? "completed" : item.status;
    const canCancel = item.status === "confirmed" && !past;
    return `
      <article class="appointment-card ${displayStatus}" data-id="${item.id}">
        <div class="appt-date">
          <span>${formatDate(item.date, { short: true, uppercase: true }).split(" ")[1]}</span>
          <strong>${String(new Date(`${item.date}T12:00:00`).getDate()).padStart(2, "0")}</strong>
          <small>${item.time}</small>
        </div>
        <div class="appt-body">
          <div class="appt-top">
            <span class="appt-icon ${item.service.color}">${icon(item.service.icon, 18)}</span>
            <div class="appt-title">
              <h3>${escapeHtml(item.service.name)}</h3>
              <p>${formatDate(item.date, { withWeekday: true })} · ${item.time} – ${item.end_time}</p>
            </div>
            ${statusBadge(displayStatus)}
          </div>
          <div class="appt-meta">
            <span>${icon("clock", 14)} ${durationLabel(item.service.duration_min)}</span>
            <span>${icon("video", 14)} Online</span>
            <span>${icon("chart", 14)} ${formatCurrency(item.service.price_cents)}</span>
            <span class="appt-id">#${String(item.id).padStart(4, "0")}</span>
          </div>
          ${item.notes ? `<div class="appt-notes">${icon("sparkles", 13)} ${escapeHtml(item.notes)}</div>` : ""}
        </div>
        <div class="appt-actions">
          ${
            canCancel
              ? `<button class="btn btn-ghost btn-sm btn-cancel" data-cancel="${item.id}">${icon("trash", 14)} Cancelar</button>`
              : displayStatus === "cancelled"
                ? `<span class="appt-hint">Cancelado ${item.cancelled_at ? `em ${formatDate(item.cancelled_at.slice(0, 10), { short: true })}` : ""}</span>`
                : `<span class="appt-hint">Sessão realizada</span>`
          }
          ${
            item.status === "confirmed" && !past
              ? `<a class="btn btn-glass btn-sm" href="#/app/agendar?reschedule=${item.id}">${icon("calendar", 14)} Reagendar</a>`
              : `<a class="btn btn-glass btn-sm" href="#/app/agendar">${icon("plus", 14)} Agendar novamente</a>`
          }
        </div>
      </article>
    `;
  }

  function renderList() {
    const data = groups();
    let items = data[activeTab] || [];
    let empty = "";
    if (activeTab === "upcoming") {
      empty = emptyState({
        iconName: "calendar",
        title: "Nenhum horário futuro",
        text: "Que tal reservar sua próxima sessão agora?",
        action: `<a class="btn btn-primary btn-sm" href="#/app/agendar">${icon("plus", 15)} Agendar sessão</a>`,
      });
    } else if (activeTab === "history") {
      empty = emptyState({
        iconName: "clock",
        title: "Seu histórico está vazio",
        text: "As sessões concluídas aparecerão aqui.",
      });
    } else {
      empty = emptyState({
        iconName: "x",
        title: "Nenhum cancelamento",
        text: "Boa notícia! Você não tem agendamentos cancelados.",
      });
    }

    list.innerHTML = items.length
      ? `<div class="appointments-list">${items.map(card).join("")}</div>`
      : empty;

    // Cria um grupo visual de datas por mes para dar contexto
    const headers = list.querySelectorAll(".appointment-card");
    headers.forEach((element) => {
      element.style.setProperty("--delay", `${Math.min(headers.length, 8) * 20}ms`);
    });

    list.querySelectorAll("[data-cancel]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = Number(button.dataset.cancel);
        const item = appointments.find((appointment) => appointment.id === id);
        if (!item) return;
        const confirmed = await confirmDialog({
          title: "Cancelar agendamento?",
          message: `Sua sessão de ${item.service.name} em ${formatDate(item.date)} às ${item.time} será cancelada. O horário voltará a ficar disponível.`,
          confirmLabel: "Sim, cancelar",
          cancelLabel: "Manter agendamento",
          danger: true,
        });
        if (!confirmed) return;

        button.disabled = true;
        try {
          await api.cancelAppointment(id);
          item.status = "cancelled";
          item.cancelled_at = new Date().toISOString();
          updateCounts();
          renderList();
          toast("Agendamento cancelado. O horário foi liberado.", "success");
        } catch (error) {
          button.disabled = false;
          toast(error.message, "error");
        }
      });
    });
  }

  root.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      root.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === tab));
      renderList();
    });
  });

  updateCounts();
  renderList();
  return () => {};
}
