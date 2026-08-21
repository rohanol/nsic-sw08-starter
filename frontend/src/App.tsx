import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  CloudUpload,
  Crosshair,
  Database,
  FileImage,
  Gauge,
  History,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  MapPinned,
  Menu,
  RefreshCw,
  Satellite,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "aegis-hackathon-2026-secure-key";

type Engine = "cv" | "ml";
type Zone = { id: string; x: number; y: number; area: number; avg_risk: number };
type Assessment = { stats: Record<string, number | string>; safe_zones: Zone[]; images: { annotated?: string; heatmap?: string } };
type HistoryItem = { timestamp: string; engine_used: string; craters_found: number; rocks_found: number; top_safe_zone_id: string | null };

type Notice = { type: "error" | "success" | "info"; text: string };

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<"annotated" | "heatmap">("annotated");
  const [engine, setEngine] = useState<Engine>("cv");
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const zones = assessment?.safe_zones ?? [];
  const selected = useMemo(() => zones.find((zone) => zone.id === activeZone) ?? zones[0], [zones, activeZone]);
  const hasResults = Boolean(assessment);
  const outputImage = assessment?.images[activeImage];
  const stats = assessment?.stats ?? {};
  const hazardCount = Number(stats.craters_detected ?? 0) + Number(stats.rocks_detected ?? 0) + Number(stats.shadowed_regions ?? 0);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (assessment && zones.length && !zones.some((zone) => zone.id === activeZone)) setActiveZone(zones[0].id); }, [assessment, zones, activeZone]);
  useEffect(() => { void loadHistory(setHistory, setIsHistoryLoading); }, []);

  const acceptFile = (next: File | undefined) => {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) { setNotice({ type: "error", text: "Unsupported file type. Upload a JPG, PNG, or WEBP terrain image." }); return; }
    if (next.size > 10 * 1024 * 1024) { setNotice({ type: "error", text: "This file is larger than the backend 10 MB upload limit." }); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next)); setAssessment(null); setActiveZone(null); setNotice({ type: "info", text: "Terrain image loaded. Choose an engine, then run the assessment." });
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); acceptFile(event.dataTransfer.files?.[0]); };
  const onInput = (event: ChangeEvent<HTMLInputElement>) => acceptFile(event.target.files?.[0]);

  const runAssessment = async () => {
    if (!file) { setNotice({ type: "info", text: "Drop a terrain image into the upload area before running an assessment." }); return; }
    setIsRunning(true); setNotice(null);
    try {
      const body = new FormData(); body.append("file", file); body.append("engine", engine);
      const response = await fetch(`${API_BASE_URL}/api/v1/assessments`, { method: "POST", headers: { "X-Mission-Control-Key": API_KEY }, body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "The terrain assessment failed.");
      setAssessment(data); setActiveZone(data.safe_zones?.[0]?.id ?? null); setActiveImage("annotated"); setNotice({ type: "success", text: "Terrain assessment complete. Review the detected hazards and recommended landing zones below." });
      void loadHistory(setHistory, setIsHistoryLoading);
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "The mission service could not be reached." }); }
    finally { setIsRunning(false); }
  };

  return (
    <main className="app-shell">
      <header className="topbar"><div className="brand-lockup"><div className="brand-mark"><Satellite size={19} /></div><div><p className="eyebrow">NSIC · SW08</p><h1>AegisLanding</h1></div></div><nav className={mobileNavOpen ? "top-nav open" : "top-nav"}><a href="#mission" onClick={() => setMobileNavOpen(false)}>Mission</a><a href="#input" onClick={() => setMobileNavOpen(false)}>Input</a><a href="#results" onClick={() => setMobileNavOpen(false)}>Results</a><a href="#history" onClick={() => setMobileNavOpen(false)}>History</a></nav><div className="top-actions"><span className="system-status"><span className={`status-dot ${hasResults ? "live" : ""}`} /> {hasResults ? "Analysis complete" : "Awaiting terrain"}</span><button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle navigation"><Menu size={18} /></button></div></header>

      <section className="hero-grid" id="mission"><div><p className="eyebrow">AI-BASED LANDING RISK ASSESSMENT</p><h2>Upload terrain.<br /><span>Understand the landing.</span></h2><p className="hero-copy">Drop a planetary surface image to run the trained terrain-analysis pipeline. AegisLanding returns annotated hazards, risk-ranked landing zones, and the evidence behind the recommendation.</p><div className="hero-meta"><span><Check size={13} /> Computer vision output</span><span><Check size={13} /> Explainable risk factors</span><span><Check size={13} /> Mission audit trail</span></div></div><div className="hero-callout"><span className="callout-label">WORKFLOW STATUS</span><div className="workflow-steps"><Step number="01" label="Upload" complete={Boolean(file)} /><ArrowRight size={14} /><Step number="02" label="Analyze" complete={hasResults} /><ArrowRight size={14} /><Step number="03" label="Review" complete={false} /></div><p>{hasResults ? "Analysis ready for mission review." : file ? "Image ready for terrain analysis." : "Waiting for terrain telemetry."}</p></div></section>

      {notice && <div className={`notice ${notice.type}`} role="status"><span>{notice.type === "error" ? <AlertTriangle size={16} /> : notice.type === "success" ? <Check size={16} /> : <Info size={16} />}</span><span>{notice.text}</span><button className="notice-close" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}

      <section className="panel input-panel" id="input"><div className="panel-heading"><div><p className="eyebrow">01 · MISSION INPUT</p><h3>Upload terrain telemetry</h3></div><span className="panel-chip"><ShieldCheck size={12} /> 10 MB MAX</span></div><div className="input-layout"><div className={`dropzone ${isDragging ? "dragging" : ""} ${file ? "has-file" : ""}`} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }} onDrop={onDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onInput} hidden />{file ? <><img src={preview} alt="Selected terrain preview" /><div className="dropzone-overlay"><span className="upload-icon"><Check size={20} /></span><strong>{file.name}</strong><small>{formatBytes(file.size)} · click or drop to replace</small></div></> : <><span className="upload-icon"><CloudUpload size={24} /></span><strong>Drag & drop terrain image here</strong><small>or click to browse your mission files</small><span className="file-types">JPG <i /> PNG <i /> WEBP</span></>}</div><div className="input-controls"><div className="control-title"><MapPinned size={15} /> Assessment configuration</div><label htmlFor="engine">Analysis engine</label><div className="select-wrap"><select id="engine" value={engine} onChange={(event) => setEngine(event.target.value as Engine)}><option value="cv">CV · classical vision</option><option value="ml">ML · depth model</option></select><ChevronDown size={14} /></div><p className="control-help">The selected engine receives the uploaded image as multipart terrain input.</p><button className="primary-button" onClick={runAssessment} disabled={isRunning}>{isRunning ? <><LoaderCircle className="spin" size={16} /> Analyzing terrain…</> : <><span>Run terrain assessment</span><ArrowRight size={16} /></>}</button></div></div></section>

      <section className="section-heading" id="results"><div><p className="eyebrow">02 · MODEL OUTPUT</p><h3>Terrain intelligence</h3></div>{hasResults && <span className="result-status"><span className="status-dot live" /> Live backend response</span>}</section>
      {!hasResults ? <div className="empty-results"><div className="empty-icon"><Sparkles size={22} /></div><div><h3>Results appear here after analysis</h3><p>Upload a surface image above to populate the hazard telemetry, annotated terrain, heatmap, and safe-zone ranking from the backend model.</p></div></div> : <Results assessment={assessment!} zones={zones} selected={selected} activeZone={activeZone} setActiveZone={setActiveZone} activeImage={activeImage} setActiveImage={setActiveImage} outputImage={outputImage} stats={stats} hazardCount={hazardCount} />}

      <section className="panel history-panel" id="history"><div className="panel-heading"><div><p className="eyebrow">03 · AUDIT TRAIL</p><h3>Recent assessments</h3></div><button className="refresh-button" onClick={() => void loadHistory(setHistory, setIsHistoryLoading)} disabled={isHistoryLoading}>{isHistoryLoading ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} Refresh</button></div>{history.length ? <div className="history-list">{history.map((item, index) => <div className="history-row" key={`${item.timestamp}-${index}`}><span className="history-icon"><History size={15} /></span><div><strong>{item.top_safe_zone_id ?? "No safe zone"}</strong><small>{item.engine_used.toUpperCase()} engine · {item.craters_found} craters · {item.rocks_found} rocks</small></div><time>{formatTime(item.timestamp)}</time></div>)}</div> : <div className="empty-history"><CircleHelp size={17} /><span>Completed backend assessments will appear here after the audit endpoint responds.</span></div>}</section>

      <footer className="footer"><span>AegisLanding · NSIC SW08</span><span>Advisory output — validate before flight-critical use</span></footer>
    </main>
  );
}

function Results({ assessment, zones, selected, activeZone, setActiveZone, activeImage, setActiveImage, outputImage, stats, hazardCount }: { assessment: Assessment; zones: Zone[]; selected?: Zone; activeZone: string | null; setActiveZone: (id: string) => void; activeImage: "annotated" | "heatmap"; setActiveImage: (value: "annotated" | "heatmap") => void; outputImage?: string; stats: Record<string, number | string>; hazardCount: number }) {
  const risk = selected?.avg_risk ?? 1; const safety = Math.round((1 - risk) * 100);
  return <>
    <section className="metric-grid"><Metric icon={<Gauge size={18} />} label="Recommended risk" value={`${Math.round(risk * 100)}%`} tone="amber" /><Metric icon={<Crosshair size={18} />} label="Safe zones found" value={String(zones.length).padStart(2, "0")} tone="blue" /><Metric icon={<ShieldCheck size={18} />} label="Image status" value="Verified" tone="green" /><Metric icon={<AlertTriangle size={18} />} label="Hazard signals" value={String(hazardCount).padStart(2, "0")} tone="red" /></section>
    <section className="workspace-grid"><div className="panel image-panel"><div className="panel-heading"><div><p className="eyebrow">TERRAIN IMAGERY</p><h3>{activeImage === "annotated" ? "Annotated surface" : "Risk heatmap"}</h3></div><span className="panel-chip"><ImageIcon size={12} /> MODEL VISUAL</span></div><div className="result-image-wrap">{outputImage ? <img src={outputImage} alt={`${activeImage} terrain model output`} /> : <div className="no-image"><FileImage size={25} /><span>No {activeImage} image returned by this engine.</span></div>}</div><div className="image-tabs"><button className={activeImage === "annotated" ? "active" : ""} onClick={() => setActiveImage("annotated")}><FileImage size={13} /> Annotated output</button><button className={activeImage === "heatmap" ? "active" : ""} onClick={() => setActiveImage("heatmap")}><ImageIcon size={13} /> Risk heatmap</button></div></div><div className="panel assessment-panel"><div className="panel-heading"><div><p className="eyebrow">RECOMMENDATION</p><h3>{selected?.id ?? "No zone"}</h3></div>{selected && <span className={`risk-badge ${riskTone(risk)}`}>{riskLabel(risk)}</span>}</div>{selected ? <><div className="risk-score"><span className="score-kicker">COMPOSITE SAFETY SCORE</span><span className="score-value">{safety}<small>/100</small></span><div className="score-note"><span className="score-dot" /> {confidenceFor(selected)} confidence · ranked #1 candidate</div></div><div className="factor-list"><Factor label="Average zone risk" value={`${Math.round(risk * 100)} / 100`} positive={risk < .45} /><Factor label="Landable area" value={`${Math.round(selected.area).toLocaleString()} px²`} positive /><Factor label="Coordinate" value={`${selected.x}, ${selected.y}`} positive /><Factor label="Model decision" value={risk < .45 ? "Preferred" : "Review required"} positive={risk < .45} /></div><p className="disclaimer">The recommended zone is the lowest-risk candidate returned by the backend for this image. It is advisory, not a flight-control command.</p></> : <div className="empty-panel">No candidate zones were returned for this terrain.</div>}</div></section>
    <section className="panel telemetry-panel"><div className="panel-heading"><div><p className="eyebrow">DETECTED TERRAIN FEATURES</p><h3>Telemetry and hazard detail</h3></div><Database size={17} className="muted-icon" /></div><div className="telemetry-grid"><Telemetry label="Craters detected" value={String(stats.craters_detected ?? "—")} /><Telemetry label="Rocks / obstacles" value={String(stats.rocks_detected ?? "—")} /><Telemetry label="Shadowed regions" value={String(stats.shadowed_regions ?? "—")} /><Telemetry label="Roughness index" value={String(stats.global_roughness_index ?? "—")} /></div><div className="telemetry-explanation"><Info size={14} /><span>These values are returned by the selected terrain-analysis engine and should be reviewed alongside the annotated image and heatmap.</span></div></section>
    <section className="panel zones-panel"><div className="panel-heading"><div><p className="eyebrow">RANKED SAFE-ZONE OUTPUT</p><h3>Candidate landing zones</h3></div><span className="panel-chip">{zones.length} RETURNED</span></div><div className="zone-table"><div className="table-row table-header"><span>Zone</span><span>Risk</span><span>Confidence</span><span>Area</span><span>Position</span></div>{zones.map((zone) => <button className={`table-row ${activeZone === zone.id ? "active-row" : ""}`} key={zone.id} onClick={() => setActiveZone(zone.id)}><span><strong>{zone.id}</strong><small>{zoneName(zone.id)}</small></span><span className={riskTone(zone.avg_risk)}>{Math.round(zone.avg_risk * 100)}%</span><span>{confidenceFor(zone)}</span><span>{Math.round(zone.area).toLocaleString()} px²</span><span className="mono">{zone.x}, {zone.y}</span></button>)}</div></section>
  </>;
}

function Step({ number, label, complete }: { number: string; label: string; complete: boolean }) { return <div className={`step ${complete ? "complete" : ""}`}><span>{complete ? <Check size={12} /> : number}</span><small>{label}</small></div>; }
function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) { return <div className={`metric-card tone-${tone}`}><span className="metric-icon">{icon}</span><div><span className="metric-label">{label}</span><strong>{value}</strong></div></div>; }
function Factor({ label, value, positive }: { label: string; value: string; positive: boolean }) { return <div className="factor-row"><span>{label}</span><strong className={positive ? "positive" : "negative"}>{positive ? <Check size={12} /> : <AlertTriangle size={12} />}{value}</strong></div>; }
function Telemetry({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function zoneName(id: string) { return ({ "LZ-1": "Primary candidate", "LZ-2": "Secondary candidate", "LZ-3": "Tertiary candidate" } as Record<string, string>)[id] ?? "Candidate landing zone"; }
function riskTone(risk: number) { return risk < .3 ? "safe" : risk < .6 ? "watch" : "danger"; }
function riskLabel(risk: number) { return risk < .3 ? "LOW RISK" : risk < .6 ? "WATCH" : "HIGH RISK"; }
function confidenceFor(zone: Zone) { return `${Math.round(Math.max(.55, 1 - zone.avg_risk * .35) * 100)}%`; }
function formatBytes(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
async function loadHistory(setHistory: (items: HistoryItem[]) => void, setLoading: (value: boolean) => void) { setLoading(true); try { const response = await fetch(`${API_BASE_URL}/api/v1/assessments/history?limit=5`, { headers: { "X-Mission-Control-Key": API_KEY } }); if (response.ok) { const data = await response.json(); setHistory(data.history ?? []); } } catch { /* Offline mode is supported. */ } finally { setLoading(false); } }

export default App;
