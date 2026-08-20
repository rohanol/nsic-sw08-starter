import { useState, useRef, useEffect } from "react";
import { AlertTriangle, Crosshair, Gauge, ShieldCheck, Satellite, Upload, Image as ImageIcon, Layers, Cpu } from "lucide-react";

export default function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'annotated' | 'heatmap' | 'depth_map'>('annotated');
  const [engine, setEngine] = useState<'cv' | 'ml'>('cv');
  const [backendHealth, setBackendHealth] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check backend health on load
    fetch("http://localhost:8000/health")
      .then(res => res.json())
      .then(data => setBackendHealth(data))
      .catch(err => console.error("Backend not running", err));
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setSelectedImage(URL.createObjectURL(selectedFile));
      setResults(null);
    }
  };

  const runAnalysis = async () => {
    if (!file) return;
    setLoading(true);
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("engine", engine);

    try {
      const response = await fetch("http://localhost:8000/api/v1/assessments", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      
      if (data.stats && data.stats.error) {
        alert("Backend Error: " + data.stats.error);
        setResults(null);
      } else {
        setResults(data);
        if (engine === 'ml' && viewMode === 'annotated') {
           // Default to depth map if ML mode runs for cooler effect
           setViewMode('depth_map');
        } else if (engine === 'cv' && viewMode === 'depth_map') {
           setViewMode('annotated');
        }
      }
    } catch (err) {
      console.error("Error running assessment:", err);
      alert("Failed to reach backend. Ensure FastAPI is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Satellite size={20} /></div>
          <div>
            <p className="eyebrow">NSIC · SW08 (DUAL ENGINE)</p>
            <h1>AegisLanding System</h1>
          </div>
        </div>
        <div className="system-status">
          <span className={`status-dot ${backendHealth ? 'active' : ''}`} /> 
          {backendHealth ? `Backend Online (ML: ${backendHealth.ml_available ? 'Ready' : 'Offline'})` : 'Backend Offline'}
        </div>
      </header>

      <section className="hero-grid">
        <div>
          <p className="eyebrow">HYBRID RISK ASSESSMENT</p>
          <h2>Analyze real planetary terrain.</h2>
          <p className="hero-copy">Choose between Classical OpenCV algorithms (100% compliant) or pre-trained AI models (Depth Anything V2) to extract terrain geometry and find safe landing zones.</p>
          
          <div className="engine-toggle">
            <button 
              className={`toggle-pill ${engine === 'cv' ? 'active' : ''}`}
              onClick={() => setEngine('cv')}
            >
              <Cpu size={16} /> OpenCV (Classical)
            </button>
            <button 
              className={`toggle-pill ${engine === 'ml' ? 'active' : ''}`}
              onClick={() => setEngine('ml')}
            >
              <Layers size={16} /> Depth Anything V2 (AI)
            </button>
          </div>
        </div>
        
        <div className="hero-actions">
           <input type="file" accept="image/*" className="hidden-input" ref={fileInputRef} onChange={handleImageUpload} style={{display:'none'}} />
           <button className="primary-button" onClick={() => fileInputRef.current?.click()}>
             <Upload size={18} /> Upload Terrain Image
           </button>
           {file && (
             <button className="primary-button run-button" onClick={runAnalysis} disabled={loading}>
               {loading ? "Analyzing..." : `Run ${engine.toUpperCase()} Assessment →`}
             </button>
           )}
        </div>
      </section>

      {results && (
        <section className="metric-grid" aria-label="Mission metrics">
          <Metric icon={<Gauge size={19} />} label="Global Roughness" value={results.stats.global_roughness_index} tone="amber" />
          <Metric icon={<Crosshair size={19} />} label="Craters Detected" value={results.stats.craters_detected.toString()} tone="blue" />
          <Metric icon={<AlertTriangle size={19} />} label="Rocks/Obstacles" value={results.stats.rocks_detected.toString()} tone="red" />
          <Metric icon={<ShieldCheck size={19} />} label="Safe Zones" value={results.safe_zones.length.toString()} tone="green" />
        </section>
      )}

      <section className="workspace-grid">
        <div className="panel map-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">TERRAIN OVERVIEW</p><h3>Visual Telemetry</h3></div>
            {results && (
              <div className="view-toggles">
                <button className={`toggle-btn ${viewMode === 'annotated' ? 'active' : ''}`} onClick={() => setViewMode('annotated')}>Annotations</button>
                <button className={`toggle-btn ${viewMode === 'heatmap' ? 'active' : ''}`} onClick={() => setViewMode('heatmap')}>Risk Heatmap</button>
                {results.images.depth_map && (
                  <button className={`toggle-btn ${viewMode === 'depth_map' ? 'active' : ''}`} onClick={() => setViewMode('depth_map')}>Depth Map (ML)</button>
                )}
              </div>
            )}
          </div>
          <div className="terrain-map cv-view">
            {!selectedImage ? (
              <div className="empty-state">
                <ImageIcon size={48} />
                <p>Upload an image to view terrain.</p>
              </div>
            ) : (
              <img 
                src={results ? results.images[viewMode] : selectedImage} 
                alt="Terrain Analysis" 
                className="terrain-image" 
              />
            )}
          </div>
        </div>

        <div className="panel assessment-panel">
          <div className="panel-heading"><div><p className="eyebrow">ASSESSMENT OUTPUT</p><h3>Optimal Safe Zones</h3></div></div>
          
          <div className="zone-table">
            {!results ? (
              <p className="disclaimer" style={{marginTop: '20px'}}>Run assessment to discover safe zones.</p>
            ) : results.safe_zones.length === 0 ? (
              <p className="disclaimer" style={{marginTop: '20px', color: '#ff3366'}}>CRITICAL: No safe landing zones found!</p>
            ) : (
              <>
                <div className="table-row table-header">
                  <span>Zone ID</span>
                  <span>Coordinates</span>
                  <span>Safe Area</span>
                  <span>Avg Risk</span>
                </div>
                {results.safe_zones.map((zone: any) => (
                  <div className="table-row" key={zone.id}>
                    <span><strong>{zone.id}</strong></span>
                    <span>X: {zone.x}, Y: {zone.y}</span>
                    <span>{Math.round(zone.area)} px²</span>
                    <span style={{color: '#00ff88'}}>{zone.avg_risk.toFixed(1)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
          
          {results && (
             <div className="legend-box">
                <h4>Legend</h4>
                <div className="legend-item"><span className="dot" style={{borderColor: '#00ff00'}}></span> Safe Landing Zone</div>
                {engine === 'cv' && (
                  <>
                    <div className="legend-item"><span className="dot" style={{borderColor: '#ffa500'}}></span> Crater Detected</div>
                    <div className="legend-item"><span className="dot solid" style={{backgroundColor: '#ff0000'}}></span> Rock / Obstacle</div>
                  </>
                )}
             </div>
          )}
        </div>
      </section>

      <footer className="footer">
        <span>AegisLanding Dual Engine System</span>
        <span>Validating both classical math and AI approaches.</span>
      </footer>
    </main>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) {
  return (
    <div className={`metric-card tone-${tone}`}>
      <span className="metric-icon">{icon}</span>
      <div>
        <span className="metric-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
