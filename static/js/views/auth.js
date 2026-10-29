import { api } from "../api.js";
import { icon, logo } from "../icons.js";
import { setLoading, toast, escapeHtml } from "../ui.js";

export function renderAuth(root, mode, ctx) {
  const isLogin = mode === "login";
  const title = isLogin ? "Bem-vindo de volta" : "Crie sua conta";
  const subtitle = isLogin
    ? "Entre para acessar sua agenda e suas automações."
    : "Comece grátis. Sem cartão de crédito.";

  root.innerHTML = `
  <div class="auth-page">
    <aside class="auth-aside">
      <div class="auth-aside-bg" aria-hidden="true">
        <span class="orb orb-violet"></span>
        <span class="orb orb-cyan"></span>
        <span class="auth-grid"></span>
      </div>
      <a class="brand-link" href="#/">${logo()}</a>
      <div class="auth-aside-content">
        <span class="pill"><span class="ping"></span> Inteligência que executa</span>
        <h2>Sua operação no <span class="grad-text">piloto automático</span>.</h2>
        <p>Agentes de IA, agenda inteligente e automações n8n em um único workspace.</p>
        <ul class="auth-benefits">
          <li><span>${icon("check", 14)}</span> Agende sessões em segundos</li>
          <li><span>${icon("check", 14)}</span> Receba cada evento no n8n</li>
          <li><span>${icon("check", 14)}</span> Acompanhe tudo em um painel</li>
        </ul>
      </div>
      <div class="auth-aside-footer">
        <div class="auth-quote">
          <div class="avatar-stack">
            <span class="avatar avatar-sm tone-a">LM</span>
            <span class="avatar avatar-sm tone-b">RC</span>
            <span class="avatar avatar-sm tone-c">BS</span>
          </div>
          <div>
            <span class="stars">${icon("star", 13)}${icon("star", 13)}${icon("star", 13)}${icon("star", 13)}${icon("star", 13)}</span>
            <p>“Automatizei 80% do meu atendimento na primeira semana.”</p>
            <small>Larissa M. · COO na Lumina</small>
          </div>
        </div>
      </div>
    </aside>

    <main class="auth-main">
      <div class="auth-mobile-top">
        <a class="brand-link" href="#/">${logo()}</a>
        <a class="back-link" href="#/">${icon("arrow-right", 14)} Voltar ao site</a>
      </div>

      <div class="auth-card">
        <div class="auth-heading">
          <span class="eyebrow">${isLogin ? "Acessar conta" : "Cadastro"}</span>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>

        <form class="auth-form" id="auth-form" novalidate>
          <div class="form-error" id="form-error" hidden></div>

          ${
            isLogin
              ? ""
              : `<label class="field">
                  <span>Nome completo</span>
                  <div class="input-wrap">
                    ${icon("user", 17)}
                    <input type="text" name="name" autocomplete="name" placeholder="Como podemos te chamar?" required minlength="2" />
                  </div>
                </label>`
          }

          <label class="field">
            <span>E-mail</span>
            <div class="input-wrap">
              ${icon("mail", 17)}
              <input type="email" name="email" autocomplete="email" placeholder="voce@empresa.com" required />
            </div>
          </label>

          <label class="field">
            <span>Senha</span>
            <div class="input-wrap">
              ${icon("lock", 17)}
              <input type="password" name="password" autocomplete="${isLogin ? "current-password" : "new-password"}" placeholder="${isLogin ? "Sua senha" : "Mínimo de 8 caracteres"}" required minlength="8" />
              <button type="button" class="input-action" id="toggle-password" aria-label="Mostrar senha">
                ${icon("eye", 16)}
              </button>
            </div>
            ${
              isLogin
                ? ""
                : `<div class="strength" id="strength" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
                   <small class="field-hint" id="strength-label">Use 8+ caracteres com letras e números.</small>`
            }
          </label>

          ${
            isLogin
              ? `<div class="form-row">
                  <label class="checkbox"><input type="checkbox" name="remember" checked /><span></span> Lembrar de mim</label>
                  <a class="text-link" href="mailto:oi@nexa.ai?subject=Recuperar%20senha">Esqueci minha senha</a>
                </div>`
              : `<label class="checkbox"><input type="checkbox" name="terms" required /><span></span> Concordo com os <a href="#faq">Termos</a> e a <a href="#faq">Privacidade</a></label>`
          }

          <button class="btn btn-primary btn-block btn-lg" type="submit" id="submit-btn">
            ${isLogin ? "Entrar no workspace" : "Criar minha conta"} ${icon("arrow-right", 16)}
          </button>
        </form>

        ${
          isLogin
            ? `<div class="demo-card">
                <span class="demo-icon">${icon("sparkles", 18)}</span>
                <div>
                  <strong>Quer só testar?</strong>
                  <p>Entre com a conta demo: <code>demo@nexa.ai</code> · <code>demo1234</code></p>
                </div>
                <button class="btn btn-glass btn-sm" id="demo-fill" type="button">Preencher</button>
              </div>`
            : ""
        }

        <p class="auth-switch">
          ${isLogin ? "Ainda não tem conta?" : "Já tem uma conta?"}
          <a href="#/${isLogin ? "register" : "login"}">${isLogin ? "Criar conta grátis" : "Entrar"}</a>
        </p>
      </div>

      <div class="auth-foot">
        <span>${icon("shield", 13)} Conexão protegida</span>
        <span>© ${new Date().getFullYear()} Nexa AI</span>
      </div>
    </main>
  </div>
  `;

  const form = root.querySelector("#auth-form");
  const errorBox = root.querySelector("#form-error");
  const submitBtn = root.querySelector("#submit-btn");
  const passwordInput = form.querySelector('input[name="password"]');

  const showError = (message) => {
    errorBox.hidden = false;
    errorBox.innerHTML = `${icon("alert", 15)} <span>${escapeHtml(message)}</span>`;
    errorBox.classList.remove("shake");
    void errorBox.offsetWidth;
    errorBox.classList.add("shake");
  };

  root.querySelector("#toggle-password")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    button.innerHTML = show ? icon("eye-off", 16) : icon("eye", 16);
    button.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
  });

  if (!isLogin) {
    const bars = [...root.querySelectorAll("#strength i")];
    const label = root.querySelector("#strength-label");
    passwordInput.addEventListener("input", () => {
      const value = passwordInput.value;
      let score = 0;
      if (value.length >= 8) score++;
      if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
      if (/\d/.test(value)) score++;
      if (/[^A-Za-z0-9]/.test(value)) score++;
      bars.forEach((bar, index) => bar.classList.toggle("on", index < score));
      const text = ["Muito fraca", "Fraca", "Razoável", "Boa", "Excelente"][score];
      label.textContent = value ? `Força da senha: ${text}` : "Use 8+ caracteres com letras e números.";
      label.dataset.score = String(score);
    });
  }

  root.querySelector("#demo-fill")?.addEventListener("click", () => {
    form.querySelector('input[name="email"]').value = "demo@nexa.ai";
    passwordInput.value = "demo1234";
    errorBox.hidden = true;
    form.querySelector('input[name="email"]').focus();
    toast("Credenciais da demo preenchidas. Clique em Entrar.", "info");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const data = Object.fromEntries(new FormData(form).entries());
    if (!isLogin) {
      if (!data.name || data.name.trim().length < 2) return showError("Informe seu nome completo.");
      if (!data.terms) return showError("Aceite os termos para continuar.");
    }
    if (!data.email || !/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(data.email)) {
      return showError("Informe um e-mail válido.");
    }
    if (!data.password || data.password.length < 8) {
      return showError("A senha precisa ter pelo menos 8 caracteres.");
    }

    setLoading(submitBtn, true, isLogin ? "Entrando..." : "Criando conta...");
    try {
      const payload = isLogin
        ? { email: data.email, password: data.password, remember: Boolean(data.remember) }
        : { name: data.name, email: data.email, password: data.password };
      const response = isLogin ? await api.login(payload) : await api.register(payload);
      ctx.setUser(response.user);
      toast(
        isLogin ? `Que bom te ver, ${response.user.name.split(" ")[0]}!` : "Conta criada com sucesso!",
        "success",
      );
      ctx.onAuthenticated();
    } catch (error) {
      showError(error.message);
      setLoading(submitBtn, false);
    }
  });

  return () => {};
}
