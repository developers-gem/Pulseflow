import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Patient from "../models/Patient.js";
import Bed from "../models/Bed.js";
import Ambulance from "../models/Ambulance.js";
import { predictWait } from "./wait.js";

const FIRST_NAMES = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Jamie"];
const LAST_NAMES = ["Reyes", "Patel", "Khan", "Nguyen", "Cohen", "Silva", "Okafor", "Lin", "Brooks", "Wagner"];
const COMPLAINTS = ["Chest pain", "Shortness of breath", "Abdominal pain", "Laceration", "Fall injury", "Severe headache", "Allergic reaction", "Fever", "Dizziness", "Back pain"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Clearing existing data...");

  await Promise.all([User.deleteMany({}), Patient.deleteMany({}), Bed.deleteMany({}), Ambulance.deleteMany({})]);

  console.log("Seeding admin user...");
  await User.create({
    name: "Dr. Sarah Chen",
    email: "admin@pulseflow.health",
    password: "password123",
    role: "admin",
    department: "Emergency Department",
  });

  console.log("Seeding beds...");
  const layout = [
    ["Resus", "resus", 4],
    ["Acute A", "acute", 8],
    ["Acute B", "acute", 8],
    ["Fast Track", "fast_track", 6],
    ["Observation", "observation", 6],
  ];
  const beds = [];
  let n = 1;
  for (const [zone, type, count] of layout) {
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      const status = r < 0.55 ? "occupied" : r < 0.78 ? "available" : r < 0.92 ? "cleaning" : "blocked";
      const bed = await Bed.create({
        bedCode: `${zone.split(" ").map((s) => s[0]).join("")}${String(n).padStart(2, "0")}`,
        zone,
        type,
        status,
      });
      beds.push(bed);
      n++;
    }
  }

  console.log("Seeding patients...");
  let pid = 1000;
  for (let i = 0; i < 9; i++) {
    const acuity = randInt(1, 5);
    await Patient.create({
      patientCode: `P-${++pid}`,
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      age: randInt(4, 88),
      sex: pick(["male", "female", "other"]),
      chiefComplaint: pick(COMPLAINTS),
      acuity,
      status: "waiting",
      arrivalTime: new Date(Date.now() - randInt(0, 90) * 60_000),
      predictedWaitMin: predictWait(acuity, i),
    });
  }

  const occupiedBeds = beds.filter((b) => b.status === "occupied");
  for (let idx = 0; idx < occupiedBeds.length; idx++) {
    const bed = occupiedBeds[idx];
    const acuity = Math.min(5, Math.max(1, (idx % 5) + 1));
    const patient = await Patient.create({
      patientCode: `P-${++pid}`,
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      age: randInt(4, 88),
      sex: pick(["male", "female", "other"]),
      chiefComplaint: pick(COMPLAINTS),
      acuity,
      status: "in_treatment",
      arrivalTime: new Date(Date.now() - randInt(30, 240) * 60_000),
      bed: bed._id,
      predictedWaitMin: 0,
    });
    bed.patient = patient._id;
    await bed.save();
  }

  console.log("Seeding ambulances...");
  await Ambulance.create([
    { callSign: "Medic 7", etaMin: 4, acuity: 2, condition: "MVA - multiple trauma", origin: "I-95 mile 42", status: "en_route" },
    { callSign: "Medic 12", etaMin: 11, acuity: 3, condition: "Stroke alert", origin: "Riverside Apts", status: "en_route" },
    { callSign: "Medic 4", etaMin: 18, acuity: 4, condition: "Hip fracture, elderly", origin: "Maple Ridge", status: "en_route" },
    { callSign: "Medic 9", etaMin: 26, acuity: 2, condition: "Cardiac arrest, ROSC", origin: "Downtown", status: "en_route" },
  ]);

  console.log("Seed complete. Login with admin@pulseflow.health / password123");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
