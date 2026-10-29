async function request(path, { method = "GET", body, signal } = {}) {
  const options = {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal,
  };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão.");
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    /* resposta sem JSON */
  }

  if (!response.ok) {
    const message = data?.error || data?.detail || "Algo deu errado. Tente novamente.";
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  me: () => request("/me"),
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  logout: () => request("/auth/logout", { method: "POST" }),

  services: () => request("/services"),
  availability: (date, serviceId, signal) =>
    request(`/availability?date=${encodeURIComponent(date)}&service_id=${serviceId}`, { signal }),

  appointments: () => request("/appointments"),
  createAppointment: (payload) => request("/appointments", { method: "POST", body: payload }),
  cancelAppointment: (id) => request(`/appointments/${id}/cancel`, { method: "POST" }),
  rescheduleAppointment: (id, payload) =>
    request(`/appointments/${id}/reschedule`, { method: "POST", body: payload }),

  integration: () => request("/integrations"),
  saveIntegration: (webhook_url) =>
    request("/integrations/config", { method: "POST", body: { webhook_url } }),
  testIntegration: (webhook_url) =>
    request("/integrations/test", { method: "POST", body: { webhook_url } }),
};
