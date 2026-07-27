import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userEmail: String,
    action: { type: String, required: true },
    resourceType: String,
    resourceId: String,
    sourceSystem: { type: String, enum: ["internal", "fhir", "hl7v2"] },
    ip: String,
    metadata: mongoose.Schema.Types.Mixed,
    success: { type: Boolean, default: true },
    error: String,
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

export default mongoose.model("AuditLog", auditLogSchema);
