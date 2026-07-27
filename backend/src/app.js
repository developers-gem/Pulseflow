import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import patientsRoutes from "./routes/patients.routes.js";
import bedsRoutes from "./routes/beds.routes.js";
import ambulancesRoutes from "./routes/ambulances.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import ewsRoutes from "./routes/ews.routes.js";
import triageRoutes from "./routes/triage.routes.js";
import alertsRoutes from "./routes/alerts.routes.js";
import fhirRoutes from "./routes/fhir.routes.js";
import fhirWebhookRoutes from "./routes/fhirWebhook.routes.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true, service: "pulseflow-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/beds", bedsRoutes);
app.use("/api/ambulances", ambulancesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ews", ewsRoutes);
app.use("/api/triage", triageRoutes);
app.use("/api/alerts", alertsRoutes);
// Mounted BEFORE the authenticated /api/fhir router: requireAuth inside
// fhirRoutes runs unconditionally for any /api/fhir/* request, so this more
// specific, unauthenticated path must match first or the EHR's callback
// (which can't carry a user JWT) would be rejected with 401.
app.use("/api/fhir/webhook", fhirWebhookRoutes);
app.use("/api/fhir", fhirRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

export default app;
