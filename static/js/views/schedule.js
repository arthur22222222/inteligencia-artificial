import { api } from "../api.js";
import { icon } from "../icons.js";
import {
  addDaysISO,
  durationLabel,
  escapeHtml,
  formatCurrency,
  formatDate,
  parseDate,
  setLoading,
  todayISO,
  toast,
} from "../ui.js";

const STEP_LABELS = ["Serviço", "Data e horário", "Confirmação"];

function weekdayShort(iso) {
  return ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"][parseDate(iso).getDay()];
}

function isWeekend(iso) {
  const day = parseDate(iso).getDay();
  return day === 0 || day === 6;
}

export async function renderSchedule(root, ctx) {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const rescheduleId = Number(params.get("reschedule")) || 0;
  let services = [];
  let reschedule = null;

  try {
    const responses = await Promise.all([
      api.services(),
      rescheduleId ? api.appointments() : Promise.resolve(null),
    ]);
    services = responses[0].services;
    if (rescheduleId) {
      const appointmentDate = (item) => new Date(`${item.date}T${item.time}:00`);
      reschedule = (responses[1]?.appointments || []).find(
        (item) => item.id === rescheduleId && item.status === "confirmed" && appointmentDate(item) >= new Date(),
      );
      if (!reschedule) {
        throw new Error("Este agendamento não está mais disponível para reagendamento.");
      }
    }
  } catch (error) {
    root.innerHTML = `<div class="empty-state">
      <span class="empty-icon">${icon("alert", 26)}</span>
      <h3>Não foi possível carregar a agenda</h3>
      <p>${escapeHtml(error.message)}</p>
      <a class="btn btn-primary btn-sm" href="#/app/agendamentos">Voltar aos agendamentos</a>
    </div>`;
    toast(error.message, "error");
    return () => {};
  }

  const state = {
    step: reschedule ? 2 : 1,
    serviceId: reschedule ? reschedule.service.id : services[0]?.id ?? null,
    date: reschedule ? reschedule.date : "",
    time: "",
    notes: reschedule ? reschedule.notes || "" : "",
    slots: [],
    loadingSlots: false,
    slotsError: "",
  };
  let abortSlots = null;
  let destroyed = false;

  const service = () =>
    services.find((item) => item.id === state.serviceId) ||
    (reschedule && reschedule.service.id === state.serviceId ? reschedule.service : undefined);

  const quickDates = (() => {
    const anchor = reschedule ? reschedule.date : todayISO();
    const limit = addDaysISO(todayISO(), 90);
    const dates = [];
    for (let offset = reschedule ? -1 : 0; offset < 30 && dates.length < 6; offset++) {
      const iso = addDaysISO(anchor, offset);
      if (iso < todayISO()) continue;
      if (iso > limit) break;
      if (!isWeekend(iso)) dates.push(iso);
    }
    if (reschedule && !dates.includes(reschedule.date)) dates.push(reschedule.date);
    return dates.sort();
  })();

  root.innerHTML = `
    <div class="schedule-layout">
      <div class="wizard">
        <div class="stepper" id="stepper">
          ${STEP_LABELS.map(
            (label, index) => `
            <div class="step-item" data-step="${index + 1}">
              <span class="step-dot">${index + 1}</span>
              <span class="step-label">${label}</span>
            </div>
            ${index < STEP_LABELS.length - 1 ? '<span class="step-connector"></span>' : ""}
          `,
          ).join("")}
        </div>

        <div class="wizard-card">
          <div id="step-content"></div>
        </div>
      </div>

      <aside class="summary" id="summary"></aside>
    </div>
  `;

  const stepContent = root.querySelector("#step-content");
  const summary = root.querySelector("#summary");
  const stepper = root.querySelector("#stepper");

  function updateStepper() {
    stepper.querySelectorAll(".step-item").forEach((item) => {
      const number = Number(item.dataset.step);
      const locked = Boolean(reschedule) && number === 1;
      item.classList.toggle("active", number === state.step);
      item.classList.toggle("done", number < state.step && !locked);
      item.classList.toggle("locked", locked);
      item.title = locked ? "No reagendamento, o serviço do atendimento é mantido." : "";
      item.querySelector(".step-dot").innerHTML = locked
        ? icon("lock", 12)
        : number < state.step
          ? icon("check", 13)
          : String(number);
    });
    stepper.querySelectorAll(".step-item").forEach((item) => {
      item.onclick = () => {
        const number = Number(item.dataset.step);
        if (number > state.step) return;
        if (reschedule && number === 1) return;
        state.step = number;
        renderStep();
      };
    });
  }

  function renderSummary() {
    const selected = service();
    const hasDate = Boolean(state.date);
    const hasTime = Boolean(state.time);
    summary.innerHTML = `
      <div class="summary-card">
        <div class="summary-head">
          <span class="eyebrow">Resumo</span>
          ${hasDate && hasTime ? '<span class="badge badge-confirmed">' + icon("check", 12) + "Pronto</span>" : ""}
        </div>
        ${
          selected
            ? `<div class="summary-service">
                <span class="summary-icon ${selected.color}">${icon(selected.icon, 19)}</span>
                <div>
                  <strong>${escapeHtml(selected.name)}</strong>
                  <small>${icon("clock", 12)} ${durationLabel(selected.duration_min)} · ${icon("video", 12)} Online</small>
                </div>
              </div>`
            : `<p class="muted">Selecione um serviço para começar.</p>`
        }
        <div class="summary-divider"></div>
        <dl class="summary-list">
          <div><dt>Data</dt><dd>${hasDate ? formatDate(state.date) : "A escolher"}</dd></div>
          <div><dt>Horário</dt><dd>${hasTime ? `${state.time}${selected ? ` – ${addMinutes(state.time, selected.duration_min)}` : ""}` : "A escolher"}</dd></div>
          <div><dt>Formato</dt><dd>Online · Google Meet</dd></div>
        </dl>
        <div class="summary-divider"></div>
        <div class="summary-total">
          <span>Total</span>
          <strong>${selected ? formatCurrency(selected.price_cents) : "—"}</strong>
        </div>
        <div class="summary-note">${icon("shield", 13)} Pagamento após a sessão. Cancelamento gratuito até 24h antes.</div>
      </div>
      <div class="summary-help">
        <span class="summary-help-icon">${icon("sparkles", 17)}</span>
        <p><strong>Precisa de outro formato?</strong> Fale com a gente em <a href="mailto:oi@nexa.ai">oi@nexa.ai</a>.</p>
      </div>
    `;
  }

  function addMinutes(time, minutes) {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + Number(minutes);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function renderStep() {
    updateStepper();
    renderSummary();
    if (state.step === 1) renderServices();
    else if (state.step === 2) renderDateTime();
    else renderConfirm();
  }

  // ------------------------------------------------------------------ step 1
  function renderServices() {
    stepContent.innerHTML = `
      <div class="wizard-head">
        <span class="eyebrow">Etapa 1 de 3</span>
        <h2>Qual serviço você precisa?</h2>
        <p>Escolha a sessão ideal. Você poderá ajustar data e horário em seguida.</p>
      </div>
      <div class="service-grid">
        ${services
          .map(
            (item) => `
            <button type="button" class="service-card ${state.serviceId === item.id ? "selected" : ""}" data-service="${item.id}" aria-pressed="${state.serviceId === item.id}">
              <span class="service-icon ${item.color}">${icon(item.icon, 20)}</span>
              <span class="service-body">
                <span class="service-top">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span class="service-check">${icon("check", 13)}</span>
                </span>
                <span class="service-desc">${escapeHtml(item.description)}</span>
                <span class="service-meta">
                  <span>${icon("clock", 13)} ${durationLabel(item.duration_min)}</span>
                  <span class="service-price">${formatCurrency(item.price_cents)}</span>
                </span>
              </span>
            </button>
          `,
          )
          .join("")}
      </div>
      <div class="wizard-actions">
        <a class="btn btn-ghost" href="#/app">Cancelar</a>
        <button class="btn btn-primary" id="next-step" ${state.serviceId ? "" : "disabled"}>
          Escolher data e horário ${icon("arrow-right", 16)}
        </button>
      </div>
    `;

    stepContent.querySelectorAll("[data-service]").forEach((button) => {
      button.addEventListener("click", () => {
        state.serviceId = Number(button.dataset.service);
        state.time = "";
        stepContent.querySelectorAll(".service-card").forEach((card) => {
          card.classList.toggle("selected", Number(card.dataset.service) === state.serviceId);
          card.setAttribute("aria-pressed", String(Number(card.dataset.service) === state.serviceId));
        });
        stepContent.querySelector("#next-step").disabled = false;
        renderSummary();
      });
    });

    stepContent.querySelector("#next-step").addEventListener("click", () => {
      if (!state.serviceId) return;
      state.step = 2;
      renderStep();
      if (state.date) loadSlots();
    });
  }

  // ------------------------------------------------------------------ step 2
  function renderDateTime() {
    const isReschedule = Boolean(reschedule);
    stepContent.innerHTML = `
      <div class="wizard-head">
        <span class="eyebrow">Etapa 2 de 3</span>
        <h2>${isReschedule ? "Escolha o novo horário" : "Escolha data e horário"}</h2>
        <p>${
          isReschedule
            ? "O serviço e a duração são mantidos. Selecione outro dia ou horário — o compromisso atual aparece marcado como “atual”."
            : "Atendemos de segunda a sexta, das 9h às 18h (horário de Brasília)."
        }</p>
      </div>

      <div class="date-chips">
        ${quickDates
          .map(
            (iso) => `
            <button type="button" class="date-chip ${state.date === iso ? "selected" : ""}" data-date="${iso}">
              <small>${weekdayShort(iso)}</small>
              <strong>${String(parseDate(iso).getDate()).padStart(2, "0")}</strong>
              <span>${formatDate(iso, { short: true }).split(" ")[1]}</span>
            </button>
          `,
          )
          .join("")}
      </div>

      <div class="date-row">
        <label class="field compact">
          <span>Outra data</span>
          <div class="input-wrap">
            ${icon("calendar", 16)}
            <input type="date" id="date-input" min="${todayISO()}" max="${addDaysISO(todayISO(), 90)}" value="${state.date}" />
          </div>
        </label>
        <div class="tz-note">${icon("globe", 14)} Fuso horário: America/São_Paulo</div>
      </div>

      <div class="slots-wrap">
        <div class="slots-head">
          <h3>Horários disponíveis</h3>
          ${state.date ? `<span class="muted">${formatDate(state.date)}</span>` : ""}
        </div>
        <div id="slots-area"></div>
      </div>

      <div class="wizard-actions">
        ${
          isReschedule
            ? `<a class="btn btn-ghost" href="#/app/agendamentos">Cancelar reagendamento</a>`
            : `<button class="btn btn-ghost" id="back-step">${icon("chevron-right", 16, "flip")} Voltar</button>`
        }
        <button class="btn btn-primary" id="next-step" ${state.time ? "" : "disabled"}>
          ${isReschedule ? "Revisar novo horário" : "Revisar agendamento"} ${icon("arrow-right", 16)}
        </button>
      </div>
    `;

    const dateInput = stepContent.querySelector("#date-input");
    const nextBtn = stepContent.querySelector("#next-step");

    stepContent.querySelectorAll("[data-date]").forEach((button) => {
      button.addEventListener("click", () => {
        state.date = button.dataset.date;
        state.time = "";
        dateInput.value = state.date;
        stepContent.querySelectorAll(".date-chip").forEach((chip) => {
          chip.classList.toggle("selected", chip.dataset.date === state.date);
        });
        nextBtn.disabled = true;
        renderSummary();
        loadSlots();
      });
    });

    dateInput.addEventListener("change", () => {
      const value = dateInput.value;
      if (!value) return;
      if (isWeekend(value)) {
        toast("Atendemos apenas de segunda a sexta.", "info");
        dateInput.value = state.date;
        return;
      }
      state.date = value;
      state.time = "";
      nextBtn.disabled = true;
      stepContent.querySelectorAll(".date-chip").forEach((chip) => {
        chip.classList.toggle("selected", chip.dataset.date === value);
      });
      renderSummary();
      loadSlots();
    });

    stepContent.querySelector("#back-step")?.addEventListener("click", () => {
      state.step = 1;
      renderStep();
    });

    nextBtn.addEventListener("click", () => {
      if (!state.time) return;
      state.step = 3;
      renderStep();
    });

    if (state.date) {
      loadSlots();
    } else {
      stepContent.querySelector("#slots-area").innerHTML = `
        <div class="slots-placeholder">${icon("calendar", 22)}<span>Selecione uma data para ver os horários livres.</span></div>
      `;
    }
  }

  async function loadSlots() {
    const area = stepContent.querySelector("#slots-area");
    if (!area || !state.date || !state.serviceId) return;
    if (abortSlots) abortSlots.abort();
    abortSlots = new AbortController();
    state.loadingSlots = true;
    area.innerHTML = `
      <div class="slots-loading">
        ${Array.from({ length: 8 }, () => '<span class="skeleton skeleton-slot"></span>').join("")}
      </div>
    `;

    try {
      const data = await api.availability(state.date, state.serviceId, abortSlots.signal);
      if (destroyed) return;
      const currentTime = reschedule && state.date === reschedule.date ? reschedule.time : "";
      state.slots = data.slots.map((slot) => ({
        ...slot,
        original: Boolean(currentTime && slot.time === currentTime),
        available: currentTime && slot.time === currentTime ? false : slot.available,
      }));
      state.loadingSlots = false;
      renderSlots();
    } catch (error) {
      if (error.name === "AbortError" || destroyed) return;
      state.loadingSlots = false;
      state.slotsError = error.message;
      if (area) {
        area.innerHTML = `<div class="slots-placeholder error">${icon("alert", 20)}<span>${escapeHtml(error.message)}</span></div>`;
      }
    }
  }

  function renderSlots() {
    const area = stepContent.querySelector("#slots-area");
    if (!area) return;
    if (!state.slots.length) {
      area.innerHTML = `<div class="slots-placeholder">${icon("clock", 22)}<span>Nenhum horário neste dia. Escolha outra data.</span></div>`;
      return;
    }

    const groups = [
      { label: "Manhã", icon: "sparkles", slots: state.slots.filter((slot) => Number(slot.time.split(":")[0]) < 12) },
      { label: "Tarde", icon: "clock", slots: state.slots.filter((slot) => Number(slot.time.split(":")[0]) >= 12) },
    ];

    area.innerHTML = groups
      .filter((group) => group.slots.length)
      .map(
        (group) => `
        <div class="slot-group">
          <span class="slot-group-label">${group.label}</span>
          <div class="slot-grid">
            ${group.slots
              .map(
                (slot) => `
                <button type="button" class="slot ${state.time === slot.time ? "selected" : ""} ${slot.original ? "original" : ""}" data-time="${slot.time}" ${slot.available ? "" : "disabled"}>
                  ${slot.time}
                  ${slot.original ? '<span class="slot-tag">atual</span>' : !slot.available ? '<span class="slot-tag">ocupado</span>' : ""}
                </button>
              `,
              )
              .join("")}
          </div>
        </div>
      `,
      )
      .join("");

    area.querySelectorAll("[data-time]").forEach((button) => {
      button.addEventListener("click", () => {
        const slot = state.slots.find((item) => item.time === button.dataset.time);
        if (!slot || !slot.available || slot.original) return;
        state.time = button.dataset.time;
        area.querySelectorAll(".slot").forEach((slot) => slot.classList.toggle("selected", slot.dataset.time === state.time));
        stepContent.querySelector("#next-step").disabled = false;
        renderSummary();
      });
    });
  }

  // ------------------------------------------------------------------ step 3
  function renderConfirm() {
    const selected = service();
    const isReschedule = Boolean(reschedule);
    stepContent.innerHTML = `
      <div class="wizard-head">
        <span class="eyebrow">Etapa 3 de 3</span>
        <h2>${isReschedule ? "Confirme seu novo horário" : "Confirme seu agendamento"}</h2>
        <p>${
          isReschedule
            ? "Revise os detalhes abaixo. O serviço continua o mesmo e o horário anterior será liberado."
            : "Revise os detalhes abaixo. Você receberá o link da reunião por e-mail."
        }</p>
      </div>

      <div class="confirm-card">
        <div class="confirm-top">
          <span class="confirm-icon ${selected.color}">${icon(selected.icon, 24)}</span>
          <div>
            <h3>${escapeHtml(selected.name)}</h3>
            <p>${escapeHtml(selected.description)}</p>
          </div>
          <span class="badge badge-confirmed">${icon("check", 12)} Selecionado</span>
        </div>
        <div class="confirm-grid">
          <div><small>Data</small><strong>${formatDate(state.date)}</strong></div>
          <div><small>Horário</small><strong>${state.time} – ${addMinutes(state.time, selected.duration_min)}</strong></div>
          <div><small>Duração</small><strong>${durationLabel(selected.duration_min)}</strong></div>
          <div><small>Investimento</small><strong>${formatCurrency(selected.price_cents)}</strong></div>
        </div>
        ${
          isReschedule
            ? `<div class="reschedule-note">${icon("refresh", 14)}
                <span>Antes: <strong>${formatDate(reschedule.date)} às ${reschedule.time}</strong> · Agora: <strong>${formatDate(state.date)} às ${state.time}</strong></span>
              </div>`
            : ""
        }
      </div>

      <label class="field">
        <span>Algo que devemos saber? <small class="optional">(opcional)</small></span>
        <textarea id="notes" rows="4" maxlength="800" placeholder="Conte um pouco sobre seu contexto, ferramentas que usa e o que espera da sessão...">${escapeHtml(state.notes)}</textarea>
      </label>

      <div class="confirm-info">
        <span>${icon("workflow", 16)}</span>
        <p>Se o n8n estiver conectado, este agendamento dispara automaticamente o evento <code>${isReschedule ? "appointment.rescheduled" : "appointment.created"}</code>.</p>
      </div>

      <div class="wizard-actions">
        <button class="btn btn-ghost" id="back-step">${icon("chevron-right", 16, "flip")} Voltar</button>
        <button class="btn btn-primary btn-lg" id="confirm-btn">${icon("check", 17)} ${isReschedule ? "Reagendar atendimento" : "Confirmar agendamento"}</button>
      </div>
    `;

    const notes = stepContent.querySelector("#notes");
    notes.addEventListener("input", () => {
      state.notes = notes.value;
    });

    stepContent.querySelector("#back-step").addEventListener("click", () => {
      state.step = 2;
      renderStep();
    });

    const confirmBtn = stepContent.querySelector("#confirm-btn");
    confirmBtn.addEventListener("click", async () => {
      state.notes = notes.value;
      setLoading(confirmBtn, true, isReschedule ? "Reagendando..." : "Confirmando...");
      const payload = { date: state.date, time: state.time, notes: state.notes };
      try {
        const response = isReschedule
          ? await api.rescheduleAppointment(reschedule.id, payload)
          : await api.createAppointment({ service_id: state.serviceId, ...payload });
        renderSuccess(response.appointment, response.n8n?.configured, isReschedule, response.previous);
      } catch (error) {
        toast(error.message, "error");
        setLoading(confirmBtn, false);
        if (error.status === 409) {
          state.time = "";
          state.step = 2;
          renderStep();
          loadSlots();
        }
      }
    });
  }

  function renderSuccess(appointment, n8nConfigured, isReschedule = false, previous = null) {
    const selected = appointment.service;
    const confetti = Array.from({ length: 22 }, (_, index) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.6;
      const duration = 1.8 + Math.random() * 1.4;
      const color = ["#8b5cf6", "#22d3ee", "#34d399", "#fbbf24"][index % 4];
      return `<i style="left:${left}%;animation-delay:${delay}s;animation-duration:${duration}s;background:${color}"></i>`;
    }).join("");

    root.innerHTML = `
      <div class="success-wrap">
        <div class="confetti" aria-hidden="true">${confetti}</div>
        <div class="success-card">
          <div class="success-check">${icon("check", 34)}</div>
          <span class="eyebrow">${isReschedule ? "Horário atualizado" : "Tudo certo"}</span>
          <h2>${isReschedule ? "Horário reagendado!" : "Agendamento confirmado!"}</h2>
          <p>${
            isReschedule
              ? `Seu atendimento foi movido. Enviamos os novos detalhes para <strong>${escapeHtml(ctx.user.email)}</strong>.`
              : `Enviamos os detalhes para <strong>${escapeHtml(ctx.user.email)}</strong>.`
          }</p>

          <div class="success-summary">
            <div class="success-service">
              <span class="service-icon ${selected.color}">${icon(selected.icon, 20)}</span>
              <div><strong>${escapeHtml(selected.name)}</strong><small>${durationLabel(selected.duration_min)} · Online</small></div>
            </div>
            <div class="success-when">
              <div><small>Data</small><strong>${formatDate(appointment.date)}</strong></div>
              <div><small>Horário</small><strong>${appointment.time} – ${appointment.end_time}</strong></div>
            </div>
            ${
              isReschedule && previous
                ? `<div class="success-previous">${icon("clock", 13)}
                    <span>Horário anterior: ${formatDate(previous.date)} às ${previous.time} – ${previous.end_time}</span>
                  </div>`
                : ""
            }
          </div>

          <div class="success-n8n ${n8nConfigured ? "active" : ""}">
            ${icon(n8nConfigured ? "check" : "workflow", 16)}
            <span>${
              n8nConfigured
                ? "Automação n8n disparada com sucesso."
                : "Dica: conecte o n8n para automatizar avisos, CRM e WhatsApp."
            }</span>
            ${!n8nConfigured ? '<a href="#/app/integracoes">Conectar</a>' : ""}
          </div>

          <div class="success-actions">
            <a class="btn btn-primary" href="#/app/agendamentos">Ver meus agendamentos ${icon("arrow-right", 15)}</a>
            <a class="btn btn-ghost" href="#/app">Voltar ao painel</a>
          </div>
          <small class="success-foot">${icon("calendar", 13)} Precisa de outro horário? Reagende em “Meus agendamentos”.</small>
        </div>
      </div>
    `;
    toast(isReschedule ? "Horário reagendado. Te esperamos no novo horário!" : "Agendamento confirmado. Te esperamos lá!", "success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  renderStep();

  return () => {
    destroyed = true;
    if (abortSlots) abortSlots.abort();
  };
}
