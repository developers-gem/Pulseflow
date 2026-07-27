import Patient from "../../models/Patient.js";
import Bed from "../../models/Bed.js";
import AuditLog from "../../models/AuditLog.js";
import { calculateNEWS2 } from "../../utils/ews.js";
import { predictWait } from "../../utils/wait.js";

const LOINC_OR_LABEL_TO_FIELD = {
  HR: "heartRate", PULSE: "heartRate",
  RR: "respiratoryRate", RESP: "respiratoryRate",
  SPO2: "spo2", SAO2: "spo2",
  SBP: "systolicBP", SYSBP: "systolicBP",
  TEMP: "temperatureC",
};

async function nextPatientCode() {
  const last = await Patient.findOne().sort({ createdAt: -1 });
  const lastNum = last?.patientCode ? parseInt(last.patientCode.split("-")[1], 10) : 1000;
  return `P-${lastNum + 1}`;
}

function parsePid(msg) {
  const pid = msg.get("PID", 3) || ""; // patient identifier list
  const hl7PatientId = pid.split("^")[0];
  const nameField = msg.get("PID", 5) || "";
  const [family, given] = nameField.split("^");
  const dob = msg.get("PID", 7);
  const sexRaw = msg.get("PID", 8);
  return {
    hl7PatientId,
    name: [given, family].filter(Boolean).join(" ") || "Unknown",
    age: dob ? Math.floor((Date.now() - Date.parse(`${dob.slice(0, 4)}-${dob.slice(4, 6)}-${dob.slice(6, 8)}`)) / (365.25 * 24 * 3600 * 1000)) : null,
    sex: sexRaw === "M" ? "male" : sexRaw === "F" ? "female" : "other",
  };
}

export async function handleAdtMessage(msg, io) {
  const eventType = msg.messageType.split("^")[1]; // A01 admit, A02 transfer, A03 discharge
  const pid = parsePid(msg);
  const pv1BedField = msg.get("PV1", 3) || ""; // assigned patient location
  const bedCode = pv1BedField.split("^")[1]; // e.g. "PointOfCare^Room^Bed"

  let patient = await Patient.findOne({ "externalIds.hl7PatientId": pid.hl7PatientId });

  if (eventType === "A03") {
    if (patient) {
      patient.status = "discharged";
      if (patient.bed) {
        await Bed.findByIdAndUpdate(patient.bed, { status: "cleaning", patient: null });
        patient.bed = null;
      }
      await patient.save();
      io?.emit("patient:updated", patient);
    }
    return { ok: true, action: "discharge", patientId: patient?._id };
  }

  if (!patient) {
    patient = await Patient.create({
      patientCode: await nextPatientCode(),
      name: pid.name,
      age: pid.age || 0,
      sex: pid.sex,
      chiefComplaint: "Admitted via HL7v2 ADT feed — complaint pending triage",
      acuity: 3,
      status: "triage",
      arrivalTime: new Date(),
      predictedWaitMin: predictWait(3, 0),
      sourceSystem: "hl7v2",
      externalIds: { hl7PatientId: pid.hl7PatientId },
      lastSyncedAt: new Date(),
    });
  }

  if (bedCode) {
    const bed = await Bed.findOne({ bedCode });
    if (bed && bed.status !== "occupied") {
      bed.status = "occupied";
      bed.patient = patient._id;
      await bed.save();
      patient.bed = bed._id;
      patient.status = "in_treatment";
      io?.emit("bed:updated", bed);
    }
  }
  await patient.save();
  io?.emit("patient:updated", patient);
  return { ok: true, action: eventType, patientId: patient._id };
}

export async function handleOruMessage(msg, io) {
  const pid = parsePid(msg);
  const patient = await Patient.findOne({ "externalIds.hl7PatientId": pid.hl7PatientId });
  if (!patient) return { ok: false, reason: "unknown patient" };

  const vitals = { source: "hl7v2", observedAt: new Date() };
  for (const obx of msg.getAll("OBX")) {
    const label = (obx.fields[3] || "").split("^")[1]?.toUpperCase() || (obx.fields[3] || "").toUpperCase();
    const value = parseFloat(obx.fields[5]);
    const field = LOINC_OR_LABEL_TO_FIELD[label];
    if (field && !Number.isNaN(value)) vitals[field] = value;
  }

  patient.vitals = vitals;
  const news2 = calculateNEWS2(vitals);
  patient.ewsHistory.push({ score: news2.total, risk: news2.risk });
  await patient.save();
  io?.emit("patient:updated", patient);
  return { ok: true, patientId: patient._id, news2 };
}

export async function logHl7Audit(action, meta, success, error) {
  await AuditLog.create({ action, resourceType: "HL7Message", sourceSystem: "hl7v2", metadata: meta, success, error });
}
