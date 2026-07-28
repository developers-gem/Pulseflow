import Patient from "../models/Patient.js";
import Bed from "../models/Bed.js";
import Ambulance from "../models/Ambulance.js";
import { predictWait } from "./wait.js";

const FIRST_NAMES = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Jamie", "Drew", "Reese", "Noor", "Mei", "Kai", "Imani", "Luca", "Aria", "Theo"];
const LAST_NAMES = ["Reyes", "Patel", "Khan", "Nguyen", "Cohen", "Silva", "Okafor", "Lin", "Brooks", "Wagner", "Hassan", "Park", "Romero", "Ito", "Dubois"];
const COMPLAINTS = [
  "Chest pain", "Shortness of breath", "Abdominal pain", "Laceration",
  "Fall injury", "Severe headache", "Allergic reaction", "Fever",
  "Fracture (suspected)", "Dizziness", "Back pain", "Asthma exacerbation",
  "Vomiting", "Palpitations", "Burn injury",
];
const ORIGINS = ["North End", "Westgate", "Harbor", "Pine Hills", "Civic Center"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

let pidCounter = null;

// async function nextPatientCode() {
//   if (pidCounter == null) {
//     const last = await Patient.findOne().sort({ createdAt: -1 });
//     pidCounter = last?.patientCode ? parseInt(last.patientCode.split("-")[1], 10) : 1000;
//   }
//   pidCounter += 1;
//   return `P-${pidCounter}`;
// }


///* we can replace with the upper one */
async function nextPatientCode() {
  while (true) {
    const last = await Patient.findOne().sort({ createdAt: -1 });

    let nextNumber = 1001;

    if (last?.patientCode) {
      nextNumber = parseInt(last.patientCode.split("-")[1], 10) + 1;
    }

    const patientCode = `P-${nextNumber}`;

    const exists = await Patient.exists({ patientCode });

    if (!exists) {
      return patientCode;
    }
  }
}

// export function startSimulation(io, intervalMs = 4000) {
//   const handle = setInterval(() => tick(io).catch((err) => console.error("Simulation tick error:", err.message)), intervalMs);
//   return () => clearInterval(handle);
// }

let simulationRunning = false;

export function startSimulation(io, intervalMs = 4000) {
  const handle = setInterval(async () => {
    if (simulationRunning) return;

    simulationRunning = true;

    try {
      await tick(io);
    } catch (err) {
      console.error("Simulation tick error:", err.message);
    } finally {
      simulationRunning = false;
    }
  }, intervalMs);

  return () => clearInterval(handle);
}


// This demo simulator only ever creates and mutates sourceSystem:"internal"
// records. Anything ingested from the EHR (sourceSystem:"fhir"/"hl7v2") is
// filtered out of every query below, so the fake demo data never overwrites
// or interferes with real EHR-driven Patients/Beds/Ambulances — those are
// exclusively updated by the FHIR webhook / HL7v2 listener.
async function tick(io) {
  const changed = { patients: [], beds: [], ambulances: [] };
  const INTERNAL = { sourceSystem: "internal" };

  // 1. Advance ambulance ETAs (internal/simulated ambulances only)
  const ambulances = await Ambulance.find({ status: "en_route", ...INTERNAL });
  for (const a of ambulances) {
    a.etaMin = Math.max(0, a.etaMin - 1);
    if (a.etaMin === 0) a.status = "arrived";
    await a.save();
    const exists = await Ambulance.exists({ _id: a._id });

    if (!exists) {
      continue;
    }

    await a.save();
    changed.ambulances.push(a);

    if (a.status === "arrived" && Math.random() > 0.4) {
      const patientCode = await nextPatientCode();
      const patient = await Patient.create({
        patientCode,
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        age: randInt(4, 88),
        sex: pick(["male", "female", "other"]),
        chiefComplaint: a.condition,
        acuity: a.acuity,
        status: "triage",
        arrivalTime: new Date(),
        predictedWaitMin: predictWait(a.acuity, 0),
        sourceSystem: "internal",
      });
      changed.patients.push(patient);
      await Ambulance.findByIdAndDelete(a._id);
    }
  }

  // 2. Occasionally dispatch a new simulated ambulance
  const activeAmbulanceCount = await Ambulance.countDocuments({ status: { $ne: "arrived" }, ...INTERNAL });
  if (Math.random() < 0.25 && activeAmbulanceCount < 6) {
    const ambulance = await Ambulance.create({
      callSign: `Medic ${randInt(1, 30)}`,
      etaMin: randInt(6, 28),
      acuity: randInt(2, 4),
      condition: pick(COMPLAINTS),
      origin: pick(ORIGINS),
      status: "en_route",
      sourceSystem: "internal",
    });
    changed.ambulances.push(ambulance);
  }

  // 3. Occasional walk-in arrival (simulated)
  if (Math.random() < 0.35) {
    const acuity = randInt(1, 5);
    const patientCode = await nextPatientCode();
    const patient = await Patient.create({
      patientCode,
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      age: randInt(4, 88),
      sex: pick(["male", "female", "other"]),
      chiefComplaint: pick(COMPLAINTS),
      acuity,
      status: "waiting",
      arrivalTime: new Date(),
      predictedWaitMin: predictWait(acuity, 0),
      sourceSystem: "internal",
    });
    changed.patients.push(patient);
  }

  // 4. Move first waiting simulated patient to triage
  const waitingPatients = await Patient.find({ status: "waiting", ...INTERNAL }).sort({ acuity: 1 });
  if (waitingPatients[0] && Math.random() < 0.5) {
    waitingPatients[0].status = "triage";
    await waitingPatients[0].save();
    changed.patients.push(waitingPatients[0]);
  }

  // 5. Assign triaged simulated patients to available beds (internal beds only —
  //    EHR-sourced beds are managed exclusively by Location Subscription updates)
  const triaged = await Patient.find({ status: "triage", ...INTERNAL }).sort({ acuity: 1 });
  for (const p of triaged) {
    const preferredType = p.acuity <= 2 ? "resus" : p.acuity === 5 ? "fast_track" : "acute";
    let bed = await Bed.findOne({ status: "available", type: preferredType, ...INTERNAL });
    if (!bed) bed = await Bed.findOne({ status: "available", ...INTERNAL });
    if (!bed) break;

    bed.status = "occupied";
    bed.patient = p._id;
    await bed.save();
    p.bed = bed._id;
    p.status = "in_treatment";
    await p.save();
    changed.beds.push(bed);
    changed.patients.push(p);
  }

  // 6. Discharge / cleaning cycle (internal patients/beds only)
  const inTreatment = await Patient.find({ status: "in_treatment", ...INTERNAL });
  for (const p of inTreatment) {
    if (Math.random() < 0.08) {
      p.status = "discharged";
      await p.save();
      if (p.bed) {
        const bed = await Bed.findById(p.bed);
        if (bed && bed.sourceSystem === "internal") {
          bed.status = "cleaning";
          bed.patient = null;
          await bed.save();
          changed.beds.push(bed);
        }
        p.bed = null;
        await p.save();
      }
      changed.patients.push(p);
    }
  }
  const cleaningBeds = await Bed.find({ status: "cleaning", ...INTERNAL });
  for (const b of cleaningBeds) {
    if (Math.random() < 0.4) {
      b.status = "available";
      await b.save();
      changed.beds.push(b);
    }
  }

  // 7. Recompute predicted waits for ALL waiting/triage patients (this is
  //    PulseFlow's own predictive model, not EHR data — it should run over
  //    everyone regardless of source system, since real EHR-sourced
  //    patients need wait predictions too).
  const stillWaiting = await Patient.find({ status: { $in: ["waiting", "triage"] } }).sort({ acuity: 1, arrivalTime: 1 });
  const totalBeds = await Bed.countDocuments();
  const occupiedBeds = await Bed.countDocuments({ status: "occupied" });
  const census = totalBeds ? occupiedBeds / totalBeds : 0.6;
  for (let i = 0; i < stillWaiting.length; i++) {
    const p = stillWaiting[i];
    p.predictedWaitMin = predictWait(p.acuity, i, census);
    await p.save();
  }

  if (io) io.emit("simulation:tick", { at: new Date().toISOString() });
}
