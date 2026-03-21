"""
Data Cleaning Pipeline
- KNN Imputer: fills missing values using the K nearest neighbors
- Isolation Forest: detects anomalous rows (outliers, data errors)
"""

import re
import numpy as np
import pandas as pd
from sklearn.impute import KNNImputer
from sklearn.ensemble import IsolationForest


def _coerce_numeric(series: pd.Series) -> pd.Series:
    """Strip currency symbols, commas, K/M/B suffixes, parenthetical negatives."""
    s = series.astype(str).str.strip()
    s = s.str.replace(r"[$€£¥₦FCFA]", "", regex=True)
    s = s.str.replace(r",", "", regex=True)
    # (100) → -100
    s = s.str.replace(r"^\(([0-9.]+)\)$", r"-\1", regex=True)
    # 1.5K → 1500 etc.
    def expand_suffix(m):
        n, suffix = float(m.group(1)), m.group(2).upper()
        mult = {"K": 1e3, "M": 1e6, "B": 1e9}
        return str(n * mult.get(suffix, 1))
    s = s.str.replace(r"([0-9.]+)\s*([KMBkmb])\b", expand_suffix, regex=True)
    # strip % but keep value
    s = s.str.replace("%", "", regex=False)
    return pd.to_numeric(s, errors="coerce")


def clean_data(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Step 1 — Clean raw financial data:
      a) Normalise column names
      b) Coerce numeric-looking object columns
      c) Fill NaNs with KNN Imputer (uses neighbour similarity, not mean)
    Returns cleaned DataFrame and a human-readable report.
    """
    report: dict = {
        "original_shape": list(df.shape),
        "missing_before": int(df.isnull().sum().sum()),
        "steps": [],
    }

    df = df.copy()

    # ── a) Normalise column names ────────────────────────────────────────────
    df.columns = [
        re.sub(r"[^a-z0-9_]", "_", str(c).strip().lower()).strip("_")
        for c in df.columns
    ]
    report["steps"].append("Normalised column names to snake_case")

    # ── b) Coerce object columns that look numeric ───────────────────────────
    converted = []
    for col in df.select_dtypes(include="object").columns:
        numeric = _coerce_numeric(df[col])
        if numeric.notna().sum() / max(len(df), 1) >= 0.4:
            df[col] = numeric
            converted.append(col)
    if converted:
        report["steps"].append(f"Converted {len(converted)} text columns to numeric: {converted}")

    # ── c) KNN Imputer on all numeric columns ────────────────────────────────
    num_cols = df.select_dtypes(include=np.number).columns.tolist()
    missing = int(df[num_cols].isnull().sum().sum()) if num_cols else 0

    if num_cols and missing > 0:
        k = min(5, max(1, len(df) - 1))
        imputer = KNNImputer(n_neighbors=k)
        df[num_cols] = imputer.fit_transform(df[num_cols])
        report["steps"].append(
            f"KNN Imputer (k={k}) filled {missing} missing values across {len(num_cols)} numeric columns"
        )
    else:
        report["steps"].append("No missing numeric values — imputation skipped")

    report["missing_after"] = int(df.isnull().sum().sum())
    report["numeric_columns"] = num_cols
    report["final_shape"] = list(df.shape)

    return df, report


def detect_anomalies(df: pd.DataFrame, contamination: float = 0.05) -> tuple[pd.DataFrame, dict]:
    """
    Step 2 — Isolation Forest anomaly detection.
    Contamination = expected fraction of outliers (default 5%).
    Adds two columns to the DataFrame:
      _anomaly       : 1 = anomalous row, 0 = normal
      _anomaly_score : higher = more anomalous (useful for ranking)
    """
    report: dict = {
        "method": "Isolation Forest",
        "contamination": contamination,
        "anomalies_found": 0,
        "anomaly_rows": [],
    }

    num_cols = df.select_dtypes(include=np.number).columns.tolist()
    # Exclude our own meta columns
    num_cols = [c for c in num_cols if not c.startswith("_")]

    df = df.copy()

    if len(num_cols) < 1 or len(df) < 5:
        df["_anomaly"] = 0
        df["_anomaly_score"] = 0.0
        report["note"] = "Too few rows or numeric columns for anomaly detection"
        return df, report

    X = df[num_cols].fillna(0).values
    iso = IsolationForest(contamination=contamination, random_state=42, n_estimators=200)
    preds = iso.fit_predict(X)       # −1 = anomaly, 1 = normal
    scores = iso.score_samples(X)   # lower raw score = more anomalous

    df["_anomaly"] = (preds == -1).astype(int)
    df["_anomaly_score"] = np.round(-scores, 4)   # flip: higher = more anomalous

    anomaly_rows = df.index[df["_anomaly"] == 1].tolist()
    report["anomalies_found"] = len(anomaly_rows)
    report["anomaly_rows"] = [int(i) for i in anomaly_rows]

    return df, report
