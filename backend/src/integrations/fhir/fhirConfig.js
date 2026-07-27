// Vendor-neutral FHIR R4 config. Defaults target the public HAPI FHIR
// test server so this works out of the box with zero credentials.
// Swap FHIR_BASE_URL + FHIR_AUTH_MODE to point at Epic/Cerner sandboxes
// later without touching any other integration code.

export const fhirConfig = {
  baseUrl: process.env.FHIR_BASE_URL || "https://hapi.fhir.org/baseR4",

  // "none"                -> public sandbox, no auth (HAPI default)
  // "client_credentials"  -> classic OAuth2 client_credentials grant
  // "jwt_bearer"          -> SMART Backend Services (signed JWT client assertion) — Epic/Cerner
  authMode: process.env.FHIR_AUTH_MODE || "none",

  tokenUrl: process.env.FHIR_TOKEN_URL || "",
  clientId: process.env.FHIR_CLIENT_ID || "",
  clientSecret: process.env.FHIR_CLIENT_SECRET || "",
  privateKeyPem: process.env.FHIR_PRIVATE_KEY_PEM || "",
  scopes: process.env.FHIR_SCOPES || "system/Patient.read system/Observation.read system/Encounter.read system/Condition.read",
};
