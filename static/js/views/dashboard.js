import { api } from "../api.js";
import { icon } from "../icons.js";
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  durationLabel,
  greeting,
  statusBadge,
  toast,
  emptyState,
} from "../ui.js";

function appointmentDate(appointment) {
  return new Date(`${appointment.date}T${appointment.time}:00`);
}

function statCard({ label, value, sub, iconName, tone, href = "" }) {
  const content = `
    <span class="stat-icon ${tone}">${icon(iconName, 19)}</span>
    <span class="stat-label">${label}</span>
    <strong class="stat-value">${value}</strong>
    <span class="stat-sub">${sub}</span>
  `;
  return href
    ? `<a class="stat-card" href="${href}">${content}${icon("arrow-up-right", 15, "stat-arrow")}</a>`
    : `<div class="stat-card">${content}</div>`;
}

function skeleton() {
  return `<div class="dashboard-loading">
    <div class="skeleton skeleton-title"></div>
    <div class="stats-grid">${Array.from({ length: 4 }, () => '<div class="skeleton skeleton-stat"></div>').join("")}</div>
    <div class="dash-grid"><div class="skeleton skeleton-panel"></div><div class="skeleton skeleton-panel"></div></div>
  </div>`;
}

export async function renderDashboard(root, ctx) {
  root.innerHTML = skeleton();

  let appointments = [];
  let integration = { configured: false, webhook_url: "" };
  try {
    const [appointmentsResponse, integrationResponse] = await Promise.all([
      api.appointments(),
      api.integration().catch(() => ({ configured: false, webhook_url: "" })),
    ]);
    appointments = appointmentsResponse.appointments;
    integration = integrationResponse;
  } catch (error) {
    root.innerHTML = emptyState({
      iconName: "alert",
      title: "Não foi possível carregar o painel",
      text: error.message,
      action: '<button class="btn btn-primary" onclick="location.reload()">Tentar novamente</button>',
    });
    toast(error.message, "error");
    return () => {};
  }

  const now = new Date();
  const confirmed = appointments
    .filter((item) => item.status === "confirmed")
    .sort((a, b) => appointmentDate(a) - appointmentDate(b));
  const upcoming = confirmed.filter((item) => appointmentDate(item) >= now);
  const next = upcoming[0];
  const completed = appointments.filter((item) => item.status === "completed" || (item.status === "confirmed" && appointmentDate(item) < now));
  const cancelled = appointments.filter((item) => item.status === "cancelled");
  const firstName = escapeHtml(ctx.user.name.split(" ")[0]);

  const recent = appointments
    .slice()
    .sort((a, b) => appointmentDate(b) - appointmentDate(a))
    .slice(0, 5);

  root.innerHTML = `
    <div class="dash-head">
      <div>
        <h2>${greeting()}, ${firstName} <span class="wave">👋</span></h2>
        <p class="muted">Aqui está o resumo da sua operação hoje, ${formatDate(
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
          { withWeekday: true },
        )}.</p>
      </div>
      <div class="dash-head-actions">
        <a class="btn btn-glass btn-sm" href="#/app/integracoes">${icon("workflow", 15)} n8n</a>
        <a class="btn btn-primary btn-sm" href="#/app/agendar">${icon("plus", 15)} Agendar sessão</a>
      </div>
    </div>

    ${
      !integration.configured
        ? `<div class="notice">
            <span class="notice-icon">${icon("workflow", 18)}</span>
            <div><strong>Sua automação ainda não está conectada.</strong>
            <p>Cada agendamento pode disparar um fluxo no n8n automaticamente.</p></div>
            <a class="btn btn-glass btn-sm" href="#/app/integracoes">Conectar agora</a>
          </div>`
        : ""
    }

    <div class="stats-grid">
      ${statCard({
        label: "Próximo atendimento",
        value: next ? formatDate(next.date, { short: true }) : "—",
        sub: next ? `${next.time} · ${next.service.name}` : "Nenhum horário marcado",
        iconName: "calendar",
        tone: "violet",
        href: "#/app/agendamentos",
      })}
      ${statCard({
        label: "Agendamentos ativos",
        value: upcoming.length,
        sub: upcoming.length === 1 ? "sessão confirmada" : "sessões confirmadas",
        iconName: "clock",
        tone: "cyan",
        href: "#/app/agendamentos",
      })}
      ${statCard({
        label: "Sessões concluídas",
        value: completed.length,
        sub: `${cancelled.length} cancelada${cancelled.length === 1 ? "" : "s"}`,
        iconName: "check",
        tone: "emerald",
        href: "#/app/agendamentos",
      })}
      ${statCard({
        label: "Integração n8n",
        value: integration.configured ? "Ativa" : "Inativa",
        sub: integration.configured ? "webhook configurado" : "configure seu webhook",
        iconName: "workflow",
        tone: integration.configured ? "emerald" : "amber",
        href: "#/app/integracoes",
      })}
    </div>

    <div class="dash-grid">
      <section class="panel dash-next">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">A seguir</span>
            <h3>Seu próximo atendimento</h3>
          </div>
          <a class="text-link" href="#/app/agendamentos">Ver todos ${icon("arrow-right", 13)}</a>
        </div>
        ${
          next
            ? `<div class="next-card">
                <div class="next-date">
                  <span>${formatDate(next.date, { short: true, uppercase: true }).split(" ")[1]}</span>
                  <strong>${String(new Date(`${next.date}T12:00:00`).getDate()).padStart(2, "0")}</strong>
                </div>
                <div class="next-info">
                  <div class="next-top">
                    <span class="badge badge-confirmed">${icon("check", 12)} Confirmado</span>
                    <span class="muted">${icon("clock", 13)} ${next.time} – ${next.end_time} · ${durationLabel(next.service.duration_min)}</span>
                  </div>
                  <h4>${escapeHtml(next.service.name)}</h4>
                  <p>${escapeHtml(next.service.description)}</p>
                  <div class="next-meta">
                    <span>${icon("video", 14)} Online · link enviado por e-mail</span>
                    <span>${icon("user", 14)} ${escapeHtml(ctx.user.name)}</span>
                    <span class="price-tag">${formatCurrency(next.service.price_cents)}</span>
                  </div>
                  ${next.notes ? `<div class="next-notes">${icon("sparkles", 13)} <span>${escapeHtml(next.notes)}</span></div>` : ""}
                </div>
              </div>
              <div class="next-actions">
                <a class="btn btn-primary btn-sm" href="#/app/agendamentos">Gerenciar agendamento</a>
                <a class="btn btn-ghost btn-sm" href="#/app/agendar?reschedule=${next.id}">Reagendar</a>
              </div>`
            : `<div class="next-empty">
                ${emptyState({
                  iconName: "calendar",
                  title: "Nenhum atendimento marcado",
                  text: "Escolha um serviço e reserve seu próximo horário em menos de 1 minuto.",
                  action: `<a class="btn btn-primary btn-sm" href="#/app/agendar">${icon("plus", 15)} Agendar agora</a>`,
                })}
              </div>`
        }
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Atalhos</span>
            <h3>Ações rápidas</h3>
          </div>
        </div>
        <div class="quick-actions">
          <a class="quick-action" href="#/app/agendar">
            <span class="quick-icon violet">${icon("calendar", 18)}</span>
            <span><strong>Novo agendamento</strong><small>Reserve uma sessão</small></span>
            ${icon("chevron-right", 16)}
          </a>
          <a class="quick-action" href="#/app/agendamentos">
            <span class="quick-icon cyan">${icon("clock", 18)}</span>
            <span><strong>Meus agendamentos</strong><small>Veja e cancele horários</small></span>
            ${icon("chevron-right", 16)}
          </a>
          <a class="quick-action" href="#/app/integracoes">
            <span class="quick-icon ${integration.configured ? "emerald" : "amber"}">${icon("workflow", 18)}</span>
            <span><strong>Integração n8n</strong><small>${integration.configured ? "Webhook ativo" : "Configure em 2 minutos"}</small></span>
            ${icon("chevron-right", 16)}
          </a>
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Atividade</span>
          <h3>Histórico recente</h3>
        </div>
        <a class="text-link" href="#/app/agendamentos">Ver histórico ${icon("arrow-right", 13)}</a>
      </div>
      ${
        recent.length
          ? `<div class="activity-list">
              ${recent
                .map(
                  (item) => `<div class="activity-item">
                    <span class="activity-dot ${item.status}"></span>
                    <div class="activity-main">
                      <strong>${escapeHtml(item.service.name)}</strong>
                      <small>${formatDate(item.date, { withWeekday: true })} · ${item.time} · ${formatCurrency(item.service.price_cents)}</small>
                    </div>
                    ${statusBadge(item.status === "confirmed" && appointmentDate(item) < new Date() ? "completed" : item.status)}
                  </div>`,
                )
                .join("")}
            </div>`
          : emptyState({
              iconName: "clock",
              title: "Nenhuma atividade ainda",
              text: "Seus agendamentos aparecerão aqui.",
            })
      }
    </section>
  `;

  return () => {};
}
