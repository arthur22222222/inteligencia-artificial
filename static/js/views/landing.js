import { icon } from "../icons.js";
import { revealOnScroll, setLoading, toast } from "../ui.js";
import { api } from "../api.js";

export function renderLanding(root, ctx) {
  root.innerHTML = `
  <section class="hero">
    <div class="hero-bg" aria-hidden="true">
      <span class="orb orb-violet"></span>
      <span class="orb orb-cyan"></span>
      <span class="grid-lines"></span>
    </div>

    <div class="container hero-grid">
      <div class="hero-copy" data-reveal>
        <span class="pill"><span class="ping"></span> Novo · Agentes autônomos com n8n</span>
        <h1>Contrate um time de <span class="grad-text">IA que executa</span>.</h1>
        <p class="hero-sub">
          A Nexa conecta agentes inteligentes à sua operação: atende, qualifica, agenda e
          dispara automações no n8n. Tudo funcionando 24 horas por dia — sem contratar mais gente.
        </p>
        <div class="hero-cta">
          <a class="btn btn-primary btn-lg" href="#/register">
            Começar grátis ${icon("arrow-right", 17)}
          </a>
          <button class="btn btn-glass btn-lg" id="demo-btn">
            ${icon("play", 15)} Ver demo ao vivo
          </button>
        </div>
        <div class="hero-proof">
          <div class="avatar-stack">
            <span class="avatar avatar-sm tone-a">LM</span>
            <span class="avatar avatar-sm tone-b">RC</span>
            <span class="avatar avatar-sm tone-c">BS</span>
            <span class="avatar avatar-sm tone-d">+2k</span>
          </div>
          <div class="proof-text">
            <span class="stars">${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}</span>
            <span>4,9/5 · +2.400 operações automatizadas</span>
          </div>
        </div>
      </div>

      <div class="hero-visual" data-reveal>
        <div class="console-glow" aria-hidden="true"></div>
        <div class="console">
          <div class="console-top">
            <span class="console-dots"><i></i><i></i><i></i></span>
            <span class="console-title">${icon("sparkles", 14)} Nexa Console</span>
            <span class="live-pill"><span></span> ao vivo</span>
          </div>
          <div class="console-body">
            <div class="chat-bubble user">
              Quero automatizar o agendamento da clínica e avisar no WhatsApp.
            </div>
            <div class="chat-bubble ai">
              <span class="ai-tag">${icon("bot", 13)} Nexa Agent</span>
              Perfeito, Ana. Montei um fluxo com 3 etapas:
              <div class="agent-steps">
                <span>01 · Captura de dados</span>
                <span>02 · Agenda inteligente</span>
                <span>03 · Aviso via n8n</span>
              </div>
              <span class="agent-note">${icon("check", 13)} Fluxo pronto para aprovar</span>
            </div>
            <div class="node-preview">
              <span class="node active">${icon("globe", 14)} Webhook</span>
              <span class="node-line"></span>
              <span class="node">${icon("bot", 14)} Agente</span>
              <span class="node-line"></span>
              <span class="node">${icon("send", 14)} WhatsApp</span>
            </div>
            <div class="console-input">
              <span>Pergunte qualquer coisa à Nexa…</span>
              <span class="console-send">${icon("arrow-right", 15)}</span>
            </div>
          </div>
        </div>
        <div class="float-card float-a">
          <span class="float-icon emerald">${icon("clock", 16)}</span>
          <span><strong>+38h</strong><small>economizadas / semana</small></span>
        </div>
        <div class="float-card float-b">
          <span class="float-icon violet">${icon("workflow", 16)}</span>
          <span><strong>n8n conectado</strong><small>1.284 execuções hoje</small></span>
        </div>
      </div>
    </div>

    <div class="container logo-strip" data-reveal>
      <span>Times que já operam com a Nexa</span>
      <div class="logo-row">
        <span>vertex</span><span>lumina</span><span>orbit.co</span><span>dataflow</span><span>nimbus</span>
      </div>
    </div>
  </section>

  <section class="metrics-band">
    <div class="container metrics-grid">
      <div class="metric" data-reveal><strong>92%</strong><span>dos atendimentos resolvidos sem humano</span></div>
      <div class="metric" data-reveal><strong>3,4x</strong><span>mais reuniões qualificadas por mês</span></div>
      <div class="metric" data-reveal><strong>24/7</strong><span>operação ativa, inclusive feriados</span></div>
      <div class="metric" data-reveal><strong>15 min</strong><span>para publicar seu primeiro fluxo</span></div>
    </div>
  </section>

  <section class="section" id="recursos">
    <div class="container">
      <div class="section-head" data-reveal>
        <span class="eyebrow">Recursos</span>
        <h2>Uma plataforma. Toda a sua operação <span class="grad-text">inteligente</span>.</h2>
        <p>Agentes, automações e agenda em um só lugar — conectados ao que você já usa.</p>
      </div>

      <div class="bento">
        <article class="bento-card span-2 tall" data-reveal>
          <div class="card-icon violet">${icon("bot", 20)}</div>
          <h3>Agentes que resolvem de verdade</h3>
          <p>Treinados com o contexto do seu negócio, respondem, qualificam e tomam ações — não só conversam.</p>
          <div class="mini-chat">
            <div class="mini-line user">Vocês atendem no sábado?</div>
            <div class="mini-line ai">${icon("sparkles", 12)} Atendemos! Tenho 10h ou 14h. Quer que eu reserve?</div>
            <div class="mini-line user">Pode ser 14h.</div>
            <div class="mini-line ai success">${icon("check", 12)} Agendado e enviado ao seu WhatsApp.</div>
          </div>
        </article>

        <article class="bento-card span-2" data-reveal>
          <div class="card-icon cyan">${icon("workflow", 20)}</div>
          <h3>Integração nativa com n8n</h3>
          <p>Dispare qualquer fluxo com um webhook. Conecte WhatsApp, CRM, e-mail, Notion e +400 apps.</p>
          <div class="flow-visual">
            <span class="flow-node">${icon("calendar", 14)} Agenda</span>
            <span class="flow-link"></span>
            <span class="flow-node accent">${icon("workflow", 14)} n8n</span>
            <span class="flow-link"></span>
            <span class="flow-node">${icon("send", 14)} Canal</span>
          </div>
        </article>

        <article class="bento-card span-2" data-reveal>
          <div class="card-icon amber">${icon("calendar", 20)}</div>
          <h3>Agenda inteligente</h3>
          <p>Slots validados em tempo real, sem conflito e sem ida e volta de mensagens.</p>
          <div class="mini-calendar" aria-hidden="true">
            <span class="cal-day"><small>SEG</small>12</span>
            <span class="cal-day active"><small>TER</small>13</span>
            <span class="cal-day"><small>QUA</small>14</span>
            <span class="cal-day muted"><small>QUI</small>15</span>
            <span class="cal-day"><small>SEX</small>16</span>
          </div>
        </article>

        <article class="bento-card span-2" data-reveal>
          <div class="card-icon emerald">${icon("chart", 20)}</div>
          <h3>Analytics que importam</h3>
          <p>Acompanhe conversões, tempo economizado e cada automação executada.</p>
          <div class="mini-bars" aria-hidden="true">
            <i style="--h: 34%"></i><i style="--h: 52%"></i><i style="--h: 44%"></i>
            <i style="--h: 72%"></i><i style="--h: 61%"></i><i style="--h: 88%"></i><i style="--h: 96%"></i>
          </div>
        </article>

        <article class="bento-card span-2" data-reveal>
          <div class="card-icon rose">${icon("shield", 20)}</div>
          <h3>Seguro por padrão</h3>
          <p>Senhas com PBKDF2, sessões HttpOnly e seus dados no seu próprio servidor.</p>
          <ul class="check-list">
            <li>${icon("check", 14)} Autenticação protegida</li>
            <li>${icon("check", 14)} Webhooks assinados</li>
            <li>${icon("check", 14)} Deploy self-hosted</li>
          </ul>
        </article>
      </div>
    </div>
  </section>

  <section class="section section-alt" id="como-funciona">
    <div class="container">
      <div class="section-head" data-reveal>
        <span class="eyebrow">Como funciona</span>
        <h2>Do primeiro clique ao fluxo rodando em <span class="grad-text">15 minutos</span>.</h2>
      </div>
      <div class="steps">
        <article class="step" data-reveal>
          <span class="step-number">01</span>
          <div class="step-icon">${icon("user", 22)}</div>
          <h3>Crie sua conta</h3>
          <p>Cadastro em segundos. Sem cartão de crédito e sem burocracia.</p>
        </article>
        <article class="step" data-reveal>
          <span class="step-number">02</span>
          <div class="step-icon">${icon("calendar", 22)}</div>
          <h3>Agende uma sessão</h3>
          <p>Escolha o serviço, o melhor dia e horário disponível na sua agenda.</p>
        </article>
        <article class="step" data-reveal>
          <span class="step-number">03</span>
          <div class="step-icon">${icon("workflow", 22)}</div>
          <h3>Conecte o n8n</h3>
          <p>Cole a URL do webhook e receba cada evento direto no seu fluxo.</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container showcase">
      <div class="showcase-copy" data-reveal>
        <span class="eyebrow">Agenda + automação</span>
        <h2>O agendamento termina. A automação <span class="grad-text">começa</span>.</h2>
        <p>
          No momento em que alguém confirma um horário, a Nexa dispara um evento para o n8n.
          Seu fluxo decide o que fazer: criar evento no Google Calendar, enviar mensagem no
          WhatsApp, registrar no CRM ou notificar o time.
        </p>
        <ul class="feature-list">
          <li><span>${icon("check", 14)}</span> Eventos <code>appointment.created</code> e <code>appointment.cancelled</code></li>
          <li><span>${icon("check", 14)}</span> Payload JSON com usuário, serviço, data e horário</li>
          <li><span>${icon("check", 14)}</span> Logs de entrega e botão de teste dentro do painel</li>
          <li><span>${icon("check", 14)}</span> Suporte a qualquer webhook HTTP/HTTPS</li>
        </ul>
        <a class="btn btn-primary" href="#/register">Quero integrar ${icon("arrow-right", 16)}</a>
      </div>

      <div class="showcase-visual" data-reveal>
        <div class="panel">
          <div class="panel-top">
            <span>${icon("calendar", 15)} Próximo agendamento</span>
            <span class="badge badge-confirmed">${icon("check", 12)} Confirmado</span>
          </div>
          <div class="panel-body">
            <h4>Automação com n8n</h4>
            <p class="muted">quinta, 14 de novembro · 14:00 – 15:30</p>
            <div class="panel-meta">
              <span>${icon("clock", 14)} 90 minutos</span>
              <span>${icon("video", 14)} Online</span>
            </div>
            <div class="panel-flow">
              <span class="flow-node done">${icon("check", 13)} Reserva criada</span>
              <span class="flow-link"></span>
              <span class="flow-node accent">${icon("workflow", 13)} Disparo n8n</span>
              <span class="flow-link"></span>
              <span class="flow-node">${icon("send", 13)} WhatsApp</span>
            </div>
            <div class="panel-log">
              <span class="log-dot"></span>
              <code>200 OK · 128ms · evento entregue</code>
            </div>
          </div>
        </div>
        <div class="float-card showcase-float">
          <span class="float-icon cyan">${icon("zap", 16)}</span>
          <span><strong>Zero trabalho manual</strong><small>cada evento vira ação</small></span>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-alt" id="precos">
    <div class="container">
      <div class="section-head" data-reveal>
        <span class="eyebrow">Planos</span>
        <h2>Comece de graça. Cresça no seu ritmo.</h2>
        <p>Troque ou cancele quando quiser. Todos os planos incluem a agenda inteligente.</p>
      </div>
      <div class="pricing">
        <article class="price-card" data-reveal>
          <span class="plan-name">Starter</span>
          <div class="price"><span>R$</span>0<small>/mês</small></div>
          <p>Para testar a Nexa e organizar sua agenda.</p>
          <ul>
            <li>${icon("check", 14)} 1 usuário</li>
            <li>${icon("check", 14)} 30 agendamentos/mês</li>
            <li>${icon("check", 14)} 1 webhook n8n</li>
            <li>${icon("check", 14)} Dashboard básico</li>
          </ul>
          <a class="btn btn-ghost btn-block" href="#/register">Começar grátis</a>
        </article>

        <article class="price-card featured" data-reveal>
          <span class="plan-badge">Mais popular</span>
          <span class="plan-name">Growth</span>
          <div class="price"><span>R$</span>297<small>/mês</small></div>
          <p>Para times que querem operação rodando sozinha.</p>
          <ul>
            <li>${icon("check", 14)} Até 5 usuários</li>
            <li>${icon("check", 14)} Agendamentos ilimitados</li>
            <li>${icon("check", 14)} 10 webhooks n8n</li>
            <li>${icon("check", 14)} Agentes com contexto</li>
            <li>${icon("check", 14)} Logs e testes de integração</li>
          </ul>
          <a class="btn btn-primary btn-block" href="#/register">Começar agora ${icon("arrow-right", 15)}</a>
        </article>

        <article class="price-card" data-reveal>
          <span class="plan-name">Scale</span>
          <div class="price"><span>R$</span>897<small>/mês</small></div>
          <p>Para operações com múltiplas unidades e canais.</p>
          <ul>
            <li>${icon("check", 14)} Usuários ilimitados</li>
            <li>${icon("check", 14)} Webhooks ilimitados</li>
            <li>${icon("check", 14)} SSO e auditoria</li>
            <li>${icon("check", 14)} Suporte prioritário</li>
            <li>${icon("check", 14)} Onboarding dedicado</li>
          </ul>
          <a class="btn btn-ghost btn-block" href="#/register">Falar com vendas</a>
        </article>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head" data-reveal>
        <span class="eyebrow">Depoimentos</span>
        <h2>Quem automatizou, não volta atrás.</h2>
      </div>
      <div class="testimonials">
        <article class="testimonial" data-reveal>
          <span class="stars">${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}</span>
          <p>“Em duas semanas o tempo de resposta caiu de 4 horas para 40 segundos. A agenda parou de ferrar o time comercial.”</p>
          <div class="testimonial-author">
            <span class="avatar tone-a">LM</span>
            <span><strong>Larissa Moreira</strong><small>COO · Lumina Health</small></span>
          </div>
        </article>
        <article class="testimonial" data-reveal>
          <span class="stars">${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}</span>
          <p>“O webhook com n8n mudou o jogo. Cada agendamento cai no CRM, no Google Calendar e no WhatsApp sem ninguém tocar em nada.”</p>
          <div class="testimonial-author">
            <span class="avatar tone-b">RC</span>
            <span><strong>Rafael Costa</strong><small>Founder · Orbit.co</small></span>
          </div>
        </article>
        <article class="testimonial" data-reveal>
          <span class="stars">${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}${icon("star", 14)}</span>
          <p>“Testei várias ferramentas. A Nexa foi a única em que eu entendi tudo em 15 minutos e já vi valor no mesmo dia.”</p>
          <div class="testimonial-author">
            <span class="avatar tone-c">BS</span>
            <span><strong>Beatriz Silva</strong><small>Head de Ops · Dataflow</small></span>
          </div>
        </article>
      </div>
    </div>
  </section>

  <section class="section section-alt" id="faq">
    <div class="container faq-wrap">
      <div class="faq-intro" data-reveal>
        <span class="eyebrow">FAQ</span>
        <h2>Dúvidas frequentes</h2>
        <p>Não achou o que procurava? Fale com a gente em <a href="mailto:oi@nexa.ai">oi@nexa.ai</a>.</p>
      </div>
      <div class="faq-list" data-reveal>
        <details class="faq-item" open>
          <summary>Preciso saber programar para usar?${icon("chevron-down", 18)}</summary>
          <p>Não. A agenda, o cadastro e o painel funcionam sem código. Para automações mais avançadas no n8n, você pode importar um fluxo pronto e só ajustar as conexões.</p>
        </details>
        <details class="faq-item">
          <summary>Como funciona a integração com o n8n?${icon("chevron-down", 18)}</summary>
          <p>Você cria um Webhook no n8n, copia a URL e cola no painel de Integrações. A partir daí, cada cadastro ou agendamento envia um JSON com os dados do evento para o seu fluxo.</p>
        </details>
        <details class="faq-item">
          <summary>Meus dados ficam seguros?${icon("chevron-down", 18)}</summary>
          <p>Sim. As senhas são armazenadas com PBKDF2 e as sessões usam cookies HttpOnly. O projeto roda no seu próprio servidor, com banco SQLite local — você tem controle total.</p>
        </details>
        <details class="faq-item">
          <summary>Posso cancelar um agendamento?${icon("chevron-down", 18)}</summary>
          <p>Sim, direto em “Meus agendamentos”. O cancelamento libera o horário e dispara o evento <code>appointment.cancelled</code> para o n8n.</p>
        </details>
        <details class="faq-item">
          <summary>Qual o horário de atendimento?${icon("chevron-down", 18)}</summary>
          <p>Atendemos de segunda a sexta, das 9h às 18h. Os horários são validados em tempo real para evitar conflitos entre sessões.</p>
        </details>
      </div>
    </div>
  </section>

  <section class="cta-section">
    <div class="container">
      <div class="cta-box" data-reveal>
        <span class="orb orb-violet cta-orb" aria-hidden="true"></span>
        <span class="eyebrow">Pronto para começar?</span>
        <h2>Coloque sua operação para <span class="grad-text">trabalhar sozinha</span>.</h2>
        <p>Crie sua conta e agende a primeira sessão em menos de 2 minutos.</p>
        <div class="hero-cta center">
          <a class="btn btn-primary btn-lg" href="#/register">Criar conta grátis ${icon("arrow-right", 17)}</a>
          <a class="btn btn-glass btn-lg" href="#/login">Já tenho conta</a>
        </div>
        <small>Sem cartão de crédito · Cancele quando quiser</small>
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        ${icon("sparkles", 15)}
        <span class="logo-word">nexa<span>ai</span></span>
        <p>Inteligência que executa. Agentes, automações e agenda para times que querem escalar sem inchar.</p>
        <div class="footer-socials">
          <a href="#/register" aria-label="Instagram">${icon("globe", 16)}</a>
          <a href="mailto:oi@nexa.ai" aria-label="E-mail">${icon("mail", 16)}</a>
          <a href="#/app/integracoes" aria-label="Integrações">${icon("workflow", 16)}</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Produto</h4>
        <a href="#recursos" data-scroll="recursos">Recursos</a>
        <a href="#precos" data-scroll="precos">Planos</a>
        <a href="#/app/agendar">Agendamento</a>
        <a href="#/app/integracoes">Integrações</a>
      </div>
      <div class="footer-col">
        <h4>Empresa</h4>
        <a href="#como-funciona" data-scroll="como-funciona">Como funciona</a>
        <a href="#faq" data-scroll="faq">FAQ</a>
        <a href="mailto:oi@nexa.ai">Contato</a>
        <a href="#/register">Trabalhe com a gente</a>
      </div>
      <div class="footer-col">
        <h4>Legal</h4>
        <a href="#faq" data-scroll="faq">Privacidade</a>
        <a href="#faq" data-scroll="faq">Termos de uso</a>
        <a href="#faq" data-scroll="faq">Segurança</a>
        <a href="#/app/integracoes">Status</a>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© ${new Date().getFullYear()} Nexa AI. Todos os direitos reservados.</span>
      <span class="footer-status"><span class="status-dot"></span> Todos os sistemas operacionais</span>
    </div>
  </footer>
  `;

  revealOnScroll(root);

  const demoBtn = root.querySelector("#demo-btn");
  demoBtn?.addEventListener("click", async () => {
    setLoading(demoBtn, true, "Entrando...");
    try {
      const data = await api.login({ email: "demo@nexa.ai", password: "demo1234" });
      ctx.setUser(data.user);
      toast("Bem-vindo à conta demo!", "success", "Acesso liberado");
      ctx.navigate("/app");
    } catch (error) {
      toast(error.message, "error");
      setLoading(demoBtn, false);
    }
  });

  return () => {};
}
