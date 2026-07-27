import { Router } from "express";
import AuditLog from "../models/AuditLog.js";
import { ingestFromWebhookResource } from "../integrations/fhir/fhirSync.js";

const router = Router();

// POST /api/fhir/webhook/:secret
// This is the endpoint a FHIR Subscription's channel.endpoint points at.
// No JWT auth here by design — the EHR calling us can't hold a PulseFlow
// user token — instead it's secured by a long random path segment
// (FHIR_WEBHOOK_SECRET) that only the registered Subscription knows.
router.post("/:secret", async (req, res) => {
  const expected = process.env.FHIR_WEBHOOK_SECRET;
  if (!expected || req.params.secret !== expected) {
    await AuditLog.create({
      action: "fhir.webhook.rejected",
      resourceType: "Subscription",
      sourceSystem: "fhir",
      ip: req.ip,
      success: false,
      error: "Invalid or missing webhook secret",
    });
    return res.status(403).json({ error: "Invalid webhook secret" });
  }

  // A Subscription with payload "application/fhir+json" delivers either a
  // bare resource or a history Bundle wrapping one/more resources.
  const body = req.body;
  const resources = body?.resourceType === "Bundle" ? (body.entry || []).map((e) => e.resource) : [body];

  const results = [];
  for (const resource of resources.filter(Boolean)) {
    try {
      const result = await ingestFromWebhookResource(resource);
      results.push(result);
      await AuditLog.create({
        action: "fhir.webhook.ingested",
        resourceType: resource.resourceType,
        resourceId: resource.id,
        sourceSystem: "fhir",
        ip: req.ip,
        success: result.ok,
        metadata: {
          module: result.module,
          patientId: result.patient?._id,
          bedId: result.bed?._id || result.matchedBed?._id,
          ambulanceId: result.ambulance?._id,
        },
      });
      if (result.ok) {
        if (result.module === "bed") {
          req.app.get("io")?.emit("bed:updated", result.bed);
        } else if (result.module === "ambulance") {
          req.app.get("io")?.emit("ambulance:updated", result.ambulance);
        } else {
          req.app.get("io")?.emit("patient:created", result.patient);
          if (result.matchedBed) req.app.get("io")?.emit("bed:updated", result.matchedBed);
        }
      }
    } catch (err) {
      results.push({ ok: false, error: err.message });
      await AuditLog.create({
        action: "fhir.webhook.error",
        resourceType: resource?.resourceType,
        resourceId: resource?.id,
        sourceSystem: "fhir",
        ip: req.ip,
        success: false,
        error: err.message,
      });
    }
  }

  // Always 200 — FHIR servers retry/disable subscriptions on repeated
  // non-2xx responses, and a partial failure shouldn't take down delivery
  // of the rest of a batch.
  res.status(200).json({ received: resources.length, results });
});

export default router;
