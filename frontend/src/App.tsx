import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleHelp,
  CloudUpload,
  Crosshair,
  Database,
  ExternalLink,
  FileImage,
  Gauge,
  Grid3X3,
  History,
  Image as ImageIcon,
  Info,
  Layers3,
  LoaderCircle,
  MapPinned,
  Menu,
  RefreshCw,
  RotateCcw,
  Satellite,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "aegis-hackathon-2026-secure-key";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Engine = "cv" | "ml";
type Notice = { type: "error" | "success" | "info"; text: string };
type Scalar = number | string;
type Zone = { id: string; x: number; y: number; area: number; avg_risk: number };
type TerrainClass = { classId?: number; className: string; pixels?: number; share: number };
type ReviewCell = { rank: number; row: number; column: number; score: number; edgeDensity?: number; textureVariance?: number; contrast?: number };
type Assessment = {
  analysisId?: string;
  engineUsed: Engine | string;
  stats: Record<string, Scalar>;
  safe_zones: Zone[];
  images: Record<string, string>;
  source?: { filename?: string; width?: number; height?: number };
  classCoverage: TerrainClass[];
  topReviewCells: ReviewCell[];
  limitations: string[];
  isDemo?: boolean;
};
type HistoryItem = { timestamp: string; engine_used: string; craters_found: number; rocks_found: number; top_safe_zone_id: string | null };

type RawPayload = {
  analysisId?: string;
  analysis_id?: string;
  engine_used?: string;
  engine?: string;
  stats?: Record<string, Scalar>;
  safe_zones?: Array<Partial<Zone>>;
  images?: Record<string, unknown>;
  source?: { filename?: string; width?: number; height?: number; png?: unknown };
  model?: { classCoverage?: TerrainClass[]; class_coverage?: TerrainClass[]; overlayPng?: unknown; overlay?: unknown; maskPng?: unknown; mask?: unknown };
  visualComplexity?: { topReviewCells?: ReviewCell[]; top_review_cells?: ReviewCell[]; overlayPng?: unknown; overlay?: unknown; edgeMapPng?: unknown; edge_map?: unknown; textureMapPng?: unknown; texture_map?: unknown };
  visual_complexity?: RawPayload["visualComplexity"];
  limitations?: string[];
};

const IMAGE_LABELS: Record<string, string> = {
  source: "Source image",
  annotated: "Annotated output",
  heatmap: "Risk heatmap",
  terrainOverlay: "Terrain overlay",
  modelOverlay: "Model overlay",
  mask: "Terrain mask",
  complexityOverlay: "Complexity grid",
  edgeMap: "Edge map",
  textureMap: "Texture map",
};

const DEMO_TERRAIN = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#c88452"/><stop offset=".45" stop-color="#6b473f"/><stop offset="1" stop-color="#1c2530"/></linearGradient><filter id="n"><feTurbulence baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .18 0"/></filter></defs><rect width="1200" height="720" fill="url(#g)"/><path d="M0 130 180 90 310 170 470 85 680 150 850 70 1200 135V0H0Z" fill="#db9b6a" opacity=".5"/><path d="M0 540 140 460 300 535 475 415 620 530 790 420 980 520 1200 380V720H0Z" fill="#121a25" opacity=".65"/><g fill="none" stroke="#eab38a" opacity=".45"><ellipse cx="280" cy="280" rx="110" ry="63" stroke-width="11"/><ellipse cx="280" cy="280" rx="68" ry="34" stroke-width="5"/><ellipse cx="890" cy="260" rx="145" ry="72" stroke-width="13"/><ellipse cx="890" cy="260" rx="87" ry="39" stroke-width="5"/></g><g fill="#1a2430" opacity=".8"><circle cx="690" cy="350" r="18"/><circle cx="730" cy="390" r="28"/><circle cx="625" cy="470" r="14"/><circle cx="985" cy="490" r="22"/></g><rect width="1200" height="720" filter="url(#n)" opacity=".48"/></svg>`)}`;

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState("annotated");
  const [engine, setEngine] = useState<Engine>("cv");
  const [declaredTarget, setDeclaredTarget] = useState("Mars");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const zones = assessment?.safe_zones ?? [];
  const selected = useMemo(() => zones.find((zone) => zone.id === activeZone) ?? zones[0], [zones, activeZone]);
  const outputImages = useMemo(() => Object.keys(assessment?.images ?? {}).filter((key) => assessment?.images[key]), [assessment]);
  const outputImage = assessment?.images[activeImage] ?? assessment?.images[outputImages[0] ?? ""];
  const stats = assessment?.stats ?? {};
  const hazardCount = Number(stats.craters_detected ?? 0) + Number(stats.rocks_detected ?? 0) + Number(stats.shadowed_regions ?? 0);
  const hasResults = Boolean(assessment);

  useEffect(() => () => { if (preview && !preview.startsWith("data:")) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (assessment && zones.length && !zones.some((zone) => zone.id === activeZone)) setActiveZone(zones[0].id); }, [assessment, zones, activeZone]);
  useEffect(() => { void loadHistory(setHistory, setIsHistoryLoading); }, []);
  useEffect(() => { if (outputImages.length && !outputImages.includes(activeImage)) setActiveImage(outputImages[0]); }, [outputImages, activeImage]);

  const acceptFile = (next: File | undefined) => {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) { setNotice({ type: "error", text: "Unsupported file type. Upload a JPG, PNG, or WEBP terrain image." }); return; }
    if (next.size > MAX_FILE_SIZE) { setNotice({ type: "error", text: "This file is larger than the backend 10 MB upload limit." }); return; }
    if (preview && !preview.startsWith("data:")) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next)); setAssessment(null); setActiveZone(null); setNotice({ type: "info", text: "Terrain image loaded. Choose an engine, then run the assessment." });
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); acceptFile(event.dataTransfer.files?.[0]); };
  const onInput = (event: ChangeEvent<HTMLInputElement>) => acceptFile(event.target.files?.[0]);

  const clearWorkspace = () => {
    if (preview && !preview.startsWith("data:")) URL.revokeObjectURL(preview);
    setFile(null); setPreview(""); setAssessment(null); setActiveZone(null); setNotice({ type: "info", text: "Workspace reset. Upload a new terrain image when ready." });
    if (inputRef.current) inputRef.current.value = "";
  };

  const loadDemo = () => {
    setFile(null); setPreview(DEMO_TERRAIN); setAssessment(normalizeAssessment({ engine: "cv", stats: { craters_detected: 3, rocks_detected: 17, shadowed_regions: 4, global_roughness_index: 138.42 }, safe_zones: [{ id: "LZ-1", x: 802, y: 438, area: 18420, avg_risk: 0.18 }, { id: "LZ-2", x: 442, y: 510, area: 12680, avg_risk: 0.36 }, { id: "LZ-3", x: 1030, y: 164, area: 8420, avg_risk: 0.64 }], images: { annotated: DEMO_TERRAIN, heatmap: DEMO_TERRAIN }, limitations: ["Demo payload only. Replace with a backend response before mission use."] }, "cv", true)); setActiveZone("LZ-1"); setActiveImage("annotated"); setNotice({ type: "info", text: "Demo payload loaded. This is a UI preview and is not a real model decision." });
  };

  const runAssessment = async () => {
    if (!file) { setNotice({ type: "info", text: "Drop a terrain image into the upload area before running an assessment, or load the demo payload." }); return; }
    setIsRunning(true); setNotice(null);
    try {
      const body = new FormData(); body.append("file", file); body.append("engine", engine); body.append("declared_target", declaredTarget); if (sourceUrl.trim()) body.append("source_url", sourceUrl.trim());
      const response = await fetch(`${API_BASE_URL}/api/v1/assessments`, { method: "POST", headers: { "X-Mission-Control-Key": API_KEY }, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail ?? "The terrain assessment failed.");
      const normalized = normalizeAssessment(data, engine);
      setAssessment(normalized); setActiveZone(normalized.safe_zones[0]?.id ?? null); setActiveImage(Object.keys(normalized.images)[0] ?? "annotated"); setNotice({ type: "success", text: "Terrain assessment complete. Review the detected hazards and evidence below." });
      void loadHistory(setHistory, setIsHistoryLoading);
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "The mission service could not be reached." }); }
    finally { setIsRunning(false); }
  };

  return (
    <main className="app-shell">
      <header className="topbar"><div className="brand-lockup"><div className="brand-mark"><Satellite size={19} /></div><div><p className="eyebrow">NSIC · SW08</p><h1>AegisLanding</h1></div></div><nav className={mobileNavOpen ? "top-nav open" : "top-nav"}><a href="#mission" onClick={() => setMobileNavOpen(false)}>Mission</a><a href="#input" onClick={() => setMobileNavOpen(false)}>Input</a><a href="#results" onClick={() => setMobileNavOpen(false)}>Results</a><a href="#history" onClick={() => setMobileNavOpen(false)}>History</a></nav><div className="top-actions"><span className="system-status"><span className={`status-dot ${hasResults ? "live" : ""}`} /> {hasResults ? assessment?.isDemo ? "Demo payload" : "Analysis complete" : "Awaiting terrain"}</span><button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle navigation"><Menu size={18} /></button></div></header>

      <section className="hero-grid" id="mission"><div><p className="eyebrow">AI-BASED LANDING RISK ASSESSMENT</p><h2>Upload terrain.<br /><span>Understand the landing.</span></h2><p className="hero-copy">AegisLanding turns a planetary surface image into reviewable terrain evidence: annotated hazards, risk-ranked landing candidates, and the signals behind each recommendation.</p><div className="hero-meta"><span><Check size={13} /> Dual analysis paths</span><span><Check size={13} /> Explainable outputs</span><span><Check size={13} /> Mission audit trail</span></div></div><div className="hero-callout"><span className="callout-label">WORKFLOW STATUS</span><div className="workflow-steps"><Step number="01" label="Upload" complete={Boolean(file || preview)} /><ArrowRight size={14} /><Step number="02" label="Analyze" complete={hasResults} /><ArrowRight size={14} /><Step number="03" label="Review" complete={hasResults} /></div><p>{hasResults ? "Analysis ready for mission review." : file ? "Image ready for terrain analysis." : "Waiting for terrain telemetry."}</p></div></section>

      {notice && <div className={`notice ${notice.type}`} role="status"><span>{notice.type === "error" ? <AlertTriangle size={16} /> : notice.type === "success" ? <Check size={16} /> : <Info size={16} />}</span><span>{notice.text}</span><button className="notice-close" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}

      <section className="panel input-panel" id="input"><div className="panel-heading"><div><p className="eyebrow">01 · MISSION INPUT</p><h3>Upload terrain telemetry</h3></div><div className="heading-actions"><button className="secondary-button" onClick={loadDemo}><Sparkles size={13} /> Load demo</button>{(file || hasResults) && <button className="secondary-button" onClick={clearWorkspace}><RotateCcw size={13} /> Reset</button>}<span className="panel-chip"><ShieldCheck size={12} /> 10 MB MAX</span></div></div><div className="input-layout"><div className={`dropzone ${isDragging ? "dragging" : ""} ${file || preview ? "has-file" : ""}`} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }} onDrop={onDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onInput} hidden />{file || preview ? <><img src={preview} alt="Selected terrain preview" /><div className="dropzone-overlay"><span className="upload-icon"><Check size={20} /></span><strong>{file?.name ?? "Demo terrain payload"}</strong><small>{file ? `${formatBytes(file.size)} · click or drop to replace` : "UI preview · no backend request made"}</small></div></> : <><span className="upload-icon"><CloudUpload size={24} /></span><strong>Drag & drop terrain image here</strong><small>or click to browse your mission files</small><span className="file-types">JPG <i /> PNG <i /> WEBP</span></>}</div><div className="input-controls"><div className="control-title"><MapPinned size={15} /> Assessment configuration</div><label htmlFor="engine">Analysis engine</label><div className="engine-options"><EngineOption value="cv" selected={engine === "cv"} onClick={() => setEngine("cv")} icon={<Gauge size={16} />} title="Classical vision" description="Fast CV hazard scan" /><EngineOption value="ml" selected={engine === "ml"} onClick={() => setEngine("ml")} icon={<Layers3 size={16} />} title="Depth model" description="Model-based terrain" /></div>{engine === "ml" && <div className="ml-fields"><label htmlFor="target">Declared target body</label><div className="select-wrap"><select id="target" value={declaredTarget} onChange={(event) => setDeclaredTarget(event.target.value)}><option value="Mars">Mars</option><option value="Earth">Earth</option><option value="Moon">Moon</option><option value="Unknown">Unknown</option></select><ChevronDown size={14} /></div><label htmlFor="source-url">Verified source URL <span>optional</span></label><div className="url-input"><ExternalLink size={13} /><input id="source-url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" /></div></div>}<p className="control-help">{engine === "ml" ? "The ML route is guarded by the Mars-only provenance check. These fields are sent with the upload." : "The CV route measures image hazards, roughness, and candidate landable areas directly from pixels."}</p><button className="primary-button" onClick={runAssessment} disabled={isRunning}>{isRunning ? <><LoaderCircle className="spin" size={16} /> Analyzing terrain…</> : <><span>Run terrain assessment</span><ArrowRight size={16} /></>}</button></div></div></section>

      <section className="section-heading" id="results"><div><p className="eyebrow">02 · MODEL OUTPUT</p><h3>Terrain intelligence</h3></div>{hasResults && <span className="result-status"><span className="status-dot live" /> {assessment?.isDemo ? "Demo response" : "Live backend response"}</span>}</section>
      {!hasResults ? <div className="empty-results"><div className="empty-icon"><Sparkles size={22} /></div><div><h3>Results appear here after analysis</h3><p>Upload a surface image to populate hazard telemetry, visual evidence, heatmaps, safe-zone rankings, and any future analysis-tools outputs.</p></div></div> : <Results assessment={assessment!} zones={zones} selected={selected} activeZone={activeZone} setActiveZone={setActiveZone} activeImage={activeImage} setActiveImage={setActiveImage} outputImage={outputImage} stats={stats} hazardCount={hazardCount} />}

      <section className="panel history-panel" id="history"><div className="panel-heading"><div><p className="eyebrow">03 · AUDIT TRAIL</p><h3>Recent assessments</h3></div><button className="refresh-button" onClick={() => void loadHistory(setHistory, setIsHistoryLoading)} disabled={isHistoryLoading}>{isHistoryLoading ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} Refresh</button></div>{history.length ? <div className="history-list">{history.map((item, index) => <div className="history-row" key={`${item.timestamp}-${index}`}><span className="history-icon"><History size={15} /></span><div><strong>{item.top_safe_zone_id ?? "No safe zone"}</strong><small>{item.engine_used.toUpperCase()} engine · {item.craters_found} craters · {item.rocks_found} rocks</small></div><time>{formatTime(item.timestamp)}</time></div>)}</div> : <div className="empty-history"><CircleHelp size={17} /><span>Completed backend assessments will appear here after the audit endpoint responds.</span></div>}</section>

      <footer className="footer"><span>AegisLanding · NSIC SW08</span><span>Advisory output — validate before flight-critical use</span></footer>
    </main>
  );
}

function Results({ assessment, zones, selected, activeZone, setActiveZone, activeImage, setActiveImage, outputImage, stats, hazardCount }: { assessment: Assessment; zones: Zone[]; selected?: Zone; activeZone: string | null; setActiveZone: (id: string) => void; activeImage: string; setActiveImage: (value: string) => void; outputImage?: string; stats: Record<string, Scalar>; hazardCount: number }) {
  const risk = selected?.avg_risk ?? 1; const safety = Math.round((1 - risk) * 100);
  const imageOptions = Object.keys(assessment.images);
  return <>
    <section className="metric-grid"><Metric icon={<Gauge size={18} />} label="Recommended risk" value={`${Math.round(risk * 100)}%`} tone="amber" /><Metric icon={<Crosshair size={18} />} label="Safe zones found" value={String(zones.length).padStart(2, "0")} tone="blue" /><Metric icon={<ShieldCheck size={18} />} label="Image status" value={assessment.source?.width ? `${assessment.source.width}×${assessment.source.height}` : "Verified"} tone="green" /><Metric icon={<AlertTriangle size={18} />} label="Hazard signals" value={String(hazardCount).padStart(2, "0")} tone="red" /></section>
    <section className="workspace-grid"><div className="panel image-panel"><div className="panel-heading"><div><p className="eyebrow">TERRAIN IMAGERY</p><h3>{IMAGE_LABELS[activeImage] ?? "Analysis visual"}</h3></div><span className="panel-chip"><ImageIcon size={12} /> MODEL VISUAL</span></div><div className="result-image-wrap">{outputImage ? <img src={outputImage} alt={`${IMAGE_LABELS[activeImage] ?? activeImage} terrain model output`} /> : <div className="no-image"><FileImage size={25} /><span>No image returned by this engine.</span></div>}</div><div className="image-tabs">{imageOptions.map((imageKey) => <button key={imageKey} className={activeImage === imageKey ? "active" : ""} onClick={() => setActiveImage(imageKey)}><FileImage size={13} /> {IMAGE_LABELS[imageKey] ?? imageKey}</button>)}</div></div><div className="panel assessment-panel"><div className="panel-heading"><div><p className="eyebrow">RECOMMENDATION</p><h3>{selected?.id ?? "No zone"}</h3></div>{selected && <span className={`risk-badge ${riskTone(risk)}`}>{riskLabel(risk)}</span>}</div>{selected ? <><div className="risk-score"><span className="score-kicker">COMPOSITE SAFETY SCORE</span><span className="score-value">{safety}<small>/100</small></span><div className="score-note"><span className="score-dot" /> {confidenceFor(selected)} confidence · ranked #{zones.findIndex((zone) => zone.id === selected.id) + 1} candidate</div></div><div className="factor-list"><Factor label="Average zone risk" value={`${Math.round(risk * 100)} / 100`} positive={risk < .45} /><Factor label="Landable area" value={`${Math.round(selected.area).toLocaleString()} px²`} positive /><Factor label="Coordinate" value={`${selected.x}, ${selected.y}`} positive /><Factor label="Model decision" value={risk < .45 ? "Preferred" : "Review required"} positive={risk < .45} /></div><p className="disclaimer">The recommended zone is the lowest-risk candidate returned for this image. It is advisory evidence, not a flight-control command.</p></> : <div className="empty-panel">No candidate zones were returned for this terrain.</div>}</div></section>
    <section className="panel telemetry-panel"><div className="panel-heading"><div><p className="eyebrow">DETECTED TERRAIN FEATURES</p><h3>Telemetry and hazard detail</h3></div><Database size={17} className="muted-icon" /></div><div className="telemetry-grid"><Telemetry label="Craters detected" value={String(stats.craters_detected ?? "—")} /><Telemetry label="Rocks / obstacles" value={String(stats.rocks_detected ?? "—")} /><Telemetry label="Shadowed regions" value={String(stats.shadowed_regions ?? "—")} /><Telemetry label="Roughness index" value={String(stats.global_roughness_index ?? "—")} /></div><div className="telemetry-explanation"><Info size={14} /><span>Values are returned by the selected terrain-analysis engine and should be reviewed alongside the imagery and ranked zones.</span></div></section>
    {(assessment.classCoverage.length > 0 || assessment.topReviewCells.length > 0 || assessment.limitations.length > 0) && <section className="evidence-grid"><div className="panel evidence-panel"><div className="panel-heading"><div><p className="eyebrow">ANALYSIS-TOOLS READY</p><h3>Terrain evidence</h3></div><BarChart3 size={17} className="muted-icon" /></div>{assessment.classCoverage.length > 0 ? <div className="coverage-list">{assessment.classCoverage.map((item) => <div className="coverage-row" key={item.className}><div><span>{item.className}</span><strong>{Math.round(item.share * 100)}%</strong></div><div className="coverage-track"><i style={{ width: `${Math.min(100, item.share * 100)}%` }} /></div></div>)}</div> : <div className="evidence-empty"><Layers3 size={18} /><span>Terrain-class coverage will appear when the trained model response is connected.</span></div>}</div><div className="panel evidence-panel"><div className="panel-heading"><div><p className="eyebrow">VISUAL COMPLEXITY</p><h3>Review cells</h3></div><Grid3X3 size={17} className="muted-icon" /></div>{assessment.topReviewCells.length > 0 ? <div className="review-cells">{assessment.topReviewCells.slice(0, 3).map((cell) => <div className="review-cell" key={`${cell.row}-${cell.column}`}><span className="cell-rank">#{cell.rank}</span><div><strong>Row {cell.row + 1} · Col {cell.column + 1}</strong><small>Score {cell.score.toFixed(3)} · edge {formatMetric(cell.edgeDensity)}</small></div></div>)}</div> : <div className="evidence-empty"><Target size={18} /><span>Top review cells will appear when TERRAIN LENS output is connected.</span></div>}</div></section>}
    <section className="panel zones-panel"><div className="panel-heading"><div><p className="eyebrow">RANKED SAFE-ZONE OUTPUT</p><h3>Candidate landing zones</h3></div><span className="panel-chip">{zones.length} RETURNED</span></div><div className="zone-table"><div className="table-row table-header"><span>Zone</span><span>Risk</span><span>Confidence</span><span>Area</span><span>Position</span></div>{zones.map((zone) => <button className={`table-row ${activeZone === zone.id ? "active-row" : ""}`} key={zone.id} onClick={() => setActiveZone(zone.id)}><span><strong>{zone.id}</strong><small>{zoneName(zone.id)}</small></span><span className={riskTone(zone.avg_risk)}>{Math.round(zone.avg_risk * 100)}%</span><span>{confidenceFor(zone)}</span><span>{Math.round(zone.area).toLocaleString()} px²</span><span className="mono">{zone.x}, {zone.y}</span></button>)}</div></section>
    {assessment.limitations.length > 0 && <div className="limitations"><AlertTriangle size={15} /><div><strong>Interpretation notes</strong><span>{assessment.limitations.join(" ")}</span></div></div>}
  </>;
}

function EngineOption({ value, selected, onClick, icon, title, description }: { value: Engine; selected: boolean; onClick: () => void; icon: ReactNode; title: string; description: string }) { return <button type="button" className={`engine-option ${selected ? "selected" : ""}`} onClick={onClick} aria-pressed={selected}><span className="engine-icon">{icon}</span><span><strong>{title}</strong><small>{description}</small></span>{selected && <Check size={14} className="engine-check" />}<span className="sr-only">{value}</span></button>; }
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
function formatMetric(value?: number) { return typeof value === "number" ? value.toFixed(3) : "—"; }

function normalizeAssessment(payload: RawPayload, fallbackEngine: Engine, isDemo = false): Assessment {
  const visual = payload.visualComplexity ?? payload.visual_complexity ?? {};
  const rawImages = payload.images ?? {};
  const images: Record<string, string> = {};
  Object.entries(rawImages).forEach(([key, value]) => { const uri = imageUri(value); if (uri) images[key] = uri; });
  const model = payload.model ?? {};
  const sourceUri = imageUri(payload.source?.png);
  if (sourceUri) images.source = sourceUri;
  const modelOverlay = imageUri(model.overlayPng ?? model.overlay); if (modelOverlay) images.modelOverlay = modelOverlay;
  const mask = imageUri(model.maskPng ?? model.mask); if (mask) images.mask = mask;
  const complexityOverlay = imageUri(visual.overlayPng ?? visual.overlay); if (complexityOverlay) images.complexityOverlay = complexityOverlay;
  const edgeMap = imageUri(visual.edgeMapPng ?? visual.edge_map); if (edgeMap) images.edgeMap = edgeMap;
  const textureMap = imageUri(visual.textureMapPng ?? visual.texture_map); if (textureMap) images.textureMap = textureMap;
  const zones = (payload.safe_zones ?? []).map((zone, index) => ({ id: String(zone.id ?? `LZ-${index + 1}`), x: Number(zone.x ?? 0), y: Number(zone.y ?? 0), area: Number(zone.area ?? 0), avg_risk: normalizeRisk(Number(zone.avg_risk ?? 1)) }));
  return { analysisId: payload.analysisId ?? payload.analysis_id, engineUsed: payload.engine_used ?? payload.engine ?? fallbackEngine, stats: payload.stats ?? {}, safe_zones: zones, images, source: payload.source ? { filename: payload.source.filename, width: payload.source.width, height: payload.source.height } : undefined, classCoverage: model.classCoverage ?? model.class_coverage ?? [], topReviewCells: visual.topReviewCells ?? visual.top_review_cells ?? [], limitations: payload.limitations ?? [], isDemo };
}

function imageUri(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `data:image/png;base64,${value}`;
}
function normalizeRisk(value: number) { return value > 1 ? Math.min(1, value / 100) : Math.max(0, Math.min(1, value)); }
async function loadHistory(setHistory: (items: HistoryItem[]) => void, setLoading: (value: boolean) => void) { setLoading(true); try { const response = await fetch(`${API_BASE_URL}/api/v1/assessments/history?limit=5`, { headers: { "X-Mission-Control-Key": API_KEY } }); if (response.ok) { const data = await response.json(); setHistory(data.history ?? []); } } catch { /* Offline mode is supported. */ } finally { setLoading(false); } }

export default App;
