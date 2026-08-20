import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Crosshair, Gauge, ShieldCheck, Satellite } from "lucide-react";

const zones = [
  { id: "A-01", name: "North Ridge", risk: 0.18, confidence: 0.82, tags: ["flat", "high-light"] },
  { id: "B-04", name: "Crater Edge", risk: 0.47, confidence: 0.71, tags: ["ice-signal", "uneven"] },
  { id: "C-07", name: "South Basin", risk: 0.76, confidence: 0.64, tags: ["shadowed", "rocky"] },
];

function App() {
  const [activeZone, setActiveZone] = useState("A-01");
  const selected = useMemo(() => zones.find((zone) => zone.id === activeZone) ?? zones[0], [activeZone]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Satellite size={20} /></div>
          <div>
            <p className="eyebrow">NSIC · SW08</p>
            <h1>AegisLanding</h1>
          </div>
        </div>
        <div className="system-status"><span className="status-dot" /> Simulation mode · data contract ready</div>
      </header>

      <section className="hero-grid">
        <div>
          <p className="eyebrow">AI-BASED LANDING RISK ASSESSMENT</p>
          <h2>Find the safest place to land.</h2>
          <p className="hero-copy">A decision-support dashboard for detecting terrain hazards, scoring candidate landing zones, and explaining the recommendation.</p>
        </div>
        <div className="hero-callout">
          <span className="callout-label">Current recommendation</span>
          <strong>{selected.name}</strong>
          <span>{Math.round((1 - selected.risk) * 100)}% safety score · {Math.round(selected.confidence * 100)}% confidence</span>
        </div>
      </section>

      <section className="metric-grid" aria-label="Mission metrics">
        <Metric icon={<Gauge size={19} />} label="Mission risk" value={`${Math.round(selected.risk * 100)}%`} tone="amber" />
        <Metric icon={<Crosshair size={19} />} label="Zones assessed" value="03" tone="blue" />
        <Metric icon={<ShieldCheck size={19} />} label="Data integrity" value="Verified" tone="green" />
        <Metric icon={<AlertTriangle size={19} />} label="Active hazards" value="02" tone="red" />
      </section>

      <section className="workspace-grid">
        <div className="panel map-panel">
          <div className="panel-heading"><div><p className="eyebrow">TERRAIN OVERVIEW</p><h3>Candidate landing zones</h3></div><span className="panel-chip">DEMO DATA</span></div>
          <div className="terrain-map">
            <div className="terrain-grid" />
            {zones.map((zone, index) => (
              <button key={zone.id} className={`zone-marker zone-${index + 1} ${activeZone === zone.id ? "selected" : ""}`} onClick={() => setActiveZone(zone.id)} aria-label={`Select ${zone.name}`}>
                <span>{zone.id}</span>
              </button>
            ))}
            <div className="map-legend"><span><i className="legend-safe" /> lower risk</span><span><i className="legend-danger" /> higher risk</span></div>
          </div>
        </div>

        <div className="panel assessment-panel">
          <div className="panel-heading"><div><p className="eyebrow">ASSESSMENT OUTPUT</p><h3>{selected.name}</h3></div><span className={`risk-badge ${selected.risk < 0.3 ? "safe" : selected.risk < 0.6 ? "watch" : "danger"}`}>{selected.risk < 0.3 ? "LOW RISK" : selected.risk < 0.6 ? "WATCH" : "HIGH RISK"}</span></div>
          <div className="risk-score"><span className="score-value">{Math.round((1 - selected.risk) * 100)}</span><span className="score-label">safety score</span></div>
          <div className="factor-list">
            <Factor label="Terrain flatness" value={selected.id === "A-01" ? "Strong" : "Moderate"} positive={selected.id === "A-01"} />
            <Factor label="Rock / crater exposure" value={selected.id === "C-07" ? "Severe" : "Low"} positive={selected.id !== "C-07"} />
            <Factor label="Illumination window" value={selected.id === "A-01" ? "Stable" : "Variable"} positive={selected.id === "A-01"} />
            <Factor label="Input integrity" value="Verified" positive />
          </div>
          <button className="primary-button">Run assessment <span>→</span></button>
          <p className="disclaimer">Starter UI only. Replace demo values with validated terrain features and a documented model during the hackathon.</p>
        </div>
      </section>

      <section className="panel zones-panel">
        <div className="panel-heading"><div><p className="eyebrow">RANKED OUTPUT</p><h3>Zone comparison</h3></div><span className="panel-chip">MODEL: UNIMPLEMENTED</span></div>
        <div className="zone-table">
          <div className="table-row table-header"><span>Zone</span><span>Risk</span><span>Confidence</span><span>Signals</span></div>
          {zones.map((zone) => <button className={`table-row ${activeZone === zone.id ? "active-row" : ""}`} key={zone.id} onClick={() => setActiveZone(zone.id)}><span><strong>{zone.id}</strong> {zone.name}</span><span>{Math.round(zone.risk * 100)}%</span><span>{Math.round(zone.confidence * 100)}%</span><span>{zone.tags.map((tag) => <em key={tag}>{tag}</em>)}</span></button>)}
        </div>
      </section>

      <footer className="footer"><span>AegisLanding · original team scaffold</span><span>Validate every model decision before presenting.</span></footer>
    </main>
  );
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) {
  return <div className={`metric-card tone-${tone}`}><span className="metric-icon">{icon}</span><div><span className="metric-label">{label}</span><strong>{value}</strong></div></div>;
}

function Factor({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return <div className="factor-row"><span>{label}</span><strong className={positive ? "positive" : "negative"}>{value}</strong></div>;
}

export default App;
