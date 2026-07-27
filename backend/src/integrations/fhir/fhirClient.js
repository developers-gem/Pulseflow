import { fhirConfig } from "./fhirConfig.js";
import { getFhirAccessToken } from "./fhirAuth.js";

async function fhirFetch(path, { method = "GET", params, body } = {}) {
  const url = new URL(`${fhirConfig.baseUrl}/${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));

  const token = await getFhirAccessToken();
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/fhir+json",
      ...(body ? { "Content-Type": "application/fhir+json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const responseBody = await res.text().catch(() => "");
    throw new Error(`FHIR ${method} ${path} failed (${res.status}): ${responseBody.slice(0, 300)}`);
  }
  return res.json();
}

export const fhirClient = {
  read: (resourceType, id) => fhirFetch(`${resourceType}/${id}`),
  search: (resourceType, params) => fhirFetch(resourceType, { params }),
  create: (resourceType, body) => fhirFetch(resourceType, { method: "POST", body }),
};
