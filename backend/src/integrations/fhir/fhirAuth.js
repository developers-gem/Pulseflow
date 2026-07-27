import jwt from "jsonwebtoken";
import crypto from "crypto";
import { fhirConfig } from "./fhirConfig.js";

let cachedToken = null;
let cachedExpiry = 0;

// SMART Backend Services auth: sign a JWT assertion with the app's private
// key, exchange it for an access token at the EHR's token endpoint.
// Ref: https://hl7.org/fhir/smart-app-launch/backend-services.html
async function jwtBearerToken() {
  const assertion = jwt.sign(
    { iss: fhirConfig.clientId, sub: fhirConfig.clientId, aud: fhirConfig.tokenUrl, jti: crypto.randomUUID() },
    fhirConfig.privateKeyPem,
    { algorithm: "RS384", expiresIn: "5m" }
  );

  const res = await fetch(fhirConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
      scope: fhirConfig.scopes,
    }),
  });
  if (!res.ok) throw new Error(`FHIR token exchange failed (${res.status})`);
  return res.json();
}

async function clientCredentialsToken() {
  const res = await fetch(fhirConfig.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${fhirConfig.clientId}:${fhirConfig.clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: fhirConfig.scopes }),
  });
  if (!res.ok) throw new Error(`FHIR token exchange failed (${res.status})`);
  return res.json();
}

export async function getFhirAccessToken() {
  if (fhirConfig.authMode === "none") return null;

  const now = Date.now();
  if (cachedToken && now < cachedExpiry - 30_000) return cachedToken;

  const grant = fhirConfig.authMode === "jwt_bearer" ? await jwtBearerToken() : await clientCredentialsToken();
  cachedToken = grant.access_token;
  cachedExpiry = now + (grant.expires_in || 300) * 1000;
  return cachedToken;
}
