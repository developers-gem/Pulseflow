import { useState } from "react";
import { api } from "../lib/api";

const EMPTY = { respiratoryRate: "", spo2: "", supplementalO2: false, systolicBP: "", heartRate: "", temperatureC: "", consciousness: "alert", alteredMentation: false };

export default function EwsCalculator() {
  const [form, setForm] = useState(EMPTY);
  const [tab, setTab] = useState("news2");
  const [result, setResult] = useState(null);
  const [qsofa, setQsofa] = useState(null);
  const [loading, setLoading] = useState(false);

  function num(v) {
    return v === "" ? undefined : Number(v);
  }

  async function calculate() {
    setLoading(true);
    try {
      const payload = {
        respiratoryRate: num(form.respiratoryRate),
        spo2: num(form.spo2),
        supplementalO2: form.supplementalO2,
        systolicBP: num(form.systolicBP),
        heartRate: num(form.heartRate),
        temperatureC: num(form.temperatureC),
        consciousness: form.consciousness,
      };
      const [ews, qs] = await Promise.all([
        api.calculateEws(payload),
        api.calculateQsofa({
          systolicBP: num(form.systolicBP),
          respiratoryRate: num(form.respiratoryRate),
          alteredMentation: form.alteredMentation || form.consciousness !== "alert",
        }),
      ]);
      setResult(ews.result);
      setQsofa(qs.result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2>Early Warning Score</h2>
      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: -8, marginBottom: 10 }}>NEWS2 deterioration score · qSOFA sepsis screen</p>

      <div className="tabs" style={{ marginBottom: 12 }}>
        <div className={`tab ${tab === "news2" ? "active" : ""}`} onClick={() => setTab("news2")}>NEWS2</div>
        <div className={`tab ${tab === "qsofa" ? "active" : ""}`} onClick={() => setTab("qsofa")}>qSOFA</div>
      </div>

      <div className="form-grid">
        <div>
          <label>Respiratory rate (/min)</label>
          <input value={form.respiratoryRate} onChange={(e) => setForm({ ...form, respiratoryRate: e.target.value })} />
        </div>
        <div>
          <label>SpO2 (%)</label>
          <input value={form.spo2} onChange={(e) => setForm({ ...form, spo2: e.target.value })} />
        </div>
        <div>
          <label>Systolic BP (mmHg)</label>
          <input value={form.systolicBP} onChange={(e) => setForm({ ...form, systolicBP: e.target.value })} />
        </div>
        <div>
          <label>Heart rate (bpm)</label>
          <input value={form.heartRate} onChange={(e) => setForm({ ...form, heartRate: e.target.value })} />
        </div>
        <div>
          <label>Temperature (°C)</label>
          <input value={form.temperatureC} onChange={(e) => setForm({ ...form, temperatureC: e.target.value })} />
        </div>
        <div>
          <label>Consciousness (ACVPU)</label>
          <select value={form.consciousness} onChange={(e) => setForm({ ...form, consciousness: e.target.value })}>
            <option value="alert">Alert</option>
            <option value="confusion">New confusion</option>
            <option value="voice">Voice</option>
            <option value="pain">Pain</option>
            <option value="unresponsive">Unresponsive</option>
          </select>
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <input type="checkbox" style={{ width: "auto" }} checked={form.supplementalO2} onChange={(e) => setForm({ ...form, supplementalO2: e.target.checked })} />
        On supplemental O2
      </label>
      <button className="btn" onClick={calculate} disabled={loading}>
        {loading ? "Calculating…" : "Calculate"}
      </button>

      {tab === "news2" && result && (
        <div className="result-box">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>Total score: {result.total}</strong>
            <span className={`badge badge-${result.risk === "high" ? 1 : result.risk === "medium" ? 3 : 5}`}>
              {result.riskLabel} risk {result.redFlag ? "· RED FLAG" : ""}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>{result.response}</p>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Monitoring: {result.monitoringFrequency}</p>
          <div style={{ marginTop: 8 }}>
            {result.breakdown.map((b) => (
              <div key={b.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--muted)" }}>{b.label}</span>
                <span>{String(b.value)}</span>
                <span>+{b.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "qsofa" && qsofa && (
        <div className="result-box">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>qSOFA: {qsofa.total}</strong>
            <span className={`badge badge-${qsofa.positive ? 1 : 5}`}>{qsofa.positive ? "Positive sepsis screen" : "Negative"}</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            {qsofa.positive
              ? ">= 2 criteria met — consider sepsis bundle, lactate, blood cultures, and broad-spectrum antibiotics within 1 hour."
              : "Fewer than 2 criteria. Continue assessment if clinical suspicion remains."}
          </p>
          <div style={{ marginTop: 8 }}>
            {qsofa.criteria.map((c) => (
              <div key={c.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--muted)" }}>{c.label}</span>
                <span>{String(c.value)}</span>
                <span>{c.score ? "✓" : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
