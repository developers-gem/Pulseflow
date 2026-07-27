import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { withAudit } from "../middleware/auditLog.js";
import { searchFhirPatients, importPatientFromFhir, getFhirPatientDetail } from "../integrations/fhir/fhirSync.js";

const router = Router();
router.use(requireAuth);

// GET /api/fhir/patients/search?family=Smith&given=John&mrn=12345
router.get("/patients/search", withAudit("fhir.patient.search", "Patient", async (req, res) => {
  const { family, given, mrn } = req.query;
  const results = await searchFhirPatients({ family, given, mrn });
  res.json({
    results: results.map((r) => ({
      fhirId: r.id,
      name: r.name?.[0] ? [...(r.name[0].given || []), r.name[0].family].filter(Boolean).join(" ") : "Unknown",
      birthDate: r.birthDate,
      gender: r.gender,
      mrn: r.identifier?.[0]?.value,
    })),
  });
}));

// GET /api/fhir/patients/:fhirId/detail — full clinical preview, auto-fetched
// the moment a search result is selected in the UI, before import is confirmed.
router.get("/patients/:fhirId/detail", withAudit("fhir.patient.detail", "Patient", async (req, res) => {
  const detail = await getFhirPatientDetail(req.params.fhirId);
  res.json({ detail });
}));

// POST /api/fhir/patients/:fhirId/import  { acuity?, status? }
router.post("/patients/:fhirId/import", withAudit("fhir.patient.import", "Patient", async (req, res) => {
  const { patient, matchedBed } = await importPatientFromFhir(req.params.fhirId, req.body || {});
  req.app.get("io")?.emit("patient:created", patient);
  if (matchedBed) req.app.get("io")?.emit("bed:updated", matchedBed);
  res.status(201).json({ patient, matchedBed });
}));

// POST /api/fhir/patients/:fhirId/sync-vitals — refresh vitals only
router.post("/patients/:fhirId/sync-vitals", withAudit("fhir.observation.sync", "Observation", async (req, res) => {
  const { patient } = await importPatientFromFhir(req.params.fhirId);
  res.json({ patient });
}));

export default router;
