import { Router } from "express";
import Patient from "../models/Patient.js";
import Bed from "../models/Bed.js";
import Ambulance from "../models/Ambulance.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/stats", async (req, res) => {
  const patients = await Patient.find({ status: { $ne: "discharged" } });
  const beds = await Bed.find();
  const ambulances = await Ambulance.find({ status: "en_route" });

  const waiting = patients.filter((p) => p.status === "waiting" || p.status === "triage");
  const critical = patients.filter((p) => p.acuity <= 2).length;
  const occupied = beds.filter((b) => b.status === "occupied").length;
  const occRate = beds.length ? Math.round((occupied / beds.length) * 100) : 0;
  const avgWait = waiting.length
    ? Math.round(waiting.reduce((s, p) => s + (p.predictedWaitMin || 0), 0) / waiting.length)
    : 0;
  const nextEta = ambulances.length ? Math.min(...ambulances.map((a) => a.etaMin)) : null;

  const waitByAcuity = [1, 2, 3, 4, 5].map((level) => {
    const group = waiting.filter((p) => p.acuity === level);
    const avg = group.length ? Math.round(group.reduce((s, p) => s + (p.predictedWaitMin || 0), 0) / group.length) : 0;
    return { level, count: group.length, avgWaitMin: avg };
  });

  res.json({
    waitByAcuity,
    activeCensus: patients.length,
    waitingCount: waiting.length,
    inCareCount: patients.length - waiting.length,
    bedOccupancyPct: occRate,
    bedsOccupied: occupied,
    bedsTotal: beds.length,
    avgPredictedWaitMin: avgWait,
    inboundAmbulances: ambulances.length,
    nextAmbulanceEtaMin: nextEta,
    criticalCount: critical,
  });
});

export default router;
