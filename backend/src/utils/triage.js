// Rule-based Emergency Severity Index (ESI) triage assessor.
// Mirrors the shape of the original AI-driven triage tool but is computed
// with red-flag heuristics so the MVP has no external LLM dependency.
// Swap the internals for a real model call later without changing the API contract.

import { calculateNEWS2 } from "./ews.js";

const RED_FLAG_KEYWORDS = [
  { kw: /chest pain/i, flag: "Possible acute coronary syndrome — chest pain reported" },
  { kw: /stroke|slurred speech|facial droop|one[- ]sided weakness/i, flag: "Stroke-like presentation" },
  { kw: /difficulty breathing|shortness of breath|can'?t breathe/i, flag: "Respiratory distress" },
  { kw: /unresponsive|unconscious|not waking/i, flag: "Altered / loss of consciousness" },
  { kw: /severe bleeding|hemorrhage|uncontrolled bleeding/i, flag: "Uncontrolled bleeding" },
  { kw: /anaphylaxis|allergic reaction.*(throat|swelling)/i, flag: "Possible anaphylaxis" },
  { kw: /suicid|self[- ]harm/i, flag: "Self-harm / suicide risk" },
  { kw: /seizure/i, flag: "Active or recent seizure" },
];

function detectRedFlags(complaint, history) {
  const text = `${complaint} ${history || ""}`;
  return RED_FLAG_KEYWORDS.filter((r) => r.kw.test(text)).map((r) => r.flag);
}

export function assessTriage(input) {
  const {
    age,
    sex,
    chiefComplaint,
    symptomDurationHours,
    heartRate,
    systolicBP,
    respiratoryRate,
    spo2,
    temperatureC,
    painScore,
    history,
  } = input;

  const news2 = calculateNEWS2({
    heartRate,
    systolicBP,
    respiratoryRate,
    spo2,
    temperatureC,
    consciousness: "alert",
  });

  const textRedFlags = detectRedFlags(chiefComplaint, history);
  const vitalRedFlags = news2.breakdown.filter((b) => b.score === 3).map((b) => `Critical ${b.label.toLowerCase()}: ${b.value}`);
  const redFlags = [...textRedFlags, ...vitalRedFlags];

  // Baseline ESI from NEWS2 total, then escalate on red flags / age extremes.
  let esiLevel;
  if (news2.total >= 7 || redFlags.length >= 2) esiLevel = 1;
  else if (news2.total >= 5 || redFlags.length === 1) esiLevel = 2;
  else if (news2.total >= 3 || (painScore ?? 0) >= 7) esiLevel = 3;
  else if (news2.total >= 1 || (painScore ?? 0) >= 4) esiLevel = 4;
  else esiLevel = 5;

  // Age modifiers: infants and elderly get bumped up one level (min 1) on ambiguous cases.
  if ((age <= 2 || age >= 75) && esiLevel > 2) esiLevel -= 1;

  const acuityLabels = { 1: "Resuscitation", 2: "Emergent", 3: "Urgent", 4: "Less Urgent", 5: "Non-Urgent" };
  const zoneByLevel = { 1: "Resus", 2: "Resus", 3: "Acute", 4: "Acute", 5: "Fast Track" };

  const confidence = Math.max(0.45, Math.min(0.9, 0.85 - redFlags.length * 0.05 - (news2.total === 0 ? 0.1 : 0)));

  const differentials = buildDifferentials(chiefComplaint);
  const immediateActions = buildActions(esiLevel, redFlags);
  const workupSuggestions = buildWorkup(chiefComplaint, esiLevel);

  const estimatedTreatmentMin = { 1: 90, 2: 70, 3: 50, 4: 30, 5: 15 }[esiLevel];

  const dispositionBase = { 1: [70, 20, 10], 2: [50, 35, 15], 3: [30, 60, 10], 4: [10, 85, 5], 5: [3, 95, 2] }[esiLevel];

  return {
    esiLevel,
    acuityLabel: acuityLabels[esiLevel],
    confidence: Number(confidence.toFixed(2)),
    recommendedZone: zoneByLevel[esiLevel],
    redFlags,
    differentials,
    immediateActions,
    workupSuggestions,
    predictedDispositionPct: {
      admit: dispositionBase[0],
      discharge: dispositionBase[1],
      transfer: dispositionBase[2],
    },
    estimatedTreatmentMin,
    news2,
    reasoning: `ESI ${esiLevel} (${acuityLabels[esiLevel]}) assigned from NEWS2 total ${news2.total}${
      redFlags.length ? ` and ${redFlags.length} red flag(s)` : ""
    }, age ${age}${symptomDurationHours != null ? `, symptoms ${symptomDurationHours}h` : ""}.`,
    disclaimer:
      "This is automated decision support based on rule-based heuristics, not a substitute for clinical judgment. All assessments must be confirmed by a qualified clinician.",
  };
}

function buildDifferentials(complaint) {
  const c = complaint.toLowerCase();
  if (c.includes("chest pain")) return ["Acute coronary syndrome", "Musculoskeletal chest pain", "GERD", "Pulmonary embolism", "Anxiety"];
  if (c.includes("breath")) return ["Asthma exacerbation", "COPD exacerbation", "Pneumonia", "Heart failure", "Pulmonary embolism"];
  if (c.includes("abdom")) return ["Appendicitis", "Gastroenteritis", "Biliary colic", "Bowel obstruction", "UTI"];
  if (c.includes("headache")) return ["Migraine", "Tension headache", "Subarachnoid hemorrhage", "Meningitis", "Hypertensive emergency"];
  if (c.includes("fall") || c.includes("fracture")) return ["Fracture", "Soft tissue injury", "Concussion", "Joint dislocation"];
  return ["Requires clinical assessment to narrow differential"];
}

function buildActions(esiLevel, redFlags) {
  const actions = [];
  if (esiLevel <= 2) actions.push("Move to resuscitation/acute bay immediately", "Continuous vitals monitoring", "Establish IV access");
  if (esiLevel <= 3) actions.push("Obtain 12-lead ECG if cardiac/respiratory complaint", "Notify treating physician");
  actions.push("Reassess vitals per monitoring frequency", "Document chief complaint and onset");
  if (redFlags.length) actions.push("Escalate red flags to charge nurse / attending immediately");
  return actions;
}

function buildWorkup(complaint, esiLevel) {
  const c = complaint.toLowerCase();
  const workup = [];
  if (c.includes("chest pain")) workup.push("Troponin", "ECG", "Chest X-ray", "BMP");
  if (c.includes("breath")) workup.push("Chest X-ray", "ABG/VBG", "BNP", "D-dimer if PE suspected");
  if (c.includes("abdom")) workup.push("CBC", "CMP", "Lipase", "Abdominal CT/ultrasound");
  if (c.includes("headache")) workup.push("Non-contrast head CT if red flags", "CBC", "Basic metabolic panel");
  if (esiLevel <= 2) workup.push("Type & screen", "Continuous cardiac monitoring");
  if (!workup.length) workup.push("Vitals recheck", "Focused history and physical");
  return [...new Set(workup)];
}
