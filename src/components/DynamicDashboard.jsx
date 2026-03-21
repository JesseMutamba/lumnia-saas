import { useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

const C = {
  bg: "#F4F0E6", panel: "#FEFCF8", panel2: "#EDE8DC", border: "#D5CEBC",
  text: "#1A1916", muted: "#8A8375", forest: "#2C5F1A", leaf: "#4D8C2E",
};

const PALETTE = ["#2C5F1A", "#4D8C2E", "#90D87B", "#A67C2A", "#C8A04A", "#B03A2A", "#6B8FBF", "#9B6BBF"];

function toNum(v) {
  if (typeof v === "number") return isNaN(v) ? null : v;
  const n = parseFloat(String(v ?? "").replace(/[$€£,\s%]/g, ""));
  return isNaN(n) ? null : n;
}

function fmt(n, short = true) {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (short) {
    if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  }
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
}

function extractYear(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}

// Classify each column as: "date", "numeric", or "categorical"
function analyzeColumns(headers, rows) {
  const cols = {};
  headers.forEach((h) => {
    const vals = rows.map((r) => r[h]).filter((v) => v !== undefined && v !== null && String(v).trim() !== "");
    if (vals.length === 0) { cols[h] = { type: "empty" }; return; }

    // Date/year detection
    const yearHits = vals.filter((v) => extractYear(v) !== null).length;
    if (yearHits >= Math.min(2, vals.length) && yearHits / vals.length >= 0.5) {
      cols[h] = { type: "date", values: vals.map((v) => extractYear(v) || String(v)) };
      return;
    }

    // Numeric detection
    const numVals = vals.map(toNum).filter((v) => v !== null);
    if (numVals.length / vals.length >= 0.6) {
      const sum = numVals.reduce((a, b) => a + b, 0);
      const avg = sum / numVals.length;
      cols[h] = {
        type: "numeric",
        values: numVals,
        sum,
        avg,
        min: Math.min(...numVals),
        max: Math.max(...numVals),
        count: numVals.length,
      };
      return;
    }

    // Categorical
    const unique = [...new Set(vals.map((v) => String(v).trim()))];
    cols[h] = { type: "categorical", values: vals.map((v) => String(v).trim()), unique };
  });
  return cols;
}

function generateInsights(headers, rows, cols) {
  const insights = [];

  const dateCols = headers.filter((h) => cols[h]?.type === "date");
  const numCols = headers.filter((h) => cols[h]?.type === "numeric");
  const catCols = headers.filter((h) => cols[h]?.type === "categorical");

  insights.push(`${rows.length} records · ${headers.length} columns · ${numCols.length} numeric field${numCols.length !== 1 ? "s" : ""}`);

  if (dateCols.length > 0) {
    const dc = dateCols[0];
    const dates = cols[dc].values.filter(Boolean).sort();
    if (dates.length >= 2) insights.push(`Period: ${dates[0]} → ${dates[dates.length - 1]}`);
  }

  numCols.slice(0, 4).forEach((col) => {
    const info = cols[col];
    const parts = [`Total: ${fmt(info.sum)}`];
    if (dateCols.length > 0) {
      const firstVal = toNum(rows[0]?.[col]);
      const lastVal = toNum(rows[rows.length - 1]?.[col]);
      if (firstVal && lastVal && firstVal !== 0) {
        const pct = ((lastVal - firstVal) / Math.abs(firstVal)) * 100;
        parts.push(`Trend: ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`);
      }
    } else {
      parts.push(`Avg: ${fmt(info.avg)}`);
    }
    insights.push(`${col} — ${parts.join(" · ")}`);
  });

  if (catCols.length > 0) {
    const cc = catCols[0];
    const info = cols[cc];
    insights.push(`${cc}: ${info.unique.length} unique value${info.unique.length !== 1 ? "s" : ""}`);
  }

  return insights;
}

function buildTimeSeriesData(headers, rows, dateCols, numCols) {
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

function buildCategoryData(headers, rows, catCols, numCols) {
  const cc = catCols[0];
  const grouped = {};
  rows.forEach((row) => {
    const key = String(row[cc] ?? "Unknown").trim();
    if (!grouped[key]) grouped[key] = { x: key };
    numCols.forEach((col) => {
      const n = toNum(row[col]);
      if (n !== null) grouped[key][col] = (grouped[key][col] || 0) + n;
    });
  });
  return Object.values(grouped)
    .sort((a, b) => (b[numCols[0]] || 0) - (a[numCols[0]] || 0))
    .slice(0, 20);
}

function KPICard({ label, value, sub }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px" }}>
      <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>{label}</p>
      <p style={{ color: C.text, fontSize: 22, fontWeight: 800, margin: "0 0 2px", fontFamily: "Manrope, sans-serif" }}>{value}</p>
      {sub && <p style={{ color: C.muted, fontSize: 11, margin: 0 }}>{sub}</p>}
    </div>
  );
}

const TOOLTIP_STYLE = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 };

export default function DynamicDashboard({
  data, projectName, projects, onSwitchProject, onNewProject, onEditProject, onSignOut, userEmail,
}) {
  const { headers, rows } = data;
  const [activeTab, setActiveTab] = useState("overview");
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  const cols = useMemo(() => analyzeColumns(headers, rows), [headers, rows]);

  const dateCols = useMemo(() => headers.filter((h) => cols[h]?.type === "date"), [headers, cols]);
  const numCols = useMemo(() => headers.filter((h) => cols[h]?.type === "numeric"), [headers, cols]);
  const catCols = useMemo(() => headers.filter((h) => cols[h]?.type === "categorical"), [headers, cols]);

  const insights = useMemo(() => generateInsights(headers, rows, cols), [headers, rows, cols]);

  const chartData = useMemo(() => {
    if (dateCols.length > 0 && numCols.length > 0) {
      return { type: "timeseries", data: buildTimeSeriesData(headers, rows, dateCols, numCols) };
    }
    if (catCols.length > 0 && numCols.length > 0) {
      return { type: "categorical", data: buildCategoryData(headers, rows, catCols, numCols) };
    }
    return null;
  }, [headers, rows, dateCols, numCols, catCols]);

  const visibleNumCols = numCols.slice(0, 5);
  const primaryCol = numCols[0];

  const TABS = ["overview", "data"];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 28px", display: "flex", alignItems: "center", height: 58, gap: 20, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: C.forest, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>L</span>
          </div>
          <span style={{ fontWeight: 800, color: C.text, fontSize: 15, fontFamily: "Manrope, sans-serif" }}>Lumina</span>
        </div>

        {/* Project switcher */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 14px", fontSize: 13, fontWeight: 600, color: C.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            {projectName || "My Dataset"} <span style={{ fontSize: 10 }}>▾</span>
          </button>
          {showProjectMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, minWidth: 200, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
              {projects?.map((p) => (
                <button key={p.id} onClick={() => { onSwitchProject(p); setShowProjectMenu(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", fontSize: 13, color: C.text, cursor: "pointer", borderRadius: 6 }}>
                  {p.name}
                </button>
              ))}
              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6 }}>
                <button onClick={() => { onNewProject(); setShowProjectMenu(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", fontSize: 13, color: C.forest, cursor: "pointer", fontWeight: 600, borderRadius: 6 }}>
                  + New Dataset
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={onEditProject}
            style={{ background: "none", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
            Edit Data
          </button>
          <span style={{ color: C.muted, fontSize: 12 }}>{userEmail}</span>
          <button onClick={onSignOut}
            style={{ background: "none", color: C.muted, border: "none", fontSize: 12, cursor: "pointer" }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 28px", display: "flex", gap: 4 }}>
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              background: "none", border: "none", padding: "12px 16px", fontSize: 13, fontWeight: 600,
              color: activeTab === tab ? C.forest : C.muted,
              borderBottom: activeTab === tab ? `2px solid ${C.forest}` : "2px solid transparent",
              cursor: "pointer", textTransform: "capitalize",
            }}>
            {tab === "overview" ? "Overview" : "Data Table"}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>

        {activeTab === "overview" && (
          <>
            {/* Insights banner */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 24 }}>
              <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Auto Insights — {projectName}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
                {insights.map((ins, i) => (
                  <span key={i} style={{ color: i === 0 ? C.muted : C.text, fontSize: 13, lineHeight: 1.5 }}>
                    {i > 0 && <span style={{ color: C.forest, marginRight: 6 }}>→</span>}
                    {ins}
                  </span>
                ))}
              </div>
            </div>

            {/* KPI cards */}
            {numCols.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(numCols.length, 4)}, 1fr)`, gap: 12, marginBottom: 24 }}>
                {numCols.slice(0, 4).map((col) => {
                  const info = cols[col];
                  const firstVal = toNum(rows[0]?.[col]);
                  const lastVal = toNum(rows[rows.length - 1]?.[col]);
                  let sub = `Avg: ${fmt(info.avg)}`;
                  if (dateCols.length > 0 && firstVal && lastVal && firstVal !== 0) {
                    const pct = ((lastVal - firstVal) / Math.abs(firstVal)) * 100;
                    sub = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% over period`;
                  }
                  return <KPICard key={col} label={col} value={fmt(info.sum)} sub={sub} />;
                })}
              </div>
            )}

            {/* Primary chart */}
            {chartData && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
                <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 20px" }}>
                  {chartData.type === "timeseries" ? `Trend Over Time (${dateCols[0]})` : `Breakdown by ${catCols[0]}`}
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  {chartData.type === "timeseries" ? (
                    <LineChart data={chartData.data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="x" tick={{ fill: C.muted, fontSize: 11 }} />
                      <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 11 }} width={65} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => fmt(v, false)} />
                      <Legend />
                      {visibleNumCols.map((col, i) => (
                        <Line key={col} type="monotone" dataKey={col} stroke={PALETTE[i % PALETTE.length]}
                          strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      ))}
                    </LineChart>
                  ) : (
                    <BarChart data={chartData.data} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="x" tick={{ fill: C.muted, fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 11 }} width={65} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => fmt(v, false)} />
                      <Legend />
                      {visibleNumCols.map((col, i) => (
                        <Bar key={col} dataKey={col} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* Second chart: bar of totals by numeric column */}
            {numCols.length > 1 && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
                <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 20px" }}>
                  Column Totals
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={numCols.map((col, i) => ({ name: col, total: cols[col].sum, fill: PALETTE[i % PALETTE.length] }))}
                    margin={{ top: 5, right: 20, left: 10, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 11 }} width={65} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => fmt(v, false)} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {numCols.map((_, i) => (
                        <rect key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Empty state */}
            {numCols.length === 0 && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
                <p style={{ color: C.muted, fontSize: 14 }}>No numeric columns detected. Check the Data Table tab to review your data.</p>
              </div>
            )}
          </>
        )}

        {activeTab === "data" && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
              <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                {rows.length} Rows · {headers.length} Columns
              </p>
            </div>
            <div style={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ position: "sticky", top: 0, background: C.panel2 }}>
                  <tr>
                    {headers.map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                        {h}
                        <span style={{ display: "block", fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 9, color: cols[h]?.type === "numeric" ? C.forest : C.muted, marginTop: 1 }}>
                          {cols[h]?.type}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? C.panel : C.bg }}>
                      {headers.map((h) => (
                        <td key={h} style={{ padding: "7px 14px", color: C.text, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", textAlign: cols[h]?.type === "numeric" ? "right" : "left" }}>
                          {String(row[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 200 && (
                <p style={{ padding: "12px 20px", color: C.muted, fontSize: 12 }}>Showing first 200 of {rows.length} rows.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
