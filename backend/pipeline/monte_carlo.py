"""
Monte Carlo Simulation for Financial Scenario Planning
- Simulates N paths of a financial metric forward in time
- Uses geometric Brownian motion (standard in finance)
- Returns percentile bands (p5, p25, p50, p75, p95) per period
"""

import numpy as np


def run_monte_carlo(
    base_value: float,
    growth_rate: float,       # e.g. 0.10 = 10% expected annual growth
    volatility: float,        # e.g. 0.20 = 20% annual std dev (risk)
    periods: int = 5,
    simulations: int = 2000,
    seed: int = 42,
) -> dict:
    """
    Geometric Brownian Motion simulation.

    Each period:  V_t+1 = V_t × exp((μ - σ²/2)Δt + σ√Δt × Z)
    where Z ~ N(0,1)

    This is the standard model for asset/revenue paths in finance.
    """
    rng = np.random.default_rng(seed)

    dt = 1.0  # 1 period per step
    drift = (growth_rate - 0.5 * volatility ** 2) * dt
    diffusion = volatility * np.sqrt(dt)

    # Random shocks: shape (simulations, periods)
    Z = rng.standard_normal((simulations, periods))
    log_returns = drift + diffusion * Z

    # Cumulative product of returns
    paths = base_value * np.exp(np.cumsum(log_returns, axis=1))

    # Prepend t=0
    start_col = np.full((simulations, 1), base_value)
    full_paths = np.hstack([start_col, paths])   # (simulations, periods+1)

    # Percentile bands
    pcts = np.percentile(full_paths, [5, 25, 50, 75, 95], axis=0)

    # Build period labels
    period_labels = [f"T{i}" for i in range(periods + 1)]

    # Probability of ending above / below base
    final_vals = full_paths[:, -1]
    prob_gain = float((final_vals > base_value).mean() * 100)
    prob_loss = 100 - prob_gain

    # Value at Risk (5th percentile of final value)
    var_95 = float(base_value - pcts[0, -1])

    return {
        "n_simulations": simulations,
        "periods": period_labels,
        "base_value": base_value,
        "growth_rate_pct": round(growth_rate * 100, 2),
        "volatility_pct": round(volatility * 100, 2),
        "p5":  [round(float(v), 2) for v in pcts[0]],
        "p25": [round(float(v), 2) for v in pcts[1]],
        "p50": [round(float(v), 2) for v in pcts[2]],
        "p75": [round(float(v), 2) for v in pcts[3]],
        "p95": [round(float(v), 2) for v in pcts[4]],
        "final_p5":  round(float(pcts[0, -1]), 2),
        "final_p50": round(float(pcts[2, -1]), 2),
        "final_p95": round(float(pcts[4, -1]), 2),
        "prob_gain_pct": round(prob_gain, 1),
        "prob_loss_pct": round(prob_loss, 1),
        "value_at_risk_95": round(var_95, 2),
    }
