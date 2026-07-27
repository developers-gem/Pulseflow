const acuityLabel = { 1: "Resuscitation", 2: "Emergent", 3: "Urgent", 4: "Less Urgent", 5: "Non-Urgent" };

export default function WaitTimePredictor({ waitByAcuity }) {
  const maxAvg = Math.max(60, ...(waitByAcuity || []).map((b) => b.avgWaitMin));

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Predicted Wait Times</h2>
        <span style={{ fontSize: 10, background: "rgba(255,255,255,0.08)", borderRadius: 4, padding: "2px 6px" }}>ML model · v2.3</span>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: -6, marginBottom: 12 }}>Forecast by ESI level, current census</p>

      {(waitByAcuity || []).map((b) => (
        <div key={b.level} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span>
              <span className={`badge badge-${b.level}`} style={{ marginRight: 6 }}>{b.level}</span>
              {acuityLabel[b.level]} <span style={{ color: "var(--muted)", fontSize: 11 }}>· {b.count} waiting</span>
            </span>
            <strong>{b.avgWaitMin} min</strong>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (b.avgWaitMin / maxAvg) * 100)}%`,
                background: "linear-gradient(90deg, var(--primary), var(--accent))",
              }}
            />
          </div>
        </div>
      ))}
      <p style={{ fontSize: 10, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
        Model inputs: queue depth, current bed census, historical throughput, time-of-day patterns.
      </p>
    </div>
  );
}
