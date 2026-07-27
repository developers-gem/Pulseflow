import mongoose from "mongoose";

const vitalsSchema = new mongoose.Schema(
  {
    heartRate: Number,
    systolicBP: Number,
    respiratoryRate: Number,
    spo2: Number,
    temperatureC: Number,
    consciousness: { type: String, enum: ["alert", "confusion", "voice", "pain", "unresponsive"], default: "alert" },
    supplementalO2: { type: Boolean, default: false },
    painScore: Number,
    source: { type: String, enum: ["manual", "fhir", "hl7v2"], default: "manual" },
    observedAt: Date,
  },
  { _id: false }
);

const patientSchema = new mongoose.Schema(
  {
    patientCode: { type: String, required: true, unique: true }, // e.g. P-1001
    name: { type: String, required: true },
    age: { type: Number, required: true },
    sex: { type: String, enum: ["male", "female", "other"], default: "other" },
    chiefComplaint: { type: String, required: true },
    acuity: { type: Number, min: 1, max: 5, required: true }, // ESI 1-5
    status: {
      type: String,
      enum: ["waiting", "triage", "in_treatment", "awaiting_bed", "discharged"],
      default: "waiting",
    },
    arrivalTime: { type: Date, default: Date.now },
    bed: { type: mongoose.Schema.Types.ObjectId, ref: "Bed", default: null },
    predictedWaitMin: { type: Number, default: 0 },
    vitals: vitalsSchema,
    ewsHistory: [
      {
        score: Number,
        risk: String,
        recordedAt: { type: Date, default: Date.now },
      },
    ],
    notes: String,
    mrn: { type: String, index: true },
    sourceSystem: { type: String, enum: ["internal", "fhir", "hl7v2"], default: "internal" },
    externalIds: {
      fhirPatientId: { type: String, index: true },
      fhirEncounterId: String,
      hl7PatientId: String,
    },
    lastSyncedAt: Date,
    conditions: [{ display: String, status: String, onsetDateTime: Date, _id: false }],
    medications: [{ display: String, status: String, dosageText: String, _id: false }],
    allergies: [{ display: String, criticality: String, reaction: String, _id: false }],
    encounter: {
      encounterId: String,
      status: String,
      class: String,
      location: String,
      periodStart: Date,
      reason: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Patient", patientSchema);
