import { Router } from "express";
import Patient from "../models/Patient.js";
import Ambulance from "../models/Ambulance.js";
import { requireAuth } from "../middleware/auth.js";
import { detectCriticalAlerts } from "../utils/criticalAlerts.js";

const router = Router();
router.use(requireAuth);

router.get("/critical", async (req, res) => {
  const [patients, ambulances] = await Promise.all([
    Patient.find({ status: { $ne: "discharged" } }).populate("bed"),
    Ambulance.find(),
  ]);
  const result = detectCriticalAlerts(patients, ambulances);
  res.json(result);
});

export default router;
