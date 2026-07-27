// Maps FHIR R4 resources to PulseFlow's internal shapes. Kept deliberately
// defensive — real-world FHIR servers omit fields constantly.

export function mapFhirPatient(fhirPatient) {
  const name = fhirPatient.name?.[0];
  const fullName = name ? [...(name.given || []), name.family].filter(Boolean).join(" ") : "Unknown";
  const mrn = fhirPatient.identifier?.find((i) => i.type?.coding?.[0]?.code === "MR")?.value
    || fhirPatient.identifier?.[0]?.value;

  return {
    name: fullName,
    age: fhirPatient.birthDate ? ageFromBirthDate(fhirPatient.birthDate) : null,
    sex: mapGender(fhirPatient.gender),
    mrn,
    sourceSystem: "fhir",
    externalIds: { fhirPatientId: fhirPatient.id },
    lastSyncedAt: new Date(),
  };
}

export function mapFhirObservationToVitals(observations) {
  const vitals = { source: "fhir", observedAt: new Date() };
  const LOINC = {
    "8867-4": "heartRate",
    "9279-1": "respiratoryRate",
    "2708-6": "spo2", "59408-5": "spo2",
    "8480-6": "systolicBP",
    "8310-5": "temperatureC",
  };

  for (const obs of observations) {
    const code = obs.code?.coding?.find((c) => LOINC[c.code])?.code;
    if (!code) continue;
    const field = LOINC[code];
    const value = obs.valueQuantity?.value ?? obs.component?.[0]?.valueQuantity?.value;
    if (value != null) vitals[field] = value;
    if (obs.effectiveDateTime) vitals.observedAt = new Date(obs.effectiveDateTime);
  }
  return vitals;
}

export function mapFhirConditionToComplaint(conditions) {
  const active = conditions.find((c) => c.clinicalStatus?.coding?.[0]?.code === "active") || conditions[0];
  return active?.code?.text || active?.code?.coding?.[0]?.display || null;
}

export function mapFhirConditionsList(conditions) {
  return conditions.map((c) => ({
    display: c.code?.text || c.code?.coding?.[0]?.display || "Unspecified condition",
    status: c.clinicalStatus?.coding?.[0]?.code || "unknown",
    onsetDateTime: c.onsetDateTime || null,
  }));
}

export function mapFhirMedicationRequests(medicationRequests) {
  return medicationRequests.map((m) => ({
    display: m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display || "Unspecified medication",
    status: m.status || "unknown",
    dosageText: m.dosageInstruction?.[0]?.text || null,
  }));
}

export function mapFhirAllergies(allergies) {
  return allergies.map((a) => ({
    display: a.code?.text || a.code?.coding?.[0]?.display || "Unspecified allergy",
    criticality: a.criticality || "unknown",
    reaction: a.reaction?.[0]?.manifestation?.[0]?.text || a.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || null,
  }));
}

export function mapFhirEncounter(encounter) {
  if (!encounter) return null;
  const location = encounter.location?.[0]?.location?.display || encounter.location?.[0]?.location?.reference || null;
  return {
    encounterId: encounter.id,
    status: encounter.status || null,
    class: encounter.class?.display || encounter.class?.code || null,
    location,
    periodStart: encounter.period?.start || null,
    reason: encounter.reasonCode?.[0]?.text || encounter.reasonCode?.[0]?.coding?.[0]?.display || null,
  };
}

// HL7 v2-0116 bed status codes, the standard FHIR Location.operationalStatus
// vocabulary real hospital bed-management systems use.
const BED_STATUS_MAP = {
  O: "occupied",   // Occupied
  U: "available",  // Unoccupied
  H: "cleaning",   // Housekeeping
  C: "blocked",    // Closed
  K: "blocked",    // Contaminated
  I: "blocked",    // Isolated
  P: "cleaning",   // Pending housekeeping/cleaning
};

export function mapFhirLocationToBed(location) {
  const opStatusCode = location.operationalStatus?.code;
  const bedCode = location.identifier?.[0]?.value || location.name || location.id;
  return {
    bedCode,
    zone: location.partOf?.display || location.physicalType?.text || "Unassigned",
    status: BED_STATUS_MAP[opStatusCode] || "available",
    sourceSystem: "fhir",
    externalIds: { fhirLocationId: location.id },
    lastSyncedAt: new Date(),
  };
}

// A FHIR Encounter with class=EMER and status=planned is the standard way
// an EHR represents "patient is inbound via EMS, not yet arrived" — the
// FHIR equivalent of an ambulance dispatch record.
export function isInboundAmbulanceEncounter(encounter) {
  const classCode = encounter.class?.code || encounter.class?.display || "";
  return encounter.status === "planned" && /EMER/i.test(classCode);
}

export function mapFhirEncounterToAmbulance(encounter) {
  const etaIso = encounter.period?.start;
  const etaMin = etaIso ? Math.max(0, Math.round((new Date(etaIso).getTime() - Date.now()) / 60000)) : 15;
  return {
    callSign: encounter.identifier?.[0]?.value || `EMS-${encounter.id}`,
    etaMin,
    acuity: mapPriorityToAcuity(encounter.priority?.coding?.[0]?.code),
    condition: encounter.reasonCode?.[0]?.text || encounter.reasonCode?.[0]?.coding?.[0]?.display || "Inbound patient — details pending",
    origin: encounter.hospitalization?.origin?.display || "Unknown origin",
    status: "en_route",
    sourceSystem: "fhir",
    externalIds: { fhirEncounterId: encounter.id },
    lastSyncedAt: new Date(),
  };
}

function mapPriorityToAcuity(priorityCode) {
  const map = { EM: 2, UR: 3, R: 4, A: 1 }; // ActPriority-ish codes; defensive fallback below
  return map[priorityCode] || 3;
}

function mapGender(fhirGender) {
  if (fhirGender === "male" || fhirGender === "female") return fhirGender;
  return "other";
}

function ageFromBirthDate(birthDate) {
  const dob = new Date(birthDate);
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}
