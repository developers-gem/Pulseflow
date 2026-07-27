# PulseFlow ED — Backend (Node.js + Express + MongoDB)

## Setup
```bash
cp .env.example .env    # edit MONGO_URI etc.
npm install
npm run seed             # seeds an admin user, beds, patients, ambulances
npm run dev               # starts on http://localhost:4000
```

Seeded login: `admin@pulseflow.health` / `password123`

## Live simulation
On startup the server runs a tick loop (default every 4s, `SIMULATION_TICK_MS`)
that mutates patients/beds/ambulances in Mongo exactly like the original demo
(walk-ins, ambulance arrivals, bed assignment, discharges) and broadcasts a
`simulation:tick` event over Socket.io so clients know to refetch.

## API summary
- `POST /api/auth/register` / `POST /api/auth/login` / `GET /api/auth/me`
- `GET/POST /api/patients`, `PATCH /api/patients/:id`, `DELETE /api/patients/:id`
- `POST /api/patients/:id/assign-bed`, `POST /api/patients/:id/discharge`, `POST /api/patients/:id/vitals`
- `GET/POST /api/beds`, `PATCH /api/beds/:id`
- `GET/POST /api/ambulances`, `PATCH /api/ambulances/:id`
- `GET /api/ambulances/forecast` — 6-hour predictive arrival forecast + inbound acuity mix + surge flag
- `GET /api/dashboard/stats` — KPI strip data, including `waitByAcuity` (predicted wait broken down by ESI level)
- `POST /api/ews/calculate` — NEWS2 score from vitals
- `POST /api/ews/qsofa` — qSOFA sepsis screen (SBP <=100, RR >=22, altered mentation)
- `POST /api/triage/assess` — rule-based ESI triage recommendation (swap in a real LLM call later; the response shape already matches what the React AI triage UI expects)
- `GET /api/alerts/critical` — sepsis / stroke / trauma critical-pathway alerts detected from chief complaints, with door-to-target timers and protocol checklists
- `GET /api/fhir/patients/search?family=&given=&mrn=` — manual fallback: search the connected FHIR server
- `GET /api/fhir/patients/:fhirId/detail` — manual fallback: auto-fetched full clinical preview before import is confirmed — no DB write
- `POST /api/fhir/patients/:fhirId/import` — manual fallback: pulls the full record into the local Patient collection; auto-assigns a bed if the encounter's location string matches a known `bedCode`
- `POST /api/fhir/patients/:fhirId/sync-vitals` — manual fallback: refresh vitals only for an already-imported patient
- `POST /api/fhir/webhook/:secret` — **primary automatic ingestion path**. Not behind `requireAuth` (secured by the secret path segment instead). Receives FHIR Subscription notifications and routes them to Patient/Bed/Ambulance automatically.

All routes except `/api/auth/*` and `/api/health` require `Authorization: Bearer <token>`.

## Socket.io events
Connect to the same origin; listen for `simulation:tick`, `patient:created`,
`patient:updated`, `patient:deleted`, `bed:updated`, `ambulance:created`,
`ambulance:updated` to keep a UI live without polling.

## EHR integration

Every module that should reflect the EHR does so automatically — no manual
"import" click required anywhere in this path:

| Module | FHIR source | Trigger |
|---|---|---|
| Patient Tracker | `Patient`, `Condition`, `Observation`, `MedicationRequest`, `AllergyIntolerance` | Subscription webhook (push) |
| Bed Management | `Location.operationalStatus` (standard HL7 v2-0116 bed-status codes) | Subscription webhook (push) |
| Ambulance Forecast | `Encounter` with `class=EMER`, `status=planned` | Subscription webhook (push) |
| Critical Pathway Alerts | *(derived)* — scans Patient/Ambulance records already ingested above | Automatic, recomputed on every read |
| Predicted Wait Times | *(derived)* — PulseFlow's own model over current census | Automatic, recomputed every simulation tick |

When an inbound `Encounter` (ambulance) transitions from `planned` to
`in-progress`/`arrived`, it's automatically promoted into a full Patient
record and removed from the ambulance list — the same real-world moment an
EMS patient becomes an ED patient.

The `EhrImportPanel` / "EHR Patient Lookup" button in the web UI is a
**manual fallback only**, for pulling in a specific patient the automatic
feed hasn't delivered yet (e.g. testing, or a one-off historical lookup) —
it is not how data is meant to flow in day to day.

### FHIR (HL7 FHIR R4) — automatic via Subscriptions
Read-only against `FHIR_BASE_URL` (defaults to the public HAPI FHIR sandbox
— `https://hapi.fhir.org/baseR4` — zero credentials needed). `FHIR_AUTH_MODE`
controls auth:
- `none` — public sandbox, no token (default)
- `client_credentials` — classic OAuth2 client credentials grant
- `jwt_bearer` — SMART Backend Services (signed JWT client assertion), what
  Epic/Cerner/most production EHRs require. Set `FHIR_TOKEN_URL`,
  `FHIR_CLIENT_ID`, and `FHIR_PRIVATE_KEY_PEM` to switch to this mode.

**Automatic push (recommended)**: set `FHIR_AUTO_SUBSCRIBE=true`,
`FHIR_WEBHOOK_BASE_URL` (a publicly reachable URL for this server — an ngrok
tunnel in dev, your real domain in production), and `FHIR_WEBHOOK_SECRET` (a
long random string). On boot, PulseFlow registers FHIR `Subscription`
resources for `Patient`, `Encounter`, `Observation`, and `Location`. The EHR
then calls `POST {FHIR_WEBHOOK_BASE_URL}/api/fhir/webhook/{secret}` the
instant any of those change — the webhook route (`src/routes/fhirWebhook.routes.js`)
is intentionally **not** behind `requireAuth`, since the EHR can't hold a
PulseFlow user token; it's secured by the secret path segment instead. That
route routes the incoming resource to the right module automatically:
- `Location` → `importBedFromFhirLocation()` → Bed Management
- `Encounter` (planned + EMER) → `importAmbulanceFromFhirEncounter()` → Ambulance Forecast
- anything else → `importPatientFromFhir()` → Patient Tracker (+ derived Critical Alerts / Wait Times)

Mapping code lives in `src/integrations/fhir/fhirMappers.js`; the shared
full-record fetch (`fetchFullFhirRecord`) and both the webhook ingestion path
(`ingestFromWebhookResource`) and the manual-lookup path
(`importPatientFromFhir`/`getFhirPatientDetail`) live in `fhirSync.js`.

### HL7v2 (MLLP) — automatic by nature
A minimal MLLP TCP listener runs on `HL7_MLLP_PORT` (default `2575`)
alongside the HTTP server. This has always been push-based — the moment the
hospital's HIS sends a message, it's ingested with zero clicks:
- `ADT^A01` (admit) — creates a patient, assigns a bed if `PV1-3` maps to a known `bedCode`
- `ADT^A02` (transfer) — updates bed assignment
- `ADT^A03` (discharge) — discharges the patient, frees the bed
- `ORU^R01` (observation result) — updates vitals and recomputes NEWS2

Code lives in `src/integrations/hl7v2/` — `hl7Parser.js` is a small
hand-rolled pipe-delimited parser (no external HL7 library dependency),
`hl7Handlers.js` applies the message to Mongo, `mllpServer.js` is the raw
`net.Server` implementing MLLP framing (`<VT>` / `<FS><CR>`) and ACK replies.

### The demo simulator respects real EHR data
`src/utils/simulation.js` (the built-in random demo generator, useful for
testing without a live EHR connection) only ever creates and mutates
`sourceSystem: "internal"` records. Beds and ambulances tagged
`sourceSystem: "fhir"` are filtered out of every simulator query, so
EHR-sourced data is never overwritten or fought over by the demo — those
records are updated exclusively by the webhook. The one exception is
predicted wait times, which are PulseFlow's own model and correctly runs
over every patient regardless of source.

### Audit logging
Every FHIR and HL7v2 read/write — including webhook deliveries, rejections,
and errors — is recorded in the `AuditLog` collection
(`src/models/AuditLog.js`, `src/middleware/auditLog.js`). This is table-stakes
for HIPAA's audit-control requirement (45 CFR §164.312(b)) the moment this
points at a real EHR.

### Production disclaimer
This ships pointed at a public sandbox with synthetic data. Before pointing
`FHIR_BASE_URL`, `FHIR_WEBHOOK_BASE_URL`, or the MLLP listener at any real
hospital system:
- Get a signed BAA with the health system
- Run FHIR and the webhook over TLS only; run MLLP inside the hospital's
  private network or over a TLS-wrapped/VPN tunnel — never expose plain MLLP
  to the internet
- Rotate `FHIR_WEBHOOK_SECRET` regularly and treat it as a credential, not a
  config convenience
- Get a security review of credential storage (the `.env` approach here is
  fine for a sandbox, not for production secrets)
- Decide on a write-back strategy deliberately — this integration is
  read-only by design; pushing triage/EWS results or bed assignments back
  into the EHR needs its own scoped write permissions and audit trail.
