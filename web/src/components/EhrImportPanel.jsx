import { useState } from "react";
import { api } from "../lib/api";

export default function EhrImportPanel({ onImported, onClose }) {
  const [family, setFamily] = useState("");
  const [given, setGiven] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    setError("");
    setSelected(null);
    setDetail(null);
    setLoadingSearch(true);
    try {
      const res = await api.fhirSearchPatients({ family, given });
      setResults(res.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSearch(false);
    }
  }

  // Auto-fetches the full clinical record the moment a result is selected —
  // no separate "load detail" click needed.
  async function selectPatient(r) {
    setSelected(r);
    setDetail(null);
    setError("");
    setLoadingDetail(true);
    try {
      const res = await api.fhirPatientDetail(r.fhirId);
      setDetail(res.detail);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function confirmImport() {
    if (!selected) return;
    setImporting(true);
    setError("");
    try {
      await api.fhirImportPatient(selected.fhirId, { acuity: 3, status: "waiting" });
      onImported?.();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}
    >
      <div className="panel" style={{ width: 720, maxWidth: "100%", maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2>Import patient from EHR</h2>
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: -8, marginBottom: 10 }}>
          Patients, beds, and inbound ambulances already sync automatically from the EHR (FHIR Subscriptions + HL7v2). Use this only to manually look up and pull in a specific patient the automatic feed hasn't delivered yet.
        </p>

        {!selected && (
          <>
            <div className="form-grid">
              <div>
                <label>Family name</label>
                <input value={family} onChange={(e) => setFamily(e.target.value)} placeholder="e.g. Smith" />
              </div>
              <div>
                <label>Given name</label>
                <input value={given} onChange={(e) => setGiven(e.target.value)} placeholder="e.g. John" />
              </div>
            </div>
            <button className="btn" onClick={search} disabled={loadingSearch || (!family && !given)}>
              {loadingSearch ? "Searching…" : "Search FHIR"}
            </button>
            {error && <p className="error-text">{error}</p>}

            <div style={{ marginTop: 14 }}>
              {results.map((r) => (
                <div
                  key={r.fhirId}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => selectPatient(r)}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {r.gender || "unknown"} · DOB {r.birthDate || "—"} · MRN {r.mrn || "—"}
                    </div>
                  </div>
                  <button className="btn btn-secondary">View chart</button>
                </div>
              ))}
              {!loadingSearch && results.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>
                  Search by name to find patients in the connected EHR.
                </p>
              )}
            </div>
          </>
        )}

        {selected && (
          <>
            <button className="btn btn-secondary" style={{ marginBottom: 12 }} onClick={() => { setSelected(null); setDetail(null); }}>
              ← Back to results
            </button>

            {loadingDetail && <p style={{ fontSize: 13, color: "var(--muted)" }}>Fetching full chart from FHIR…</p>}
            {error && <p className="error-text">{error}</p>}

            {detail && (
              <div>
                <div className="result-box">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <strong style={{ fontSize: 15 }}>{detail.name}</strong>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{detail.sex} · {detail.age ?? "—"}y · MRN {detail.mrn || "—"}</span>
                  </div>
                  {detail.chiefComplaint && (
                    <p style={{ fontSize: 12, marginTop: 4 }}>Primary condition: <strong>{detail.chiefComplaint}</strong></p>
                  )}
                </div>

                {detail.encounter && (
                  <Section title="Current encounter">
                    <Row label="Status" value={detail.encounter.status} />
                    <Row label="Class" value={detail.encounter.class} />
                    <Row label="Location" value={detail.encounter.location} />
                    <Row label="Reason" value={detail.encounter.reason} />
                    {detail.encounter.location && (
                      <p style={{ fontSize: 11, color: "var(--accent)", marginTop: 6 }}>
                        Will attempt to auto-assign a matching bed from this location on import.
                      </p>
                    )}
                  </Section>
                )}

                {detail.vitals && (
                  <Section title="Latest vitals">
                    <div className="pill-row">
                      {detail.vitals.heartRate != null && <span className="pill">HR {detail.vitals.heartRate}</span>}
                      {detail.vitals.respiratoryRate != null && <span className="pill">RR {detail.vitals.respiratoryRate}</span>}
                      {detail.vitals.spo2 != null && <span className="pill">SpO2 {detail.vitals.spo2}%</span>}
                      {detail.vitals.systolicBP != null && <span className="pill">SBP {detail.vitals.systolicBP}</span>}
                      {detail.vitals.temperatureC != null && <span className="pill">Temp {detail.vitals.temperatureC}°C</span>}
                    </div>
                  </Section>
                )}

                <Section title={`Conditions (${detail.conditions?.length || 0})`}>
                  {detail.conditions?.length ? (
                    detail.conditions.map((c, i) => <Row key={i} label={c.display} value={c.status} />)
                  ) : (
                    <Empty />
                  )}
                </Section>

                <Section title={`Medications (${detail.medications?.length || 0})`}>
                  {detail.medications?.length ? (
                    detail.medications.map((m, i) => <Row key={i} label={m.display} value={m.dosageText || m.status} />)
                  ) : (
                    <Empty />
                  )}
                </Section>

                <Section title={`Allergies (${detail.allergies?.length || 0})`}>
                  {detail.allergies?.length ? (
                    detail.allergies.map((a, i) => (
                      <Row key={i} label={a.display} value={`${a.criticality}${a.reaction ? ` · ${a.reaction}` : ""}`} />
                    ))
                  ) : (
                    <Empty />
                  )}
                </Section>

                <button className="btn" onClick={confirmImport} disabled={importing}>
                  {importing ? "Importing…" : "Import into PulseFlow"}
                </button>
                <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
                  Imports into Patient Tracker, auto-assigns a bed if matched, and refreshes dashboard stats, wait-time predictions, and critical alerts.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
      <span>{label}</span>
      <span style={{ color: "var(--muted)" }}>{value || "—"}</span>
    </div>
  );
}

function Empty() {
  return <p style={{ fontSize: 12, color: "var(--muted)" }}>None on file.</p>;
}
