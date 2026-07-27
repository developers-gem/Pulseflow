import { fhirClient } from "./fhirClient.js";
import {
  mapFhirPatient,
  mapFhirObservationToVitals,
  mapFhirConditionToComplaint,
  mapFhirConditionsList,
  mapFhirMedicationRequests,
  mapFhirAllergies,
  mapFhirEncounter,
  mapFhirLocationToBed,
  isInboundAmbulanceEncounter,
  mapFhirEncounterToAmbulance,
} from "./fhirMappers.js";
import Patient from "../../models/Patient.js";
import Bed from "../../models/Bed.js";
import Ambulance from "../../models/Ambulance.js";
import { calculateNEWS2 } from "../../utils/ews.js";
import { predictWait } from "../../utils/wait.js";

export async function searchFhirPatients({ family, given, mrn }) {
  const params = {};
  if (family) params.family = family;
  if (given) params.given = given;
  if (mrn) params.identifier = mrn;
  const bundle = await fhirClient.search("Patient", params);
  return (bundle.entry || []).map((e) => e.resource);
}

// Pulls every clinically-relevant resource for a patient from the FHIR
// server in parallel: demographics, vitals, conditions, medications,
// allergies, and the most recent encounter (for bed/location matching).
// Read-only against the EHR — this never writes to Mongo itself.
async function fetchFullFhirRecord(fhirPatientId) {
  const [fhirPatient, obsBundle, condBundle, medBundle, allergyBundle, encBundle] = await Promise.all([
    fhirClient.read("Patient", fhirPatientId),
    fhirClient.search("Observation", { patient: fhirPatientId, category: "vital-signs", _sort: "-date", _count: 20 }),
    fhirClient.search("Condition", { patient: fhirPatientId, _count: 10 }),
    fhirClient.search("MedicationRequest", { patient: fhirPatientId, _count: 10 }),
    fhirClient.search("AllergyIntolerance", { patient: fhirPatientId, _count: 10 }),
    fhirClient.search("Encounter", { patient: fhirPatientId, _sort: "-date", _count: 1 }),
  ]);

  const observations = (obsBundle.entry || []).map((e) => e.resource);
  const conditions = (condBundle.entry || []).map((e) => e.resource);
  const medications = (medBundle.entry || []).map((e) => e.resource);
  const allergies = (allergyBundle.entry || []).map((e) => e.resource);
  const encounterResource = (encBundle.entry || [])[0]?.resource || null;

  return {
    fhirPatient,
    mapped: mapFhirPatient(fhirPatient),
    vitals: observations.length ? mapFhirObservationToVitals(observations) : null,
    conditions: mapFhirConditionsList(conditions),
    chiefComplaint: mapFhirConditionToComplaint(conditions),
    medications: mapFhirMedicationRequests(medications),
    allergies: mapFhirAllergies(allergies),
    encounter: mapFhirEncounter(encounterResource),
  };
}

// Full clinical detail preview — called automatically as soon as the user
// selects a search result in the UI, before they confirm the import.
export async function getFhirPatientDetail(fhirPatientId) {
  const record = await fetchFullFhirRecord(fhirPatientId);
  return {
    fhirId: fhirPatientId,
    name: record.mapped.name,
    age: record.mapped.age,
    sex: record.mapped.sex,
    mrn: record.mapped.mrn,
    vitals: record.vitals,
    conditions: record.conditions,
    chiefComplaint: record.chiefComplaint,
    medications: record.medications,
    allergies: record.allergies,
    encounter: record.encounter,
  };
}

// Imports (or refreshes) a patient into the local Patient collection,
// including an attempt to auto-assign a bed if the FHIR Encounter's
// location matches a known bedCode. Read-only against the EHR.
export async function importPatientFromFhir(fhirPatientId, { acuity = 3, status = "waiting" } = {}) {
  const record = await fetchFullFhirRecord(fhirPatientId);
  const { mapped, vitals, conditions, chiefComplaint, medications, allergies, encounter } = record;

  const existing = await Patient.findOne({ "externalIds.fhirPatientId": fhirPatientId });
  const patientCode = existing?.patientCode || (await nextPatientCode());

  // Try to auto-match a bed from the encounter's location string against
  // known bedCodes (e.g. FHIR location display "ED Bed 4" -> bedCode "A04").
  let matchedBed = null;
  if (encounter?.location) {
    const candidates = await Bed.find({ status: { $ne: "occupied" } });
    matchedBed = candidates.find((b) => encounter.location.toUpperCase().includes(b.bedCode.toUpperCase())) || null;
  }

  const doc = {
    ...mapped,
    patientCode,
    chiefComplaint: existing?.chiefComplaint || chiefComplaint || "Imported from EHR — complaint pending triage",
    acuity: existing?.acuity || acuity,
    status: existing?.status || (matchedBed ? "in_treatment" : status),
    arrivalTime: existing?.arrivalTime || (encounter?.periodStart ? new Date(encounter.periodStart) : new Date()),
    predictedWaitMin: existing?.predictedWaitMin ?? predictWait(acuity, 0),
    conditions,
    medications,
    allergies,
    encounter: encounter
      ? { encounterId: encounter.encounterId, status: encounter.status, class: encounter.class, location: encounter.location, periodStart: encounter.periodStart, reason: encounter.reason }
      : undefined,
    ...(vitals ? { vitals } : {}),
    ...(matchedBed ? { bed: matchedBed._id } : {}),
  };

  const patient = existing
    ? await Patient.findByIdAndUpdate(existing._id, doc, { new: true })
    : await Patient.create(doc);

  if (matchedBed) {
    matchedBed.status = "occupied";
    matchedBed.patient = patient._id;
    await matchedBed.save();
  }

  if (vitals) {
    const news2 = calculateNEWS2(vitals);
    patient.ewsHistory.push({ score: news2.total, risk: news2.risk });
    await patient.save();
  }

  return { patient, matchedBed };
}

// --- Beds, via FHIR Location (operationalStatus = standard HL7 bed-status codes) ---

export async function importBedFromFhirLocation(fhirLocation) {
  const mapped = mapFhirLocationToBed(fhirLocation);
  const existing = await Bed.findOne({
    $or: [{ "externalIds.fhirLocationId": fhirLocation.id }, { bedCode: mapped.bedCode }],
  });

  const bed = existing
    ? await Bed.findByIdAndUpdate(existing._id, mapped, { new: true })
    : await Bed.create({ ...mapped, type: existing?.type || "acute" });

  return bed;
}

// --- Ambulances, via FHIR Encounter (class=EMER, status=planned = inbound/not yet arrived) ---

export async function importAmbulanceFromFhirEncounter(encounterResource) {
  const mapped = mapFhirEncounterToAmbulance(encounterResource);
  const existing = await Ambulance.findOne({ "externalIds.fhirEncounterId": encounterResource.id });

  const ambulance = existing
    ? await Ambulance.findByIdAndUpdate(existing._id, mapped, { new: true })
    : await Ambulance.create(mapped);

  return ambulance;
}

async function nextPatientCode() {
  const last = await Patient.findOne().sort({ createdAt: -1 });
  const lastNum = last?.patientCode ? parseInt(last.patientCode.split("-")[1], 10) : 1000;
  return `P-${lastNum + 1}`;
}

// Given any FHIR resource a Subscription might deliver (Patient, Encounter,
// Observation, Condition, ...), resolves the FHIR Patient id it belongs to.
export function resolvePatientIdFromResource(resource) {
  if (!resource) return null;
  if (resource.resourceType === "Patient") return resource.id;
  const ref = resource.subject?.reference || resource.patient?.reference;
  if (ref?.startsWith("Patient/")) return ref.split("/")[1];
  return null;
}

// Single entry point for the FHIR webhook: routes whatever resource the
// Subscription delivered to the right module — Patient/Observation/Condition
// -> Patient Tracker (+ derived Critical Alerts / Wait Times), Location ->
// Bed Management, planned EMER Encounter -> Ambulance Forecast. Fully
// automatic, triggered by the EHR itself — no human clicks anywhere in
// this path.
export async function ingestFromWebhookResource(resource) {
  if (!resource?.resourceType) {
    return { ok: false, reason: "Resource missing resourceType" };
  }

  if (resource.resourceType === "Location") {
    const bed = await importBedFromFhirLocation(resource);
    return { ok: true, module: "bed", bed, triggeredBy: "Location" };
  }

  if (resource.resourceType === "Encounter" && isInboundAmbulanceEncounter(resource)) {
    const ambulance = await importAmbulanceFromFhirEncounter(resource);
    return { ok: true, module: "ambulance", ambulance, triggeredBy: "Encounter(planned/EMER)" };
  }

  // Any other Encounter (arrived/in-progress/finished) means the patient
  // has landed — promote them via the normal patient import path, and if
  // they were previously tracked as an inbound ambulance, that record is
  // now resolved into a patient, so remove it.
  if (resource.resourceType === "Encounter") {
    await Ambulance.findOneAndDelete({ "externalIds.fhirEncounterId": resource.id });
  }

  const fhirPatientId = resolvePatientIdFromResource(resource);
  if (!fhirPatientId) {
    return { ok: false, reason: `Could not resolve a Patient from ${resource.resourceType}` };
  }
  const { patient, matchedBed } = await importPatientFromFhir(fhirPatientId);
  return { ok: true, module: "patient", patient, matchedBed, triggeredBy: resource.resourceType };
}
