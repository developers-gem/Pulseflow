const acuityLabel = { 1: "Resuscitation", 2: "Emergent", 3: "Urgent", 4: "Less Urgent", 5: "Non-Urgent" };

export default function AmbulanceForecast({ ambulances, forecast }) {
  const sorted = [...ambulances].sort((a, b) => a.etaMin - b.etaMin);
  const hourly = forecast?.hourlyForecast || [];
  const maxExpected = Math.max(...hourly.map((f) => f.high), 1);
  const mix = (forecast?.acuityMix || []).filter((m) => m.count > 0);

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2>Ambulance Arrival Forecasting</h2>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: -6 }}>Live GPS · predictive model</p>
        </div>
        {forecast?.surge && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--critical)", border: "1px solid var(--critical)", borderRadius: 6, padding: "3px 8px" }}>
            Surge alert
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, margin: "12px 0" }}>
        <MiniStat label="Inbound" value={forecast?.inbound ?? sorted.length} />
        <MiniStat label="<= 15 min" value={forecast?.next15Min ?? 0} warn={forecast?.next15Min >= 3} />
        <MiniStat label="<= 30 min" value={forecast?.next30Min ?? 0} />
        <MiniStat label="Critical" value={forecast?.criticalInbound ?? 0} critical={forecast?.criticalInbound > 0} />
      </div>

      {hourly.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "10px 0", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>6-Hour Arrival Forecast (expected, 80% CI)</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
            {hourly.map((f, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                <div style={{ fontSize: 10, marginBottom: 2 }}>{f.expected.toFixed(1)}</div>
                <div
                  style={{
                    width: 16,
                    height: `${(f.expected / maxExpected) * 100}%`,
                    borderRadius: "4px 4px 0 0",
                    background: f.expected >= 4 ? "linear-gradient(180deg, var(--warning), var(--critical))" : "linear-gradient(180deg, var(--accent), var(--primary))",
                  }}
                />
                <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 4 }}>{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mix.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Inbound Acuity Mix</div>
          <div style={{ display: "flex", height: 6, borderRadius: 4, overflow: "hidden" }}>
            {mix.map((m) => (
              <div key={m.acuity} style={{ width: `${m.pct}%`, background: acuityBarColor(m.acuity) }} title={`${acuityLabel[m.acuity]}: ${m.count}`} />
            ))}
          </div>
          <div className="pill-row">
            {mix.map((m) => (
              <span key={m.acuity} className="pill">L{m.acuity} · {m.count}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Inbound Units</div>
      {sorted.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No inbound ambulances.</p>}
      {sorted.map((a) => (
        <div key={a._id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>
              <strong>{a.callSign}</strong>
              {a.sourceSystem === "fhir" && (
                <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(34,211,238,0.15)", color: "var(--accent)" }} title="Auto-synced from EHR (inbound Encounter)">
                  EHR
                </span>
              )}
            </span>
            <span className={`badge badge-${a.acuity}`}>ETA {a.etaMin}m</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.condition} · from {a.origin}</div>
        </div>
      ))}
    </div>
  );
}

function acuityBarColor(level) {
  if (level <= 2) return "#ef4444";
  if (level === 3) return "#f59e0b";
  if (level === 4) return "#3b82f6";
  return "#22c55e";
}

function MiniStat({ label, value, warn, critical }) {
  const color = critical ? "var(--critical)" : warn ? "var(--warning)" : "var(--text)";
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
      <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
