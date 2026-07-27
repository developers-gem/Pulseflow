# PulseFlow ED — MVP with EHR integration

Rebuilt from the Lovable prototype ("Flow Guardian" / PulseFlow ED) onto:
**Node.js + Express + MongoDB** backend and a **React + Vite** web dashboard,
talking to real hospital systems via **FHIR R4** and **HL7v2 (MLLP)**.

## What's included
| Feature | Status |
|---|---|
| Auth (JWT) | Done |
| Live patient tracker (with EHR source badges) | Done |
| Bed management board (click to change status) | Done |
| Ambulance arrival forecast (6-hour predictive chart + acuity mix) | Done |
| KPI dashboard + per-ESI-level wait time breakdown | Done |
| NEWS2 + qSOFA Early Warning Scores | Done |
| ESI Triage tool (rule-based) | Done |
| Critical Pathway Alerts (sepsis/stroke/trauma, door-to-target timers) | Done |
| Live simulation engine (Socket.io) | Done |
| FHIR R4 patient search + import (read-only) | Done |
| HL7v2 MLLP listener (ADT admit/transfer/discharge, ORU vitals) | Done |
| Audit log of all EHR-sourced activity | Done |
| Stripe billing / admin panels | Dropped for MVP (see note below) |

## Quick start

**1. Backend**
```bash
cd backend
cp .env.example .env      # point MONGO_URI at your Mongo instance
npm install
npm run seed                # creates admin@pulseflow.health / password123 + demo data
npm run dev                  # http://localhost:4000 (+ HL7v2 MLLP listener on :2575)
```

**2. Web dashboard**
```bash
cd web
cp .env.example .env
npm install
npm run dev                  # http://localhost:5173
```

Sign in, then click "Import from EHR" in the top bar to search the connected
FHIR sandbox (public HAPI test server by default, no credentials needed) and
pull a patient straight into the tracker.

## Why some things were dropped for the MVP
The original app also had Stripe subscription billing, Supabase-specific auth
plumbing, and internal admin screens (email templates, payment webhooks,
security audit log). Those are back-office/monetization concerns, not
ED-floor workflows, so they were left out to keep the MVP focused on the
operational core. The data models and API are structured so billing/auth
roles can be layered back in later without reshaping the app.

## Architecture
```
pulseflow/
  backend/
    src/
      integrations/
        fhir/      FHIR R4 client, auth (SMART Backend Services), mappers, sync
        hl7v2/     MLLP listener, HL7v2 parser, ADT/ORU handlers
      models/      User, Patient, Bed, Ambulance, AuditLog
      routes/      auth, patients, beds, ambulances, dashboard, ews, triage, alerts, fhir
  web/             React + Vite dashboard (command-center view)
```

## EHR integration at a glance
- Standard: FHIR R4 (patient/chart data) + HL7v2 over MLLP (real-time ADT/vitals feeds)
- Direction: read-only — pulls from the EHR into PulseFlow; the EHR remains
  the source of truth. Architected so write-back can be added later (see
  backend/README.md) without restructuring anything.
- Sandbox: public HAPI FHIR test server (https://hapi.fhir.org/baseR4),
  vendor-neutral — swapping to Epic/Cerner/Athenahealth later is a config
  change (FHIR_BASE_URL, FHIR_AUTH_MODE=jwt_bearer), not a rewrite.
- Compliance note: this points at a public sandbox with synthetic data only.
  Full production disclaimer and checklist in backend/README.md.

Full API route list and integration details: backend/README.md.
