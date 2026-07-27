// NEWS2 (National Early Warning Score 2) calculator — adapted from PulseFlow ED web app.

function scoreRR(rr) {
  if (rr == null) return 0;
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3;
}

function scoreSpO2(spo2, onO2, scale2) {
  if (spo2 == null) return 0;
  if (!scale2) {
    if (spo2 <= 91) return 3;
    if (spo2 <= 93) return 2;
    if (spo2 <= 95) return 1;
    return 0;
  }
  if (spo2 <= 83) return 3;
  if (spo2 <= 85) return 2;
  if (spo2 <= 87) return 1;
  if (spo2 <= 92) return 0;
  if (!onO2) return 0;
  if (spo2 <= 94) return 1;
  if (spo2 <= 96) return 2;
  return 3;
}

function scoreO2(onO2) {
  return onO2 ? 2 : 0;
}

function scoreBP(sbp) {
  if (sbp == null) return 0;
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3;
}

function scoreHR(hr) {
  if (hr == null) return 0;
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3;
}

function scoreTemp(t) {
  if (t == null) return 0;
  if (t <= 35.0) return 3;
  if (t <= 36.0) return 1;
  if (t <= 38.0) return 0;
  if (t <= 39.0) return 1;
  return 2;
}

function scoreConsciousness(level) {
  return level && level !== "alert" ? 3 : 0;
}

export function calculateNEWS2(input) {
  const { respiratoryRate, spo2, scale2, supplementalO2, systolicBP, heartRate, temperatureC, consciousness } = input;

  const breakdown = [
    { label: "Respiratory rate", value: respiratoryRate ?? null, score: scoreRR(respiratoryRate) },
    { label: "SpO2", value: spo2 ?? null, score: scoreSpO2(spo2, supplementalO2, scale2) },
    { label: "Supplemental O2", value: !!supplementalO2, score: scoreO2(supplementalO2) },
    { label: "Systolic BP", value: systolicBP ?? null, score: scoreBP(systolicBP) },
    { label: "Heart rate", value: heartRate ?? null, score: scoreHR(heartRate) },
    { label: "Temperature", value: temperatureC ?? null, score: scoreTemp(temperatureC) },
    { label: "Consciousness (ACVPU)", value: consciousness ?? "alert", score: scoreConsciousness(consciousness) },
  ];

  const total = breakdown.reduce((s, b) => s + b.score, 0);
  const redFlag = breakdown.some((b) => b.score === 3);

  let risk, riskLabel, response, monitoringFrequency;

  if (total === 0) {
    risk = "low";
    riskLabel = "Low";
    response = "Continue routine monitoring";
    monitoringFrequency = "Every 12 hours";
  } else if (total <= 4 && !redFlag) {
    risk = "low";
    riskLabel = "Low";
    response = "Ward-based response; registered nurse review";
    monitoringFrequency = "Every 4-6 hours";
  } else if (redFlag && total < 5) {
    risk = "low-medium";
    riskLabel = "Low-Medium (single red flag)";
    response = "Urgent registered nurse review; consider escalation";
    monitoringFrequency = "At least hourly";
  } else if (total <= 6) {
    risk = "medium";
    riskLabel = "Medium";
    response = "Urgent review by clinician with acute care competencies";
    monitoringFrequency = "At least hourly";
  } else {
    risk = "high";
    riskLabel = "High";
    response = "Emergency assessment by critical care team; transfer to higher level of care";
    monitoringFrequency = "Continuous monitoring of vital signs";
  }

  return { total, redFlag, risk, riskLabel, response, monitoringFrequency, breakdown };
}

// --- qSOFA (sepsis screen) ---
export function calculateQSOFA({ systolicBP, respiratoryRate, alteredMentation }) {
  const criteria = [
    { label: "SBP <= 100 mmHg", value: systolicBP ?? null, score: (systolicBP ?? 999) <= 100 ? 1 : 0 },
    { label: "RR >= 22 /min", value: respiratoryRate ?? null, score: (respiratoryRate ?? 0) >= 22 ? 1 : 0 },
    { label: "Altered mentation (GCS < 15)", value: !!alteredMentation, score: alteredMentation ? 1 : 0 },
  ];
  const total = criteria.reduce((s, c) => s + c.score, 0);
  return { total, positive: total >= 2, criteria };
}
