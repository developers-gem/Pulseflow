import { Router } from "express";
import Ambulance from "../models/Ambulance.js";
import { requireAuth } from "../middleware/auth.js";
import { buildHourlyForecast, acuityMixForecast } from "../utils/ambulanceForecast.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const ambulances = await Ambulance.find({ status: { $ne: "arrived" } }).sort({ etaMin: 1 });
  res.json({ ambulances });
});

// 6-hour predictive arrival forecast + inbound acuity mix
router.get("/forecast", async (req, res) => {
  const ambulances = await Ambulance.find();
  const enRoute = ambulances.filter((a) => a.status === "en_route");
  const critical = enRoute.filter((a) => a.acuity <= 2);
  const next15 = enRoute.filter((a) => a.etaMin <= 15).length;
  const next30 = enRoute.filter((a) => a.etaMin <= 30).length;
  const surge = next15 >= 3 || critical.length >= 2;
  const nextEta = enRoute.length ? Math.min(...enRoute.map((a) => a.etaMin)) : null;

  res.json({
    inbound: enRoute.length,
    next15Min: next15,
    next30Min: next30,
    criticalInbound: critical.length,
    surge,
    nextEtaMin: nextEta,
    hourlyForecast: buildHourlyForecast(enRoute.length),
    acuityMix: acuityMixForecast(ambulances),
  });
});

router.post("/", async (req, res) => {
  try {
    const ambulance = await Ambulance.create(req.body);
    req.app.get("io")?.emit("ambulance:created", ambulance);
    res.status(201).json({ ambulance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const ambulance = await Ambulance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!ambulance) return res.status(404).json({ error: "Ambulance not found" });
    req.app.get("io")?.emit("ambulance:updated", ambulance);
    res.json({ ambulance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
