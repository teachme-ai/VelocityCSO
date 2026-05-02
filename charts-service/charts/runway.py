"""
SIM 3.1 — Runway Simulation Chart
Renders P10/P50/P90 cash balance trajectories over 36 months.
"""
import io
import base64
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches


def render(data: dict) -> str:
    p10 = data.get("monthly_trajectories", {}).get("p10", [])
    p50 = data.get("monthly_trajectories", {}).get("p50", [])
    p90 = data.get("monthly_trajectories", {}).get("p90", [])
    p10_months = data.get("p10_months", 0)
    p50_months = data.get("p50_months", 0)
    p90_months = data.get("p90_months", 36)
    prob_24m   = data.get("probability_24m", 0)

    months = list(range(len(p50) if p50 else 37))

    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    fig.patch.set_facecolor("#0a0a0f")
    for ax in axes:
        ax.set_facecolor("#0d1117")
        ax.tick_params(colors="#9ca3af", labelsize=8)
        for spine in ax.spines.values():
            spine.set_edgecolor("#1e2a3a")

    # Left: Cash balance trajectories
    ax = axes[0]
    if p90:
        ax.plot(months, p90, color="#22c55e", linewidth=1.5, label=f"P90 (optimistic)")
    if p50:
        ax.plot(months, p50, color="#f59e0b", linewidth=2,   label=f"P50 (base case)")
    if p10:
        ax.plot(months, p10, color="#ef4444", linewidth=1.5, label=f"P10 (pessimistic)")
    ax.axhline(0, color="#6b7280", linestyle="--", linewidth=0.8, alpha=0.6)
    ax.set_xlabel("Month", color="#9ca3af", fontsize=8)
    ax.set_ylabel("Cash Balance", color="#9ca3af", fontsize=8)
    ax.set_title("Cash Balance Trajectories", color="#e5e7eb", fontsize=9, pad=8)
    ax.legend(fontsize=7, facecolor="#1e2a3a", edgecolor="#374151", labelcolor="#e5e7eb")

    # Right: Runway distribution histogram
    ax2 = axes[1]
    hist = data.get("zero_cash_distribution", [])
    if hist:
        x = list(range(len(hist)))
        colors = ["#ef4444" if i <= p10_months else "#f59e0b" if i <= p50_months else "#22c55e" for i in x]
        ax2.bar(x, hist, color=colors, alpha=0.8, width=0.9)
    ax2.axvline(p10_months, color="#ef4444", linestyle="--", linewidth=1, label=f"P10: {p10_months}m")
    ax2.axvline(p50_months, color="#f59e0b", linestyle="--", linewidth=1.5, label=f"P50: {p50_months}m")
    ax2.axvline(p90_months if p90_months < 36 else 35, color="#22c55e", linestyle="--", linewidth=1,
                label=f"P90: {'36m+' if p90_months >= 36 else str(p90_months) + 'm'}")
    ax2.set_xlabel("Months to Zero Cash", color="#9ca3af", fontsize=8)
    ax2.set_ylabel("Simulation Count", color="#9ca3af", fontsize=8)
    ax2.set_title(f"Runway Distribution  ·  P(24m) = {round(prob_24m * 100)}%",
                  color="#e5e7eb", fontsize=9, pad=8)
    ax2.legend(fontsize=7, facecolor="#1e2a3a", edgecolor="#374151", labelcolor="#e5e7eb")

    plt.tight_layout(pad=1.5)
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=120, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")
