import { Router } from "express";
import Patient from "../models/Patient.js";
import Bed from "../models/Bed.js";
import { requireAuth } from "../middleware/auth.js";
import { predictWait } from "../utils/wait.js";
import { calculateNEWS2 } from "../utils/ews.js";

const router = Router();
router.use(requireAuth);

async function nextPatientCode() {
  const last = await Patient.findOne().sort({ createdAt: -1 });
  const lastNum = last?.patientCode ? parseInt(last.patientCode.split("-")[1], 10) : 1000;
  return `P-${lastNum + 1}`;
}

router.get("/", async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const patients = await Patient.find(filter).populate("bed").sort({ acuity: 1, arrivalTime: 1 });
  res.json({ patients });
});

router.get("/:id", async (req, res) => {
  const patient = await Patient.findById(req.params.id).populate("bed");
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  res.json({ patient });
});

router.post("/", async (req, res) => {
  try {
    const patientCode = await nextPatientCode();
    const queueAhead = await Patient.countDocuments({ status: { $in: ["waiting", "triage"] } });
    const patient = await Patient.create({
      ...req.body,
      patientCode,
      predictedWaitMin: predictWait(req.body.acuity, queueAhead),
    });
    req.app.get("io")?.emit("patient:created", patient);
    res.status(201).json({ patient });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate("bed");
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    req.app.get("io")?.emit("patient:updated", patient);
    res.json({ patient });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Assign patient to a bed and move status to in_treatment
router.post("/:id/assign-bed", async (req, res) => {
  try {
    const { bedId } = req.body;
    const bed = await Bed.findById(bedId);
    if (!bed || bed.status !== "available") return res.status(400).json({ error: "Bed not available" });

    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    bed.status = "occupied";
    bed.patient = patient._id;
    await bed.save();

    patient.bed = bed._id;
    patient.status = "in_treatment";
    await patient.save();

    req.app.get("io")?.emit("bed:updated", bed);
    req.app.get("io")?.emit("patient:updated", patient);
    res.json({ patient, bed });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Discharge patient and free their bed
router.post("/:id/discharge", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    patient.status = "discharged";
    await patient.save();

    if (patient.bed) {
      const bed = await Bed.findById(patient.bed);
      if (bed) {
        bed.status = "cleaning";
        bed.patient = null;
        await bed.save();
        req.app.get("io")?.emit("bed:updated", bed);
      }
      patient.bed = null;
      await patient.save();
    }

    req.app.get("io")?.emit("patient:updated", patient);
    res.json({ patient });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Record vitals + auto-compute NEWS2, appended to history
router.post("/:id/vitals", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    patient.vitals = req.body;
    const result = calculateNEWS2(req.body);
    patient.ewsHistory.push({ score: result.total, risk: result.risk });
    await patient.save();

    req.app.get("io")?.emit("patient:updated", patient);
    res.json({ patient, news2: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  const patient = await Patient.findByIdAndDelete(req.params.id);
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  req.app.get("io")?.emit("patient:deleted", { id: req.params.id });
  res.json({ ok: true });
});

export default router;
