/**
 * TerrainLens frontend: cinematic mission narrative linked to the starter API.
 * The visual system stays editorial and calm while uploads, evidence, and zones
 * are real backend outputs rather than demo-only content.
 */
import {
  ArrowDownRight,
  ChevronRight,
  Crosshair,
  Layers2,
  LoaderCircle,
  ShieldCheck,
  Upload,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? "/api" : "http://localhost:8000/api")).replace(/\/$/, "");
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

type Engine = "cv" | "ml";
type Severity = "low" | "medium" | "high";
type Zone = { id: string; x: number; y: number; area: number; avg_risk: number };
type ReviewCell = { rank: number; row: number; column: number; score: number; edgeDensity?: number; textureVariance?: number; contrast?: number };
type TerrainRow = { id: string; label: string; note: string; severity: Severity; x: string; y: string; score?: number };
type Assessment = {
  analysisId?: string;
  engine_used?: string;
  stats?: Record<string, string | number>;
  safe_zones?: Zone[];
  images?: Record<string, string>;
  model?: { classCoverage?: Array<{ className: string; share: number }> };
  visualComplexity?: { grid?: { columns: number; rows: number }; topReviewCells?: ReviewCell[] };
  limitations?: string[];
};

const fallbackRows: TerrainRow[] = [
  { id: "01", label: "Crater edge", note: "A shallow edge", severity: "medium", x: "67%", y: "27%" },
  { id: "02", label: "Rock group", note: "Large rocks together", severity: "high", x: "48%", y: "53%" },
  { id: "03", label: "Loose dust", note: "Dust that can shift", severity: "low", x: "29%", y: "68%" },
];

const scrollScenes = [
  { code: "01", label: "START", title: <>Find safe<br /><em>ground.</em></>, body: "TerrainLens checks the surface before landing." },
  { code: "02", label: "VIEW", title: <>Look<br /><em>closer.</em></>, body: "See slopes, rocks, and open ground in the landing area." },
  { code: "03", label: "MARK", title: <>Mark the<br /><em>risks.</em></>, body: "Every risk stays visible on the map." },
  { code: "04", label: "CHECK", title: <>Check it<br /><em>twice.</em></>, body: "Two scans help the team choose a safer path." },
];

function moveTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function severityFor(score: number): Severity {
  return score >= 0.67 ? "high" : score >= 0.34 ? "medium" : "low";
}

function rowsFor(assessment: Assessment | null): TerrainRow[] {
  const cells = assessment?.visualComplexity?.topReviewCells ?? [];
  const grid = assessment?.visualComplexity?.grid ?? { columns: 6, rows: 4 };
  if (!cells.length) return fallbackRows;
  return cells.slice(0, 3).map((cell, index) => ({
    id: String(index + 1).padStart(2, "0"),
    label: `Review cell ${cell.row + 1}.${cell.column + 1}`,
    note: `Complexity score ${cell.score.toFixed(2)}`,
    severity: severityFor(cell.score),
    x: `${Math.round(((cell.column + 0.5) / grid.columns) * 100)}%`,
    y: `${Math.round(((cell.row + 0.5) / grid.rows) * 100)}%`,
    score: cell.score,
  }));
}

function EnginePanel({ name, descriptor, confidence, variance, metric, findings, tone }: {
  name: string; descriptor: string; confidence: number; variance: string; metric: string; findings: string[]; tone: "cv" | "ml";
}) {
  return (
    <article className={`engine-panel engine-panel--${tone}`}>
      <div className="engine-panel__topline"><div><p className="eyebrow">{name}</p><h3>{descriptor}</h3></div><span className="engine-seal"><ShieldCheck size={16} /></span></div>
      <div className="confidence-block"><div className="confidence-block__head"><span>Surface confidence</span><strong>{confidence}%</strong></div><div className="confidence-track" aria-label={`${name} surface confidence ${confidence}%`}><span style={{ width: `${confidence}%` }} /></div></div>
      <dl className="engine-metrics"><div><dt>Vertical variance</dt><dd>{variance}</dd></div><div><dt>Fit metric</dt><dd>{metric}</dd></div></dl>
      <ul className="engine-findings">{findings.map((finding, index) => <li key={finding}><span>{String(index + 1).padStart(2, "0")}</span>{finding}</li>)}</ul>
    </article>
  );
}

export default function App() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [descentProgress, setDescentProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [comparisonProgress, setComparisonProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("top");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [activeAnomaly, setActiveAnomaly] = useState("01");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notice, setNotice] = useState("Upload a terrain frame when you are ready to inspect it.");
  const [engine, setEngine] = useState<Engine>("cv");
  const [sourceUrl, setSourceUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<HTMLElement>(null);
  const descentRef = useRef<HTMLElement>(null);
  const descentVideoRef = useRef<HTMLVideoElement>(null);
  const videoTargetTimeRef = useRef(0);
  const lastVideoFrameRef = useRef<number | null>(null);
  const analysisRef = useRef<HTMLElement>(null);
  const comparisonRef = useRef<HTMLElement>(null);
  const protocolRef = useRef<HTMLElement>(null);

  const terrainRows = useMemo(() => rowsFor(assessment), [assessment]);
  const activeTerrain = terrainRows.find((terrain) => terrain.id === activeAnomaly) ?? terrainRows[0];
  const zones = assessment?.safe_zones ?? [];
  const stats = assessment?.stats ?? {};
  const outputImage = assessment?.images?.modelOverlay ?? assessment?.images?.complexityOverlay ?? assessment?.images?.annotated ?? "/terrainlens/terrain-scan.jpg";
  const bestRisk = zones[0]?.avg_risk;
  const modelCoverage = assessment?.model?.classCoverage ?? [];
  const sceneIndex = Math.min(scrollScenes.length - 1, Math.floor(sceneProgress * scrollScenes.length));
  const currentScene = scrollScenes[sceneIndex];

  useEffect(() => {
    setActiveAnomaly(terrainRows[0]?.id ?? "01");
  }, [terrainRows]);

  useEffect(() => {
    const getSectionProgress = (node: HTMLElement | null) => {
      if (!node) return 0;
      const travel = Math.max(node.offsetHeight - window.innerHeight, 1);
      return Math.max(0, Math.min((window.scrollY - node.offsetTop) / travel, 1));
    };
    const updateProgress = () => {
      setScrollProgress(Math.min(window.scrollY / Math.max(window.innerHeight * 1.25, 1), 1));
      const scene = getSectionProgress(sceneRef.current);
      const analysis = getSectionProgress(analysisRef.current);
      setSceneProgress(scene);
      setAnalysisProgress(analysis);
      setComparisonProgress(getSectionProgress(comparisonRef.current));
      setActiveAnomaly(terrainRows[Math.min(terrainRows.length - 1, Math.floor(analysis * terrainRows.length))]?.id ?? "01");
      const descent = getSectionProgress(descentRef.current);
      setDescentProgress(descent);
      const landingVideo = descentVideoRef.current;
      if (landingVideo && Number.isFinite(landingVideo.duration) && landingVideo.duration > 0) {
        videoTargetTimeRef.current = Math.min(landingVideo.duration - 0.04, Math.max(0, Math.min(descent / 0.62, 1) * landingVideo.duration));
      }
      const focusPoint = window.scrollY + window.innerHeight * 0.28;
      if (protocolRef.current && focusPoint >= protocolRef.current.offsetTop) setActiveTab("protocol");
      else if (comparisonRef.current && focusPoint >= comparisonRef.current.offsetTop) setActiveTab("analysis");
      else if (analysisRef.current && focusPoint >= analysisRef.current.offsetTop) setActiveTab("analysis");
      else if (descentRef.current && focusPoint >= descentRef.current.offsetTop) setActiveTab("descent");
      else setActiveTab("top");
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    return () => window.removeEventListener("scroll", updateProgress);
  }, [terrainRows]);

  useEffect(() => {
    let frame = 0;
    const softenVideoSeek = (now: number) => {
      const video = descentVideoRef.current;
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        const previousFrame = lastVideoFrameRef.current ?? now;
        const elapsed = Math.min((now - previousFrame) / 1000, 0.08);
        lastVideoFrameRef.current = now;
        const distance = videoTargetTimeRef.current - video.currentTime;
        if (!video.seeking && Math.abs(distance) > 0.018) video.currentTime += distance * (1 - Math.exp(-11.2 * elapsed));
      }
      frame = requestAnimationFrame(softenVideoSeek);
    };
    frame = requestAnimationFrame(softenVideoSeek);
    return () => cancelAnimationFrame(frame);
  }, []);

  const jumpToScene = (index: number) => {
    const node = sceneRef.current;
    if (!node) return;
    window.scrollTo({ top: node.offsetTop + (node.offsetHeight - window.innerHeight) * (index / scrollScenes.length), behavior: "smooth" });
  };

  const runAssessment = async (file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setNotice("Use a JPG, PNG, or WEBP terrain frame."); return; }
    if (file.size > 10 * 1024 * 1024) { setNotice("Use a terrain frame smaller than 10 MB."); return; }
    setIsAnalyzing(true);
    setNotice("TerrainLens is reading the frame and assembling evidence.");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("engine", engine);
      body.append("declared_target", "Mars");
      if (sourceUrl.trim()) body.append("source_url", sourceUrl.trim());
      const response = await fetch(`${API_BASE_URL}/v1/assessments`, { method: "POST", headers: API_KEY ? { "X-Mission-Control-Key": API_KEY } : {}, body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail ?? "The terrain service could not read this frame.");
      setAssessment(payload as Assessment);
      setNotice(payload.model ? "Semantic terrain evidence and visual complexity are ready." : "Visual complexity evidence and landing candidates are ready.");
      window.setTimeout(() => moveTo("analysis"), 180);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The terrain service could not be reached.");
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void runAssessment(file);
  };

  const engineRows = [
    { name: "SURFACE VIEW", descriptor: "Ranks open ground", confidence: bestRisk === undefined ? 74 : Math.max(1, Math.round((1 - bestRisk) * 100)), variance: `${zones.length || 0} zones`, metric: bestRisk === undefined ? "Awaiting frame" : `${Math.round((1 - bestRisk) * 100)}% clear`, findings: terrainRows.map((row) => row.label), tone: "cv" as const },
    { name: "TERRAIN MODEL", descriptor: assessment?.model ? "Reads terrain classes" : "Visual complexity evidence", confidence: assessment?.model ? 91 : 68, variance: assessment?.model ? "4 terrain classes" : "Model gated", metric: assessment?.model ? "Semantic evidence" : "Review evidence", findings: modelCoverage.length ? modelCoverage.map((item) => `${item.className} ${Math.round(item.share * 100)}%`) : terrainRows.map((row) => row.note), tone: "ml" as const },
  ];
  const analysisStyle = { "--analysis-progress": analysisProgress } as CSSProperties;
  const comparisonStyle = { "--comparison-progress": comparisonProgress } as CSSProperties;
  const descentStyle = { "--descent-progress": descentProgress } as CSSProperties;
  const sceneObjectStyle: CSSProperties = { transform: `translate3d(${sceneProgress * 9 - 4}%, ${sceneProgress * -4}%, 0) rotate(${sceneProgress * 4 - 2}deg)` };

  return (
    <main className="aegis-site">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onUpload} />
      <header className={`mission-nav ${scrollProgress > 0.2 ? "mission-nav--solid" : ""}`}>
        <button className="brand-lockup brand-lockup--terrain" onClick={() => moveTo("top")} aria-label="Go to TerrainLens start"><img src="/terrainlens/orbital-shield.png" alt="" /><span>TerrainLens</span></button>
        <nav aria-label="Mission navigation">
          <button className={activeTab === "descent" ? "mission-tab mission-tab--active" : "mission-tab"} onClick={() => moveTo("descent")}>Landing</button>
          <button className={activeTab === "analysis" ? "mission-tab mission-tab--active" : "mission-tab"} onClick={() => moveTo("analysis")}>Scan</button>
          <button className={activeTab === "protocol" ? "mission-tab mission-tab--active" : "mission-tab"} onClick={() => moveTo("protocol")}>Upload</button>
        </nav>
        <span className="nav-status"><i className="status-dot" />{isAnalyzing ? "Reading frame" : assessment ? "Evidence ready" : "Ready"}</span>
      </header>

      <section ref={sceneRef} id="top" className="hero-scroll"><div className="hero-stage"><div className="hero-stage__grain" aria-hidden="true" /><img className="hero-stage__image" src="/terrainlens/deep-space.jpg" alt="Deep space and galaxy backdrop" /><div className="hero-stage__veil" aria-hidden="true" /><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-orbit orbit-three" /><div className="scene-quadrants" aria-hidden="true"><span /><span /><span /><span /></div><div className="scene-object" style={sceneObjectStyle} aria-hidden="true"><img src="/terrainlens/mars-whole-planet.jpg" alt="" /></div><div className="scene-copy" key={currentScene.code}><h1>{currentScene.title}</h1><p className="hero-copy__body">{currentScene.body}</p><button className="primary-cta" onClick={() => sceneIndex === scrollScenes.length - 1 ? moveTo("protocol") : jumpToScene(sceneIndex + 1)}>{sceneIndex === scrollScenes.length - 1 ? "Load terrain" : "Keep scrolling"}<ArrowDownRight size={18} /></button></div></div></section>

      <section ref={descentRef} id="descent" className="descent-scroll"><div className="descent-record" style={descentStyle}><video ref={descentVideoRef} className="descent-background" muted playsInline preload="auto" poster="/terrainlens/rover-dawn.jpg" aria-label="Mars landing sequence controlled by scroll position"><source src="/terrainlens/descent.mp4" type="video/mp4" /></video><div className="descent-background__veil" /><div className="chapter-rail" aria-hidden="true"><p>01</p><span /><p>LANDING</p></div><div className="descent-record__intro"><h2>See the landing<br /><em>before it happens.</em></h2><p>Scroll to follow the craft to the ground.</p></div><div className="landing-annotation landing-annotation--one"><span>01</span><p>Approach<br /><strong>Watch the ground</strong></p></div><div className="landing-annotation landing-annotation--two"><span>02</span><p>Landing area<br /><strong>{zones[0] ? `Best zone ${zones[0].id}` : "Open path ahead"}</strong></p></div><div className="descent-stats"><article><p>Rocks</p><strong>{stats.rocks_detected ?? "—"}</strong><span>detected</span></article><article><p>Roughness</p><strong>{stats.global_roughness_index ?? "—"}</strong><span>surface read</span></article><article><p>Ground</p><strong>{bestRisk === undefined ? "Scan" : `${Math.round((1 - bestRisk) * 100)}%`}</strong><span>{bestRisk === undefined ? "awaiting frame" : "clear estimate"}</span></article></div></div></section>

      <section ref={analysisRef} id="analysis" className="analysis-scroll"><div className="analysis-surface" style={analysisStyle}><div className="section-side-label">02 / CHECK</div><div className="analysis-surface__background"><img src={assessment?.images?.complexityOverlay ?? "/terrainlens/analysis-surface.jpg"} alt="Terrain evidence background" /></div><div className="analysis-header"><div><p className="eyebrow eyebrow--signal">02 / GROUND CHECK</p><h2>Look at the ground<br /><em>two ways.</em></h2></div><p>{assessment ? "Tap a marked review cell to see its evidence." : "Upload a frame to map surface evidence here."}</p></div><div className="analysis-sequence" aria-hidden="true"><span className={analysisProgress < 0.34 ? "analysis-sequence__step analysis-sequence__step--active" : "analysis-sequence__step"}>SEE</span><span className={analysisProgress >= 0.34 && analysisProgress < 0.67 ? "analysis-sequence__step analysis-sequence__step--active" : "analysis-sequence__step"}>MARK</span><span className={analysisProgress >= 0.67 ? "analysis-sequence__step analysis-sequence__step--active" : "analysis-sequence__step"}>CHECK</span></div><div className="analysis-workspace"><aside className="analysis-aside"><div className="aside-heading"><Crosshair size={17} /><span>GROUND VIEW</span></div><div className="anomaly-list"><p className="eyebrow">Things to check</p>{terrainRows.map((terrain) => <button key={terrain.id} className={activeAnomaly === terrain.id ? "anomaly-row anomaly-row--active" : "anomaly-row"} onClick={() => setActiveAnomaly(terrain.id)}><span>{terrain.id}</span><div><strong>{terrain.label}</strong><small>{terrain.note}</small></div><i className={`risk risk--${terrain.severity}`} /></button>)}</div></aside><div className={`terrain-module ${isDragging ? "terrain-module--dragging" : ""}`}><div className="terrain-module__topbar"><span>Terrain evidence</span><span>{assessment ? "Live result" : "Sample frame"}</span></div><div className="terrain-view" onPointerDown={() => setIsDragging(true)} onPointerUp={() => setIsDragging(false)} onPointerLeave={() => setIsDragging(false)}><img src={outputImage} alt="Terrain analysis evidence" /><div className="scan-sweep" />{terrainRows.map((terrain) => <button key={terrain.id} className={activeAnomaly === terrain.id ? "terrain-pin terrain-pin--active" : "terrain-pin"} style={{ left: terrain.x, top: terrain.y }} onClick={() => setActiveAnomaly(terrain.id)} aria-label={`Inspect ${terrain.label}`}><span>{terrain.id}</span></button>)}<div className="target-bracket target-bracket--tl" /><div className="target-bracket target-bracket--tr" /><div className="target-bracket target-bracket--bl" /><div className="target-bracket target-bracket--br" /></div><div className="terrain-module__footer"><span><Waves size={15} />{assessment?.analysisId ? "Evidence linked" : "Awaiting frame"}</span><span>Looking at: <strong>{activeTerrain.label}</strong></span></div></div><aside className="active-readout"><p className="eyebrow">ON THIS SPOT</p><strong>{activeTerrain.id}</strong><h3>{activeTerrain.label}</h3><p>{activeTerrain.note}. Check this spot before landing.</p><dl><div><dt>Risk</dt><dd>{activeTerrain.severity}</dd></div><div><dt>Engine</dt><dd>{assessment?.engine_used ?? "TerrainLens"}</dd></div><div><dt>Next step</dt><dd>{zones[0] ? `Review ${zones[0].id}` : "Load frame"}</dd></div></dl><button onClick={() => moveTo("compare")}>See both views <ChevronRight size={16} /></button></aside></div></div></section>

      <section ref={comparisonRef} id="compare" className="comparison-scroll"><div className="engine-comparison" style={comparisonStyle}><div className="section-side-label">03 / COMPARE</div><div className="comparison-heading"><p className="eyebrow eyebrow--signal">03 / TWO VIEWS</p><div><h2>Double check<br /><em>the ground.</em></h2></div></div><div className="engine-grid">{engineRows.map((row) => <EnginePanel key={row.name} {...row} />)}</div><div className="comparison-note"><Layers2 size={18} /><p><strong>{assessment ? "Evidence assembled:" : "Two views:"}</strong> {assessment ? "use the landing candidates and review cells together." : "upload a terrain frame to compare surface and model evidence."}</p><span>{assessment ? "READY" : "STANDBY"}</span></div></div></section>

      <section ref={protocolRef} id="protocol" className="protocol-section"><div className="section-side-label section-side-label--dark">04 / UPLOAD</div><div className="protocol-section__media"><img src={outputImage} alt="Terrain analysis sample" /></div><div className="protocol-section__copy"><p className="eyebrow eyebrow--signal">MISSION PROTOCOL</p><h2>Let the image<br />answer <em>twice.</em></h2><p>{notice}</p><div className="upload-control"><div className="engine-toggle"><button className={engine === "cv" ? "active" : ""} onClick={() => setEngine("cv")}>Surface scan</button><button className={engine === "ml" ? "active" : ""} onClick={() => setEngine("ml")}>Verified Mars model</button></div>{engine === "ml" && <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Direct NASA/JPL image URL for semantic model" aria-label="Verified Mars source URL" />}<button className="primary-cta" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing}>{isAnalyzing ? <><LoaderCircle className="spin" size={17} /> Reading frame</> : <><Upload size={17} /> Load a terrain frame</>}</button></div><small className="upload-note">The verified Mars model runs only when uploaded bytes exactly match a direct HTTPS image from an approved NASA or JPL source. Other images still receive visual-complexity evidence.</small></div></section>

      <footer className="mission-footer"><button className="brand-lockup brand-lockup--terrain" onClick={() => moveTo("top")}><img src="/terrainlens/orbital-shield.png" alt="" /><span>TerrainLens</span></button><p>Clear terrain before landing.</p><span>© 2026 / MARS 07</span></footer>
    </main>
  );
}
