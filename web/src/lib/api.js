const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() {
  return localStorage.getItem("pf_token");
}

export function setToken(token) {
  if (token) localStorage.setItem("pf_token", token);
  else localStorage.removeItem("pf_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  me: () => request("/auth/me"),

  patients: () => request("/patients"),
  createPatient: (payload) => request("/patients", { method: "POST", body: payload }),
  assignBed: (id, bedId) => request(`/patients/${id}/assign-bed`, { method: "POST", body: { bedId } }),
  dischargePatient: (id) => request(`/patients/${id}/discharge`, { method: "POST" }),

  beds: () => request("/beds"),
  updateBed: (id, payload) => request(`/beds/${id}`, { method: "PATCH", body: payload }),

  ambulances: () => request("/ambulances"),
  ambulanceForecast: () => request("/ambulances/forecast"),

  dashboardStats: () => request("/dashboard/stats"),

  criticalAlerts: () => request("/alerts/critical"),

  calculateEws: (payload) => request("/ews/calculate", { method: "POST", body: payload }),
  calculateQsofa: (payload) => request("/ews/qsofa", { method: "POST", body: payload }),
  assessTriage: (payload) => request("/triage/assess", { method: "POST", body: payload }),

  fhirSearchPatients: (params) => request(`/fhir/patients/search?${new URLSearchParams(params)}`),
  fhirPatientDetail: (fhirId) => request(`/fhir/patients/${fhirId}/detail`),
  fhirImportPatient: (fhirId, payload) => request(`/fhir/patients/${fhirId}/import`, { method: "POST", body: payload || {} }),
  fhirSyncVitals: (fhirId) => request(`/fhir/patients/${fhirId}/sync-vitals`, { method: "POST" }),
};
