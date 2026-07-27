import { useState } from "react";

const KIND_STYLE = {
  sepsis: { border: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  stroke: { border: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
  trauma: { border: "#ef4444", bg: "rgba(239,68,68,0.08)" },
};

function fmtElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function CriticalAlerts({ alerts, counts, now }) {
  const [open, setOpen] = useState(null);

  return (
    <div className="panel">
      <h2>Critical Pathway Alerts</h2>
      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: -8, marginBottom: 10 }}>
        Sepsis · Stroke · Trauma — time-sensitive protocols
      </p>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {["sepsis", "stroke", "trauma"].map((k) => (
          <div key={k} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>{k}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{counts?.[k] ?? 0}</div>
          </div>
        ))}
      </div>

      {(!alerts || alerts.length === 0) && (
        <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>
          No active sepsis, stroke, or trauma alerts.
        </p>
      )}

      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {alerts?.map((a) => {
          const style = KIND_STYLE[a.kind];
          const elapsed = now - new Date(a.startedAt).getTime();
          const targetMs = a.targetMin * 60_000;
          const pct = Math.min(100, (elapsed / targetMs) * 100);
          const overdue = elapsed > targetMs;
          const isOpen = open === a.id;
          return (
            <div
              key={a.id}
              style={{ border: `1px solid ${style.border}55`, background: style.bg, borderRadius: 10, marginBottom: 8, cursor: "pointer" }}
              onClick={() => setOpen(isOpen ? null : a.id)}
            >
              <div style={{ padding: 10 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700 }}>{a.label}</span>
                  <span style={{ fontSize: 10, background: "rgba(255,255,255,0.08)", borderRadius: 4, padding: "1px 5px" }}>
                    {a.source === "ambulance" ? `Inbound · ETA ${a.etaMin}m` : "In ED"}
                  </span>
                  <span style={{ fontSize: 10, background: "rgba(255,255,255,0.08)", borderRadius: 4, padding: "1px 5px" }}>
                    ESI {a.acuity}
                  </span>
                </div>
                <p style={{ margin: "6px 0 2px", fontSize: 13, fontWeight: 600 }}>
                  {a.subject} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {a.detail}</span>
                </p>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{a.location}</p>
                {a.source === "patient" && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                      <span>{a.target}</span>
                      <span style={{ color: overdue ? "var(--critical)" : "var(--muted)", fontWeight: 600 }}>
                        {fmtElapsed(elapsed)} / {a.targetMin}m
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: 3 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: overdue ? "var(--critical)" : style.border }} />
                    </div>
                  </div>
                )}
              </div>
              {isOpen && (
                <div style={{ padding: "0 10px 10px", borderTop: `1px solid ${style.border}33` }}>
                  <p style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", margin: "8px 0 4px" }}>Protocol</p>
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                    {a.protocol.map((step, i) => (
                      <li key={i} style={{ marginBottom: 2 }}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
