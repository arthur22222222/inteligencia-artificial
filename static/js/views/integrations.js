import { api } from "../api.js";
import { icon } from "../icons.js";
import { escapeHtml, setLoading, toast } from "../ui.js";

const EVENT_LABELS = {
  "user.registered": "Novo usuário",
  "appointment.created": "Agendamento criado",
  "appointment.rescheduled": "Agendamento reagendado",
  "appointment.cancelled": "Agendamento cancelado",
  "integration.test": "Teste de conexão",
};

const PAYLOAD_EXAMPLE = {
  event: "appointment.created",
  source: "nexa-ai",
  sent_at: "2026-10-29T14:32:10+00:00",
  user: {
    id: 12,
    name: "Ana Martins",
    email: "ana@empresa.com",
  },
  appointment: {
    id: 48,
    date: "2026-11-05",
    time: "14:00",
    end_time: "15:30",
    status: "confirmed",
    notes: "Integrar CRM + WhatsApp",
    service: {
      id: 2,
      name: "Automação com n8n",
      duration_min: 90,
      price_cents: 89000,
      description: "Construímos juntos um fluxo real conectando seus apps, agentes e dados.",
      icon: "workflow",
      color: "cyan",
    },
  },
};

function formatLogTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function renderIntegrations(root, ctx) {
  let integration = { configured: false, webhook_url: "", logs: [] };
  try {
    integration = await api.integration();
  } catch (error) {
    toast(error.message, "error");
  }

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h2>Conecte a Nexa ao seu n8n.</h2>
        <p class="muted">Cada agendamento vira um evento no seu fluxo — sem código e sem trabalho manual.</p>
      </div>
      <span class="conn-status ${integration.configured ? "on" : "off"}" id="conn-status">
        <span class="status-dot"></span> ${integration.configured ? "Webhook conectado" : "Não configurado"}
      </span>
    </div>

    <div class="integration-grid">
      <section class="panel integration-form-card">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Webhook</span>
            <h3>URL de destino no n8n</h3>
          </div>
          <a class="text-link" href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/" target="_blank" rel="noopener">
            Docs ${icon("external", 13)}
          </a>
        </div>

        <form id="webhook-form">
          <label class="field">
            <span>Production Webhook URL</span>
            <div class="input-wrap">
              ${icon("link", 17)}
              <input
                type="url"
                id="webhook-url"
                name="webhook_url"
                placeholder="https://n8n.seudominio.com/webhook/nexa-agenda"
                value="${escapeHtml(integration.webhook_url || "")}"
                autocomplete="off"
                spellcheck="false"
              />
            </div>
            <small class="field-hint">No n8n: adicione um nó <strong>Webhook</strong>, método POST, e copie a Production URL.</small>
          </label>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="save-btn">${icon("check", 15)} Salvar webhook</button>
            <button type="button" class="btn btn-glass" id="test-btn">${icon("zap", 15)} Testar conexão</button>
          </div>
          <div id="test-result" class="test-result" hidden></div>
        </form>

        <div class="events-box">
          <span class="events-title">Eventos enviados automaticamente</span>
          <div class="event-chips">
            <span class="event-chip">${icon("user", 12)} user.registered</span>
            <span class="event-chip">${icon("calendar", 12)} appointment.created</span>
            <span class="event-chip">${icon("refresh", 12)} appointment.rescheduled</span>
            <span class="event-chip">${icon("x", 12)} appointment.cancelled</span>
          </div>
        </div>
      </section>

      <aside class="integration-side">
        <div class="panel mini-steps">
          <span class="eyebrow">Passo a passo</span>
          <h3>Do zero ao fluxo ativo</h3>
          <ol class="mini-step-list">
            <li><span>1</span><p><strong>Crie um Webhook no n8n</strong>Aponte o método para POST.</p></li>
            <li><span>2</span><p><strong>Cole a URL ao lado</strong>Use a Production URL do nó.</p></li>
            <li><span>3</span><p><strong>Teste e ative</strong>Rode um teste e veja o log.</p></li>
          </ol>
          <a class="btn btn-ghost btn-block btn-sm" href="/n8n/workflow-example.json" download>
            ${icon("download", 15)} Baixar workflow de exemplo
          </a>
        </div>

        <div class="panel payload-card">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">Payload</span>
              <h3>Exemplo de evento</h3>
            </div>
            <button class="icon-btn" id="copy-payload" title="Copiar JSON" aria-label="Copiar JSON">${icon("copy", 15)}</button>
          </div>
          <pre class="code-block"><code>${escapeHtml(JSON.stringify(PAYLOAD_EXAMPLE, null, 2))}</code></pre>
        </div>
      </aside>
    </div>

    <section class="panel logs-card">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Monitoramento</span>
          <h3>Últimas entregas</h3>
        </div>
        <button class="btn btn-ghost btn-sm" id="refresh-logs">${icon("refresh", 14)} Atualizar</button>
      </div>
      <div id="logs-area">${renderLogs(integration.logs)}</div>
    </section>

    <div class="notice subtle">
      <span class="notice-icon">${icon("shield", 18)}</span>
      <div>
        <strong>Dica de segurança</strong>
        <p>Use HTTPS e, no n8n, valide o header <code>X-Webhook-Source: nexa-ai</code>. A configuração vale para todo o workspace.</p>
      </div>
    </div>
  `;

  const form = root.querySelector("#webhook-form");
  const input = root.querySelector("#webhook-url");
  const saveBtn = root.querySelector("#save-btn");
  const testBtn = root.querySelector("#test-btn");
  const resultBox = root.querySelector("#test-result");
  const statusPill = root.querySelector("#conn-status");
  const logsArea = root.querySelector("#logs-area");

  function renderLogs(logs) {
    if (!logs || !logs.length) {
      return `<div class="logs-empty">${icon("clock", 20)}<span>Nenhuma entrega registrada ainda. Salve a URL e clique em “Testar conexão”.</span></div>`;
    }
    return `<div class="log-table">
      ${logs
        .map(
          (log) => `
          <div class="log-row">
            <span class="log-state ${log.status === "success" ? "ok" : log.status === "skipped" ? "skip" : "err"}">
              ${icon(log.status === "success" ? "check" : log.status === "skipped" ? "clock" : "alert", 12)}
            </span>
            <span class="log-event">
              <strong>${escapeHtml(EVENT_LABELS[log.event] || log.event)}</strong>
              <small>${escapeHtml(log.event)}</small>
            </span>
            <span class="log-detail">${escapeHtml(log.detail || "—")}</span>
            <span class="log-code">${log.status_code ?? "—"}</span>
            <span class="log-time">${formatLogTime(log.created_at)}</span>
          </div>
        `,
        )
        .join("")}
    </div>`;
  }

  function setConnected(configured) {
    statusPill.className = `conn-status ${configured ? "on" : "off"}`;
    statusPill.innerHTML = `<span class="status-dot"></span> ${configured ? "Webhook conectado" : "Não configurado"}`;
  }

  async function refreshLogs() {
    try {
      const data = await api.integration();
      logsArea.innerHTML = renderLogs(data.logs);
      setConnected(data.configured);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = input.value.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast("A URL deve começar com http:// ou https://", "error");
      input.focus();
      return;
    }
    setLoading(saveBtn, true, "Salvando...");
    try {
      await api.saveIntegration(url);
      setConnected(Boolean(url));
      toast(url ? "Webhook salvo com sucesso." : "Webhook removido.", "success");
      await refreshLogs();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setLoading(saveBtn, false);
    }
  });

  testBtn.addEventListener("click", async () => {
    const url = input.value.trim();
    if (!url) {
      toast("Informe a URL do webhook antes de testar.", "info");
      input.focus();
      return;
    }
    setLoading(testBtn, true, "Testando...");
    resultBox.hidden = true;
    try {
      const result = await api.testIntegration(url);
      resultBox.hidden = false;
      resultBox.className = `test-result ${result.ok ? "ok" : "error"}`;
      resultBox.innerHTML = `
        ${icon(result.ok ? "check" : "alert", 16)}
        <span><strong>${result.ok ? "Conexão bem-sucedida!" : "Não foi possível entregar"}</strong>
        ${escapeHtml(result.detail || (result.ok ? "O n8n recebeu o evento de teste." : "Verifique a URL e se o workflow está ativo."))}</span>
      `;
      toast(result.ok ? "O n8n recebeu o evento de teste." : "Falha no teste do webhook.", result.ok ? "success" : "error");
      await refreshLogs();
    } catch (error) {
      resultBox.hidden = false;
      resultBox.className = "test-result error";
      resultBox.innerHTML = `${icon("alert", 16)}<span><strong>Falha na conexão</strong>${escapeHtml(error.message)}</span>`;
      toast(error.message, "error");
      await refreshLogs();
    } finally {
      setLoading(testBtn, false);
    }
  });

  root.querySelector("#refresh-logs").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    setLoading(button, true, "Atualizando...");
    await refreshLogs();
    setLoading(button, false);
  });

  root.querySelector("#copy-payload").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(PAYLOAD_EXAMPLE, null, 2));
      toast("Payload copiado para a área de transferência.", "success");
    } catch {
      toast("Não foi possível copiar automaticamente.", "error");
    }
  });

  return () => {};
}
