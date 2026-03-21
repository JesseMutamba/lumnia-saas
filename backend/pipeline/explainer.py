"""
SHAP Explainability
- Trains an XGBoost model to predict a target KPI
- Uses SHAP TreeExplainer to explain what drives the predictions
- Returns per-feature importance and per-row SHAP values
"""

import numpy as np
import pandas as pd


def shap_explain(
    data: list[dict],
    feature_cols: list[str],
    target_col: str,
) -> dict:
    """
    Train XGBoost on (feature_cols → target_col), then run SHAP TreeExplainer.

    Returns:
      feature_importance: global mean |SHAP| per feature (ranked)
      shap_matrix:        per-row SHAP values [n_rows × n_features]
      base_value:         expected model output (mean prediction)
      predictions:        model predictions for each training row
      waterfall_row0:     SHAP breakdown for the first row (great for UI waterfall chart)
    """
    import xgboost as xgb
    import shap

    df = pd.DataFrame(data)
    X = df[feature_cols].fillna(0)
    y = pd.to_numeric(df[target_col], errors="coerce").fillna(0)

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

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)      # shape: (n_rows, n_features)
    base_value = float(explainer.expected_value)

    # Global importance: mean |SHAP| per feature
    mean_abs = np.abs(shap_values).mean(axis=0)
    feature_importance = [
        {
            "feature": col,
            "importance": round(float(mean_abs[i]), 4),
            "importance_pct": 0.0,  # filled below
        }
        for i, col in enumerate(feature_cols)
    ]
    total = sum(f["importance"] for f in feature_importance) or 1.0
    for f in feature_importance:
        f["importance_pct"] = round(f["importance"] / total * 100, 1)
    feature_importance.sort(key=lambda x: x["importance"], reverse=True)

    # Waterfall for row 0 (example explanation)
    waterfall = [
        {
            "feature": col,
            "shap_value": round(float(shap_values[0, i]), 4),
            "feature_value": round(float(X.iloc[0, i]), 4),
        }
        for i, col in enumerate(feature_cols)
    ]
    waterfall.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

    return {
        "model": "XGBoost + SHAP TreeExplainer",
        "target": target_col,
        "features": feature_cols,
        "base_value": round(base_value, 2),
        "feature_importance": feature_importance,
        "shap_matrix": [[round(float(v), 4) for v in row] for row in shap_values],
        "predictions": [round(float(v), 2) for v in model.predict(X)],
        "waterfall_row0": waterfall,
    }
