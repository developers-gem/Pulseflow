import { Router } from "express";
import Bed from "../models/Bed.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const beds = await Bed.find().populate("patient").sort({ zone: 1, bedCode: 1 });
  res.json({ beds });
});

router.post("/", async (req, res) => {
  try {
    const bed = await Bed.create(req.body);
    req.app.get("io")?.emit("bed:created", bed);
    res.status(201).json({ bed });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.status && update.status !== "occupied") update.patient = null;
    const bed = await Bed.findByIdAndUpdate(req.params.id, update, { new: true }).populate("patient");
    if (!bed) return res.status(404).json({ error: "Bed not found" });
    req.app.get("io")?.emit("bed:updated", bed);
    res.json({ bed });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
