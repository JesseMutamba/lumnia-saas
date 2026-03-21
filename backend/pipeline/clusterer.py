"""
Client / Business-Unit Segmentation
- K-Means: groups rows into N clusters based on financial KPIs
- Auto-selects best K using the elbow method (inertia)
- Returns cluster labels, centroids, and a human-readable profile per segment
"""

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA


def _elbow_k(X_scaled: np.ndarray, max_k: int = 8) -> int:
    """Pick the best K using the elbow (largest inertia drop per increment)."""
    if len(X_scaled) < 4:
        return 2
    max_k = min(max_k, len(X_scaled) - 1)
    inertias = []
    for k in range(2, max_k + 1):
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        km.fit(X_scaled)
        inertias.append(km.inertia_)
    # Largest relative drop
    drops = [inertias[i - 1] - inertias[i] for i in range(1, len(inertias))]
    best_idx = int(np.argmax(drops))
    return best_idx + 2  # offset: k starts at 2


def kmeans_cluster(
    data: list[dict],
    feature_cols: list[str],
    n_clusters: int | None = None,
) -> dict:
    """
    Segment rows into clusters using K-Means on the selected financial KPIs.

    n_clusters = None → auto-detect best K via elbow method.
    Returns labels, per-cluster profiles, and 2D PCA coordinates for scatter plot.
    """
    df = pd.DataFrame(data)
    X = df[feature_cols].fillna(0)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    if n_clusters is None:
        n_clusters = _elbow_k(X_scaled)

    n_clusters = min(n_clusters, len(df))

    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = km.fit_predict(X_scaled)

    df["cluster"] = labels

    # ── Per-cluster profiles ─────────────────────────────────────────────────
    profiles = []
    for k in range(n_clusters):
        mask = labels == k
        subset = df[mask][feature_cols]
        profiles.append({
            "cluster": k,
            "size": int(mask.sum()),
            "label": f"Segment {k + 1}",
            "centroid": {col: round(float(subset[col].mean()), 2) for col in feature_cols},
        })

    # Sort by size desc
    profiles.sort(key=lambda p: p["size"], reverse=True)

    # ── 2D PCA for scatter visualisation ────────────────────────────────────
    n_components = min(2, X_scaled.shape[1])
    pca = PCA(n_components=n_components, random_state=42)
    coords = pca.fit_transform(X_scaled)
    scatter = [
        {
            "x": round(float(coords[i, 0]), 4),
            "y": round(float(coords[i, 1]), 4) if n_components > 1 else 0.0,
            "cluster": int(labels[i]),
        }
        for i in range(len(df))
    ]

    return {
        "n_clusters": n_clusters,
        "labels": [int(l) for l in labels],
        "profiles": profiles,
        "scatter": scatter,
        "inertia": round(float(km.inertia_), 4),
        "variance_explained": [round(float(v), 4) for v in pca.explained_variance_ratio_],
    }
