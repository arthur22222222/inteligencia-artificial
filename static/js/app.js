import { api } from "./api.js";
import { icon, logo } from "./icons.js";
import { initials, toast, scrollToTop } from "./ui.js";
import { renderLanding } from "./views/landing.js";
import { renderAuth } from "./views/auth.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderSchedule } from "./views/schedule.js";
import { renderAppointments } from "./views/appointments.js";
import { renderIntegrations } from "./views/integrations.js";

const app = document.getElementById("app");

const state = {
  user: null,
  ready: false,
  cleanup: null,
};

const pageTitles = {
  "/app": { title: "Visão geral", eyebrow: "Workspace" },
  "/app/agendar": { title: "Novo agendamento", eyebrow: "Agenda" },
  "/app/agendamentos": { title: "Meus agendamentos", eyebrow: "Agenda" },
  "/app/integracoes": { title: "Integrações", eyebrow: "Automação" },
};

const appNav = [
  { path: "/app", label: "Visão geral", icon: "grid" },
  { path: "/app/agendar", label: "Agendar", icon: "calendar" },
  { path: "/app/agendamentos", label: "Meus agendamentos", icon: "clock" },
  { path: "/app/integracoes", label: "Integrações", icon: "plug" },
];

const landingAnchors = new Set(["recursos", "como-funciona", "precos", "faq"]);

export function navigate(path, { replace = false } = {}) {
  const hash = `#${path}`;
  if (location.hash === hash) {
    route();
    return;
  }
  if (replace) history.replaceState(null, "", hash);
  else location.hash = hash;
  if (replace) route();
}

function currentPath() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw || raw === "/") return "/";
  return raw.split("?")[0].replace(/\/+$/, "") || "/";
}

function isAppRoute(path) {
  return path === "/app" || path.startsWith("/app/");
}

async function refreshUser() {
  try {
    const data = await api.me();
    state.user = data.user;
  } catch {
    state.user = null;
  }
  return state.user;
}

function setUser(user) {
  state.user = user;
}

async function logout() {
  try {
    await api.logout();
  } catch {
    /* segue o fluxo */
  }
  state.user = null;
  toast("Você saiu da sua conta.", "info");
  navigate("/", { replace: true });
}

function publicHeader() {
  return `<header class="site-header">
    <a class="brand-link" href="#/">${logo()}</a>
    <nav class="site-nav" id="site-nav">
      <a href="#recursos" data-scroll="recursos">Recursos</a>
      <a href="#como-funciona" data-scroll="como-funciona">Como funciona</a>
      <a href="#precos" data-scroll="precos">Planos</a>
      <a href="#faq" data-scroll="faq">FAQ</a>
    </nav>
    <div class="site-actions">
      ${
        state.user
          ? `<a class="btn btn-primary btn-sm" href="#/app">Abrir painel ${icon("arrow-right", 15)}</a>`
          : `<a class="btn btn-ghost btn-sm hide-mobile" href="#/login">Entrar</a>
             <a class="btn btn-primary btn-sm" href="#/register">Começar grátis</a>`
      }
      <button class="icon-btn menu-btn" id="menu-btn" aria-label="Abrir menu" aria-expanded="false">
        ${icon("menu", 20)}
      </button>
    </div>
  </header>`;
}

function appShell(path) {
  const user = state.user;
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const isReschedule = path === "/app/agendar" && Number(params.get("reschedule")) > 0;
  const page = isReschedule
    ? { title: "Reagendar atendimento", eyebrow: "Agenda" }
    : pageTitles[path] || pageTitles["/app"];
  const nav = appNav
    .map(
      (item) => `<a class="nav-link ${path === item.path ? "active" : ""}" href="#${item.path}">
        ${icon(item.icon, 18)}<span>${item.label}</span>
        ${path === item.path ? '<span class="nav-dot"></span>' : ""}
      </a>`,
    )
    .join("");

  return `<div class="app-shell">
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="sidebar" id="sidebar">
      <a class="brand-link sidebar-brand" href="#/app">${logo()}</a>
      <div class="sidebar-label">Menu</div>
      <nav class="app-nav">${nav}</nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-tip">
        <span class="sidebar-tip-icon">${icon("sparkles", 18)}</span>
        <p><strong>Dica Nexa</strong>Conecte o n8n e receba cada agendamento no seu WhatsApp ou CRM.</p>
        <a href="#/app/integracoes">Configurar ${icon("arrow-right", 13)}</a>
      </div>
      <div class="sidebar-user">
        <span class="avatar">${initials(user.name)}</span>
        <span class="sidebar-user-info">
          <strong>${user.name.split(" ")[0]}</strong>
          <small>${user.email}</small>
        </span>
        <button class="icon-btn" id="logout-btn" aria-label="Sair" title="Sair">${icon("logout", 17)}</button>
      </div>
    </aside>

    <div class="app-main">
      <header class="topbar">
        <button class="icon-btn menu-btn" id="sidebar-btn" aria-label="Abrir menu">${icon("menu", 20)}</button>
        <div class="topbar-title">
          <span class="eyebrow">${page.eyebrow}</span>
          <h1>${page.title}</h1>
        </div>
        <div class="topbar-actions">
          <a class="btn btn-primary btn-sm" href="#/app/agendar">${icon("plus", 15)} <span class="hide-mobile">Novo agendamento</span></a>
          <a class="avatar avatar-btn" href="#/app" title="${user.name}">${initials(user.name)}</a>
        </div>
      </header>
      <main class="app-content" id="view-root"></main>
    </div>
  </div>`;
}

function notFound() {
  return `<div class="not-found">
    <span class="eyebrow">Erro 404</span>
    <h1>Essa página não existe.</h1>
    <p>O link pode ter quebrado ou a página foi movida.</p>
    <a class="btn btn-primary" href="#/">Voltar para o início ${icon("arrow-right", 16)}</a>
  </div>`;
}

function bindPublicChrome() {
  const menuBtn = document.getElementById("menu-btn");
  const nav = document.getElementById("site-nav");
  menuBtn?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.innerHTML = open ? icon("x", 20) : icon("menu", 20);
  });
  document.querySelectorAll("[data-scroll]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = document.getElementById(link.dataset.scroll);
      if (!target) return;
      nav?.classList.remove("open");
      if (menuBtn) {
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.innerHTML = icon("menu", 20);
      }
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindAppChrome() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const openBtn = document.getElementById("sidebar-btn");
  const close = () => {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("open");
  };
  openBtn?.addEventListener("click", () => {
    sidebar?.classList.add("open");
    overlay?.classList.add("open");
  });
  overlay?.addEventListener("click", close);
  document.querySelectorAll(".app-nav a").forEach((link) => link.addEventListener("click", close));
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const logoutMobile = document.getElementById("logout-mobile");
  logoutMobile?.addEventListener("click", logout);
}

async function route() {
  const rawPath = currentPath();
  const anchor = rawPath.replace(/^\/+/, "");
  const scrollTarget = landingAnchors.has(anchor) ? anchor : "";
  const path = scrollTarget ? "/" : rawPath;
  if (state.cleanup) {
    try {
      state.cleanup();
    } catch {
      /* ignora erros de cleanup */
    }
    state.cleanup = null;
  }

  const appRoute = isAppRoute(path);
  if (appRoute && !state.user) {
    state.cleanup = null;
    renderAuth(app, "login", {
      navigate,
      setUser,
      onAuthenticated: () => navigate("/app", { replace: true }),
      message: "Entre para acessar seu workspace.",
    });
    scrollToTop();
    return;
  }

  if ((path === "/login" || path === "/register") && state.user) {
    navigate("/app", { replace: true });
    return;
  }

  document.body.classList.toggle("app-mode", appRoute);

  if (path === "/") {
    app.innerHTML = `${publicHeader()}<div id="landing-root"></div>`;
    bindPublicChrome();
    state.cleanup = renderLanding(document.getElementById("landing-root"), {
      navigate,
      user: state.user,
      setUser,
    });
    if (scrollTarget) {
      setTimeout(() => {
        document.getElementById(scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  } else if (path === "/login" || path === "/register") {
    app.innerHTML = "";
    state.cleanup = renderAuth(app, path === "/login" ? "login" : "register", {
      navigate,
      setUser,
      onAuthenticated: () => navigate("/app", { replace: true }),
    });
  } else if (appRoute && state.user) {
    app.innerHTML = appShell(path);
    bindAppChrome();
    const viewRoot = document.getElementById("view-root");
    const ctx = { navigate, user: state.user, setUser, refreshUser };

    if (path === "/app") {
      state.cleanup = await renderDashboard(viewRoot, ctx);
    } else if (path === "/app/agendar") {
      state.cleanup = await renderSchedule(viewRoot, ctx);
    } else if (path === "/app/agendamentos") {
      state.cleanup = await renderAppointments(viewRoot, ctx);
    } else if (path === "/app/integracoes") {
      state.cleanup = await renderIntegrations(viewRoot, ctx);
    } else {
      viewRoot.innerHTML = notFound();
    }
  } else {
    app.innerHTML = `<div class="not-found standalone">${notFound()}</div>`;
  }
  if (!appRoute) document.body.classList.remove("app-mode");
  if (!scrollTarget) scrollToTop();
}

async function init() {
  await refreshUser();
  state.ready = true;
  if (!location.hash) history.replaceState(null, "", "#/");
  route();
  window.addEventListener("hashchange", route);
}

init();
