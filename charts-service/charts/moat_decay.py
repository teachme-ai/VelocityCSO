"""
SIM 3.3 — Moat Decay Chart
Renders baseline vs accelerated moat strength over 36 months.
"""
import io
import base64
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches


def render(data: dict) -> str:
    baseline    = data.get("decay_curve_baseline", [])
    accelerated = data.get("decay_curve_accelerated", [])
    moat_name   = data.get("moat_name", "Core Moat")
    top_threat  = data.get("top_threat", "Attack Vector")
    baseline_m  = data.get("baseline_months_to_parity", 0)
    accel_m     = data.get("accelerated_months_to_parity", 0)
    interventions = data.get("intervention_points", [])

    months = list(range(37))

    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor("#0a0a0f")
    ax.set_facecolor("#0d1117")
    ax.tick_params(colors="#9ca3af", labelsize=8)
    for spine in ax.spines.values():
        spine.set_edgecolor("#1e2a3a")

    if baseline:
        ax.plot(months[:len(baseline)], baseline, color="#6366f1", linewidth=2.5,
                label=f"Base case (parity @ {baseline_m}m)")
    if accelerated and accelerated != baseline:
        ax.plot(months[:len(accelerated)], accelerated, color="#ef4444", linewidth=2,
                linestyle="--", label=f"If {top_threat} executes (parity @ {accel_m}m)")

    # Parity threshold line
    ax.axhline(50, color="#6b7280", linestyle=":", linewidth=1, alpha=0.7)
    ax.text(0.5, 51, "Competitive Parity (50)", color="#6b7280", fontsize=7, alpha=0.8)

    # Residual floor line
    ax.axhline(30, color="#374151", linestyle=":", linewidth=0.8, alpha=0.5)
    ax.text(0.5, 31, "Residual Advantage (30)", color="#374151", fontsize=7, alpha=0.7)

    # Intervention points
    for pt in interventions:
        m = pt.get("month", 0)
        urgency = pt.get("urgency", "monitor")
        color = "#ef4444" if urgency == "now" else "#f59e0b" if urgency == "soon" else "#6b7280"
        ax.axvline(m, color=color, alpha=0.5, linestyle=":")
        strength_at_m = baseline[m] if m < len(baseline) else 50
        ax.annotate(
            f"Act @ M{m}",
            xy=(m, strength_at_m),
            xytext=(m + 0.5, strength_at_m + 4),
            fontsize=6,
            color=color,
            arrowprops=dict(arrowstyle="->", color=color, lw=0.8),
        )

    ax.set_xlabel("Months from Today", color="#9ca3af", fontsize=9)
    ax.set_ylabel("Moat Strength (0–100)", color="#9ca3af", fontsize=9)
    ax.set_title(f"{moat_name} — Competitive Parity Clock",
                 color="#e5e7eb", fontsize=10, pad=10)
    ax.set_ylim(0, 105)
    ax.set_xlim(0, 36)
    ax.legend(fontsize=8, facecolor="#1e2a3a", edgecolor="#374151", labelcolor="#e5e7eb")

    plt.tight_layout(pad=1.5)
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=120, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")
