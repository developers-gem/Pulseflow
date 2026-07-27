import mongoose from "mongoose";

const ambulanceSchema = new mongoose.Schema(
  {
    callSign: { type: String, required: true },
    etaMin: { type: Number, required: true },
    acuity: { type: Number, min: 1, max: 5, required: true },
    condition: { type: String, required: true },
    origin: { type: String, required: true },
    status: { type: String, enum: ["dispatched", "en_route", "arrived"], default: "en_route" },
    sourceSystem: { type: String, enum: ["internal", "fhir"], default: "internal" },
    externalIds: { fhirEncounterId: { type: String, index: true } },
    lastSyncedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Ambulance", ambulanceSchema);
