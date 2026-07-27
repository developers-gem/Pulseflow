import { Router } from "express";
import { assessTriage } from "../utils/triage.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/assess", (req, res) => {
  try {
    const { age, sex, chiefComplaint } = req.body;
    if (age == null || !sex || !chiefComplaint) {
      return res.status(400).json({ error: "age, sex, and chiefComplaint are required" });
    }
    const assessment = assessTriage(req.body);
    res.json({ assessment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
