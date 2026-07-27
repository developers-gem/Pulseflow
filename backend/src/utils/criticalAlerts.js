// Critical pathway alert detection — sepsis / stroke / trauma — ported 1:1
// from the original CriticalAlerts.tsx keyword + protocol logic.

const KEYWORDS = {
  sepsis: /sepsis|septic|infection|fever|sirs|pneumonia|uti|bacteremia/i,
  stroke: /stroke|cva|tia|facial droop|slurred|hemiparesis|aphasia/i,
  trauma: /trauma|mva|mvc|fall|laceration|fracture|gsw|stab|burn|head injury|crush/i,
};

const META = {
  sepsis: {
    label: "SEPSIS ALERT",
    target: "Door-to-antibiotics",
    targetMin: 60,
    protocol: [
      "Draw lactate, blood cultures x2, CBC, CMP",
      "Broad-spectrum antibiotics within 60 min",
      "30 mL/kg crystalloid if MAP < 65 or lactate >= 4",
      "Reassess MAP, lactate, urine output q1h",
    ],
  },
  stroke: {
    label: "STROKE ALERT",
    target: "Door-to-CT",
    targetMin: 25,
    protocol: [
      "Activate neurology + CT now",
      "NIH Stroke Scale, finger-stick glucose",
      "Confirm last-known-well time",
      "Non-contrast CT head; consider CTA",
      "tPA window screen if eligible (<= 4.5 h)",
    ],
  },
  trauma: {
    label: "TRAUMA ALERT",
    target: "Door-to-trauma-bay",
    targetMin: 15,
    protocol: [
      "Activate trauma team + OR on standby",
      "ATLS primary survey (ABCDE)",
      "2 large-bore IVs, type & cross 4 units",
      "FAST exam, pan-scan as indicated",
      "C-spine precautions until cleared",
    ],
  },
};

function classify(text) {
  for (const k of Object.keys(KEYWORDS)) {
    if (KEYWORDS[k].test(text || "")) return k;
  }
  return null;
}

export function detectCriticalAlerts(patients, ambulances) {
  const out = [];

  for (const p of patients) {
    if (p.status === "discharged") continue;
    const kind = classify(p.chiefComplaint);
    if (!kind) continue;
    if (p.acuity > 3) continue;
    out.push({
      id: `pt-${p._id}-${kind}`,
      kind,
      label: META[kind].label,
      target: META[kind].target,
      targetMin: META[kind].targetMin,
      protocol: META[kind].protocol,
      source: "patient",
      subject: p.name,
      detail: p.chiefComplaint,
      acuity: p.acuity,
      startedAt: p.arrivalTime,
      location: p.bed?.bedCode || p.status.replace("_", " "),
    });
  }

  for (const a of ambulances) {
    const kind = classify(a.condition);
    if (!kind) continue;
    out.push({
      id: `amb-${a._id}-${kind}`,
      kind,
      label: META[kind].label,
      target: META[kind].target,
      targetMin: META[kind].targetMin,
      protocol: META[kind].protocol,
      source: "ambulance",
      subject: a.callSign,
      detail: a.condition,
      acuity: a.acuity,
      startedAt: new Date(Date.now() - (30 - a.etaMin) * 60_000),
      etaMin: a.status === "en_route" ? a.etaMin : 0,
      location: a.origin,
    });
  }

  const order = { trauma: 0, stroke: 1, sepsis: 2 };
  out.sort((x, y) => order[x.kind] - order[y.kind] || x.acuity - y.acuity);

  const counts = { sepsis: 0, stroke: 0, trauma: 0 };
  out.forEach((a) => counts[a.kind]++);

  return { alerts: out, counts };
}
