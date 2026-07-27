import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { useSocket } from "../lib/useSocket";
import { api } from "../lib/api";
import KpiCard from "../components/KpiCard";
import PatientTracker from "../components/PatientTracker";
import BedBoard from "../components/BedBoard";
import AmbulanceForecast from "../components/AmbulanceForecast";
import EwsCalculator from "../components/EwsCalculator";
import TriageTool from "../components/TriageTool";
import CriticalAlerts from "../components/CriticalAlerts";
import WaitTimePredictor from "../components/WaitTimePredictor";
import EhrImportPanel from "../components/EhrImportPanel";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [beds, setBeds] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [alertsData, setAlertsData] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState("overview");
  const [ehrPanelOpen, setEhrPanelOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [statsRes, patientsRes, bedsRes, ambulancesRes, forecastRes, alertsRes] = await Promise.all([
      api.dashboardStats(),
      api.patients(),
      api.beds(),
      api.ambulances(),
      api.ambulanceForecast(),
      api.criticalAlerts(),
    ]);
    setStats(statsRes);
    setPatients(patientsRes.patients);
    setBeds(bedsRes.beds);
    setAmbulances(ambulancesRes.ambulances);
    setForecast(forecastRes);
    setAlertsData(alertsRes);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [refresh]);

  useSocket(refresh);

  async function handleDischarge(id) {
    await api.dischargePatient(id);
    refresh();
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">
          <div className="brand-badge">⚡</div>
          PulseFlow ED
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn btn-secondary" onClick={() => setEhrPanelOpen(true)}>
            EHR Patient Lookup
          </button>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {user?.name} · {user?.role}
          </span>
          <button className="btn btn-secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>

      <div className="main">
        {stats && (
          <div className="kpi-grid">
            <KpiCard label="Active Census" value={stats.activeCensus} hint={`${stats.waitingCount} waiting · ${stats.inCareCount} in care`} />
            <KpiCard
              label="Bed Occupancy"
              value={`${stats.bedOccupancyPct}%`}
              hint={`${stats.bedsOccupied} of ${stats.bedsTotal} beds`}
              tone={stats.bedOccupancyPct > 85 ? "critical" : stats.bedOccupancyPct > 70 ? "warning" : "success"}
            />
            <KpiCard label="Avg Predicted Wait" value={`${stats.avgPredictedWaitMin}m`} hint="Across waiting room" tone={stats.avgPredictedWaitMin > 45 ? "warning" : "default"} />
            <KpiCard
              label="Inbound Ambulances"
              value={stats.inboundAmbulances}
              hint={stats.nextAmbulanceEtaMin != null ? `Next in ${stats.nextAmbulanceEtaMin} min` : "None inbound"}
            />
            <KpiCard
              label="Critical (ESI 1-2)"
              value={stats.criticalCount}
              hint="Resus / Emergent"
              tone={stats.criticalCount > 3 ? "critical" : stats.criticalCount > 0 ? "warning" : "success"}
            />
          </div>
        )}

        <div className="tabs">
          <div className={`tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Overview</div>
          <div className={`tab ${tab === "ews" ? "active" : ""}`} onClick={() => setTab("ews")}>Early Warning Score</div>
          <div className={`tab ${tab === "triage" ? "active" : ""}`} onClick={() => setTab("triage")}>AI Triage</div>
        </div>

        {tab === "overview" && (
          <>
            <div className="grid-2">
              <PatientTracker patients={patients} onDischarge={handleDischarge} />
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <WaitTimePredictor waitByAcuity={stats?.waitByAcuity} />
                <CriticalAlerts alerts={alertsData?.alerts} counts={alertsData?.counts} now={now} />
              </div>
            </div>
            <div className="grid-2">
              <BedBoard beds={beds} onChanged={refresh} />
              <AmbulanceForecast ambulances={ambulances} forecast={forecast} />
            </div>
          </>
        )}
        {tab === "ews" && <EwsCalculator />}
        {tab === "triage" && <TriageTool />}

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", padding: "20px 0" }}>
          Live simulated demo data · updates in real time via Socket.io
        </p>
      </div>

      {ehrPanelOpen && <EhrImportPanel onImported={refresh} onClose={() => setEhrPanelOpen(false)} />}
    </div>
  );
}
