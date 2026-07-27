import mongoose from "mongoose";

const bedSchema = new mongoose.Schema(
  {
    bedCode: { type: String, required: true, unique: true }, // e.g. R01
    zone: { type: String, required: true }, // Resus, Acute A, Acute B, Fast Track, Observation
    type: { type: String, enum: ["resus", "acute", "fast_track", "observation"], required: true },
    status: { type: String, enum: ["available", "occupied", "cleaning", "blocked"], default: "available" },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", default: null },
    sourceSystem: { type: String, enum: ["internal", "fhir"], default: "internal" },
    externalIds: { fhirLocationId: { type: String, index: true } },
    lastSyncedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Bed", bedSchema);
