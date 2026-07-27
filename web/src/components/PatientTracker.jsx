const acuityLabel = { 1: "Resuscitation", 2: "Emergent", 3: "Urgent", 4: "Less Urgent", 5: "Non-Urgent" };

export default function PatientTracker({ patients, onDischarge }) {
  const active = patients.filter((p) => p.status !== "discharged");
  return (
    <div className="panel">
      <h2>Patient Tracker ({active.length})</h2>
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Age</th>
              <th>Complaint</th>
              <th>Acuity</th>
              <th>Status</th>
              <th>Wait</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {active.map((p) => (
              <tr key={p._id}>
                <td>{p.patientCode}</td>
                <td>{p.name}</td>
                <td>{p.age}</td>
                <td>{p.chiefComplaint}</td>
                <td>
                  <span className={`badge badge-${p.acuity}`}>
                    ESI {p.acuity} · {acuityLabel[p.acuity]}
                  </span>
                </td>
                <td>
                  {p.status.replace("_", " ")}
                  {p.sourceSystem && p.sourceSystem !== "internal" && (
                    <span
                      style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(34,211,238,0.15)", color: "var(--accent)" }}
                      title={p.sourceSystem === "fhir" ? "Imported from FHIR" : "Received via HL7v2 ADT"}
                    >
                      {p.sourceSystem.toUpperCase()}
                    </span>
                  )}
                </td>
                <td>{p.predictedWaitMin ?? 0}m</td>
                <td>
                  {p.status === "in_treatment" && (
                    <button className="btn btn-secondary" onClick={() => onDischarge(p._id)}>
                      Discharge
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
