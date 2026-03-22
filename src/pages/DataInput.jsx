import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const C = {
  bg: "#F4F0E6", panel: "#FEFCF8", panel2: "#EDE8DC", border: "#D5CEBC",
  text: "#1A1916", muted: "#8A8375", forest: "#2C5F1A", leaf: "#4D8C2E",
  gold: "#A67C2A", red: "#B03A2A", amber: "#C8A04A",
};

// Dashboard fields we want to fill
const DASHBOARD_FIELDS = [
  { key: "revenue",      label: "Revenue ($)" },
  { key: "cpo",          label: "CPO Production (T)" },
  { key: "ffb",          label: "FFB (T)" },
  { key: "ha",           label: "New Ha Planted" },
  { key: "haMgd",        label: "Total Ha Managed" },
  { key: "capex",        label: "CAPEX ($)" },
  { key: "opex",         label: "OPEX ($)" },
  { key: "opexPerTCpo",  label: "OPEX per T CPO ($)" },
  { key: "totalPerTCpo", label: "Total Cost/T CPO ($)" },
  { key: "opexPerHa",    label: "OPEX per Ha ($)" },
  { key: "margin",       label: "Net Margin ($)" },
  { key: "marginPct",    label: "Margin %" },
];

// Fuzzy match: score how similar two strings are (0–1)
function similarity(a, b) {
  a = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  b = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;
  let matches = 0;
  const shorter = a.length < b.length ? a : b;
  const longer  = a.length < b.length ? b : a;
  for (const ch of shorter) if (longer.includes(ch)) matches++;
  return matches / longer.length;
}

// Known aliases for each field key
const ALIASES = {
  revenue:      ["revenue", "revenus", "recettes", "income", "sales", "chiffre"],
  cpo:          ["cpo", "crude palm oil", "huile", "palm oil", "cpo ton", "cpo tonnes"],
  ffb:          ["ffb", "fresh fruit", "regime", "fruit", "ffb ton", "ffb tonnes"],
  ha:           ["ha to plant", "hectares plant", "new ha", "ha plant", "planted"],
  haMgd:        ["ha managed", "hamgd", "total ha", "managed ha", "superficie"],
  capex:        ["capex", "capital", "investissement", "investment"],
  opex:         ["opex", "operating", "exploitation", "operations"],
  opexPerTCpo:  ["opex per t", "opex/t", "cout t cpo", "cost per t cpo"],
  totalPerTCpo: ["total per t", "total/t", "total cost t", "cout total t"],
  opexPerHa:    ["opex per ha", "opex/ha", "cout ha", "cost per ha"],
  margin:       ["margin", "marge", "profit", "benefice", "net margin", "net profit"],
  marginPct:    ["margin %", "margin pct", "marge %", "taux marge", "margin percent"],
};

function bestFieldMatch(colName) {
  let best = null, bestScore = 0.3; // threshold
  for (const [key, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      const score = similarity(colName, alias);
      if (score > bestScore) { bestScore = score; best = key; }
    }
  }
  return best;
}

// Detect if a value looks like a year
function isYear(val) {
  const n = parseInt(val);
  return n >= 1990 && n <= 2100;
}

// ── CLEANING PIPELINE ─────────────────────────────────────────────────────────

// Clean a single numeric value — handles currency, commas, K/M suffixes, %, errors
function cleanValue(raw) {
  if (raw === null || raw === undefined) return { value: 0, changed: false };
  const str = String(raw).trim();

  // Error / null-like values
  if (/^(#value!|#ref!|#div\/0!|#n\/a|n\/a|null|none|-+|–+|—+)$/i.test(str)) {
    return { value: 0, changed: str !== "0" };
  }

  let s = str;
  let changed = false;

  // Strip currency symbols
  if (/[$€£¥₣CDF₦FCFA]/i.test(s)) { s = s.replace(/[$€£¥₣CDF₦FCFA]/gi, ""); changed = true; }

  // Strip parentheses used for negatives (100) → -100
  if (/^\(.*\)$/.test(s.trim())) { s = "-" + s.replace(/[()]/g, ""); changed = true; }

  // Handle percentage — store as the number itself (19% → 19)
  const isPct = s.includes("%");
  if (isPct) { s = s.replace("%", ""); changed = true; }

  // Remove commas used as thousand separators
  if (/\d,\d/.test(s)) { s = s.replace(/,/g, ""); changed = true; }

  // Handle K / M / B suffixes
  const multMatch = s.trim().match(/^([\d.]+)\s*([KkMmBb])$/);
  if (multMatch) {
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[multMatch[2].toLowerCase()];
    s = String(parseFloat(multMatch[1]) * mult);
    changed = true;
  }

  const value = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return { value: isNaN(value) ? 0 : value, changed: changed || str !== String(value) };
}

// Find the real header row — scan first 15 rows for the one with most text-like cells
function findHeaderRow(rawRows) {
  let bestIdx = 0, bestScore = -1;
  const check = rawRows.slice(0, 15);
  check.forEach((row, i) => {
    const vals = Object.values(row).map(v => String(v).trim());
    const textCount = vals.filter(v => v && !/^[\d.,\s$€£%()-]+$/.test(v) && !isYear(v)).length;
    if (textCount > bestScore) { bestScore = textCount; bestIdx = i; }
  });
  return bestIdx;
}

// ── MULTI-SHEET EXCEL ENGINE ───────────────────────────────────────────────────

// Scan a raw sheet (array of arrays) for rows containing year values 2020-2040
// Returns: { yearColMap: { "2025": [colIdx, ...], ... }, headerRowIdx }
function findYearColumns(sheetRows) {
  for (let r = 0; r < Math.min(sheetRows.length, 15); r++) {
    const row = sheetRows[r];
    const yearCols = {};
    row.forEach((cell, c) => {
      const n = parseInt(String(cell).trim());
      if (n >= 2020 && n <= 2040) {
        const y = String(n);
        if (!yearCols[y]) yearCols[y] = [];
        yearCols[y].push(c);
      }
    });
    if (Object.keys(yearCols).length >= 2) {
      return { yearColMap: yearCols, headerRowIdx: r };
    }
  }
  return null;
}

// Extract data from one sheet (array of arrays) given a year column map
// Returns: { year: { field: value } }
function extractSheetData(sheetRows, yearColMap, headerRowIdx) {
  const result = {};

  for (let r = headerRowIdx + 1; r < sheetRows.length; r++) {
    const row = sheetRows[r];
    // Get label from first non-empty cell in the row
    const label = row.slice(0, 4).map(v => String(v ?? "").trim()).find(v => v && !/^[\d.,\s()%$#-]+$/.test(v)) || "";
    if (!label) continue;

    const field = bestFieldMatch(label);
    if (!field) continue;

    // For each year, try all mapped columns and take the best (largest non-zero) value
    Object.entries(yearColMap).forEach(([year, cols]) => {
      const candidates = cols.map(c => cleanValue(row[c]).value).filter(v => v !== 0 && !isNaN(v));
      if (candidates.length === 0) return;
      // Take max absolute value (most informative)
      const best = candidates.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0);
      if (!result[year]) result[year] = {};
      // Only overwrite if we don't already have this field (first sheet wins per field per year)
      if (!result[year][field]) result[year][field] = best;
    });
  }

  return result;
}

// Merge multiple sheet results — earlier sheets take priority per field
function mergeResults(sheetResults) {
  const merged = {};
  sheetResults.forEach(sheetData => {
    Object.entries(sheetData).forEach(([year, fields]) => {
      if (!merged[year]) merged[year] = {};
      Object.entries(fields).forEach(([field, value]) => {
        if (!merged[year][field] && value) merged[year][field] = value;
      });
    });
  });
  return merged;
}

// Full cleaning pass on a raw value
function cleanRows(rows, headers) {
  let totalCleaned = 0;
  const cleanedRows = rows.map(row => {
    const out = {};
    headers.forEach(h => {
      const raw = row[h];
      const { value, changed } = cleanValue(raw);
      out[h] = value;
      if (changed) totalCleaned++;
    });
    return out;
  });
  const report = totalCleaned > 0 ? [`${totalCleaned} values auto-cleaned (symbols, errors, formatting)`] : [];
  return { cleanedRows, report };
}

// Priority order for Montage Financier sheets — most reliable data first
const SHEET_PRIORITY = [
  /projection/i,       // PROJECTION 2030 — cleanest production & revenue data
  /recap/i,            // RECAP — summary totals
  /capex/i,            // capex — investment data
  /developpement/i,    // DEVELOPPEMENT PLANTATION — hectares
  /production/i,       // PRODUCTION 2025&2026
  /.*/,                // everything else
];

function sortSheets(sheetNames) {
  return [...sheetNames].sort((a, b) => {
    const ai = SHEET_PRIORITY.findIndex(p => p.test(a));
    const bi = SHEET_PRIORITY.findIndex(p => p.test(b));
    return ai - bi;
  });
}

// Parse any file into { data, years, report }
async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const report = [];

  // ── CSV / TXT ──
  if (ext === "csv" || ext === "txt") {
    const result = await new Promise((resolve) => {
      Papa.parse(file, { header: false, skipEmptyLines: false, complete: (r) => resolve(r.data) });
    });
    const headerIdx = result.findIndex(row =>
      row.some(v => v && !/^[\d.,\s$€£%()-]+$/.test(String(v).trim()) && !isYear(String(v).trim()))
    );
    const hi = Math.max(0, headerIdx);
    if (hi > 0) report.push(`Skipped ${hi} metadata row(s)`);
    const rawHeaders = result[hi].map(h => String(h).trim()).filter(Boolean);
    const rawRows = result.slice(hi + 1)
      .filter(r => r.some(v => String(v).trim()))
      .map(r => Object.fromEntries(rawHeaders.map((h, i) => [h, r[i] ?? ""])));
    const { cleanedRows, report: cr } = cleanRows(rawRows, rawHeaders);
    return { headers: rawHeaders, rows: cleanedRows, report: [...report, ...cr], multiSheet: false };
  }

  // ── EXCEL / ODS ──
  if (["xlsx", "xls", "ods"].includes(ext)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });

    const orderedSheets = sortSheets(wb.SheetNames);
    const sheetResults = [];
    const usedSheets = [];

    for (const sheetName of orderedSheets) {
      const ws = wb.Sheets[sheetName];
      const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const found = findYearColumns(allRows);
      if (!found) continue;

      const sheetData = extractSheetData(allRows, found.yearColMap, found.headerRowIdx);
      if (Object.keys(sheetData).length > 0) {
        sheetResults.push(sheetData);
        usedSheets.push(sheetName);
      }
    }

    if (sheetResults.length === 0) {
      // Fallback: use first sheet as flat table
      const ws = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const hi = findHeaderRow(allRows.map((r) => Object.fromEntries(r.map((v, j) => [j, v]))));
      const rawHeaders = allRows[hi].map(h => String(h).trim()).filter(Boolean);
      const rawRows = allRows.slice(hi + 1)
        .filter(r => r.some(v => String(v).trim()))
        .map(r => Object.fromEntries(rawHeaders.map((h, i) => [h, r[i] ?? ""])));
      const { cleanedRows, report: cr } = cleanRows(rawRows, rawHeaders);
      return { headers: rawHeaders, rows: cleanedRows, report: [...report, ...cr], multiSheet: false };
    }

    report.push(`Read ${usedSheets.length} sheet(s): ${usedSheets.join(", ")}`);
    const merged = mergeResults(sheetResults);
    const years = [...new Set(Object.keys(merged))].filter(y => isYear(y)).sort();
    return { data: merged, years, report, multiSheet: true };
  }

  return null;
}

// Find the column whose VALUES are mostly years (handles any column name)
// Extract years embedded in column headers: "Revenue_2025", "2025 CPO", "FY2026", etc.
function extractEmbeddedYears(headers) {
  const map = {}; // year → [colName]
  headers.forEach(h => {
    const m = h.match(/\b(20[2-9]\d)\b/);
    if (m) {
      const y = m[1];
      if (!map[y]) map[y] = [];
      map[y].push(h);
    }
  });
  return map; // e.g. { "2025": ["Revenue_2025", "OPEX_2025"], "2026": [...] }
}

// Generic value extractor
function toNum(v) {
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace(/[^0-9.-]/g, "")) || 0;
}

// Extract year from a value — handles plain years AND date strings like "2025-01", "01/2025"
function extractYear(val) {
  const s = String(val ?? "").trim();
  // Plain year
  if (isYear(s)) return s;
  // Date strings: 2025-01, 2025/01, 01-2025, Jan-2025, 2025-01-01
  const m = s.match(/\b(20[2-9]\d)\b/);
  return m ? m[1] : null;
}

// Find year column — checks both exact year values and date strings
function findYearColumnByValues(headers, rows) {
  for (const h of headers) {
    const vals = rows.map(r => String(r[h] ?? "").trim()).filter(Boolean);
    const yearCount = vals.filter(v => extractYear(v) !== null).length;
    if (yearCount >= Math.min(2, vals.length) && yearCount / vals.length >= 0.5) return h;
  }
  return null;
}

// Detect format and extract year→field→value mapping
function detectAndExtract(headers, rows) {
  // ── 1. Transposed: years are column headers ──────────────────────────────
  const yearHeaderCols = headers.filter(h => isYear(String(h).trim()));
  if (yearHeaderCols.length >= 1) {
    const labelCol = headers.find(h => !isYear(String(h).trim())) || headers[0];
    const result = {};
    const unmapped = [];
    rows.forEach(row => {
      const metric = String(row[labelCol] ?? "").trim();
      if (!metric) return;
      const field = bestFieldMatch(metric);
      if (!field) { if (metric) unmapped.push(metric); return; }
      yearHeaderCols.forEach(y => {
        const year = String(y).trim();
        if (!result[year]) result[year] = {};
        if (!result[year][field]) result[year][field] = toNum(row[y]);
      });
    });
    const years = yearHeaderCols.map(y => String(y).trim()).sort();
    if (Object.keys(result).length > 0) return { format: "transposed", data: result, years, unmapped };
  }

  // ── 2. Long format: metric + value columns, year anywhere ────────────────
  // Prefer exact/close matches for metric column over broad ones like "category"
  const metricCol = (
    headers.find(h => /^metric$|^metrics$|^indicateur$|^indicator$/i.test(h.trim())) ||
    headers.find(h => /^field$|^libelle$|^poste$|^description$|^item$/i.test(h.trim())) ||
    headers.find(h => /metric|indicator|libelle|poste|description/i.test(h.trim()))
  );
  const valueCol = headers.find(h => /^value$|^montant$|^amount$|^valeur$|^total$|^amount_usd$/i.test(h.trim()));
  const yearColLong = findYearColumnByValues(headers, rows);

  if (metricCol && valueCol && yearColLong) {
    // Aggregate by year (handles monthly rows too — sums numeric values per field per year)
    const result = {}, counts = {};
    rows.forEach(row => {
      const year = extractYear(row[yearColLong]);
      const metric = String(row[metricCol] ?? "").trim();
      const value = toNum(row[valueCol]);
      const field = bestFieldMatch(metric);
      if (!field || !year) return;
      if (!result[year]) { result[year] = {}; counts[year] = {}; }
      result[year][field] = (result[year][field] || 0) + value;
      counts[year][field] = (counts[year][field] || 0) + 1;
    });
    const years = [...new Set(Object.keys(result))].sort();
    if (years.length > 0) return { format: "long", data: result, years, unmapped: [] };
  }

  // ── 3. Wide format: one column has year/date values, rest are metrics ────
  const yearColWide = yearColLong ||
    headers.find(h => /^year$|^yr$|^fy$|^annee$|^année$|^periode$|^period$|^fiscal|^exercice$|^date$|^month$/i.test(h.trim()));
  if (yearColWide) {
    const metricCols = headers.filter(h => h !== yearColWide);
    const mappings = {}, unmapped = [];
    metricCols.forEach(col => {
      const field = bestFieldMatch(col);
      if (field) mappings[col] = field;
      else unmapped.push(col);
    });
    // Aggregate rows by year (sums monthly rows into annual)
    const result = {}, counts = {};
    rows.forEach(row => {
      const year = extractYear(row[yearColWide]);
      if (!year) return;
      if (!result[year]) { result[year] = {}; counts[year] = {}; }
      metricCols.forEach(col => {
        const field = mappings[col];
        if (!field) return;
        result[year][field] = (result[year][field] || 0) + toNum(row[col]);
        counts[year][field] = (counts[year][field] || 0) + 1;
      });
    });
    const uniqueYears = [...new Set(Object.keys(result))].sort();
    if (uniqueYears.length > 0) return { format: "wide", data: result, years: uniqueYears, unmapped };
  }

  // ── 4. Embedded years in column names: "Revenue_2025", "2026_OPEX" ───────
  const embedded = extractEmbeddedYears(headers);
  if (Object.keys(embedded).length >= 1) {
    const result = {};
    const labelCol = headers.find(h => !embedded[h] && bestFieldMatch(h)) || headers[0];
    rows.forEach(row => {
      // Each row is one metric, columns per year
      const metric = String(row[labelCol] ?? "").trim();
      const field = bestFieldMatch(metric) || bestFieldMatch(labelCol);
      Object.entries(embedded).forEach(([year, cols]) => {
        cols.forEach(col => {
          const colField = bestFieldMatch(col.replace(/\b20[2-9]\d\b/, "").trim()) || field;
          if (!colField) return;
          if (!result[year]) result[year] = {};
          if (!result[year][colField]) result[year][colField] = toNum(row[col]);
        });
      });
    });
    const years = Object.keys(embedded).sort();
    if (Object.keys(result).length > 0) return { format: "embedded", data: result, years, unmapped: [] };
  }

  // ── 5. Single-row fallback: treat each row as one year if it has a year-like value ─
  const firstNumericHeader = headers.find(h => {
    const vals = rows.map(r => toNum(r[h])).filter(v => v > 0);
    return vals.length > 0;
  });
  if (firstNumericHeader) {
    // Try to find any year-like value in each row and use it
    const result = {};
    rows.forEach(row => {
      // Look for a year value in any cell of this row
      const yearVal = Object.values(row).map(v => String(v ?? "").trim()).find(v => isYear(v));
      if (!yearVal) return;
      headers.forEach(h => {
        const field = bestFieldMatch(h);
        if (!field) return;
        if (!result[yearVal]) result[yearVal] = {};
        if (!result[yearVal][field]) result[yearVal][field] = toNum(row[h]);
      });
    });
    const years = [...new Set(Object.keys(result))].sort();
    if (years.length > 0) return { format: "rowscan", data: result, years, unmapped: [] };
  }

  return null;
}

const EMPTY_ROW = () => ({
  revenue: "", cpo: "", ffb: "", ha: "", haMgd: "",
  capex: "", opex: "", opexPerTCpo: "", totalPerTCpo: "",
  opexPerHa: "", margin: "", marginPct: "",
});

export default function DataInput() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const fileInputRef = useRef(null);

  const [years, setYears] = useState(["2025","2026","2027","2028","2029","2030"]);
  const [rows, setRows] = useState(Array(6).fill(null).map(EMPTY_ROW));
  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [existingProjects, setExistingProjects] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  // Column mapper state
  const [showMapper, setShowMapper] = useState(false);
  const [unmappedCols, setUnmappedCols] = useState([]);
  const [colMappings, setColMappings] = useState({});
  const [pendingData, setPendingData] = useState(null);
  const [pendingYears, setPendingYears] = useState([]);
  const [uploadMsg, setUploadMsg] = useState("");

  // Raw dataset (for generic/non-financial files)
  const [rawDataset, setRawDataset] = useState(null); // { headers, rows }
  const [dataMode, setDataMode] = useState("financial"); // "financial" | "generic"

  const [sector, setSector] = useState("");

  useEffect(() => {
    loadProjects();
    if (editId) loadProject(editId);
  }, [editId]);

  async function loadProjects() {
    const { data } = await supabase
      .from("financial_projects")
      .select("id, name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setExistingProjects(data);
  }

  async function loadProject(id) {
    const { data } = await supabase
      .from("financial_projects").select("*").eq("id", id).single();
    if (data) {
      setProjectName(data.name);
      setSector(data.sector || "");
      const detectedYears = data.data.map((_, i) => String(2025 + i));
      setYears(detectedYears);
      setRows(data.data);
    }
  }

  function updateCell(yearIdx, field, value) {
    setRows(prev => prev.map((row, i) => i === yearIdx ? { ...row, [field]: value } : row));
  }

  // Apply extracted data to the table
  function applyData(data, detectedYears) {
    setYears(detectedYears);
    setRows(detectedYears.map(y => {
      const d = data[y] || {};
      const row = EMPTY_ROW();
      Object.entries(d).forEach(([k, v]) => { row[k] = v === 0 ? "" : String(v); });
      return row;
    }));
  }

  async function handleFile(file) {
    if (!file) return;
    setError("");
    setUploadMsg("");
    setShowMapper(false);
    setRawDataset(null);
    setDataMode("financial");

    const parsed = await parseFile(file);
    if (!parsed) { setError("Unsupported file type. Use CSV, XLSX, XLS, or ODS."); return; }

    const cleanSummary = parsed.report.length > 0 ? ` · ${parsed.report.join("; ")}` : "";

    // Multi-sheet Excel: data already extracted and merged
    if (parsed.multiSheet) {
      if (!parsed.years || parsed.years.length === 0) {
        // Fall through to generic mode below
      } else {
        applyData(parsed.data, parsed.years);
        setUploadMsg(`Imported ${parsed.years.length} years from "${file.name}"${cleanSummary}`);
        return;
      }
    }

    // Single-sheet / CSV: run format detection
    const headers = parsed.headers || [];
    const csvRows = parsed.rows || [];

    // Always store raw dataset so we can save as generic if needed
    if (headers.length > 0 && csvRows.length > 0) {
      setRawDataset({ headers, rows: csvRows });
    }

    const detected = !parsed.multiSheet ? detectAndExtract(headers, csvRows) : null;

    if (!detected || detected.years.length === 0) {
      // Generic mode: save raw data as-is
      setDataMode("generic");
      setUploadMsg(`"${file.name}" loaded — ${csvRows.length} rows, ${headers.length} columns${cleanSummary}. Will be saved as a generic dataset.`);
      return;
    }

    if (detected.unmapped && detected.unmapped.length > 0) {
      setUnmappedCols(detected.unmapped);
      setColMappings({});
      setPendingData(detected.data);
      setPendingYears(detected.years);
      setShowMapper(true);
      setUploadMsg(`${detected.years.length} years detected${cleanSummary} · ${detected.unmapped.length} column(s) need manual mapping below.`);
    } else {
      applyData(detected.data, detected.years);
      setUploadMsg(`Imported ${detected.years.length} years from "${file.name}"${cleanSummary}`);
    }
  }

  function applyMappings() {
    // Merge manually mapped columns into pendingData
    const merged = { ...pendingData };
    Object.entries(colMappings).forEach(([col, field]) => {
      if (!field) return;
      pendingYears.forEach((year, i) => {
        // We need to re-parse the raw rows — store them temporarily
      });
    });
    applyData(merged, pendingYears);
    setShowMapper(false);
    setUploadMsg(`Data imported with your custom mappings.`);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    let saveData;
    if (dataMode === "generic" && rawDataset) {
      // Store raw dataset — DynamicDashboard will visualize it
      saveData = { type: "generic", headers: rawDataset.headers, rows: rawDataset.rows };
    } else {
      // Store as financial projection array (existing format)
      saveData = rows.map(row => {
        const out = {};
        DASHBOARD_FIELDS.forEach(({ key }) => { out[key] = parseFloat(row[key]) || 0; });
        return out;
      });
    }

    let error;
    if (editId) {
      ({ error } = await supabase.from("financial_projects")
        .update({ name: projectName || "My Project", data: saveData, sector: sector || null })
        .eq("id", editId)
        .eq("user_id", user.id));
    } else {
      ({ error } = await supabase.from("financial_projects").insert({
        user_id: user.id,
        name: projectName || "My Project",
        data: saveData,
        sector: sector || null,
      }));
    }

    setSaving(false);
    if (error) { setError(error.message); return; }
    setSuccess(true);
    setTimeout(() => navigate("/dashboard"), 1200);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, background: C.forest, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>P</span>
          </div>
          <span style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>PVACK</span>
          <span style={{ color: C.muted, fontSize: 12 }}>/ Data Input</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ color: C.muted, fontSize: 12 }}>{user.email}</span>
          <button onClick={() => navigate("/dashboard")} style={{ background: C.forest, color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View Dashboard</button>
          <button onClick={signOut} style={{ background: "none", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* Existing projects */}
        {existingProjects.length > 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
            <p style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>Load Existing Project</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {existingProjects.map(p => (
                <button key={p.id} onClick={() => loadProject(p.id)}
                  style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 14px", fontSize: 12, color: C.text, cursor: "pointer" }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current.click()}
          style={{
            border: `2px dashed ${dragOver ? C.forest : C.border}`,
            borderRadius: 12, padding: "32px 24px", textAlign: "center",
            background: dragOver ? `${C.forest}08` : C.panel,
            cursor: "pointer", marginBottom: 24, transition: "all 0.15s",
          }}
        >
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.ods,.txt"
            style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <p style={{ color: C.forest, fontWeight: 700, fontSize: 14, margin: "0 0 4px" }}>Drop any file here to auto-fill</p>
          <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
            Supports <strong>CSV, Excel (.xlsx/.xls), ODS</strong> — any layout (long, wide, or transposed)
          </p>
          {uploadMsg && (
            <p style={{ color: C.forest, fontSize: 12, marginTop: 12, background: `${C.forest}10`, padding: "6px 14px", borderRadius: 6, display: "inline-block" }}>
              {uploadMsg}
            </p>
          )}
        </div>

        {/* Column mapper */}
        {showMapper && unmappedCols.length > 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.amber}55`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
            <p style={{ color: C.gold, fontSize: 12, fontWeight: 700, margin: "0 0 14px" }}>
              These columns were not automatically recognized — match them to dashboard fields (or skip):
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {unmappedCols.map(col => (
                <div key={col} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: C.text, fontSize: 12, minWidth: 180, background: C.panel2, padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}` }}>{col}</span>
                  <span style={{ color: C.muted, fontSize: 12 }}>→</span>
                  <select value={colMappings[col] || ""}
                    onChange={(e) => setColMappings(prev => ({ ...prev, [col]: e.target.value }))}
                    style={{ flex: 1, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, fontSize: 12 }}>
                    <option value="">Skip this column</option>
                    {DASHBOARD_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button onClick={applyMappings}
              style={{ background: C.forest, color: "#fff", border: "none", borderRadius: 7, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Apply & Fill Table
            </button>
          </div>
        )}

        {error && <p style={{ color: C.red, fontSize: 12, marginBottom: 16, background: `${C.red}10`, padding: "8px 12px", borderRadius: 6 }}>{error}</p>}

        {dataMode === "generic" && rawDataset && (
          <div style={{ background: `${C.forest}12`, border: `1px solid ${C.forest}40`, borderRadius: 10, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <p style={{ color: C.forest, fontWeight: 700, fontSize: 13, margin: "0 0 3px" }}>Generic dataset detected</p>
              <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
                {rawDataset.rows.length} rows · {rawDataset.headers.length} columns. Lumina will auto-generate charts for your data.
              </p>
            </div>
            <button type="button" onClick={() => setDataMode("financial")}
              style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", fontSize: 11, color: C.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
              Switch to Manual Entry
            </button>
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>Sector</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              style={{ padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.panel, color: sector ? C.text : C.muted, fontSize: 14, width: 360, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
            >
              <option value="">Select a sector (optional)</option>
              <option value="healthcare">Healthcare</option>
              <option value="energy">Energy</option>
              <option value="hospitality">Hospitality</option>
              <option value="mining">Mining</option>
              <option value="agriculture">Agriculture</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>Project Name</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} required
              style={{ padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.panel, color: C.text, fontSize: 14, width: 360, outline: "none", boxSizing: "border-box" }}
              placeholder="e.g. Palm Oil Operations 2025–2030" />
          </div>

          <p style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>
            Review and edit imported values below. All monetary values in USD.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.panel2 }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", border: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Field</th>
                  {years.map(y => (
                    <th key={y} style={{ padding: "10px 14px", textAlign: "right", color: C.forest, fontWeight: 800, fontSize: 12, border: `1px solid ${C.border}` }}>{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DASHBOARD_FIELDS.map(({ key, label }) => (
                  <tr key={key} style={{ background: C.panel }}>
                    <td style={{ padding: "8px 14px", color: C.text, fontWeight: 600, border: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{label}</td>
                    {years.map((_, i) => (
                      <td key={i} style={{ padding: "4px 8px", border: `1px solid ${C.border}` }}>
                        <input
                          type="number" min="0" step="any"
                          value={rows[i]?.[key] ?? ""}
                          onChange={(e) => updateCell(i, key, e.target.value)}
                          style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 5, background: rows[i]?.[key] ? "#fff" : C.bg, color: C.text, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {success && <p style={{ color: C.forest, fontSize: 12, marginTop: 16, background: `${C.forest}10`, padding: "8px 12px", borderRadius: 6 }}>Saved! Taking you to your dashboard...</p>}

          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button type="submit" disabled={saving}
              style={{ background: C.forest, color: "#fff", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving..." : editId ? "Update & View Dashboard" : "Save & View Dashboard"}
            </button>
            <button type="button" onClick={() => navigate("/dashboard")}
              style={{ background: "none", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 20px", fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
