import { useState } from "react";
import { api } from "../lib/api";

const EMPTY = { age: "", sex: "female", chiefComplaint: "", symptomDurationHours: "", heartRate: "", systolicBP: "", respiratoryRate: "", spo2: "", temperatureC: "", painScore: "", history: "" };

export default function TriageTool() {
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function num(v) {
    return v === "" ? undefined : Number(v);
  }

  async function assess() {
    setError("");
    setLoading(true);
    try {
      const res = await api.assessTriage({
        age: num(form.age),
        sex: form.sex,
        chiefComplaint: form.chiefComplaint,
        symptomDurationHours: num(form.symptomDurationHours),
        heartRate: num(form.heartRate),
        systolicBP: num(form.systolicBP),
        respiratoryRate: num(form.respiratoryRate),
        spo2: num(form.spo2),
        temperatureC: num(form.temperatureC),
        painScore: num(form.painScore),
        history: form.history,
      });
      setResult(res.assessment);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2>AI Triage Tool (ESI Assessment)</h2>
      <div className="form-grid">
        <div>
          <label>Age</label>
          <input value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        </div>
        <div>
          <label>Sex</label>
          <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label>Chief complaint</label>
          <input value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} placeholder="e.g. Chest pain" />
        </div>
        <div>
          <label>Heart rate</label>
          <input value={form.heartRate} onChange={(e) => setForm({ ...form, heartRate: e.target.value })} />
        </div>
        <div>
          <label>Systolic BP</label>
          <input value={form.systolicBP} onChange={(e) => setForm({ ...form, systolicBP: e.target.value })} />
        </div>
        <div>
          <label>Respiratory rate</label>
          <input value={form.respiratoryRate} onChange={(e) => setForm({ ...form, respiratoryRate: e.target.value })} />
        </div>
        <div>
          <label>SpO2 (%)</label>
          <input value={form.spo2} onChange={(e) => setForm({ ...form, spo2: e.target.value })} />
        </div>
        <div>
          <label>Temperature (°C)</label>
          <input value={form.temperatureC} onChange={(e) => setForm({ ...form, temperatureC: e.target.value })} />
        </div>
        <div>
          <label>Pain score (0-10)</label>
          <input value={form.painScore} onChange={(e) => setForm({ ...form, painScore: e.target.value })} />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label>Relevant history</label>
          <textarea rows={2} value={form.history} onChange={(e) => setForm({ ...form, history: e.target.value })} />
        </div>
      </div>
      <button className="btn" onClick={assess} disabled={loading || !form.age || !form.chiefComplaint}>
        {loading ? "Assessing…" : "Run triage assessment"}
      </button>
      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="result-box">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>
              ESI {result.esiLevel} · {result.acuityLabel}
            </strong>
            <span className={`badge badge-${result.esiLevel}`}>{Math.round(result.confidence * 100)}% confidence</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>{result.reasoning}</p>
          <p style={{ fontSize: 12 }}>
            <strong>Recommended zone:</strong> {result.recommendedZone} · <strong>Est. treatment:</strong> {result.estimatedTreatmentMin}m
          </p>
          {result.redFlags?.length > 0 && (
            <>
              <div style={{ fontSize: 12, marginTop: 8 }}>Red flags:</div>
              <div className="pill-row">
                {result.redFlags.map((f, i) => (
                  <span key={i} className="pill">{f}</span>
                ))}
              </div>
            </>
          )}
          <div style={{ fontSize: 12, marginTop: 8 }}>Immediate actions:</div>
          <div className="pill-row">
            {result.immediateActions?.map((f, i) => (
              <span key={i} className="pill">{f}</span>
            ))}
          </div>
          <div style={{ fontSize: 12, marginTop: 8 }}>Suggested workup:</div>
          <div className="pill-row">
            {result.workupSuggestions?.map((f, i) => (
              <span key={i} className="pill">{f}</span>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
