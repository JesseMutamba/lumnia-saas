import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, ReferenceLine, Cell,
} from "recharts";

const C = {
  bg: "#F4F0E6", panel: "#FEFCF8", panel2: "#EDE8DC", border: "#D5CEBC",
  text: "#1A1916", muted: "#8A8375", forest: "#2C5F1A", leaf: "#4D8C2E",
  sage: "#7DA05A", gold: "#A67C2A", amber: "#C8A04A", earth: "#7A4E2E",
  clay: "#9E6845", red: "#B03A2A",
};

// ── BASE DATA — injected from user's Supabase project ────────────────────────
const YEARS = ["2025","2026","2027","2028","2029","2030"];
// BASE is now passed as a prop — see PVAKDashboard component below

// ── SCENARIO CONFIG ──────────────────────────────────────────────────────────
const SCENARIO_DEFS = {
  bear:  { label: "Bear 🐻",  color: C.red,    cpoPriceFactor: 0.70, yieldFactor: 0.80, extractionFactor: 0.90, opexFactor: 1.20, capexFactor: 1.10 },
  base:  { label: "Base ⚖️", color: C.gold,   cpoPriceFactor: 1.00, yieldFactor: 1.00, extractionFactor: 1.00, opexFactor: 1.00, capexFactor: 1.00 },
  bull:  { label: "Bull 🐂",  color: C.forest, cpoPriceFactor: 1.30, yieldFactor: 1.15, extractionFactor: 1.08, opexFactor: 0.90, capexFactor: 0.95 },
};

function computeScenario(factors, BASE) {
  const { cpoPriceFactor, yieldFactor, extractionFactor, opexFactor } = factors;
  return BASE.map((d) => {
    const basePricePerT = d.revenue / d.cpo;
    const adjCpo = d.cpo * yieldFactor * extractionFactor;
    const adjRevenue = adjCpo * basePricePerT * cpoPriceFactor;
    const adjOpex = d.opex * opexFactor;
    const margin = adjRevenue - adjOpex;
    return {
      year: d.year,
      revenue: Math.round(adjRevenue),
      opex: Math.round(adjOpex),
      margin: Math.round(margin),
      marginPct: Math.round((margin / adjRevenue) * 100),
      cpo: Math.round(adjCpo),
      capex: Math.round(d.capex),
    };
  });
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n).toLocaleString()}`;
const fmtN = (n, d=1) => n >= 1e6 ? `${(n/1e6).toFixed(d)}M` : n >= 1e3 ? `${(n/1e3).toFixed(d)}K` : String(Math.round(n));

function boxMuller() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function runMonteCarlo(N, params, BASE) {
  const results = [];
  for (let i = 0; i < N; i++) {
    const cpoPrice   = Math.max(400, params.cpoPriceMu   + boxMuller() * params.cpoPriceSd);
    const yieldFac   = Math.max(0.3, params.yieldMu      + boxMuller() * params.yieldSd);
    const extractFac = Math.max(0.12, params.extractMu   + boxMuller() * params.extractSd);
    const opexFac    = Math.max(0.5, params.opexMu       + boxMuller() * params.opexSd);

    let totalRevenue = 0, totalOpex = 0, totalCapex = 0;
    const yearlyRevenue = [];
    for (const d of BASE) {
      const basePricePerT = d.revenue / d.cpo;
      const adjCpo = d.cpo * yieldFac * extractFac;
      const adjRevenue = adjCpo * basePricePerT * cpoPrice / 1000;
      const adjOpex = d.opex * opexFac;
      totalRevenue += adjRevenue;
      totalOpex += adjOpex;
      totalCapex += d.capex;
      yearlyRevenue.push(adjRevenue);
    }
    const totalMargin = totalRevenue - totalOpex;
    const finalYearMarginPct = ((yearlyRevenue[5] - BASE[5].opex * opexFac) / yearlyRevenue[5]) * 100;
    results.push({ totalRevenue, totalOpex, totalMargin, finalYearMarginPct, cpoPrice, yieldFac, opexFac });
  }
  return results;
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function buildHistogram(values, bins = 30) {
  const mn = Math.min(...values), mx = Math.max(...values);
  const step = (mx - mn) / bins;
  const hist = Array.from({ length: bins }, (_, i) => ({ x: mn + i * step + step / 2, count: 0, pct: 0 }));
  for (const v of values) {
    const i = Math.min(Math.floor((v - mn) / step), bins - 1);
    hist[i].count++;
  }
  const total = values.length;
  hist.forEach(h => h.pct = (h.count / total) * 100);
  return hist;
}

// ── SHARED COMPONENTS ────────────────────────────────────────────────────────
const Tip = ({ active, payload, label, suffix = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 13px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <p style={{ color: C.muted, fontSize: 10, marginBottom: 6, fontFamily: "monospace" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 12, margin: "2px 0" }}>
          <span style={{ fontWeight: 600 }}>{p.name}: </span>
          {typeof p.value === "number" ? (suffix ? `${p.value.toLocaleString()} ${suffix}` : fmt(p.value)) : p.value}
        </p>
      ))}
    </div>
  );
};

const Pnl = ({ children, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 22, ...style }}>{children}</div>
);

const STitle = ({ children, sub, accent }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 3, height: 16, background: accent || C.forest, borderRadius: 2 }} />
      <h2 style={{ color: C.text, fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", margin: 0 }}>{children}</h2>
    </div>
    {sub && <p style={{ color: C.muted, fontSize: 11, margin: "5px 0 0 11px", lineHeight: 1.4 }}>{sub}</p>}
  </div>
);

const KCard = ({ label, value, sub, color }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}55, transparent)` }} />
    <p style={{ color: C.muted, fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", margin: "0 0 7px" }}>{label}</p>
    <p style={{ color: color || C.text, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{value}</p>
    {sub && <p style={{ color: C.muted, fontSize: 11, margin: 0, lineHeight: 1.4 }}>{sub}</p>}
  </div>
);

const Slider = ({ label, min, max, step, value, onChange, format, color }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span style={{ color: C.muted, fontSize: 11 }}>{label}</span>
      <span style={{ color: color || C.forest, fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{format ? format(value) : value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: "100%", accentColor: color || C.forest, height: 4, cursor: "pointer" }} />
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: `${C.muted}88`, fontSize: 9, fontFamily: "monospace" }}>{format ? format(min) : min}</span>
      <span style={{ color: `${C.muted}88`, fontSize: 9, fontFamily: "monospace" }}>{format ? format(max) : max}</span>
    </div>
  </div>
);

// ── SCENARIO ANALYSIS TAB ────────────────────────────────────────────────────
function ScenarioTab({ BASE }) {
  const [custom, setCustom] = useState({ cpoPriceFactor: 1.0, yieldFactor: 1.0, extractionFactor: 1.0, opexFactor: 1.0 });
  const [activeScen, setActiveScen] = useState("all");

  const scenarios = {
    bear: computeScenario(SCENARIO_DEFS.bear, BASE),
    base: computeScenario(SCENARIO_DEFS.base, BASE),
    bull: computeScenario(SCENARIO_DEFS.bull, BASE),
    custom: computeScenario(custom, BASE),
  };

  const totals = Object.fromEntries(
    Object.entries(scenarios).map(([k, rows]) => [k, {
      revenue: rows.reduce((s, r) => s + r.revenue, 0),
      margin: rows.reduce((s, r) => s + r.margin, 0),
      opex: rows.reduce((s, r) => s + r.opex, 0),
    }])
  );

  const revenueChartData = YEARS.map((y, i) => ({
    year: y,
    Bear: scenarios.bear[i].revenue,
    Base: scenarios.base[i].revenue,
    Bull: scenarios.bull[i].revenue,
    Custom: scenarios.custom[i].revenue,
  }));

  const marginChartData = YEARS.map((y, i) => ({
    year: y,
    Bear: scenarios.bear[i].marginPct,
    Base: scenarios.base[i].marginPct,
    Bull: scenarios.bull[i].marginPct,
    Custom: scenarios.custom[i].marginPct,
  }));

  const waterfallData = [
    { name: "Bear", revenue: totals.bear.revenue, opex: -totals.bear.opex, margin: totals.bear.margin },
    { name: "Base", revenue: totals.base.revenue, opex: -totals.base.opex, margin: totals.base.margin },
    { name: "Bull", revenue: totals.bull.revenue, opex: -totals.bull.opex, margin: totals.bull.margin },
    { name: "Custom", revenue: totals.custom.revenue, opex: -totals.custom.opex, margin: totals.custom.margin },
  ];

  const cpoPriceBase = 1000;

  return (
    <div>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { key: "bear", ...SCENARIO_DEFS.bear },
          { key: "base", ...SCENARIO_DEFS.base },
          { key: "bull", ...SCENARIO_DEFS.bull },
          { key: "custom", label: "Custom 🎛️", color: C.amber },
        ].map(({ key, label, color }) => (
          <div key={key} style={{ background: C.panel, border: `2px solid ${color}55`, borderRadius: 10, padding: "14px 18px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color }} />
            <p style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 6px" }}>{label}</p>
            <p style={{ color, fontSize: 20, fontWeight: 700, margin: "0 0 3px", fontFamily: "monospace" }}>{fmt(totals[key].revenue)}</p>
            <p style={{ color: C.muted, fontSize: 10, margin: 0 }}>Total Revenue 2025–2030</p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <div>
                <p style={{ color: C.muted, fontSize: 9, margin: 0 }}>NET MARGIN</p>
                <p style={{ color, fontSize: 13, fontWeight: 700, margin: 0, fontFamily: "monospace" }}>{fmt(totals[key].margin)}</p>
              </div>
              <div>
                <p style={{ color: C.muted, fontSize: 9, margin: 0 }}>2030 MARGIN%</p>
                <p style={{ color, fontSize: 13, fontWeight: 700, margin: 0, fontFamily: "monospace" }}>{scenarios[key][5].marginPct}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, marginBottom: 16 }}>
        {/* Custom scenario controls */}
        <Pnl>
          <STitle accent={C.amber} sub="Drag sliders to build your own scenario">Custom Scenario Levers</STitle>
          <Slider label="CPO Price" min={0.5} max={1.8} step={0.05} value={custom.cpoPriceFactor}
            onChange={(v) => setCustom(p => ({ ...p, cpoPriceFactor: v }))}
            format={(v) => `$${Math.round(cpoPriceBase * v)}/T`} color={C.amber} />
          <Slider label="Yield Factor" min={0.5} max={1.5} step={0.05} value={custom.yieldFactor}
            onChange={(v) => setCustom(p => ({ ...p, yieldFactor: v }))}
            format={(v) => `${Math.round(v * 100)}%`} color={C.leaf} />
          <Slider label="Extraction Rate" min={0.7} max={1.3} step={0.05} value={custom.extractionFactor}
            onChange={(v) => setCustom(p => ({ ...p, extractionFactor: v }))}
            format={(v) => `${(0.23 * v * 100).toFixed(1)}%`} color={C.forest} />
          <Slider label="OPEX Factor" min={0.7} max={1.5} step={0.05} value={custom.opexFactor}
            onChange={(v) => setCustom(p => ({ ...p, opexFactor: v }))}
            format={(v) => `${Math.round(v * 100)}%`} color={C.earth} />

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <p style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>Preset Assumptions</p>
            {[
              { label: "Bear", f: SCENARIO_DEFS.bear, color: C.red },
              { label: "Base", f: SCENARIO_DEFS.base, color: C.gold },
              { label: "Bull", f: SCENARIO_DEFS.bull, color: C.forest },
            ].map(({ label, f, color }) => (
              <button key={label} onClick={() => setCustom({ cpoPriceFactor: f.cpoPriceFactor, yieldFactor: f.yieldFactor, extractionFactor: f.extractionFactor, opexFactor: f.opexFactor })}
                style={{ background: `${color}18`, border: `1px solid ${color}44`, color, borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginRight: 6, marginBottom: 6 }}>
                Load {label}
              </button>
            ))}
            <button onClick={() => setCustom({ cpoPriceFactor: 1.0, yieldFactor: 1.0, extractionFactor: 1.0, opexFactor: 1.0 })}
              style={{ background: C.panel2, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              Reset
            </button>
          </div>
        </Pnl>

        {/* Revenue comparison chart */}
        <Pnl>
          <STitle accent={C.forest} sub="Annual revenue projection across all 4 scenarios">Revenue by Scenario — 2025 to 2030</STitle>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={58} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
              <Line type="monotone" dataKey="Bear" stroke={C.red} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: C.red, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="Base" stroke={C.gold} strokeWidth={2.5} dot={{ r: 4, fill: C.gold, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="Bull" stroke={C.forest} strokeWidth={2} dot={{ r: 3, fill: C.forest, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="Custom" stroke={C.amber} strokeWidth={2} strokeDasharray="3 2" dot={{ r: 3, fill: C.amber, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </Pnl>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Margin % chart */}
        <Pnl>
          <STitle accent={C.leaf} sub="Operating margin % by scenario across years">Margin % by Scenario</STitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={marginChartData}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} domain={[-20, 100]} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip suffix="%" />} />
              <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
              <ReferenceLine y={0} stroke={C.border} strokeWidth={1.5} />
              <Line type="monotone" dataKey="Bear" stroke={C.red} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: C.red, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="Base" stroke={C.gold} strokeWidth={2.5} dot={{ r: 4, fill: C.gold, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="Bull" stroke={C.forest} strokeWidth={2} dot={{ r: 3, fill: C.forest, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="Custom" stroke={C.amber} strokeWidth={2} strokeDasharray="3 2" dot={{ r: 3, fill: C.amber, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </Pnl>

        {/* 6-year total bar comparison */}
        <Pnl>
          <STitle accent={C.gold} sub="Cumulative 2025–2030 revenue vs opex vs margin">6-Year Totals by Scenario</STitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={waterfallData} barSize={28}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v <= -1e6 ? `-$${(-v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
              <Bar dataKey="revenue" name="Revenue" fill={C.leaf} fillOpacity={0.7} radius={[3, 3, 0, 0]}>
                {waterfallData.map((d, i) => {
                  const colors = [C.red, C.gold, C.forest, C.amber];
                  return <Cell key={i} fill={colors[i]} fillOpacity={0.75} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Pnl>
      </div>

      {/* Full comparison table */}
      <Pnl>
        <STitle accent={C.forest} sub="Year-by-year revenue, OPEX, and margin for all scenarios">Full Scenario Comparison Table</STitle>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                <th style={{ color: C.muted, textAlign: "left", padding: "8px 10px", fontWeight: 600, fontSize: 10, letterSpacing: "0.06em" }}>YEAR</th>
                {["bear","base","bull","custom"].map(k => (
                  <th key={k} colSpan={3} style={{ color: SCENARIO_DEFS[k]?.color || C.amber, textAlign: "center", padding: "8px 10px", fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", borderLeft: `1px solid ${C.border}` }}>
                    {SCENARIO_DEFS[k]?.label || "CUSTOM 🎛️"}
                  </th>
                ))}
              </tr>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ color: C.muted, textAlign: "left", padding: "5px 10px", fontWeight: 500, fontSize: 10 }}></th>
                {["bear","base","bull","custom"].map(k => (
                  ["Rev","OPEX","Margin%"].map(h => (
                    <th key={k+h} style={{ color: C.muted, textAlign: "right", padding: "5px 8px", fontWeight: 500, fontSize: 9, borderLeft: h === "Rev" ? `1px solid ${C.border}` : "none" }}>{h}</th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {YEARS.map((y, i) => (
                <tr key={y} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.panel : `${C.panel2}66` }}>
                  <td style={{ padding: "8px 10px", color: C.text, fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>{y}</td>
                  {["bear","base","bull","custom"].map(k => {
                    const d = scenarios[k][i];
                    const color = SCENARIO_DEFS[k]?.color || C.amber;
                    return (
                      <>
                        <td key={k+"rev"} style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 10, color, borderLeft: `1px solid ${C.border}` }}>{fmt(d.revenue)}</td>
                        <td key={k+"opex"} style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 10, color: C.muted }}>{fmt(d.opex)}</td>
                        <td key={k+"marg"} style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 10, color: d.marginPct >= 50 ? C.forest : d.marginPct >= 20 ? C.gold : C.red, fontWeight: 700 }}>{d.marginPct}%</td>
                      </>
                    );
                  })}
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${C.border}`, background: `${C.gold}0A` }}>
                <td style={{ padding: "9px 10px", color: C.gold, fontWeight: 700, fontSize: 11 }}>TOTAL</td>
                {["bear","base","bull","custom"].map(k => {
                  const color = SCENARIO_DEFS[k]?.color || C.amber;
                  return (
                    <>
                      <td key={k+"trev"} style={{ padding: "9px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color, fontWeight: 700, borderLeft: `1px solid ${C.border}` }}>{fmt(totals[k].revenue)}</td>
                      <td key={k+"topx"} style={{ padding: "9px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color: C.muted }}>{fmt(totals[k].opex)}</td>
                      <td key={k+"tmg"} style={{ padding: "9px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color, fontWeight: 700 }}>{fmt(totals[k].margin)}</td>
                    </>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Pnl>
    </div>
  );
}

// ── MONTE CARLO TAB ──────────────────────────────────────────────────────────
function MonteCarloTab({ BASE }) {
  const [params, setParams] = useState({
    cpoPriceMu: 1000, cpoPriceSd: 150,
    yieldMu: 1.0,    yieldSd: 0.10,
    extractMu: 1.0,  extractSd: 0.03,
    opexMu: 1.0,     opexSd: 0.08,
    N: 2000,
  });
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [metric, setMetric] = useState("totalRevenue");

  const run = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const res = runMonteCarlo(params.N, params, BASE);
      setResults(res);
      setRunning(false);
    }, 20);
  }, [params, BASE]);

  useEffect(() => { run(); }, []);

  const metricOpts = [
    { key: "totalRevenue", label: "Total Revenue", color: C.forest },
    { key: "totalMargin", label: "Total Margin", color: C.leaf },
    { key: "finalYearMarginPct", label: "2030 Margin %", color: C.gold },
  ];

  const mc = metricOpts.find(m => m.key === metric);

  let stats = null, hist = null, p10 = null, p50 = null, p90 = null;
  if (results) {
    const vals = results.map(r => r[metric]);
    p10 = percentile(vals, 10);
    p50 = percentile(vals, 50);
    p90 = percentile(vals, 90);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    const sd = Math.sqrt(variance);
    const pAboveBase = vals.filter(v => v >= (metric === "finalYearMarginPct" ? 70 : BASE.reduce((s, d) => s + d.revenue, 0))).length / vals.length * 100;
    stats = { mean, sd, p10, p50, p90, pAboveBase };
    hist = buildHistogram(vals, 35);
  }

  const formatMetric = (v) => metric === "finalYearMarginPct" ? `${v.toFixed(1)}%` : fmt(v);
  const correlationData = results ? results.filter((_, i) => i % 20 === 0).map(r => ({ cpoPrice: Math.round(r.cpoPrice), margin: r[metric] })) : [];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, marginBottom: 16 }}>
        {/* Parameters */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Pnl>
            <STitle accent={C.forest} sub="Define distribution parameters for each variable">Simulation Parameters</STitle>

            <p style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>CPO Market Price ($/T)</p>
            <Slider label="Mean (μ)" min={600} max={1400} step={25} value={params.cpoPriceMu} onChange={v => setParams(p => ({...p, cpoPriceMu: v}))} format={v => `$${v}`} color={C.forest} />
            <Slider label="Std Dev (σ)" min={30} max={300} step={10} value={params.cpoPriceSd} onChange={v => setParams(p => ({...p, cpoPriceSd: v}))} format={v => `±$${v}`} color={C.forest} />

            <p style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", margin: "12px 0 10px" }}>Yield Factor</p>
            <Slider label="Mean (μ)" min={0.7} max={1.3} step={0.05} value={params.yieldMu} onChange={v => setParams(p => ({...p, yieldMu: v}))} format={v => `${(v*100).toFixed(0)}%`} color={C.leaf} />
            <Slider label="Std Dev (σ)" min={0.01} max={0.20} step={0.01} value={params.yieldSd} onChange={v => setParams(p => ({...p, yieldSd: v}))} format={v => `±${(v*100).toFixed(0)}%`} color={C.leaf} />

            <p style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", margin: "12px 0 10px" }}>OPEX Factor</p>
            <Slider label="Mean (μ)" min={0.8} max={1.3} step={0.05} value={params.opexMu} onChange={v => setParams(p => ({...p, opexMu: v}))} format={v => `${(v*100).toFixed(0)}%`} color={C.earth} />
            <Slider label="Std Dev (σ)" min={0.02} max={0.20} step={0.01} value={params.opexSd} onChange={v => setParams(p => ({...p, opexSd: v}))} format={v => `±${(v*100).toFixed(0)}%`} color={C.earth} />

            <p style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", margin: "12px 0 10px" }}>Simulations</p>
            <Slider label="Number of runs (N)" min={500} max={5000} step={500} value={params.N} onChange={v => setParams(p => ({...p, N: v}))} format={v => `${v.toLocaleString()}`} color={C.gold} />

            <button onClick={run} disabled={running}
              style={{ width: "100%", marginTop: 14, background: running ? C.muted : C.forest, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 12, fontWeight: 700, cursor: running ? "not-allowed" : "pointer", letterSpacing: "0.06em", transition: "background 0.2s" }}>
              {running ? "⚡ Running..." : `▶ Run ${params.N.toLocaleString()} Simulations`}
            </button>
          </Pnl>
        </div>

        {/* Histogram */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Metric selector */}
          <div style={{ display: "flex", gap: 8 }}>
            {metricOpts.map(m => (
              <button key={m.key} onClick={() => setMetric(m.key)}
                style={{ background: metric === m.key ? m.color : C.panel, border: `1px solid ${metric === m.key ? m.color : C.border}`, color: metric === m.key ? "#fff" : C.muted, borderRadius: 7, padding: "7px 16px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* P10 / P50 / P90 cards */}
          {stats && (
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { label: "P10 (Downside)", val: formatMetric(stats.p10), color: C.red, sub: "10% chance below" },
                { label: "P50 (Median)", val: formatMetric(stats.p50), color: C.gold, sub: "50% chance below" },
                { label: "P90 (Upside)", val: formatMetric(stats.p90), color: C.forest, sub: "90% chance below" },
                { label: "Mean ± σ", val: formatMetric(stats.mean), color: mc.color, sub: `σ = ${formatMetric(stats.sd)}` },
              ].map(card => (
                <div key={card.label} style={{ flex: 1, background: C.panel, border: `1px solid ${card.color}44`, borderRadius: 9, padding: "12px 14px" }}>
                  <p style={{ color: C.muted, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 4px" }}>{card.label}</p>
                  <p style={{ color: card.color, fontSize: 17, fontWeight: 700, fontFamily: "monospace", margin: "0 0 2px" }}>{card.val}</p>
                  <p style={{ color: C.muted, fontSize: 9, margin: 0 }}>{card.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Histogram */}
          <Pnl style={{ flex: 1 }}>
            <STitle accent={mc?.color} sub={`Distribution of ${mc?.label} across ${params.N.toLocaleString()} simulations`}>
              Outcome Distribution — {mc?.label}
            </STitle>
            {hist && stats ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hist} barCategoryGap="2%">
                  <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                  <XAxis dataKey="x" tickFormatter={(v) => metric === "finalYearMarginPct" ? `${v.toFixed(0)}%` : fmtN(v)} tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} interval={6} />
                  <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip formatter={(v, n, p) => [`${p.payload.pct.toFixed(2)}%`, "Frequency"]} labelFormatter={(v) => metric === "finalYearMarginPct" ? `${Number(v).toFixed(1)}%` : fmt(v)} />
                  <ReferenceLine x={stats.p10} stroke={C.red} strokeDasharray="4 2" label={{ value: "P10", fill: C.red, fontSize: 8, position: "top" }} />
                  <ReferenceLine x={stats.p50} stroke={C.gold} strokeWidth={2} label={{ value: "P50", fill: C.gold, fontSize: 8, position: "top" }} />
                  <ReferenceLine x={stats.p90} stroke={C.forest} strokeDasharray="4 2" label={{ value: "P90", fill: C.forest, fontSize: 8, position: "top" }} />
                  <Bar dataKey="pct" name="Frequency %">
                    {hist.map((h, i) => {
                      const isBelow10 = h.x < stats.p10;
                      const isAbove90 = h.x > stats.p90;
                      return <Cell key={i} fill={isBelow10 ? C.red : isAbove90 ? C.forest : mc.color} fillOpacity={0.75} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
                <span>Press Run to generate simulations</span>
              </div>
            )}
          </Pnl>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* CPO Price sensitivity scatter */}
        <Pnl>
          <STitle accent={C.gold} sub="Sampled simulation results showing CPO price sensitivity">CPO Price vs Outcome (Sample)</STitle>
          {correlationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <ComposedChart data={correlationData.sort((a,b) => a.cpoPrice - b.cpoPrice)}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                <XAxis dataKey="cpoPrice" tickFormatter={v => `$${v}`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: "CPO Price ($/T)", fill: C.muted, fontSize: 9, position: "insideBottom", offset: -2 }} />
                <YAxis tickFormatter={v => metric === "finalYearMarginPct" ? `${v.toFixed(0)}%` : fmtN(v)} tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} width={50} />
                <Tooltip formatter={(v) => [formatMetric(v), mc?.label]} labelFormatter={v => `CPO Price: $${v}/T`} />
                <Line dataKey="margin" name={mc?.label} dot={{ r: 2, fill: mc?.color, fillOpacity: 0.5, strokeWidth: 0 }} stroke="none" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 190, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}><span>Run simulation first</span></div>}
        </Pnl>

        {/* Probability table */}
        <Pnl>
          <STitle accent={C.forest} sub="Probability of exceeding key financial targets">Probability Analysis</STitle>
          {stats && results ? (
            <div>
              {[
                { label: "Total Revenue > $8M (2025–2030)", target: 8e6, key: "totalRevenue" },
                { label: "Total Revenue > $10M", target: 10e6, key: "totalRevenue" },
                { label: "Total Revenue > $12M", target: 12e6, key: "totalRevenue" },
                { label: "Total Margin > $4M", target: 4e6, key: "totalMargin" },
                { label: "Total Margin > $6M", target: 6e6, key: "totalMargin" },
                { label: "2030 Margin % > 70%", target: 70, key: "finalYearMarginPct" },
                { label: "2030 Margin % > 80%", target: 80, key: "finalYearMarginPct" },
              ].map(({ label, target, key }) => {
                const pct = results.filter(r => r[key] >= target).length / results.length * 100;
                const color = pct >= 70 ? C.forest : pct >= 40 ? C.gold : C.red;
                return (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.muted, fontSize: 11 }}>{label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 70, height: 5, borderRadius: 3, background: C.panel2, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
                      </div>
                      <span style={{ color, fontWeight: 700, fontFamily: "monospace", fontSize: 12, minWidth: 42, textAlign: "right" }}>{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
              <p style={{ color: C.muted, fontSize: 10, marginTop: 12, fontStyle: "italic" }}>
                Based on {params.N.toLocaleString()} Monte Carlo draws. CPO price N(${params.cpoPriceMu}, ${params.cpoPriceSd}), Yield N({params.yieldMu.toFixed(2)}, {params.yieldSd.toFixed(2)}), OPEX N({params.opexMu.toFixed(2)}, {params.opexSd.toFixed(2)}).
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 190, color: C.muted }}>
              <span>Run simulation to see probabilities</span>
            </div>
          )}
        </Pnl>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ───────────────────────────────────────────────────────────
const YEARS_LIST = ["2025","2026","2027","2028","2029","2030"];

const capexPlantation = [
  { name: "Semences", byYear: { 2025: 211200, 2026: 563200, 2027: 432000, 2028: 432000, 2029: 400800, 2030: 0 }, color: C.leaf },
  { name: "Poly Bags", byYear: { 2025: 2022, 2026: 85590, 2027: 48600, 2028: 48600, 2029: 45090, 2030: 0 }, color: C.sage },
  { name: "Plante couverture", byYear: { 2025: 0, 2026: 38400, 2027: 38400, 2028: 57600, 2029: 52800, 2030: 52800 }, color: C.forest },
  { name: "Engrais pépinière", byYear: { 2025: 0, 2026: 31200, 2027: 47280, 2028: 43200, 2029: 43200, 2030: 40080 }, color: C.gold },
  { name: "Engrais transpl.", byYear: { 2025: 1500, 2026: 20020, 2027: 42900, 2028: 39325, 2029: 39325, 2030: 36501 }, color: C.amber },
  { name: "Pesticides", byYear: { 2025: 0, 2026: 1000, 2027: 1000, 2028: 1000, 2029: 1000, 2030: 1000 }, color: C.earth },
  { name: "Parit + Sprinkler", byYear: { 2025: 0, 2026: 24000, 2027: 0, 2028: 0, 2029: 0, 2030: 0 }, color: C.muted },
];
const capexUsine = [
  { name: "Usine RENTEC 2ème", byYear: { 2025: 0, 2026: 48000, 2027: 0, 2028: 0, 2029: 0, 2030: 0 }, color: C.gold },
  { name: "Hangar & Bureau", byYear: { 2025: 3500, 2026: 40500, 2027: 0, 2028: 0, 2029: 0, 2030: 0 }, color: C.leaf },
  { name: "Citernes (×5)", byYear: { 2025: 62700, 2026: 3400, 2027: 0, 2028: 0, 2029: 0, 2030: 0 }, color: C.forest },
  { name: "Bascule + Bureau transp", byYear: { 2025: 0, 2026: 0, 2027: 28000, 2028: 0, 2029: 0, 2030: 0 }, color: C.amber },
  { name: "Laboratoire Usine", byYear: { 2025: 0, 2026: 6500, 2027: 0, 2028: 0, 2029: 0, 2030: 0 }, color: C.sage },
  { name: "Kit Maintenance", byYear: { 2025: 1300, 2026: 4500, 2027: 0, 2028: 0, 2029: 0, 2030: 0 }, color: C.clay },
  { name: "Toilettes Usine", byYear: { 2025: 0, 2026: 3000, 2027: 0, 2028: 0, 2029: 0, 2030: 0 }, color: C.muted },
];
const capexYearly = [
  { year: "2025", plantation: 214722, usine: 67500, total: 282222 },
  { year: "2026", plantation: 764210, usine: 105900, total: 870110 },
  { year: "2027", plantation: 610180, usine: 28000, total: 638180 },
  { year: "2028", plantation: 621725, usine: 0, total: 621725 },
  { year: "2029", plantation: 582215, usine: 0, total: 582215 },
  { year: "2030", plantation: 130381, usine: 0, total: 130381 },
];
const capexMonthly = [
  { month: "Jan", plantation: 0, usine: 0 },
  { month: "Feb", plantation: 121200, usine: 24750 },
  { month: "Mar", plantation: 166720, usine: 13250 },
  { month: "Apr", plantation: 8800, usine: 20150 },
  { month: "May", plantation: 47280, usine: 17750 },
  { month: "Jun", plantation: 110320, usine: 6750 },
  { month: "Jul", plantation: 17020, usine: 18750 },
  { month: "Aug", plantation: 119670, usine: 0 },
  { month: "Sep", plantation: 118120, usine: 0 },
  { month: "Oct", plantation: 7800, usine: 0 },
  { month: "Nov", plantation: 47280, usine: 0 },
  { month: "Dec", plantation: 0, usine: 4500 },
];
let acc = 0;
const capexCumul = capexMonthly.map((d) => { acc += d.plantation + d.usine; return { ...d, cumulative: acc }; });
const opexBreakdown = [
  { name: "Plantations (salary)", value: 87930, color: C.forest },
  { name: "Techniques (salary)", value: 43224, color: C.leaf },
  { name: "Administration (sal.)", value: 50559, color: C.sage },
  { name: "Carburants/Lubrifiant", value: 27514, color: C.gold },
  { name: "Rechanges véhicules", value: 20884, color: C.amber },
  { name: "Matériels agro", value: 18464, color: C.earth },
  { name: "Admin Site (CNSS etc)", value: 33110, color: C.clay },
  { name: "DGO Overhead", value: 58320, color: C.muted },
  { name: "Other materials", value: 21662, color: C.border },
];
const salaryData = [
  { role: "Récolteur", dept: "PROD", amount: 120750 },
  { role: "Ramasseur", dept: "PROD", amount: 47196 },
  { role: "Chef de quart", dept: "USINE", amount: 31823 },
  { role: "CDP", dept: "PROD", amount: 26538 },
  { role: "Op. presse", dept: "USINE", amount: 25447 },
  { role: "Aide opérat.", dept: "USINE", amount: 25272 },
  { role: "Chef récolte", dept: "PROD", amount: 7962 },
  { role: "Clerck évac.", dept: "PROD", amount: 6369 },
  { role: "Chargeur", dept: "PROD", amount: 3157 },
];
const productionMonthly = [
  { month: "Jul '25", FFB: 43.8, CPO: 7.36 },
  { month: "Aug '25", FFB: 152, CPO: 31.86 },
  { month: "Sep '25", FFB: 292, CPO: 59.76 },
  { month: "Oct '25", FFB: 354, CPO: 75.6 },
  { month: "Nov '25", FFB: 267, CPO: 61.78 },
  { month: "Dec '25", FFB: 78, CPO: 17.72 },
  { month: "Jan '26", FFB: 87, CPO: 20.01 },
  { month: "Feb '26", FFB: 235, CPO: 54.05 },
  { month: "Mar '26", FFB: 336, CPO: 77.28 },
];

const ProgressRow = ({ item, years }) => {
  const total = years.reduce((s, y) => s + (item.byYear[y] || 0), 0);
  const paid = years.filter((y) => parseInt(y) <= 2026).reduce((s, y) => s + (item.byYear[y] || 0), 0);
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
          <span style={{ color: C.text, fontSize: 11 }}>{item.name}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <span style={{ color: C.muted, fontSize: 10, fontFamily: "monospace" }}>{fmt(total)}</span>
          <span style={{ color: item.color, fontSize: 10, fontWeight: 700, fontFamily: "monospace", minWidth: 42, textAlign: "right" }}>{pct}% paid</span>
        </div>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: C.panel2, gap: 1 }}>
        {years.map((y) => {
          const v = item.byYear[y] || 0;
          const w = total > 0 ? (v / total) * 100 : 0;
          if (w < 0.3) return null;
          return <div key={y} title={`${y}: ${fmt(v)}`} style={{ width: `${w}%`, background: item.color, opacity: parseInt(y) <= 2026 ? 1 : 0.25 }} />;
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 3 }}>
        {years.map((y) => { const v = item.byYear[y] || 0; if (!v) return null; return <span key={y} style={{ fontSize: 9, color: parseInt(y) <= 2026 ? C.muted : `${C.muted}66`, fontFamily: "monospace" }}>{y}: {fmt(v)}</span>; })}
      </div>
    </div>
  );
};

export default function PVAKDashboard({ baseData, projectName, projects = [], onSwitchProject, onNewProject, onEditProject, onSignOut, userEmail }) {
  // Make BASE reactive to the user's data, auto-filling derived fields if missing
  const BASE = (baseData || []).map((d, i) => {
    const row = { ...d, year: YEARS[i] };
    // Auto-calculate margin only when both revenue and opex are present
    if (!row.margin && row.revenue > 0 && row.opex > 0) {
      row.margin = row.revenue - row.opex;
    }
    // Auto-calculate marginPct only when we have real margin and revenue data
    if ((!row.marginPct || row.marginPct === 0) && row.revenue > 0 && row.margin > 0) {
      row.marginPct = Math.round((row.margin / row.revenue) * 100);
    }
    return row;
  });

  // ── DERIVED KPIs from BASE data ──────────────────────────────────────────────
  const totalRevenue   = BASE.reduce((s, d) => s + (d.revenue || 0), 0);
  const totalCapex     = BASE.reduce((s, d) => s + (d.capex   || 0), 0);
  const totalOpex      = BASE.reduce((s, d) => s + (d.opex    || 0), 0);
  const totalMargin    = BASE.reduce((s, d) => s + (d.margin  || 0), 0);
  const lastRow        = BASE[BASE.length - 1] || {};
  const firstRow       = BASE[0] || {};
  const secondRow      = BASE[1] || BASE[0] || {};
  const revenueGrowth  = firstRow.revenue > 0
    ? Math.round(((lastRow.revenue - firstRow.revenue) / firstRow.revenue) * 100)
    : 0;
  const peakHaRow      = BASE.reduce((best, d) => (d.ha || 0) > (best.ha || 0) ? d : best, BASE[0] || {});
  const finalMarginPct = lastRow.marginPct || (lastRow.revenue > 0 && lastRow.margin > 0 ? Math.round((lastRow.margin / lastRow.revenue) * 100) : 0);
  const opexPerTCpo2   = secondRow.opexPerTCpo || (secondRow.cpo > 0 ? Math.round(secondRow.opex / secondRow.cpo) : 0);
  const totalPerTCpo2  = secondRow.totalPerTCpo || 0;
  const opexPerHa2     = secondRow.opexPerHa   || (secondRow.haMgd > 0 ? Math.round(secondRow.opex / secondRow.haMgd) : 0);
  const opexPerTLast   = lastRow.opexPerTCpo   || (lastRow.cpo > 0 ? Math.round(lastRow.opex / lastRow.cpo) : 0);
  const totalPerTLast  = lastRow.totalPerTCpo  || 0;
  const opexPct2       = secondRow.revenue > 0 ? Math.round((secondRow.opex / secondRow.revenue) * 100) : 0;
  const totalHaMgd     = lastRow.haMgd || 0;
  const firstYear      = firstRow.year  || YEARS[0];
  const lastYear       = lastRow.year   || YEARS[YEARS.length - 1];

  const [tab, setTab] = useState("overview");
  const [cview, setCview] = useState("progress");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "costprod", label: "Cost of Production" },
    { id: "capex", label: "CAPEX Detail" },
    { id: "opex", label: "OPEX & Labor" },
    { id: "production", label: "Production" },
    { id: "scenario", label: "📊 Scenario Analysis" },
    { id: "montecarlo", label: "🎲 Monte Carlo" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", color: C.text, paddingBottom: 48 }}>
      {/* HEADER */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 18, paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: C.forest, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 800, letterSpacing: 1 }}>PV</span>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>PVAK Financial Intelligence System</h1>
              <p style={{ margin: 0, fontSize: 11, color: C.muted, letterSpacing: "0.02em" }}>Palm Oil Operations · Institutional Dashboard · 2025–2030 · RSPO-Aligned</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {projects.length > 1 && (
              <select onChange={(e) => onSwitchProject(projects.find(p => p.id === e.target.value))}
                style={{ padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.panel2, color: C.text, fontSize: 12, cursor: "pointer" }}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button onClick={onEditProject} style={{ background: "none", color: C.forest, border: `1px solid ${C.forest}`, borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit Data</button>
            <button onClick={onNewProject} style={{ background: C.forest, color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ New Project</button>
            <span style={{ color: C.muted, fontSize: 11 }}>{userEmail}</span>
            <button onClick={onSignOut} style={{ background: "none", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>Sign Out</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "11px 18px", fontSize: 12, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.forest : C.muted, borderBottom: tab === t.id ? `2px solid ${C.forest}` : "2px solid transparent", letterSpacing: "0.02em", transition: "color 0.15s", whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>

        {/* ═══ OVERVIEW ═══ */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
              <KCard label={`Revenue Projection ${firstYear}–${lastYear}`} value={fmt(totalRevenue)} sub={`${revenueGrowth.toLocaleString()}% growth over period`} color={C.forest} />
              <KCard label="Total CAPEX Budget" value={fmt(totalCapex)} sub={`Total investment ${firstYear}–${lastYear}`} color={C.gold} />
              <KCard label="Total OPEX" value={fmt(totalOpex)} sub={`Operating costs ${firstYear}–${lastYear}`} color={C.leaf} />
              <KCard label="Peak Planting Year" value={peakHaRow.year || "—"} sub={`${(peakHaRow.ha || 0).toLocaleString()} HA · ${totalHaMgd.toLocaleString()} HA total by ${lastYear}`} color={C.earth} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, marginBottom: 16 }}>
              <Pnl>
                <STitle accent={C.forest} sub="Projected CPO revenues 2025–2030 (USD)">Revenue Trajectory</STitle>
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={BASE}>
                    <defs><linearGradient id="revG" x1="0" y1="0" x2="0" y2="1"><stop offset="10%" stopColor={C.forest} stopOpacity={0.18} /><stop offset="90%" stopColor={C.forest} stopOpacity={0.01} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                    <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={58} />
                    <Tooltip content={<Tip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.forest} strokeWidth={2} fill="url(#revG)" dot={{ fill: C.forest, r: 4, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Pnl>
              <Pnl>
                <STitle accent={C.gold} sub="New hectares planted each year">Plantation Scale-up</STitle>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={BASE} barSize={28}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                    <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip suffix="HA" />} />
                    <Bar dataKey="ha" name="HA Planted" radius={[4, 4, 0, 0]}>
                      {BASE.map((d, i) => <Cell key={i} fill={d.year === "2027" ? C.gold : C.leaf} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Pnl>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Pnl>
                <STitle accent={C.gold} sub="Annual CAPEX investment vs revenue generated">CAPEX vs Revenue</STitle>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={capexYearly.map((d, i) => ({ ...d, revenue: BASE[i].revenue }))}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                    <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={58} />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                    <Bar dataKey="total" name="CAPEX" fill={C.gold} fillOpacity={0.7} radius={[3, 3, 0, 0]} barSize={24} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke={C.forest} strokeWidth={2} dot={{ fill: C.forest, r: 3, strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Pnl>
              <Pnl>
                <STitle accent={C.leaf} sub="Operating margin (Revenue − OPEX) by year">Operating Margin Trend</STitle>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={BASE} barSize={28}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                    <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip suffix="%" />} />
                    <Bar dataKey="marginPct" name="Margin %" radius={[4, 4, 0, 0]}>
                      {BASE.map((d, i) => <Cell key={i} fill={d.marginPct >= 60 ? C.forest : d.marginPct >= 40 ? C.leaf : C.sage} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Pnl>
            </div>
          </div>
        )}

        {/* ═══ COST OF PRODUCTION ═══ */}
        {tab === "costprod" && (
          <div>
            <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
              <KCard label={`OPEX / Tonne CPO — ${secondRow.year || ""}`} value={opexPerTCpo2 ? `$${opexPerTCpo2.toLocaleString()} / T` : "—"} sub={opexPerTLast ? `${lastYear} target: $${opexPerTLast.toLocaleString()}/T` : "Enter CPO & OPEX data"} color={C.forest} />
              <KCard label={`Total Cost / Tonne CPO — ${secondRow.year || ""}`} value={totalPerTCpo2 ? `$${totalPerTCpo2.toLocaleString()} / T` : "—"} sub={totalPerTLast ? `vs $${totalPerTLast.toLocaleString()}/T at maturity (${lastYear})` : "Enter totalPerTCpo data"} color={C.red} />
              <KCard label={`OPEX / Managed Hectare — ${secondRow.year || ""}`} value={opexPerHa2 ? `$${opexPerHa2.toLocaleString()} / HA` : "—"} sub={`Based on ${(secondRow.haMgd || 0).toLocaleString()} HA managed`} color={C.gold} />
              <KCard label={`Operating Margin — ${lastYear}`} value={finalMarginPct ? `${finalMarginPct}%` : "—"} sub={totalMargin > 0 ? `Net margin: ${fmt(totalMargin)} over period` : "Enter revenue & OPEX data"} color={C.leaf} />
            </div>
            <Pnl style={{ marginBottom: 16 }}>
              <STitle accent={C.forest} sub="Operating cost per tonne of CPO produced">OPEX per Tonne CPO — Efficiency Curve 2025–2030</STitle>
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={BASE}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                  <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="cost" tickFormatter={(v) => `$${v}`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                  <YAxis yAxisId="cpo" orientation="right" tickFormatter={(v) => `${(v/1000).toFixed(1)}KT`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                  <Bar yAxisId="cpo" dataKey="cpo" name="CPO Volume (T)" fill={C.sage} fillOpacity={0.4} radius={[3, 3, 0, 0]} barSize={28} />
                  <Line yAxisId="cost" type="monotone" dataKey="opexPerTCpo" name="OPEX / T CPO ($)" stroke={C.red} strokeWidth={2.5} dot={{ fill: C.red, r: 5, strokeWidth: 0 }} />
                  <Line yAxisId="cost" type="monotone" dataKey="totalPerTCpo" name="Total Cost / T CPO ($)" stroke={C.earth} strokeWidth={2} strokeDasharray="5 3" dot={{ fill: C.earth, r: 3, strokeWidth: 0 }} />
                  <ReferenceLine yAxisId="cost" y={800} stroke={C.gold} strokeDasharray="4 2" label={{ value: "CPO Market ~$1,000/T", fill: C.gold, fontSize: 9, position: "insideTopRight" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Pnl>
            <Pnl>
              <STitle accent={C.forest} sub="Full cost breakdown 2025–2030">Cost of Production — Full Table</STitle>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                      {["Metric","2025","2026 ★","2027","2028","2029","2030"].map(h => (
                        <th key={h} style={{ color: C.muted, textAlign: h === "Metric" ? "left" : "right", padding: "8px 12px", fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "CPO Produced (T)", key: "cpo", fmt: v => Math.round(v).toLocaleString(), color: C.text },
                      { label: "FFB Harvested (T)", key: "ffb", fmt: v => v.toLocaleString(), color: C.muted },
                      { label: "Revenue (USD)", key: "revenue", fmt: v => fmt(v), color: C.forest },
                      { label: "OPEX", key: "opex", fmt: v => fmt(v), color: C.earth },
                      { label: "Margin %", key: "marginPct", fmt: v => `${v}%`, color: C.leaf },
                      { label: "OPEX / Tonne CPO", key: "opexPerTCpo", fmt: v => `$${v}`, color: C.red },
                      { label: "OPEX / Managed HA", key: "opexPerHa", fmt: v => `$${v}`, color: C.gold },
                    ].map((row, ri) => (
                      <tr key={row.label} style={{ borderBottom: `1px solid ${C.border}`, background: ri % 2 === 0 ? C.panel : `${C.panel2}66` }}>
                        <td style={{ padding: "9px 12px", color: C.muted, fontSize: 11 }}>{row.label}</td>
                        {BASE.map((d, i) => {
                          const is26 = d.year === "2026";
                          return <td key={i} style={{ padding: "9px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: is26 ? 700 : 400, color: is26 ? C.text : row.color, background: is26 ? `${C.forest}08` : "transparent" }}>{row.fmt(d[row.key])}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Pnl>
          </div>
        )}

        {/* ═══ CAPEX ═══ */}
        {tab === "capex" && (
          <div>
            <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
              <KCard label={`Total CAPEX ${firstYear}–${lastYear}`} value={fmt(totalCapex)} sub={`Avg ${fmt(totalCapex / Math.max(BASE.length, 1))} / year`} color={C.gold} />
              <KCard label="Peak CAPEX Year" value={BASE.reduce((b, d) => (d.capex||0) > (b.capex||0) ? d : b, BASE[0]||{}).year || "—"} sub={fmt(BASE.reduce((b, d) => (d.capex||0) > (b.capex||0) ? d : b, BASE[0]||{}).capex||0)} color={C.red} />
              <KCard label="CAPEX to Revenue Ratio" value={totalRevenue > 0 ? `${Math.round((totalCapex/totalRevenue)*100)}%` : "—"} sub="Investment intensity over full period" color={C.forest} />
              <KCard label="Net Position" value={fmt(totalRevenue - totalCapex - totalOpex)} sub="Revenue minus all costs" color={C.earth} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {[{ id: "progress", label: "Item Progress" }, { id: "yearly", label: "Year by Year" }, { id: "monthly", label: "Monthly Flow 2026" }].map(v => (
                <button key={v.id} onClick={() => setCview(v.id)} style={{ background: cview === v.id ? C.forest : C.panel, border: `1px solid ${cview === v.id ? C.forest : C.border}`, color: cview === v.id ? "#fff" : C.muted, borderRadius: 7, padding: "7px 15px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {v.label}
                </button>
              ))}
            </div>
            {cview === "progress" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Pnl><STitle accent={C.forest} sub="Solid = ≤2026 · Faded = 2027+">Plantation Dev — Line Item Progress</STitle>{capexPlantation.map(it => <ProgressRow key={it.name} item={it} years={YEARS_LIST} />)}</Pnl>
                  <Pnl><STitle accent={C.gold} sub="Mill & technical infrastructure">Usine Items — Progress</STitle>{capexUsine.map(it => <ProgressRow key={it.name} item={it} years={YEARS_LIST} />)}</Pnl>
                </div>
                <Pnl>
                  <STitle accent={C.gold} sub="Plantation CAPEX stacked by item">Annual Plantation Breakdown</STitle>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={YEARS_LIST.map(y => { const o = { year: y }; capexPlantation.forEach(it => { o[it.name] = it.byYear[y] || 0; }); return o; })} barSize={32}>
                      <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                      <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v}`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip content={<Tip />} />
                      {capexPlantation.map((it, i) => <Bar key={i} dataKey={it.name} stackId="a" fill={it.color} radius={i === capexPlantation.length - 1 ? [3,3,0,0] : [0,0,0,0]} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </Pnl>
              </div>
            )}
            {cview === "yearly" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                  {capexYearly.map(d => (
                    <Pnl key={d.year} style={{ borderColor: d.year === "2026" ? `${C.forest}55` : C.border }}>
                      <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", margin: 0 }}>CAPEX {d.year}</p>
                      <p style={{ color: d.year === "2026" ? C.forest : C.text, fontSize: 20, fontWeight: 700, fontFamily: "monospace", margin: "4px 0 8px" }}>{fmt(d.total)}</p>
                      {[...capexPlantation, ...capexUsine].filter(it => (it.byYear[d.year] || 0) > 0).sort((a, b) => (b.byYear[d.year] || 0) - (a.byYear[d.year] || 0)).slice(0, 5).map(it => (
                        <div key={it.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}`, fontSize: 11 }}>
                          <span style={{ color: C.text }}>{it.name}</span>
                          <span style={{ fontFamily: "monospace", color: it.color }}>{fmt(it.byYear[d.year] || 0)}</span>
                        </div>
                      ))}
                    </Pnl>
                  ))}
                </div>
                <Pnl>
                  <STitle accent={C.gold} sub="Plantation dev vs Usine by year">Total CAPEX — 2025 to 2030</STitle>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={capexYearly} barSize={42}>
                      <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                      <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={58} />
                      <Tooltip content={<Tip />} />
                      <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                      <Bar dataKey="plantation" name="Plantation Dev" stackId="a" fill={C.leaf} />
                      <Bar dataKey="usine" name="Usine & Tech" stackId="a" fill={C.gold} radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Pnl>
              </div>
            )}
            {cview === "monthly" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Pnl>
                  <STitle accent={C.gold} sub="Plantation vs Usine monthly disbursements">2026 Monthly CAPEX Cash Flow</STitle>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={capexMonthly} barSize={26}>
                      <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                      <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v}`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip content={<Tip />} />
                      <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                      <Bar dataKey="plantation" name="Plantation Dev" stackId="a" fill={C.leaf} />
                      <Bar dataKey="usine" name="Usine & Tech" stackId="a" fill={C.gold} radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Pnl>
                <Pnl>
                  <STitle accent={C.forest} sub="Running total vs $870K annual budget">Cumulative CAPEX 2026</STitle>
                  <ResponsiveContainer width="100%" height={185}>
                    <AreaChart data={capexCumul}>
                      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.forest} stopOpacity={0.2}/><stop offset="95%" stopColor={C.forest} stopOpacity={0.01}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                      <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v}`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip content={<Tip />} />
                      <ReferenceLine y={870110} stroke={C.red} strokeDasharray="4 2" label={{ value: "Budget $870K", fill: C.red, fontSize: 9, position: "insideTopRight" }} />
                      <Area type="monotone" dataKey="cumulative" name="Cumulative CAPEX" stroke={C.forest} strokeWidth={2} fill="url(#cg)" dot={{ fill: C.forest, r: 3, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Pnl>
              </div>
            )}
          </div>
        )}

        {/* ═══ OPEX ═══ */}
        {tab === "opex" && (
          <div>
            <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
              <KCard label={`Total OPEX ${firstYear}–${lastYear}`} value={fmt(totalOpex)} sub={`${fmt(secondRow.opex || 0)} in ${secondRow.year || ""} (base year)`} color={C.red} />
              <KCard label="Avg Annual OPEX" value={fmt(totalOpex / Math.max(BASE.length, 1))} sub="Mean operating cost per year" color={C.gold} />
              <KCard label="OPEX Growth" value={firstRow.opex > 0 ? `${Math.round(((lastRow.opex - firstRow.opex) / firstRow.opex) * 100)}%` : "—"} sub={`${firstYear} → ${lastYear}`} color={C.leaf} />
              <KCard label="Fixed Overhead" value="$91K / yr" sub="Admin site $33K + DGO $58K" color={C.earth} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Pnl>
                <STitle accent={C.forest} sub="2026 base year OPEX composition">OPEX Breakdown by Category</STitle>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={opexBreakdown} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `$${(v/1e3).toFixed(0)}K`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={155} tick={{ fill: C.text, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="value" name="Annual Cost" radius={[0,4,4,0]}>{opexBreakdown.map((d,i) => <Cell key={i} fill={d.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Pnl>
              <Pnl>
                <STitle accent={C.gold} sub="Salary by role — 2026 annual projection">Labor Cost by Role</STitle>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[...salaryData].sort((a,b) => b.amount - a.amount)} layout="vertical" barSize={13}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `$${(v/1e3).toFixed(0)}K`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="role" width={90} tick={{ fill: C.text, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="amount" name="Annual Salary" radius={[0,4,4,0]}>
                      {[...salaryData].sort((a,b) => b.amount-a.amount).map((d,i) => <Cell key={i} fill={d.dept === "PROD" ? C.forest : C.gold} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Pnl>
            </div>
          </div>
        )}

        {/* ═══ PRODUCTION ═══ */}
        {tab === "production" && (
          <div>
            <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
              <KCard label="Total FFB (Jul 25–Mar 26)" value="1,926 T" sub="Peak Oct 2025 — 354 tonnes" color={C.forest} />
              <KCard label="Total CPO (Jul 25–Mar 26)" value="405 T" sub="Avg extraction rate ~21%" color={C.gold} />
              <KCard label="CPO Projection 2030" value="5,228 T" sub="20.5× growth from 2025 baseline" color={C.leaf} />
              <KCard label="Mature HA at 2030" value="2,779 HA" sub="485% increase from current 475 HA" color={C.earth} />
            </div>
            <Pnl style={{ marginBottom: 16 }}>
              <STitle accent={C.forest} sub="Actual tonnes harvested and processed — Jul 2025 to Mar 2026">FFB & CPO Monthly Production (Actuals)</STitle>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={productionMonthly} barGap={3}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                  <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="ffb" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="cpo" orientation="right" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip suffix="T" />} />
                  <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                  <Bar yAxisId="ffb" dataKey="FFB" name="FFB (T)" fill={C.sage} radius={[4,4,0,0]} barSize={18} />
                  <Bar yAxisId="cpo" dataKey="CPO" name="CPO (T)" fill={C.gold} radius={[4,4,0,0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </Pnl>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Pnl>
                <STitle accent={C.leaf} sub="CPO extraction rate monthly">Extraction Rate (%) — Monthly</STitle>
                <ResponsiveContainer width="100%" height={195}>
                  <LineChart data={productionMonthly.map(d => ({ month: d.month, rate: d.FFB > 0 ? +((d.CPO/d.FFB)*100).toFixed(1) : 0 }))}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[10,30]} tickFormatter={v => `${v}%`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip suffix="%" />} />
                    <ReferenceLine y={22} stroke={C.gold} strokeDasharray="4 2" label={{ value: "Avg 22%", fill: C.gold, fontSize: 9 }} />
                    <Line type="monotone" dataKey="rate" name="Extraction %" stroke={C.forest} strokeWidth={2.5} dot={{ fill: C.forest, r: 4, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Pnl>
              <Pnl>
                <STitle accent={C.gold} sub="Projected CPO & FFB tonnage 2025–2030">5-Year Production Forecast</STitle>
                <ResponsiveContainer width="100%" height={195}>
                  <BarChart data={BASE} barSize={24}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
                    <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip suffix="T" />} />
                    <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                    <Bar dataKey="cpo" name="CPO (T)" fill={C.gold} radius={[3,3,0,0]} />
                    <Bar dataKey="ffb" name="FFB (T)" fill={C.sage} fillOpacity={0.7} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Pnl>
            </div>
          </div>
        )}

        {/* ═══ SCENARIO ANALYSIS ═══ */}
        {tab === "scenario" && <ScenarioTab BASE={BASE} />}

        {/* ═══ MONTE CARLO ═══ */}
        {tab === "montecarlo" && <MonteCarloTab BASE={BASE} />}

      </div>
    </div>
  );
}
