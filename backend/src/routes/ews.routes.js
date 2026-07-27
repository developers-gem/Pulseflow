import { Router } from "express";
import { calculateNEWS2, calculateQSOFA } from "../utils/ews.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/calculate", (req, res) => {
  try {
    const result = calculateNEWS2(req.body);
    res.json({ result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/qsofa", (req, res) => {
  try {
    const result = calculateQSOFA(req.body);
    res.json({ result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
