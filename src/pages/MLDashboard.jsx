/**
 * Lumina ML Dashboard
 * A 5-step ML pipeline UI: Upload → Clean → Forecast → Cluster → Explain → Simulate
 * Dark navy + gold design.
 */

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

const API = import.meta.env.VITE_ML_API_URL || "http://localhost:8000";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      "#080E1A",
  panel:   "#0F172A",
  panel2:  "#1E293B",
  border:  "#334155",
  text:    "#F1F5F9",
  muted:   "#94A3B8",
  gold:    "#F59E0B",
  goldDim: "#78490A",
  green:   "#10B981",
  red:     "#EF4444",
  blue:    "#6366F1",
  teal:    "#14B8A6",
};

const TT = { background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 };

function fmt(n) {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return typeof n === "number" ? n.toFixed(2) : String(n);
}

// ── Step badge ────────────────────────────────────────────────────────────────
function StepBadge({ n, active, done }) {
  const bg = done ? C.green : active ? C.gold : C.panel2;
  const color = done || active ? "#000" : C.muted;
  return (
    <div style={{ width: 28, height: 28, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
      {done ? "✓" : n}
    </div>
  );
}

function StepRow({ n, label, active, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
      <StepBadge n={n} active={active} done={done} />
      <span style={{ fontSize: 13, fontWeight: 600, color: active ? C.gold : done ? C.green : C.muted }}>{label}</span>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Card({ title, children, style }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 20, ...style }}>
      {title && (
        <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 16px" }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

// ── KPI mini-card ─────────────────────────────────────────────────────────────
function KPI({ label, value, sub, color }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
      <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>{label}</p>
      <p style={{ color: color || C.gold, fontSize: 20, fontWeight: 800, margin: "0 0 2px", fontFamily: "Manrope, sans-serif" }}>{value}</p>
      {sub && <p style={{ color: C.muted, fontSize: 11, margin: 0 }}>{sub}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 12px", color: C.text, fontSize: 13, width: "100%", outline: "none" }}>
        <option value="">— select —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function MultiSelect({ label, options, selected, onChange }) {
  const toggle = (col) => {
    onChange(selected.includes(col) ? selected.filter((c) => c !== col) : [...selected, col]);
  };
  return (
    <div>
      <label style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {options.map((col) => (
          <button key={col} onClick={() => toggle(col)}
            style={{
              background: selected.includes(col) ? C.gold : C.panel2,
              color: selected.includes(col) ? "#000" : C.muted,
              border: `1px solid ${selected.includes(col) ? C.gold : C.border}`,
              borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
            {col}
          </button>
        ))}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted, fontSize: 13 }}>
      <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, borderTopColor: C.gold, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      Running ML pipeline...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MLDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  // Pipeline state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  // Step 1: processed data
  const [processed, setProcessed] = useState(null);

  // Step 2: forecast config + results
  const [dateCol, setDateCol]   = useState("");
  const [metricCols, setMetricCols] = useState([]);
  const [targetCol, setTargetCol]   = useState("");
  const [featureCols, setFeatureCols] = useState([]);
  const [forecastResult, setForecastResult] = useState(null);
  const [forecastPeriods, setForecastPeriods] = useState(5);

  // Step 3: cluster results
  const [clusterFeatures, setClusterFeatures] = useState([]);
  const [clusterResult, setClusterResult] = useState(null);

  // Step 4: SHAP results
  const [shapTarget, setShapTarget]   = useState("");
  const [shapFeatures, setShapFeatures] = useState([]);
  const [shapResult, setShapResult]   = useState(null);

  // Step 5: Monte Carlo
  const [mcBase, setMcBase]           = useState("");
  const [mcGrowth, setMcGrowth]       = useState("10");
  const [mcVol, setMcVol]             = useState("20");
  const [mcPeriods, setMcPeriods]     = useState("5");
  const [mcResult, setMcResult]       = useState(null);

  // Helpers
  const numCols = processed?.numeric_columns?.filter((c) => !c.startsWith("_")) || [];
  const allCols = processed?.columns?.filter((c) => !c.startsWith("_")) || [];

  async function callAPI(path, body, method = "POST") {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || JSON.stringify(json));
    return json;
  }

  // ── Step 1: Upload ──────────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return;
    setError("");
    setLoading("upload");
    setProcessed(null);
    setForecastResult(null);
    setClusterResult(null);
    setShapResult(null);
    setMcResult(null);
    setStep(1);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API}/api/process`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setProcessed(data);
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  // ── Step 2: Forecast ────────────────────────────────────────────────────────
  async function handleForecast() {
    if (!dateCol || metricCols.length === 0) { setError("Select a date column and at least one metric."); return; }
    setError("");
    setLoading("forecast");
    try {
      const data = await callAPI("/api/forecast", {
        data: processed.rows,
        date_col: dateCol,
        metric_cols: metricCols,
        periods: forecastPeriods,
        freq: "Y",
        target_col: targetCol || null,
        feature_cols: featureCols.length > 0 ? featureCols : null,
      });
      setForecastResult(data);
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  // ── Step 3: Cluster ─────────────────────────────────────────────────────────
  async function handleCluster() {
    if (clusterFeatures.length < 2) { setError("Select at least 2 features for clustering."); return; }
    setError("");
    setLoading("cluster");
    try {
      const data = await callAPI("/api/cluster", { data: processed.rows, feature_cols: clusterFeatures });
      setClusterResult(data);
      setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  // ── Step 4: SHAP ────────────────────────────────────────────────────────────
  async function handleExplain() {
    if (!shapTarget || shapFeatures.length === 0) { setError("Select a target and at least one feature."); return; }
    setError("");
    setLoading("shap");
    try {
      const data = await callAPI("/api/explain", { data: processed.rows, feature_cols: shapFeatures, target_col: shapTarget });
      setShapResult(data);
      setStep(5);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  // ── Step 5: Monte Carlo ─────────────────────────────────────────────────────
  async function handleSimulate() {
    if (!mcBase) { setError("Enter a base value."); return; }
    setError("");
    setLoading("mc");
    try {
      const data = await callAPI("/api/simulate", {
        base_value: parseFloat(mcBase),
        growth_rate: parseFloat(mcGrowth) / 100,
        volatility:  parseFloat(mcVol) / 100,
        periods:     parseInt(mcPeriods),
        simulations: 2000,
      });
      setMcResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  // ── Cluster scatter palette ─────────────────────────────────────────────────
  const CLUSTER_COLORS = [C.gold, C.teal, C.blue, C.green, C.red, "#A78BFA"];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif", color: C.text }}>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 28px", height: 58, display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ width: 30, height: 30, background: C.gold, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontWeight: 900, fontSize: 14, color: "#000" }}>L</span>
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: C.text, fontFamily: "Manrope, sans-serif" }}>Lumina</span>
        <span style={{ color: C.muted, fontSize: 12 }}>/ ML Pipeline</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={() => navigate("/dashboard")}
            style={{ background: "none", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 14px", fontSize: 12, cursor: "pointer" }}>
            ← Classic Dashboard
          </button>
          <span style={{ color: C.muted, fontSize: 12 }}>{user?.email}</span>
          <button onClick={signOut} style={{ background: "none", color: C.muted, border: "none", fontSize: 12, cursor: "pointer" }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: "220px 1fr", gap: 28 }}>

        {/* Sidebar steps */}
        <div>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 18px", position: "sticky", top: 80 }}>
            <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 14px" }}>Pipeline Steps</p>
            <StepRow n={1} label="Upload & Clean"  active={step === 1} done={step > 1} />
            <StepRow n={2} label="Forecast"         active={step === 2} done={step > 2} />
            <StepRow n={3} label="Cluster Segments" active={step === 3} done={step > 3} />
            <StepRow n={4} label="SHAP Explain"     active={step === 4} done={step > 4} />
            <StepRow n={5} label="Monte Carlo"      active={step === 5} done={false} />
          </div>
        </div>

        {/* Main content */}
        <div>
          {error && (
            <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}55`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: C.red, fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* ─── STEP 1: Upload ──────────────────────────────────────────── */}
          <Card title="Step 1 — Upload & Clean Data">
            <div
              onClick={() => fileRef.current.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: "36px 24px", textAlign: "center", cursor: "pointer", background: C.panel2, transition: "border-color 0.15s" }}
            >
              <input ref={fileRef} type="file" style={{ display: "none" }} accept=".csv,.xlsx,.xls"
                onChange={(e) => handleFile(e.target.files[0])} />
              <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
              <p style={{ color: C.gold, fontWeight: 700, fontSize: 14, margin: "0 0 4px" }}>Drop CSV or Excel file</p>
              <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>KNN Imputer fills missing values · Isolation Forest detects anomalies</p>
            </div>

            {loading === "upload" && <div style={{ marginTop: 16 }}><Spinner /></div>}

            {processed && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                  <KPI label="Rows"         value={processed.shape.rows} />
                  <KPI label="Columns"      value={processed.shape.cols} />
                  <KPI label="Anomalies"    value={processed.anomaly_report.anomalies_found} color={C.red} sub="Isolation Forest" />
                  <KPI label="Missing Filled" value={processed.cleaning_report.missing_before} color={C.teal} sub="KNN Imputer" />
                </div>

                {/* Cleaning steps */}
                <div style={{ marginBottom: 16 }}>
                  {processed.cleaning_report.steps?.map((s, i) => (
                    <p key={i} style={{ color: C.muted, fontSize: 12, margin: "3px 0" }}>
                      <span style={{ color: C.green, marginRight: 6 }}>✓</span>{s}
                    </p>
                  ))}
                </div>

                {/* Anomaly rows highlighted */}
                {processed.anomaly_report.anomalies_found > 0 && (
                  <p style={{ color: C.red, fontSize: 12 }}>
                    ⚠ {processed.anomaly_report.anomalies_found} anomalous row(s) detected at indices: {processed.anomaly_report.anomaly_rows.slice(0, 10).join(", ")}
                    {processed.anomaly_report.anomaly_rows.length > 10 ? " ..." : ""}
                  </p>
                )}

                {/* Preview table */}
                <div style={{ overflowX: "auto", maxHeight: 280, overflowY: "auto", borderRadius: 8, border: `1px solid ${C.border}`, marginTop: 14 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead style={{ position: "sticky", top: 0, background: C.panel2 }}>
                      <tr>
                        {processed.columns.map((col) => (
                          <th key={col} style={{ padding: "8px 12px", textAlign: "left", color: col.startsWith("_anomaly") ? C.red : C.gold, fontWeight: 700, whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {processed.rows.slice(0, 50).map((row, i) => (
                        <tr key={i} style={{ background: row._anomaly === 1 ? `${C.red}12` : i % 2 === 0 ? C.panel : C.panel2 }}>
                          {processed.columns.map((col) => (
                            <td key={col} style={{ padding: "6px 12px", color: col === "_anomaly" && row[col] === 1 ? C.red : C.text, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                              {row[col] === null ? "—" : typeof row[col] === "number" ? fmt(row[col]) : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          {/* ─── STEP 2: Forecast ────────────────────────────────────────── */}
          {processed && (
            <Card title="Step 2 — Forecast (Prophet + XGBoost)">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <Select label="Date / Year Column" value={dateCol} onChange={setDateCol} options={allCols} />
                <div>
                  <label style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Forecast Periods</label>
                  <input type="number" min={1} max={20} value={forecastPeriods} onChange={(e) => setForecastPeriods(parseInt(e.target.value) || 5)}
                    style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 12px", color: C.text, fontSize: 13, width: "100%", outline: "none" }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <MultiSelect label="Metrics to Forecast (Prophet)" options={numCols} selected={metricCols} onChange={setMetricCols} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <Select label="XGBoost Target (optional)" value={targetCol} onChange={setTargetCol} options={numCols} />
                <MultiSelect label="XGBoost Features (optional)" options={numCols.filter((c) => c !== targetCol)} selected={featureCols} onChange={setFeatureCols} />
              </div>

              <button onClick={handleForecast} disabled={loading === "forecast"}
                style={{ background: C.gold, color: "#000", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading === "forecast" ? 0.7 : 1 }}>
                {loading === "forecast" ? "Running Prophet + XGBoost..." : "Run Forecast →"}
              </button>
              {loading === "forecast" && <div style={{ marginTop: 14 }}><Spinner /></div>}

              {/* Forecast charts */}
              {forecastResult && (
                <div style={{ marginTop: 24 }}>
                  {forecastResult.prophet?.map((series, si) => {
                    if (series.error) return <p key={si} style={{ color: C.red, fontSize: 12 }}>{series.metric}: {series.error}</p>;
                    const pts = series.points || [];
                    return (
                      <div key={si} style={{ marginBottom: 24 }}>
                        <p style={{ color: C.gold, fontWeight: 700, fontSize: 13, margin: "0 0 12px" }}>
                          {series.metric} — Prophet Forecast
                          <span style={{ color: C.muted, fontWeight: 400, fontSize: 11, marginLeft: 10 }}>{series.model}</span>
                        </p>
                        <ResponsiveContainer width="100%" height={260}>
                          <AreaChart data={pts} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <defs>
                              <linearGradient id={`ci${si}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={C.gold} stopOpacity={0.15} />
                                <stop offset="95%" stopColor={C.gold} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="ds" tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={(v) => v.slice(0, 4)} />
                            <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} width={70} />
                            <Tooltip contentStyle={TT} formatter={(v, n) => [fmt(v), n]} labelFormatter={(l) => l?.slice(0, 10)} />
                            <Legend />
                            {/* Confidence band */}
                            <Area type="monotone" dataKey="yhat_upper" stroke="none" fill={`url(#ci${si})`} fillOpacity={1} name="Upper 80%" dot={false} />
                            <Area type="monotone" dataKey="yhat_lower" stroke="none" fill={C.bg} fillOpacity={1} name="Lower 80%" dot={false} />
                            {/* Actual */}
                            <Line type="monotone" dataKey="actual" stroke={C.teal} strokeWidth={2.5} dot={{ r: 4, fill: C.teal }} name="Actual" connectNulls={false} />
                            {/* Forecast */}
                            <Line type="monotone" dataKey="yhat" stroke={C.gold} strokeWidth={2} strokeDasharray="5 4" dot={false} name="Forecast" />
                            <ReferenceLine x={pts.find((p) => p.is_forecast)?.ds || ""} stroke={C.border} strokeDasharray="3 3" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })}

                  {/* XGBoost feature importance */}
                  {forecastResult.xgboost && !forecastResult.xgboost.error && (
                    <div>
                      <p style={{ color: C.blue, fontWeight: 700, fontSize: 13, margin: "0 0 12px" }}>
                        XGBoost KPI Prediction — {forecastResult.xgboost.target}
                        <span style={{ color: C.muted, fontWeight: 400, fontSize: 11, marginLeft: 10 }}>MAPE: {forecastResult.xgboost.mape_pct}%</span>
                      </p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={forecastResult.xgboost.feature_importance} layout="vertical" margin={{ left: 20, right: 30 }}>
                          <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={(v) => v.toFixed(2)} />
                          <YAxis type="category" dataKey="feature" tick={{ fill: C.muted, fontSize: 11 }} width={120} />
                          <Tooltip contentStyle={TT} />
                          <Bar dataKey="importance" fill={C.blue} radius={[0, 4, 4, 0]} name="Importance" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* ─── STEP 3: Clustering ───────────────────────────────────────── */}
          {step >= 3 && processed && (
            <Card title="Step 3 — K-Means Client / Business-Unit Segmentation">
              <div style={{ marginBottom: 16 }}>
                <MultiSelect label="Features for Clustering" options={numCols} selected={clusterFeatures} onChange={setClusterFeatures} />
              </div>
              <button onClick={handleCluster} disabled={loading === "cluster"}
                style={{ background: C.teal, color: "#000", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading === "cluster" ? 0.7 : 1 }}>
                {loading === "cluster" ? "Clustering..." : "Run K-Means →"}
              </button>
              {loading === "cluster" && <div style={{ marginTop: 14 }}><Spinner /></div>}

              {clusterResult && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                    <KPI label="Segments Found" value={clusterResult.n_clusters} color={C.teal} />
                    <KPI label="Inertia" value={fmt(clusterResult.inertia)} color={C.muted} sub="Lower = tighter clusters" />
                    {clusterResult.variance_explained?.[0] && (
                      <KPI label="PCA Variance" value={`${(clusterResult.variance_explained[0] * 100).toFixed(0)}%`} color={C.muted} sub="Explained by PC1" />
                    )}
                  </div>

                  {/* Scatter plot */}
                  {clusterResult.scatter && (
                    <div style={{ marginBottom: 20 }}>
                      <p style={{ color: C.muted, fontSize: 11, margin: "0 0 10px" }}>PCA 2D projection of clusters</p>
                      <ResponsiveContainer width="100%" height={280}>
                        <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                          <XAxis type="number" dataKey="x" name="PC1" tick={{ fill: C.muted, fontSize: 10 }} />
                          <YAxis type="number" dataKey="y" name="PC2" tick={{ fill: C.muted, fontSize: 10 }} />
                          <Tooltip contentStyle={TT} cursor={{ strokeDasharray: "3 3" }} />
                          {Array.from({ length: clusterResult.n_clusters }, (_, k) => (
                            <Scatter
                              key={k}
                              name={`Segment ${k + 1}`}
                              data={clusterResult.scatter.filter((p) => p.cluster === k)}
                              fill={CLUSTER_COLORS[k % CLUSTER_COLORS.length]}
                            />
                          ))}
                          <Legend />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Profiles */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                    {clusterResult.profiles.map((p) => (
                      <div key={p.cluster} style={{ background: C.panel2, border: `1px solid ${CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length]}55`, borderRadius: 10, padding: "14px 16px" }}>
                        <p style={{ color: CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length], fontWeight: 700, fontSize: 13, margin: "0 0 8px" }}>
                          {p.label} <span style={{ color: C.muted, fontWeight: 400 }}>({p.size} rows)</span>
                        </p>
                        {Object.entries(p.centroid).map(([col, val]) => (
                          <p key={col} style={{ color: C.muted, fontSize: 11, margin: "2px 0" }}>
                            <span style={{ color: C.text }}>{col}:</span> {fmt(val)}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ─── STEP 4: SHAP ─────────────────────────────────────────────── */}
          {step >= 4 && processed && (
            <Card title="Step 4 — SHAP Feature Attribution (XGBoost)">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <Select label="Target KPI to Explain" value={shapTarget} onChange={setShapTarget} options={numCols} />
                <MultiSelect label="Driving Features" options={numCols.filter((c) => c !== shapTarget)} selected={shapFeatures} onChange={setShapFeatures} />
              </div>
              <button onClick={handleExplain} disabled={loading === "shap"}
                style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading === "shap" ? 0.7 : 1 }}>
                {loading === "shap" ? "Computing SHAP..." : "Explain with SHAP →"}
              </button>
              {loading === "shap" && <div style={{ marginTop: 14 }}><Spinner /></div>}

              {shapResult && (
                <div style={{ marginTop: 24 }}>
                  <p style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>
                    Base value (mean prediction): <strong style={{ color: C.text }}>{fmt(shapResult.base_value)}</strong>
                  </p>

                  {/* Global importance bar chart */}
                  <p style={{ color: C.blue, fontWeight: 700, fontSize: 13, margin: "0 0 12px" }}>Global Feature Importance (mean |SHAP|)</p>
                  <ResponsiveContainer width="100%" height={Math.max(180, shapResult.feature_importance.length * 36)}>
                    <BarChart data={shapResult.feature_importance} layout="vertical" margin={{ left: 20, right: 60 }}>
                      <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} />
                      <YAxis type="category" dataKey="feature" tick={{ fill: C.muted, fontSize: 11 }} width={130} />
                      <Tooltip contentStyle={TT} formatter={(v, n, p) => [`${v} (${p.payload.importance_pct}%)`, "Importance"]} />
                      <Bar dataKey="importance" fill={C.blue} radius={[0, 4, 4, 0]} name="Mean |SHAP|" />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Waterfall for row 0 */}
                  <p style={{ color: C.blue, fontWeight: 700, fontSize: 13, margin: "24px 0 12px" }}>
                    Row 1 — Waterfall Breakdown
                    <span style={{ color: C.muted, fontWeight: 400, fontSize: 11, marginLeft: 8 }}>what pushed the prediction up or down</span>
                  </p>
                  <ResponsiveContainer width="100%" height={Math.max(180, shapResult.waterfall_row0.length * 36)}>
                    <BarChart data={shapResult.waterfall_row0} layout="vertical" margin={{ left: 20, right: 60 }}>
                      <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} />
                      <YAxis type="category" dataKey="feature" tick={{ fill: C.muted, fontSize: 11 }} width={130} />
                      <Tooltip contentStyle={TT} formatter={(v, n, p) => [`${v} (feature value: ${fmt(p.payload.feature_value)})`, "SHAP"]} />
                      <Bar dataKey="shap_value" name="SHAP Value" radius={[0, 4, 4, 0]}
                        fill={C.blue}
                        label={{ position: "right", fill: C.muted, fontSize: 10, formatter: (v) => fmt(v) }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          )}

          {/* ─── STEP 5: Monte Carlo ──────────────────────────────────────── */}
          {step >= 5 && (
            <Card title="Step 5 — Monte Carlo Risk Simulation (Geometric Brownian Motion)">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Base Value ($)</label>
                  <input value={mcBase} onChange={(e) => setMcBase(e.target.value)} placeholder="e.g. 1000000"
                    style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 12px", color: C.text, fontSize: 13, width: "100%", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Growth Rate (%)</label>
                  <input type="number" value={mcGrowth} onChange={(e) => setMcGrowth(e.target.value)}
                    style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 12px", color: C.text, fontSize: 13, width: "100%", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Volatility (%)</label>
                  <input type="number" value={mcVol} onChange={(e) => setMcVol(e.target.value)}
                    style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 12px", color: C.text, fontSize: 13, width: "100%", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Periods</label>
                  <input type="number" value={mcPeriods} onChange={(e) => setMcPeriods(e.target.value)}
                    style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 12px", color: C.text, fontSize: 13, width: "100%", outline: "none" }} />
                </div>
              </div>
              <button onClick={handleSimulate} disabled={loading === "mc"}
                style={{ background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading === "mc" ? 0.7 : 1 }}>
                {loading === "mc" ? "Simulating 2,000 paths..." : "Run Monte Carlo →"}
              </button>
              {loading === "mc" && <div style={{ marginTop: 14 }}><Spinner /></div>}

              {mcResult && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
                    <KPI label="Bear (P5)"  value={fmt(mcResult.final_p5)}  color={C.red} />
                    <KPI label="Base (P50)" value={fmt(mcResult.final_p50)} color={C.gold} />
                    <KPI label="Bull (P95)" value={fmt(mcResult.final_p95)} color={C.green} />
                    <KPI label="Prob. Gain" value={`${mcResult.prob_gain_pct}%`} color={C.teal} sub={`${mcResult.n_simulations} paths`} />
                    <KPI label="VaR (95%)"  value={fmt(mcResult.value_at_risk_95)} color={C.red} sub="Max expected loss" />
                  </div>

                  {/* Fan chart */}
                  <p style={{ color: C.muted, fontSize: 11, margin: "0 0 12px" }}>
                    2,000 simulated paths — shaded bands show probability ranges
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={mcResult.periods.map((t, i) => ({
                        t,
                        p5:  mcResult.p5[i],
                        p25: mcResult.p25[i],
                        p50: mcResult.p50[i],
                        p75: mcResult.p75[i],
                        p95: mcResult.p95[i],
                      }))}
                      margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="mcGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.gold} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={C.gold} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="t" tick={{ fill: C.muted, fontSize: 11 }} />
                      <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} width={75} />
                      <Tooltip contentStyle={TT} formatter={fmt} />
                      <Legend />
                      <Area type="monotone" dataKey="p95" stroke={C.green}   strokeWidth={1.5} fill="url(#mcGrad)" name="P95 (Bull)" dot={false} />
                      <Area type="monotone" dataKey="p75" stroke={C.teal}    strokeWidth={1}   fill={C.bg}         name="P75"       dot={false} fillOpacity={0} />
                      <Line type="monotone" dataKey="p50" stroke={C.gold}    strokeWidth={2.5} name="P50 (Base)"  dot={{ r: 4 }} />
                      <Area type="monotone" dataKey="p25" stroke={C.muted}   strokeWidth={1}   fill={C.bg}         name="P25"       dot={false} fillOpacity={0} />
                      <Line type="monotone" dataKey="p5"  stroke={C.red}     strokeWidth={1.5} name="P5 (Bear)"   dot={false} strokeDasharray="4 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
