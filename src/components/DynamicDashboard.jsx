/**
 * DynamicDashboard — renders any uploaded dataset in the PVAK visual style.
 * Matches the design language of PVAKDashboard exactly:
 * cream/beige bg, forest green + gold accents, Pnl / STitle / KCard / Tip components.
 */

import { useMemo, useState, useEffect, useRef } from "react";
import { SECTOR_CONFIG } from "../sectorConfig";

const ML_API = import.meta.env.VITE_ML_API_URL || "http://localhost:8000";
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

// ── Design tokens (matches PVAKDashboard exactly) ─────────────────────────────
const C = {
  bg: "#F4F0E6", panel: "#FEFCF8", panel2: "#EDE8DC", border: "#D5CEBC",
  text: "#1A1916", muted: "#8A8375",
  forest: "#2C5F1A", leaf: "#4D8C2E", sage: "#7DA05A",
  gold: "#A67C2A", amber: "#C8A04A",
  earth: "#7A4E2E", clay: "#9E6845", red: "#B03A2A",
};

const PALETTE = [C.forest, C.gold, C.red, C.leaf, C.amber, C.earth, C.clay, C.sage];

// ── Shared components ─────────────────────────────────────────────────────────

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 13px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <p style={{ color: C.muted, fontSize: 10, marginBottom: 6, fontFamily: "monospace" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 12, margin: "2px 0" }}>
          <span style={{ fontWeight: 600 }}>{p.name}: </span>
          {typeof p.value === "number" ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const Pnl = ({ children, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 22, ...style }}>
    {children}
  </div>
);

const STitle = ({ children, sub, accent }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 3, height: 16, background: accent || C.forest, borderRadius: 2 }} />
      <h2 style={{ color: C.text, fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", margin: 0 }}>
        {children}
      </h2>
    </div>
    {sub && <p style={{ color: C.muted, fontSize: 11, margin: "5px 0 0 11px", lineHeight: 1.4 }}>{sub}</p>}
  </div>
);

const KCard = ({ label, value, sub, color }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color || C.forest}55, transparent)` }} />
    <p style={{ color: C.muted, fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", margin: "0 0 7px" }}>{label}</p>
    <p style={{ color: color || C.text, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{value}</p>
    {sub && <p style={{ color: C.muted, fontSize: 11, margin: 0, lineHeight: 1.4 }}>{sub}</p>}
  </div>
);

// ── Data utilities ─────────────────────────────────────────────────────────────

function toNum(v) {
  if (typeof v === "number") return isNaN(v) ? null : v;
  const n = parseFloat(String(v ?? "").replace(/[$€£,\s%]/g, ""));
  return isNaN(n) ? null : n;
}

function fmt(n) {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return typeof n === "number" ? n.toFixed(Number.isInteger(n) ? 0 : 2) : String(n);
}

function extractYear(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}

function analyzeColumns(headers, rows) {
  const cols = {};
  headers.forEach((h) => {
    const vals = rows.map((r) => r[h]).filter((v) => v !== undefined && v !== null && String(v).trim() !== "");
    if (!vals.length) { cols[h] = { type: "empty" }; return; }

    const yearHits = vals.filter((v) => extractYear(v) !== null).length;
    if (yearHits >= Math.min(2, vals.length) && yearHits / vals.length >= 0.5) {
      cols[h] = { type: "date", values: vals.map((v) => extractYear(v) || String(v)) };
      return;
    }

    const numVals = vals.map(toNum).filter((v) => v !== null);
    if (numVals.length / vals.length >= 0.6) {
      const sum = numVals.reduce((a, b) => a + b, 0);
      cols[h] = { type: "numeric", values: numVals, sum, avg: sum / numVals.length, min: Math.min(...numVals), max: Math.max(...numVals) };
      return;
    }

    const unique = [...new Set(vals.map((v) => String(v).trim()))];
    cols[h] = { type: "categorical", values: vals.map((v) => String(v).trim()), unique };
  });
  return cols;
}

// ── Sector KPI matching ───────────────────────────────────────────────────────
// Returns the matching kpiMapping entry for a column name, or null.
function matchKpi(colName, kpiMappings) {
  if (!kpiMappings?.length) return null;
  const lower = colName.toLowerCase();
  return kpiMappings.find((kpi) =>
    kpi.columnKeywords.some((kw) => lower.includes(kw.toLowerCase()))
  ) || null;
}

// ── Linear regression for scenarios ──────────────────────────────────────────
function linReg(ys) {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0 };
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = ys.reduce((s, y, i) => s + i * y, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function buildTimeSeries(rows, dateCols, numCols) {
  const dc = dateCols[0];
  const grouped = {};
  rows.forEach((row) => {
    const key = extractYear(row[dc]) || String(row[dc] ?? "").trim();
    if (!key) return;
    if (!grouped[key]) grouped[key] = { x: key };
    numCols.forEach((col) => {
      const n = toNum(row[col]);
      if (n !== null) grouped[key][col] = (grouped[key][col] || 0) + n;
    });
  });
  return Object.values(grouped).sort((a, b) => String(a.x).localeCompare(String(b.x)));
}

function buildCategoryChart(rows, catCol, numCols) {
  const grouped = {};
  rows.forEach((row) => {
    const key = String(row[catCol] ?? "Unknown").trim();
    if (!grouped[key]) grouped[key] = { x: key };
    numCols.forEach((col) => {
      const n = toNum(row[col]);
      if (n !== null) grouped[key][col] = (grouped[key][col] || 0) + n;
    });
  });
  return Object.values(grouped).sort((a, b) => (b[numCols[0]] || 0) - (a[numCols[0]] || 0)).slice(0, 20);
}

// Build forecast rows: apply bear / base / bull factors on top of trend
function buildForecast(tsData, numCols, periods, factors) {
  const lastLabel = tsData[tsData.length - 1]?.x;
  const isYear = /^\d{4}$/.test(String(lastLabel));
  const lastYear = isYear ? parseInt(lastLabel) : null;

  const regressions = {};
  numCols.forEach((col) => {
    regressions[col] = linReg(tsData.map((d) => d[col] || 0));
  });

  const future = [];
  for (let i = 1; i <= periods; i++) {
    const label = lastYear ? String(lastYear + i) : `+${i}`;
    const idx = tsData.length - 1 + i;
    const pt = { x: label, _forecast: true };
    numCols.forEach((col) => {
      const { slope, intercept } = regressions[col];
      const base = Math.max(0, intercept + slope * idx);
      pt[`${col}_bear`]   = Math.max(0, base * (1 + factors.bear / 100));
      pt[`${col}_base`]   = base;
      pt[`${col}_bull`]   = Math.max(0, base * (1 + factors.bull / 100));
    });
    future.push(pt);
  }
  return future;
}

// ── Insight card skeleton ─────────────────────────────────────────────────────
function InsightSkeleton({ accent }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `${accent}40` }} />
          <div style={{ width: "55%", height: 11, background: C.panel2, borderRadius: 4, marginBottom: 10, animation: "lm-pulse 1.4s ease-in-out infinite" }} />
          <div style={{ width: "100%", height: 8, background: C.panel2, borderRadius: 4, marginBottom: 5, animation: "lm-pulse 1.4s ease-in-out infinite 0.1s" }} />
          <div style={{ width: "85%", height: 8, background: C.panel2, borderRadius: 4, marginBottom: 14, animation: "lm-pulse 1.4s ease-in-out infinite 0.2s" }} />
          <div style={{ width: "75%", height: 8, background: C.panel2, borderRadius: 4, animation: "lm-pulse 1.4s ease-in-out infinite 0.3s" }} />
        </div>
      ))}
    </div>
  );
}

// ── Insight cards ─────────────────────────────────────────────────────────────
function InsightCards({ cards, accent }) {
  if (!cards.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
      {cards.map((card, i) => (
        <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
          <p style={{ color: accent, fontSize: 12, fontWeight: 700, margin: "0 0 8px", letterSpacing: "0.02em" }}>{card.title}</p>
          <p style={{ color: C.text, fontSize: 12, margin: "0 0 10px", lineHeight: 1.55 }}>{card.explanation}</p>
          <p style={{ color: C.muted, fontSize: 11, margin: 0, lineHeight: 1.45 }}>
            <span style={{ color: accent, fontWeight: 700, marginRight: 4 }}>→</span>
            <strong style={{ color: C.text }}>{card.action}</strong>
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ headers, rows, cols, dateCols, numCols, catCols, tsData, accent, kpiMappings, insightCards, insightsLoading }) {
  const primaryCol  = numCols[0];
  const secondaryCol = numCols[1];

  // KPI cards — use sector label/unit when a kpiMapping matches the column name
  const kpis = numCols.slice(0, 4).map((col) => {
    const info = cols[col];
    const matched = matchKpi(col, kpiMappings);
    const firstVal = toNum(rows[0]?.[col]);
    const lastVal  = toNum(rows[rows.length - 1]?.[col]);
    let sub = `Avg: ${fmt(info.avg)}${matched?.unit ? " " + matched.unit : ""}`;
    if (dateCols.length > 0 && firstVal && lastVal && firstVal !== 0) {
      const pct = ((lastVal - firstVal) / Math.abs(firstVal)) * 100;
      sub = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% over period`;
    }
    const label = matched ? matched.label : col;
    const color = numCols.indexOf(col) === 0 ? accent : PALETTE[numCols.indexOf(col)];
    return { label, value: fmt(info.sum), sub, color };
  });

  return (
    <div>
      {/* KPI row */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        {kpis.map((k) => <KCard key={k.label} {...k} />)}
        {numCols.length === 0 && (
          <KCard label="Rows" value={rows.length} sub={`${headers.length} columns detected`} color={C.forest} />
        )}
      </div>

      {/* AI insight cards */}
      {insightsLoading && <InsightSkeleton accent={accent} />}
      {!insightsLoading && <InsightCards cards={insightCards} accent={accent} />}

      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, marginBottom: 16 }}>
        {/* Primary trend chart */}
        <Pnl>
          <STitle accent={accent} sub={dateCols.length > 0 ? `${primaryCol} over ${dateCols[0]}` : `${primaryCol} distribution`}>
            {primaryCol ? `${primaryCol} — Trajectory` : "Overview"}
          </STitle>
          <ResponsiveContainer width="100%" height={210}>
            {tsData && tsData.length > 0 ? (
              <AreaChart data={tsData}>
                <defs>
                  <linearGradient id="ovG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor={accent} stopOpacity={0.18} />
                    <stop offset="90%" stopColor={accent} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                <XAxis dataKey="x" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<Tip />} />
                {primaryCol && <Area type="monotone" dataKey={primaryCol} name={primaryCol} stroke={accent} strokeWidth={2} fill="url(#ovG)" dot={{ fill: accent, r: 4, strokeWidth: 0 }} />}
              </AreaChart>
            ) : (
              <BarChart data={numCols.map((col) => ({ name: col, value: cols[col]?.sum || 0 }))}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="value" name="Total" radius={[4, 4, 0, 0]}>
                  {numCols.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </Pnl>

        {/* Secondary chart: bar of totals OR second metric */}
        <Pnl>
          <STitle accent={C.gold} sub="Column totals across full dataset">
            Column Totals
          </STitle>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart
              data={numCols.map((col, i) => ({ name: col, value: cols[col]?.sum || 0, fill: PALETTE[i % PALETTE.length] }))}
              barSize={22}
            >
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={36} />
              <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={58} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="value" name="Total" radius={[4, 4, 0, 0]}>
                {numCols.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Pnl>
      </div>

      {/* Second row: combined lines or category breakdown */}
      {tsData && tsData.length > 0 && numCols.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Pnl>
            <STitle accent={accent} sub="All numeric metrics over time">
              All Metrics — Trend Lines
            </STitle>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tsData}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                <XAxis dataKey="x" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                {numCols.slice(0, 5).map((col, i) => (
                  <Line key={col} type="monotone" dataKey={col} name={col} stroke={PALETTE[i]} strokeWidth={2} dot={{ r: 3, fill: PALETTE[i], strokeWidth: 0 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Pnl>

          <Pnl>
            <STitle accent={C.amber} sub="Operating trend: revenue vs cost comparison">
              Revenue vs Cost Structure
            </STitle>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tsData} barSize={20}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                <XAxis dataKey="x" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                {numCols.slice(0, 3).map((col, i) => (
                  <Bar key={col} dataKey={col} name={col} fill={PALETTE[i]} fillOpacity={0.8} radius={[3, 3, 0, 0]} stackId={i === 0 ? undefined : "s"} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Pnl>
        </div>
      )}
    </div>
  );
}

// ── Scenarios tab ─────────────────────────────────────────────────────────────
function ScenariosTab({ tsData, numCols, accent }) {
  const [periods, setPeriods] = useState(3);
  const [factors, setFactors] = useState({ bear: -20, bull: 20 });
  const primaryCol = numCols[0];

  const futureRows = useMemo(() => buildForecast(tsData, numCols.slice(0, 3), periods, factors), [tsData, numCols, periods, factors]);

  // Combined chart data: historical + forecast (3 lines for primary col)
  const combined = [
    ...tsData.map((d) => ({ ...d, _type: "historical" })),
    ...futureRows,
  ];

  const forecastTableCols = numCols.slice(0, 4);

  // Summary cards per scenario
  const summaryScenarios = [
    { key: "bear",   label: "Bear",   color: C.red },
    { key: "base",   label: "Base",   color: C.gold },
    { key: "bull",   label: "Bull",   color: accent },
  ];

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {summaryScenarios.map(({ key, label, color }) => {
          const lastRow = futureRows[futureRows.length - 1] || {};
          const val = lastRow[`${primaryCol}_${key}`];
          return (
            <div key={key} style={{ background: C.panel, border: `2px solid ${color}55`, borderRadius: 10, padding: "14px 18px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color }} />
              <p style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 6px" }}>{label} Scenario</p>
              <p style={{ color, fontSize: 20, fontWeight: 700, margin: "0 0 3px", fontFamily: "monospace" }}>{fmt(val)}</p>
              <p style={{ color: C.muted, fontSize: 10, margin: 0 }}>{primaryCol} at period +{periods} · {key === "bear" ? `${factors.bear}%` : key === "bull" ? `+${factors.bull}%` : "trend"} vs base</p>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, marginBottom: 16 }}>
        {/* Controls */}
        <Pnl>
          <STitle accent={C.amber} sub="Adjust scenario assumptions">Scenario Controls</STitle>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ color: C.muted, fontSize: 11 }}>Forecast periods</span>
              <span style={{ color: C.forest, fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{periods}</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={periods} onChange={(e) => setPeriods(parseInt(e.target.value))}
              style={{ width: "100%", accentColor: accent, height: 4, cursor: "pointer" }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ color: C.muted, fontSize: 11 }}>Bear adjustment</span>
              <span style={{ color: C.red, fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{factors.bear}%</span>
            </div>
            <input type="range" min={-60} max={-5} step={5} value={factors.bear} onChange={(e) => setFactors((f) => ({ ...f, bear: parseInt(e.target.value) }))}
              style={{ width: "100%", accentColor: C.red, height: 4, cursor: "pointer" }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ color: C.muted, fontSize: 11 }}>Bull adjustment</span>
              <span style={{ color: C.forest, fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>+{factors.bull}%</span>
            </div>
            <input type="range" min={5} max={100} step={5} value={factors.bull} onChange={(e) => setFactors((f) => ({ ...f, bull: parseInt(e.target.value) }))}
              style={{ width: "100%", accentColor: accent, height: 4, cursor: "pointer" }} />
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <p style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>Presets</p>
            {[{ l: "Conservative", b: -30, u: 15 }, { l: "Base", b: -20, u: 20 }, { l: "Optimistic", b: -10, u: 40 }].map(({ l, b, u }) => (
              <button key={l} onClick={() => setFactors({ bear: b, bull: u })}
                style={{ background: C.panel2, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginRight: 6, marginBottom: 6 }}>
                {l}
              </button>
            ))}
          </div>
        </Pnl>

        {/* Forecast chart */}
        <Pnl>
          <STitle accent={accent} sub={`Historical (solid) + ${periods}-period forecast (dashed) — bear / base / bull`}>
            {primaryCol} — Scenario Forecast
          </STitle>
          <ResponsiveContainer width="100%" height={270}>
            <ComposedChart data={combined}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis dataKey="x" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
              <ReferenceLine x={tsData[tsData.length - 1]?.x} stroke={C.border} strokeDasharray="3 3" />
              {/* Historical */}
              <Line type="monotone" dataKey={primaryCol} name={primaryCol} stroke={accent} strokeWidth={2.5} dot={{ r: 4, fill: accent, strokeWidth: 0 }} connectNulls={false} />
              {/* Forecast lines */}
              <Line type="monotone" dataKey={`${primaryCol}_base`} name="Base forecast" stroke={C.gold}   strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: C.gold,   strokeWidth: 0 }} />
              <Line type="monotone" dataKey={`${primaryCol}_bull`} name="Bull forecast" stroke={accent}   strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: accent,   strokeWidth: 0 }} />
              <Line type="monotone" dataKey={`${primaryCol}_bear`} name="Bear forecast" stroke={C.red}    strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: C.red,    strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Pnl>
      </div>

      {/* Scenario comparison table */}
      <Pnl>
        <STitle accent={accent} sub="Projected values per metric across all scenarios">
          Full Scenario Comparison Table
        </STitle>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                <th style={{ color: C.muted, textAlign: "left", padding: "8px 10px", fontWeight: 600, fontSize: 10, letterSpacing: "0.06em" }}>PERIOD</th>
                {forecastTableCols.map((col) => (
                  <th key={col} colSpan={3} style={{ color: C.forest, textAlign: "center", padding: "8px 10px", fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", borderLeft: `1px solid ${C.border}` }}>
                    {col}
                  </th>
                ))}
              </tr>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: "4px 10px" }} />
                {forecastTableCols.map((col) =>
                  ["Bear", "Base", "Bull"].map((s) => (
                    <th key={col + s} style={{ color: s === "Bear" ? C.red : s === "Bull" ? accent : C.gold, textAlign: "right", padding: "4px 8px", fontSize: 9, borderLeft: s === "Bear" ? `1px solid ${C.border}` : "none" }}>
                      {s}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {futureRows.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.panel : `${C.panel2}66` }}>
                  <td style={{ padding: "8px 10px", color: C.text, fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>{row.x}</td>
                  {forecastTableCols.map((col) =>
                    (["bear", "base", "bull"]).map((s) => (
                      <td key={col + s} style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 10, color: s === "bear" ? C.red : s === "bull" ? accent : C.gold, fontWeight: s === "base" ? 700 : 400, borderLeft: s === "bear" ? `1px solid ${C.border}` : "none" }}>
                        {fmt(row[`${col}_${s}`])}
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Pnl>
    </div>
  );
}

// ── Distribution tab ──────────────────────────────────────────────────────────
function DistributionTab({ headers, rows, cols, numCols, catCols }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {numCols.slice(0, 4).map((col, ci) => {
          const info = cols[col];
          if (!info?.values?.length) return null;
          const mn = info.min, mx = info.max, bins = 20;
          const step = (mx - mn) / bins || 1;
          const hist = Array.from({ length: bins }, (_, i) => ({ x: mn + i * step + step / 2, count: 0 }));
          info.values.forEach((v) => {
            const i = Math.min(Math.floor((v - mn) / step), bins - 1);
            hist[i].count++;
          });

          return (
            <Pnl key={col}>
              <STitle accent={PALETTE[ci]} sub={`n=${info.values.length} · min ${fmt(info.min)} · avg ${fmt(info.avg)} · max ${fmt(info.max)}`}>
                {col} — Distribution
              </STitle>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hist} barCategoryGap="5%">
                  <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                  <XAxis dataKey="x" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip formatter={(v, n, p) => [`${v} rows`, `Value ~${fmt(p.payload.x)}`]} />
                  <ReferenceLine x={info.avg} stroke={C.gold} strokeDasharray="3 2" label={{ value: "avg", fill: C.gold, fontSize: 8 }} />
                  <Bar dataKey="count" name="Count" fill={PALETTE[ci]} fillOpacity={0.75} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Pnl>
          );
        })}
      </div>

      {catCols.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {catCols.slice(0, 2).map((col) => {
            const info = cols[col];
            const freq = {};
            info.values.forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
            const data = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => ({ name: k, count: v }));
            return (
              <Pnl key={col} style={{ marginBottom: 16 }}>
                <STitle accent={C.amber} sub={`${info.unique.length} unique values`}>{col} — Frequency</STitle>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data} layout="vertical" barSize={12}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} horizontal={false} />
                    <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fill: C.text, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Count" fill={C.amber} fillOpacity={0.8} radius={[0, 4, 4, 0]}>
                      {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.75} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Pnl>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Data Table tab ────────────────────────────────────────────────────────────
function DataTableTab({ headers, rows, cols, accent }) {
  return (
    <Pnl>
      <STitle accent={accent} sub={`${rows.length} rows · ${headers.length} columns`}>Raw Data</STitle>
      <div style={{ overflowX: "auto", maxHeight: 560, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead style={{ position: "sticky", top: 0, background: C.panel2 }}>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {headers.map((h) => (
                <th key={h} style={{ padding: "9px 12px", textAlign: cols[h]?.type === "numeric" ? "right" : "left", color: C.muted, fontWeight: 600, fontSize: 10, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                  {h}
                  <span style={{ display: "block", fontWeight: 400, fontSize: 8, color: cols[h]?.type === "numeric" ? C.forest : C.muted, marginTop: 1 }}>
                    {cols[h]?.type}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.panel : `${C.panel2}66` }}>
                {headers.map((h) => (
                  <td key={h} style={{ padding: "7px 12px", color: C.text, textAlign: cols[h]?.type === "numeric" ? "right" : "left", fontFamily: cols[h]?.type === "numeric" ? "monospace" : "inherit", whiteSpace: "nowrap" }}>
                    {row[h] === null || row[h] === undefined ? <span style={{ color: C.muted }}>—</span> : typeof row[h] === "number" ? fmt(row[h]) : String(row[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 200 && <p style={{ padding: "10px 14px", color: C.muted, fontSize: 11 }}>Showing first 200 of {rows.length} rows.</p>}
      </div>
    </Pnl>
  );
}

// ── Main DynamicDashboard ─────────────────────────────────────────────────────
export default function DynamicDashboard({
  data, projectName, projects, onSwitchProject, onNewProject, onEditProject, onSignOut, userEmail, sector,
}) {
  const { headers, rows } = data;
  const [tab, setTab] = useState("overview");
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  const sectorCfg   = sector ? SECTOR_CONFIG[sector] : null;
  const accent      = sectorCfg?.accentColor || C.forest;
  const kpiMappings = sectorCfg?.kpiMappings || [];

  const [insightCards, setInsightCards]     = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const generatedKeyRef = useRef(null);

  const cols     = useMemo(() => analyzeColumns(headers, rows), [headers, rows]);
  const dateCols = useMemo(() => headers.filter((h) => cols[h]?.type === "date"), [headers, cols]);
  const numCols  = useMemo(() => headers.filter((h) => cols[h]?.type === "numeric"), [headers, cols]);
  const catCols  = useMemo(() => headers.filter((h) => cols[h]?.type === "categorical"), [headers, cols]);

  const tsData = useMemo(() => {
    if (dateCols.length > 0 && numCols.length > 0) return buildTimeSeries(rows, dateCols, numCols);
    if (catCols.length > 0 && numCols.length > 0)  return buildCategoryChart(rows, catCols[0], numCols);
    return null;
  }, [rows, dateCols, numCols, catCols]);

  const canForecast = dateCols.length > 0 && numCols.length > 0 && tsData?.length >= 2;

  // ── AI insight generation ────────────────────────────────────────────────────
  useEffect(() => {
    const dataKey = `${rows.length}-${headers.join(",")}`;
    if (!ANTHROPIC_KEY || numCols.length === 0 || rows.length === 0 || generatedKeyRef.current === dataKey) return;
    generatedKeyRef.current = dataKey;

    setInsightCards([]);
    setInsightsLoading(true);

    (async () => {
      try {
        // Step 1: call /api/explain (SHAP). Needs ≥2 numeric cols: features + target.
        const targetCol  = numCols[0];
        const featureCols = numCols.slice(1, 7); // up to 6 features
        let shapContext = "";

        if (featureCols.length >= 1) {
          try {
            const explainRes = await fetch(`${ML_API}/api/explain`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(20000),
              body: JSON.stringify({
                data: rows.slice(0, 150).map((r) => {
                  const out = {};
                  [...featureCols, targetCol].forEach((c) => { out[c] = toNum(r[c]) ?? 0; });
                  return out;
                }),
                feature_cols: featureCols,
                target_col: targetCol,
              }),
            });
            if (explainRes.ok) {
              const shap = await explainRes.json();
              const topFeatures = (shap.feature_importance || []).slice(0, 5)
                .map((f) => `${f.feature} (${f.importance_pct}% of impact)`).join(", ");
              const topWaterfall = (shap.waterfall_row0 || []).slice(0, 4)
                .map((w) => `${w.feature}: ${w.shap_value >= 0 ? "+" : ""}${w.shap_value} (value=${w.feature_value})`).join("; ");
              shapContext = `Target KPI: ${shap.target}. Top predictors: ${topFeatures}. SHAP breakdown for first record: ${topWaterfall}. Baseline prediction: ${shap.base_value}.`;
            }
          } catch {
            // SHAP unavailable — fall through to stats fallback
          }
        }

        // Fallback: use column statistics if SHAP is unavailable
        if (!shapContext) {
          shapContext = "Key metric statistics: " + numCols.slice(0, 6).map((col) => {
            const info = cols[col];
            return `${col}: total=${fmt(info.sum)}, avg=${fmt(info.avg)}, min=${fmt(info.min)}, max=${fmt(info.max)}`;
          }).join("; ");
        }

        // Step 2: call Anthropic API to generate insight cards
        const sectorName = sectorCfg?.displayName || "general business";
        const extraContext = sectorCfg?.insightContext ? `\nSector context: ${sectorCfg.insightContext}` : "";
        const systemPrompt = `You are a financial analyst generating actionable insights for a ${sectorName} sector client. Convert the following SHAP feature attribution data into 3 to 5 plain-English insight cards. Each card should have: a short title, one sentence explaining what is driving the result, and one recommended action. Be specific and avoid jargon.`;
        const userMessage = `Dataset: ${rows.length} records across columns: ${numCols.join(", ")}.${extraContext}\n\n${shapContext}\n\nReturn ONLY a JSON array — no markdown, no explanation. Each element must have exactly these keys: "title" (string, ≤8 words), "explanation" (one sentence), "action" (one actionable recommendation starting with a verb).`;

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-allow-browser": "true",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
          }),
        });

        if (!res.ok) throw new Error(`Anthropic ${res.status}`);
        const payload = await res.json();
        const text = payload.content?.[0]?.text || "";
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) setInsightCards(parsed.slice(0, 5));
        }
      } catch (err) {
        console.warn("Insight generation failed:", err.message);
      } finally {
        setInsightsLoading(false);
      }
    })();
  }, [data]); // re-run when the project dataset changes

  const tabs = [
    { id: "overview",     label: "Overview" },
    ...(canForecast ? [{ id: "scenarios", label: "Scenarios & Forecast" }] : []),
    { id: "distribution", label: "Distribution" },
    { id: "data",         label: "Data Table" },
  ];

  // Auto-insights
  const insights = useMemo(() => {
    const out = [];
    out.push(`${rows.length} records · ${headers.length} columns · ${numCols.length} numeric`);
    if (dateCols.length > 0 && tsData?.length >= 2) {
      out.push(`Period: ${tsData[0].x} → ${tsData[tsData.length - 1].x}`);
    }
    numCols.slice(0, 3).forEach((col) => {
      const info = cols[col];
      const first = toNum(rows[0]?.[col]), last = toNum(rows[rows.length - 1]?.[col]);
      let growth = "";
      if (dateCols.length > 0 && first && last && first !== 0) {
        const pct = ((last - first) / Math.abs(first)) * 100;
        growth = ` · ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% trend`;
      }
      out.push(`${col}: total ${fmt(info.sum)}${growth}`);
    });
    return out;
  }, [rows, headers, numCols, dateCols, tsData, cols]);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", color: C.text, paddingBottom: 48 }}>
      <style>{`@keyframes lm-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* Header — matches PVAKDashboard exactly */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 18, paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 800, letterSpacing: 1 }}>L</span>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>Lumina Intelligence</h1>
              <p style={{ margin: 0, fontSize: 11, color: C.muted, letterSpacing: "0.02em" }}>
                {projectName} · {rows.length} records · {numCols.length} metrics
                {sectorCfg && (
                  <span style={{ marginLeft: 8, background: `${accent}18`, color: accent, borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {sectorCfg.displayName}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Project switcher + actions */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowProjectMenu(!showProjectMenu)}
                style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: C.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {projectName} <span style={{ fontSize: 9 }}>▾</span>
              </button>
              {showProjectMenu && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, minWidth: 180, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
                  {projects?.map((p) => (
                    <button key={p.id} onClick={() => { onSwitchProject(p); setShowProjectMenu(false); }}
                      style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", fontSize: 12, color: C.text, cursor: "pointer", borderRadius: 6 }}>
                      {p.name}
                    </button>
                  ))}
                  <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6 }}>
                    <button onClick={() => { onNewProject(); setShowProjectMenu(false); }}
                      style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", fontSize: 12, color: C.forest, cursor: "pointer", fontWeight: 600, borderRadius: 6 }}>
                      + New Dataset
                    </button>
                  </div>
                </div>
              )}
            </div>
            {[
              { label: "Edit Data",  onClick: onEditProject, color: accent, bg: `${accent}18` },
              { label: "Sign Out",   onClick: onSignOut,     color: C.muted,  bg: "none" },
            ].map((b) => (
              <button key={b.label} onClick={b.onClick}
                style={{ background: b.bg, border: `1px solid ${b.color}55`, borderRadius: 20, padding: "5px 13px", fontSize: 11, color: b.color, fontWeight: 600, cursor: "pointer" }}>
                {b.label}
              </button>
            ))}
            <span style={{ color: C.muted, fontSize: 11 }}>{userEmail}</span>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "11px 18px", fontSize: 12, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? accent : C.muted, borderBottom: tab === t.id ? `2px solid ${accent}` : "2px solid transparent", letterSpacing: "0.02em", transition: "color 0.15s", whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>
        {/* Auto-insights banner */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 18px", marginBottom: 20, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ width: 3, height: 14, background: accent, borderRadius: 2, flexShrink: 0 }} />
          {insights.map((ins, i) => (
            <span key={i} style={{ color: i === 0 ? C.muted : C.text, fontSize: 12 }}>
              {i > 0 && <span style={{ color: C.border, marginRight: 8 }}>·</span>}
              {ins}
            </span>
          ))}
        </div>

        {tab === "overview"      && <OverviewTab      headers={headers} rows={rows} cols={cols} dateCols={dateCols} numCols={numCols} catCols={catCols} tsData={tsData} accent={accent} kpiMappings={kpiMappings} insightCards={insightCards} insightsLoading={insightsLoading} />}
        {tab === "scenarios"     && <ScenariosTab     tsData={tsData} numCols={numCols} accent={accent} />}
        {tab === "distribution"  && <DistributionTab  headers={headers} rows={rows} cols={cols} numCols={numCols} catCols={catCols} />}
        {tab === "data"          && <DataTableTab     headers={headers} rows={rows} cols={cols} accent={accent} />}
      </div>
    </div>
  );
}
