"""
Lumina ML API — FastAPI backend
Endpoints:
  POST /api/process    → clean data + anomaly detection
  POST /api/forecast   → Prophet time series + XGBoost KPI prediction
  POST /api/cluster    → K-Means segmentation
  POST /api/explain    → SHAP feature attribution
  POST /api/simulate   → Monte Carlo scenario planning
"""

import io
import json
import numpy as np
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from pipeline.cleaner import clean_data, detect_anomalies
from pipeline.forecaster import prophet_forecast, xgboost_predict
from pipeline.clusterer import kmeans_cluster
from pipeline.explainer import shap_explain
from pipeline.monte_carlo import run_monte_carlo

app = FastAPI(title="Lumina ML API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Restrict to your Vercel domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "Lumina ML API"}


# ── Step 1: Upload + Clean + Anomaly Detection ────────────────────────────────

@app.post("/api/process")
async def process_file(file: UploadFile = File(...)):
    """
    Accept a CSV or Excel file.
    Returns cleaned data with anomaly flags and a pipeline report.
    """
    content = await file.read()
    name = file.filename or ""

    try:
        if name.endswith(".csv") or name.endswith(".txt"):
            df = pd.read_csv(io.BytesIO(content))
        elif name.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(400, "Unsupported file type. Upload CSV or Excel.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")

    if df.empty:
        raise HTTPException(400, "File is empty or could not be parsed.")

    cleaned_df, cleaning_report = clean_data(df)
    anomaly_df, anomaly_report = detect_anomalies(cleaned_df)

    # Replace NaN/Inf with None for JSON serialisation
    anomaly_df = anomaly_df.replace([np.inf, -np.inf], np.nan)
    rows = json.loads(anomaly_df.where(pd.notnull(anomaly_df), None).to_json(orient="records"))

    return {
        "columns": list(anomaly_df.columns),
        "rows": rows,
        "shape": {"rows": len(anomaly_df), "cols": len(anomaly_df.columns)},
        "numeric_columns": cleaning_report.get("numeric_columns", []),
        "cleaning_report": cleaning_report,
        "anomaly_report": anomaly_report,
    }


# ── Step 2: Forecasting ───────────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    data: list[dict]
    date_col: str
    metric_cols: list[str]
    periods: int = 5
    freq: str = "Y"                    # Y / Q / M
    # XGBoost optional fields
    target_col: Optional[str] = None
    feature_cols: Optional[list[str]] = None


@app.post("/api/forecast")
def forecast(req: ForecastRequest):
    """
    Run Prophet on each metric_col and (optionally) XGBoost on target_col.
    """
    out: dict = {"prophet": [], "xgboost": None}

    for metric in req.metric_cols:
        try:
            result = prophet_forecast(req.data, req.date_col, metric, req.periods, req.freq)
            out["prophet"].append(result)
        except Exception as e:
            out["prophet"].append({"metric": metric, "error": str(e)})

    if req.target_col and req.feature_cols:
        try:
            out["xgboost"] = xgboost_predict(req.data, req.feature_cols, req.target_col)
        except Exception as e:
            out["xgboost"] = {"error": str(e)}

    return out


# ── Step 3: Clustering ────────────────────────────────────────────────────────

class ClusterRequest(BaseModel):
    data: list[dict]
    feature_cols: list[str]
    n_clusters: Optional[int] = None   # None = auto-detect via elbow


@app.post("/api/cluster")
def cluster(req: ClusterRequest):
    try:
        return kmeans_cluster(req.data, req.feature_cols, req.n_clusters)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Step 4: SHAP Explainability ───────────────────────────────────────────────

class ExplainRequest(BaseModel):
    data: list[dict]
    feature_cols: list[str]
    target_col: str


@app.post("/api/explain")
def explain(req: ExplainRequest):
    try:
        return shap_explain(req.data, req.feature_cols, req.target_col)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Step 5: Monte Carlo ───────────────────────────────────────────────────────

class SimulateRequest(BaseModel):
    base_value: float
    growth_rate: float        # fraction e.g. 0.10
    volatility: float         # fraction e.g. 0.20
    periods: int = 5
    simulations: int = 2000


@app.post("/api/simulate")
def simulate(req: SimulateRequest):
    if req.base_value <= 0:
        raise HTTPException(400, "base_value must be positive")
    return run_monte_carlo(
        req.base_value,
        req.growth_rate,
        req.volatility,
        req.periods,
        req.simulations,
    )
