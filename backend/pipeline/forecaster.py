"""
Forecasting Pipeline
- Prophet: probabilistic time series forecasting (trend + seasonality + uncertainty)
- XGBoost: supervised regression for KPI prediction from feature set
"""

import numpy as np
import pandas as pd


# ── Prophet ──────────────────────────────────────────────────────────────────

def prophet_forecast(
    data: list[dict],
    date_col: str,
    value_col: str,
    periods: int = 5,
    freq: str = "Y",
) -> dict:
    """
    Fit a Prophet model and forecast `periods` steps ahead.
    Returns historical actuals + forecast with 80% confidence interval.

    freq options: 'Y' (yearly), 'Q' (quarterly), 'M' (monthly)
    """
    try:
        from prophet import Prophet
    except ImportError:
        return _linear_fallback(data, date_col, value_col, periods, freq)

    df = pd.DataFrame(data)

    # Build Prophet-format DataFrame: ds (datetime), y (value)
    ds = pd.to_datetime(df[date_col].astype(str), errors="coerce")
    if ds.isna().all():
        # Try treating as year integers
        ds = pd.to_datetime(df[date_col].astype(str) + "-01-01", errors="coerce")

    df_prophet = pd.DataFrame({"ds": ds, "y": pd.to_numeric(df[value_col], errors="coerce")})
    df_prophet = df_prophet.dropna()

    if len(df_prophet) < 2:
        return {"error": "Need at least 2 data points for forecasting"}

    m = Prophet(
        yearly_seasonality=(freq in ("M", "Q")),
        weekly_seasonality=False,
        daily_seasonality=False,
        changepoint_prior_scale=0.3,
        interval_width=0.80,
    )
    m.fit(df_prophet)

    future = m.make_future_dataframe(periods=periods, freq=freq)
    forecast = m.predict(future)

    history_len = len(df_prophet)
    result = []
    for i, row in forecast.iterrows():
        is_forecast = i >= history_len
        result.append({
            "ds": row["ds"].strftime("%Y-%m-%d"),
            "actual": None if is_forecast else float(df_prophet.iloc[i]["y"]),
            "yhat": round(float(row["yhat"]), 2),
            "yhat_lower": round(float(row["yhat_lower"]), 2),
            "yhat_upper": round(float(row["yhat_upper"]), 2),
            "is_forecast": is_forecast,
        })

    return {"metric": value_col, "model": "Prophet", "points": result}


def _linear_fallback(data, date_col, value_col, periods, freq):
    """Simple linear trend fallback when Prophet is unavailable."""
    df = pd.DataFrame(data)
    y = pd.to_numeric(df[value_col], errors="coerce").dropna().values
    n = len(y)
    x = np.arange(n)
    if n < 2:
        return {"error": "Not enough data"}
    slope = np.polyfit(x, y, 1)[0]
    intercept = np.polyfit(x, y, 1)[1]
    std = float(np.std(y - (slope * x + intercept)))

    result = []
    for i in range(n + periods):
        yhat = float(slope * i + intercept)
        result.append({
            "ds": str(2020 + i),
            "actual": float(y[i]) if i < n else None,
            "yhat": round(yhat, 2),
            "yhat_lower": round(yhat - 1.28 * std, 2),
            "yhat_upper": round(yhat + 1.28 * std, 2),
            "is_forecast": i >= n,
        })
    return {"metric": value_col, "model": "LinearTrend (Prophet unavailable)", "points": result}


# ── XGBoost ──────────────────────────────────────────────────────────────────

def xgboost_predict(
    data: list[dict],
    feature_cols: list[str],
    target_col: str,
    forecast_rows: list[dict] | None = None,
) -> dict:
    """
    Train an XGBoost regressor to predict `target_col` from `feature_cols`.
    If `forecast_rows` is provided, also predict on those future rows.

    Use case: predict next-year margin given revenue, opex, capex as features.
    """
    import xgboost as xgb
    from sklearn.model_selection import cross_val_score
    from sklearn.metrics import mean_absolute_percentage_error

    df = pd.DataFrame(data)
    X = df[feature_cols].fillna(0).values
    y = pd.to_numeric(df[target_col], errors="coerce").fillna(0).values

    model = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=0,
    )
    model.fit(X, y)

    train_preds = model.predict(X)
    mape = float(mean_absolute_percentage_error(y, train_preds)) * 100

    # Feature importance
    importance = [
        {"feature": col, "importance": round(float(imp), 4)}
        for col, imp in zip(feature_cols, model.feature_importances_)
    ]
    importance.sort(key=lambda x: x["importance"], reverse=True)

    out: dict = {
        "model": "XGBoost",
        "target": target_col,
        "features": feature_cols,
        "mape_pct": round(mape, 2),
        "feature_importance": importance,
        "train_actuals": [round(float(v), 2) for v in y],
        "train_predictions": [round(float(v), 2) for v in train_preds],
    }

    if forecast_rows:
        X_future = pd.DataFrame(forecast_rows)[feature_cols].fillna(0).values
        out["forecast_predictions"] = [round(float(v), 2) for v in model.predict(X_future)]

    return out
