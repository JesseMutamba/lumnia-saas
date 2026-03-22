/**
 * FinancialHealthScore
 * Circular gauge showing a 0–100 composite score derived from margin,
 * revenue/cost growth, and anomaly count. Weights are pulled from
 * sectorConfig.js for the active sector.
 *
 * Gauge is drawn with SVG arcs (more reliable than RadialBarChart for
 * a fixed-domain 0-100 gauge with a background track).
 */

import { SECTOR_CONFIG } from "../sectorConfig";

// ── Design tokens (matches DynamicDashboard / PVAK palette) ───────────────────
const C = {
  panel: "#FEFCF8", panel2: "#EDE8DC", border: "#D5CEBC",
  text: "#1A1916", muted: "#8A8375",
};

const SCORE_RED   = "#C0392B";
const SCORE_AMBER = "#E07B39";
const SCORE_GREEN = "#2C5F1A";

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

function scoreColor(s) {
  if (s <= 40) return SCORE_RED;
  if (s <= 69) return SCORE_AMBER;
  return SCORE_GREEN;
}

function scoreLabel(s) {
  if (s <= 40) return "Needs Attention";
  if (s <= 69) return "Developing";
  return "Healthy";
}

// SVG arc helper — angles in degrees, 0 = top, clockwise
function describeArc(cx, cy, r, startDeg, endDeg) {
  const toRad = (d) => ((d - 90) * Math.PI) / 180;
  const sx = cx + r * Math.cos(toRad(startDeg));
  const sy = cy + r * Math.sin(toRad(startDeg));
  const ex = cx + r * Math.cos(toRad(endDeg));
  const ey = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx.toFixed(3)} ${sy.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(3)} ${ey.toFixed(3)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinancialHealthScore({
  margin, costGrowth, revenueGrowth, anomalyCount, sector,
}) {
  const weights = SECTOR_CONFIG[sector]?.healthScoreWeights || {
    margin: 0.40, growth: 0.30, costControl: 0.30,
  };

  // ── Score calculation (spec) ─────────────────────────────────────────────────
  const marginScore   = clamp((margin / 40) * 100, 0, 100);
  const growthScore   = clamp(
    revenueGrowth > costGrowth
      ? 100
      : costGrowth === 0
        ? 100
        : (revenueGrowth / costGrowth) * 100,
    0, 100,
  );
  const anomalyPenalty = Math.min(anomalyCount * 5, 30);
  const score = Math.round(
    clamp(marginScore * weights.margin + growthScore * weights.growth - anomalyPenalty, 0, 100),
  );

  const color = scoreColor(score);
  const label = scoreLabel(score);

  // ── SVG gauge geometry ───────────────────────────────────────────────────────
  const CX = 80, CY = 78, R = 54, SW = 14;
  const GAP_DEG  = 65;                    // gap at the bottom
  const ARC_DEG  = 360 - GAP_DEG;        // 295° total arc
  const START    = 90 + GAP_DEG / 2;     // ~122.5° — lower-left
  const TRACK_END = START + ARC_DEG;
  const fillDeg   = score > 0 ? START + (score / 100) * ARC_DEG : START;

  // ── Bullet points ────────────────────────────────────────────────────────────
  const bullets = [];

  if (margin >= 20) {
    bullets.push({ icon: "↑", c: SCORE_GREEN, text: `Strong margin of ${margin.toFixed(1)}% is lifting your score` });
  } else if (margin > 0) {
    bullets.push({ icon: "↓", c: SCORE_RED, text: `Thin margin of ${margin.toFixed(1)}% is limiting your score` });
  } else {
    bullets.push({ icon: "—", c: C.muted, text: "No margin data detected — add a margin or profit column" });
  }

  if (revenueGrowth > 0 && revenueGrowth > costGrowth) {
    bullets.push({ icon: "↑", c: SCORE_GREEN, text: `Revenue growing faster than costs — healthy trajectory` });
  } else if (costGrowth > 0 && costGrowth > revenueGrowth) {
    bullets.push({ icon: "↓", c: SCORE_RED, text: `Costs (${costGrowth.toFixed(1)}%) outpacing revenue (${revenueGrowth.toFixed(1)}%) — watch this gap` });
  } else {
    bullets.push({ icon: "—", c: C.muted, text: "Insufficient time-series data to assess growth trend" });
  }

  if (anomalyCount > 0) {
    bullets.push({ icon: "↓", c: SCORE_AMBER, text: `${anomalyCount} data ${anomalyCount === 1 ? "anomaly" : "anomalies"} detected — investigate outliers` });
  } else {
    bullets.push({ icon: "↑", c: SCORE_GREEN, text: "No anomalies detected — data quality looks clean" });
  }

  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: "18px 20px", minWidth: 210, flexShrink: 0,
      display: "flex", flexDirection: "column",
    }}>
      {/* Title */}
      <p style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", margin: "0 0 4px" }}>
        Financial Health
      </p>
      <p style={{ color: C.muted, fontSize: 10, margin: "0 0 14px", lineHeight: 1.4 }}>
        Composite performance score
      </p>

      {/* SVG gauge */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", width: 160, height: 135 }}>
          <svg width={160} height={135} viewBox="0 0 160 135" overflow="visible">
            {/* Background track */}
            <path
              d={describeArc(CX, CY, R, START, TRACK_END)}
              fill="none"
              stroke={C.panel2}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            {/* Score fill */}
            {score > 0 && (
              <path
                d={describeArc(CX, CY, R, START, fillDeg)}
                fill="none"
                stroke={color}
                strokeWidth={SW}
                strokeLinecap="round"
              />
            )}
            {/* Score tick dot */}
            {score > 0 && score < 100 && (() => {
              const toRad = (d) => ((d - 90) * Math.PI) / 180;
              const tx = CX + R * Math.cos(toRad(fillDeg));
              const ty = CY + R * Math.sin(toRad(fillDeg));
              return <circle cx={tx} cy={ty} r={5} fill={color} />;
            })()}
          </svg>

          {/* Centre text */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            paddingTop: 10,
          }}>
            <span style={{ color, fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {score}
            </span>
            <span style={{ color, fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginTop: 3 }}>
              {label}
            </span>
          </div>
        </div>
      </div>

      {/* Score breakdown mini-bar */}
      <div style={{ display: "flex", gap: 3, marginBottom: 14, height: 5, borderRadius: 3, overflow: "hidden" }}>
        {[...Array(20)].map((_, i) => {
          const threshold = ((i + 1) / 20) * 100;
          const filled = score >= threshold;
          const barColor = threshold <= 40 ? SCORE_RED : threshold <= 69 ? SCORE_AMBER : SCORE_GREEN;
          return <div key={i} style={{ flex: 1, background: filled ? barColor : C.panel2, borderRadius: 2 }} />;
        })}
      </div>

      {/* Bullet points */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, flex: 1 }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: i < bullets.length - 1 ? 8 : 0 }}>
            <span style={{ color: b.c, fontSize: 12, fontWeight: 700, flexShrink: 0, lineHeight: 1.45 }}>{b.icon}</span>
            <span style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>{b.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
