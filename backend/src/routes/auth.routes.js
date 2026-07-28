import { Router } from "express";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, and password are required" });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const user = await User.create({ name, email, password, role, department });
    const token = signToken(user._id);
    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// router.post("/login", async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) return res.status(400).json({ error: "email and password are required" });

//     const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
//     if (!user) return res.status(401).json({ error: "Invalid credentials" });

//     const ok = await user.comparePassword(password);
//     if (!ok) return res.status(401).json({ error: "Invalid credentials" });

//     const token = signToken(user._id);
//     res.json({ token, user: user.toSafeObject() });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.get("/me", requireAuth, (req, res) => {
//   res.json({ user: req.user.toSafeObject() });
// });

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+password");

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await user.comparePassword(password);

    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken(user._id);

    res.json({
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error("Login Error:", err);   // <-- Add this line
    res.status(500).json({
      error: err.message,
    });
  }
});

export default router;
