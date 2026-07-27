import { useState } from "react";
import { api } from "../lib/api";

const STATUSES = ["available", "occupied", "cleaning", "blocked"];

export default function BedBoard({ beds, onChanged }) {
  const zones = [...new Set(beds.map((b) => b.zone))];
  const [menuFor, setMenuFor] = useState(null);
  const fhirBedCount = beds.filter((b) => b.sourceSystem === "fhir").length;

  async function setStatus(bed, status) {
    setMenuFor(null);
    await api.updateBed(bed._id, { status });
    onChanged?.();
  }

  return (
    <div className="panel">
      <h2>Bed Management ({beds.filter((b) => b.status === "occupied").length}/{beds.length} occupied)</h2>
      {fhirBedCount > 0 && (
        <p style={{ fontSize: 11, color: "var(--accent)", marginTop: -8, marginBottom: 10 }}>
          {fhirBedCount} bed{fhirBedCount !== 1 ? "s" : ""} synced live from EHR (FHIR Location) — status updates automatically, not editable here
        </p>
      )}
      {zones.map((zone) => (
        <div key={zone} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{zone}</div>
          <div className="bed-grid">
            {beds
              .filter((b) => b.zone === zone)
              .map((b) => {
                const isFhir = b.sourceSystem === "fhir";
                return (
                  <div key={b._id} style={{ position: "relative" }}>
                    <div
                      className={`bed-cell bed-${b.status}`}
                      title={isFhir ? `${b.patient?.name || ""} · synced from EHR` : b.patient?.name || ""}
                      style={{ cursor: isFhir ? "default" : "pointer", position: "relative" }}
                      onClick={() => !isFhir && setMenuFor(menuFor === b._id ? null : b._id)}
                    >
                      {b.bedCode}
                      {isFhir && (
                        <span style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
                      )}
                    </div>
                    {!isFhir && menuFor === b._id && (
                      <div
                        style={{
                          position: "absolute", top: "100%", left: 0, zIndex: 20, background: "var(--panel-2)",
                          border: "1px solid var(--border)", borderRadius: 8, padding: 4, marginTop: 4, minWidth: 110,
                        }}
                      >
                        {STATUSES.map((s) => (
                          <div
                            key={s}
                            onClick={() => setStatus(b, s)}
                            style={{ padding: "6px 8px", fontSize: 12, borderRadius: 6, cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Mark {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
