import { fhirClient } from "./fhirClient.js";

// Registers a FHIR R4 Subscription so the EHR calls PulseFlow automatically
// whenever a matching resource changes — no polling, no manual import.
// Ref: https://hl7.org/fhir/R4/subscription.html
//
// channel.payload "application/fhir+json" asks the server to deliver the
// full changed resource in the webhook POST body (not just an id-only ping),
// which is what fhirWebhook.routes.js expects.
export async function registerFhirSubscription({ resourceType, criteria, webhookUrl, secret }) {
  const subscription = {
    resourceType: "Subscription",
    status: "requested",
    reason: `PulseFlow ED automatic ingestion — ${resourceType}`,
    criteria: criteria || resourceType,
    channel: {
      type: "rest-hook",
      endpoint: `${webhookUrl}/${secret}`,
      payload: "application/fhir+json",
      header: [`X-PulseFlow-Resource: ${resourceType}`],
    },
  };
  return fhirClient.create("Subscription", subscription);
}

// Called once on server boot when FHIR_AUTO_SUBSCRIBE=true. Registers
// Subscriptions for the three resource types that should trigger automatic
// ingestion: new/updated Patients, Encounters (admits/transfers/discharges),
// and Observations (vitals results).
export async function registerAllSubscriptions({ webhookBaseUrl, secret }) {
  const webhookUrl = `${webhookBaseUrl}/api/fhir/webhook`;
  const results = [];
  for (const resourceType of ["Patient", "Encounter", "Observation", "Location"]) {
    try {
      const sub = await registerFhirSubscription({ resourceType, webhookUrl, secret });
      results.push({ resourceType, subscriptionId: sub.id, ok: true });
      console.log(`FHIR Subscription registered for ${resourceType} -> ${webhookUrl}/${secret}`);
    } catch (err) {
      results.push({ resourceType, ok: false, error: err.message });
      console.error(`Failed to register FHIR Subscription for ${resourceType}:`, err.message);
    }
  }
  return results;
}
