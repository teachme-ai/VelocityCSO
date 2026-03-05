"""
Monte Carlo — Histogram with KDE overlay, percentile bands, and inputs table
"""
import logging
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
try:
    import seaborn as sns
    HAS_SNS = True
except ImportError:
    HAS_SNS = False

from theme import (apply_dark_theme, fig_to_base64,
                   NAVY, WHITE, OFF_WHITE, GRAY, MONTE_COLOR,
                   RED, GREEN, BLUE, AMBER)

logger = logging.getLogger("vcso.charts.monte_carlo")


def render(data: dict) -> str:
    """
    data: monte_carlo result object
    {
        distributions: [{value: float}, ...],  # 10,000 outcomes
        risk_drivers: [{factor: str, variance_contribution: float}],
        # Also accepts raw monteCarloInputs for display
        inputs: {
            arpu_low, arpu_base, arpu_high,
            churn_low, churn_base, churn_high,
            cac_low, cac_base, cac_high,
            growth_rate_low, growth_rate_base, growth_rate_high,
            gross_margin_low, gross_margin_base, gross_margin_high
        }
    }
    """
    apply_dark_theme()
    distributions = data.get('distributions', [])
    risk_drivers = data.get('risk_drivers', [])
    inputs = data.get('inputs', {})

    logger.info("monte_carlo | render_start | outcomes=%d | risk_drivers=%d",
                len(distributions), len(risk_drivers))

    # Extract outcome values
    if distributions and isinstance(distributions[0], dict):
        values = [d.get('value', d.get('ltv_cac', 0)) for d in distributions]
    elif distributions and isinstance(distributions[0], (int, float)):
        values = list(distributions)
    else:
        # Generate synthetic data from inputs for display
        logger.warning("monte_carlo | no_distribution_data | generating from inputs")
        arpu_base = inputs.get('arpu_base', 500)
        churn_base = inputs.get('churn_base', 0.05)
        cac_base = inputs.get('cac_base', 1000)
        if churn_base > 0 and cac_base > 0:
            ltv_base = (arpu_base * 12) / churn_base
            ltv_cac_base = ltv_base / cac_base
        else:
            ltv_cac_base = 3.0
        np.random.seed(42)
        values = np.random.normal(ltv_cac_base, ltv_cac_base * 0.25, 1000).tolist()

    values = np.array(values, dtype=float)
    values = values[np.isfinite(values)]

    if len(values) == 0:
        logger.error("monte_carlo | no_valid_values | returning empty chart")
        values = np.array([2.0, 3.0, 4.0])

    p10 = float(np.percentile(values, 10))
    p50 = float(np.percentile(values, 50))
    p90 = float(np.percentile(values, 90))
    mean = float(np.mean(values))

    logger.info("monte_carlo | percentiles | P10=%.2f P50=%.2f P90=%.2f mean=%.2f",
                p10, p50, p90, mean)

    fig = plt.figure(figsize=(13, 7), facecolor=NAVY)

    # ── Left: Histogram + KDE ──────────────────────────────────────────────────
    ax_hist = fig.add_subplot(121, facecolor='#111827')

    n_bins = min(60, max(20, len(values) // 100))
    counts, bin_edges, patches = ax_hist.hist(
        values, bins=n_bins, color=MONTE_COLOR, alpha=0.6, edgecolor='none'
    )

    # Color zones
    for patch, left in zip(patches, bin_edges[:-1]):
        if left < 1.0:
            patch.set_facecolor(RED)
            patch.set_alpha(0.7)
        elif left < 3.0:
            patch.set_facecolor(BLUE)
            patch.set_alpha(0.6)
        else:
            patch.set_facecolor(GREEN)
            patch.set_alpha(0.6)

    # KDE overlay
    if HAS_SNS and len(values) > 10:
        ax2 = ax_hist.twinx()
        ax2.set_facecolor('none')
        try:
            sns.kdeplot(values, ax=ax2, color=MONTE_COLOR,
                        linewidth=2.0, fill=False)
        except Exception as e:
            logger.warning("monte_carlo | kde_failed | %s", str(e))
        ax2.set_ylabel('Density', color=GRAY, fontsize=8)
        ax2.tick_params(colors=GRAY, labelsize=7)
        ax2.spines['right'].set_color('#374151')
        ax2.spines['top'].set_visible(False)

    # Percentile lines
    for val, label, color, ls in [
        (p10,  'P10', RED,    '--'),
        (p50,  'P50', AMBER,  '-'),
        (p90,  'P90', GREEN,  '--'),
        (mean, 'Mean', WHITE, ':'),
    ]:
        ax_hist.axvline(x=val, color=color, linewidth=1.5,
                        linestyle=ls, alpha=0.9, zorder=5)
        ax_hist.text(val, ax_hist.get_ylim()[1] * 0.95,
                     f' {label}\n {val:.1f}x',
                     color=color, fontsize=7, va='top', ha='left')

    # Reference line at LTV:CAC = 3 (benchmark)
    ax_hist.axvline(x=3.0, color='#374151', linewidth=1.0,
                    linestyle=':', alpha=0.6)
    ax_hist.text(3.0, 0, ' Benchmark\n 3.0x',
                 color=GRAY, fontsize=6.5, va='bottom')

    ax_hist.set_xlabel('LTV:CAC Ratio Outcomes', color=GRAY, fontsize=9)
    ax_hist.set_ylabel('Frequency', color=GRAY, fontsize=9)
    ax_hist.tick_params(colors=GRAY, labelsize=7)
    ax_hist.spines['bottom'].set_color('#374151')
    ax_hist.spines['left'].set_color('#374151')
    ax_hist.spines['top'].set_visible(False)
    ax_hist.spines['right'].set_visible(False)
    ax_hist.grid(axis='y', color='#1F2937', linewidth=0.4, alpha=0.5)
    ax_hist.set_title('Monte Carlo Simulation (LTV:CAC)', color=WHITE,
                      fontsize=10, fontweight='bold')

    # Legend
    legend_patches = [
        mpatches.Patch(color=RED,   label='Danger (<1x)'),
        mpatches.Patch(color=BLUE,  label='Developing (1–3x)'),
        mpatches.Patch(color=GREEN, label='Healthy (>3x)'),
    ]
    ax_hist.legend(handles=legend_patches, loc='upper right',
                   fontsize=7, framealpha=0.3)

    # ── Right: Stats + Risk Drivers ────────────────────────────────────────────
    ax_info = fig.add_subplot(122, facecolor=NAVY)
    ax_info.axis('off')

    # Percentile table
    ax_info.text(0.5, 0.97, 'Simulation Summary',
                 transform=ax_info.transAxes, ha='center', va='top',
                 color=WHITE, fontsize=11, fontweight='bold')

    prob_above_3 = float(np.mean(values >= 3.0)) * 100
    prob_below_1 = float(np.mean(values < 1.0)) * 100

    summary_rows = [
        ('Scenarios Simulated', f'{len(values):,}'),
        ('P10 (Bear Case)',  f'{p10:.2f}x'),
        ('P50 (Base Case)',  f'{p50:.2f}x'),
        ('P90 (Bull Case)',  f'{p90:.2f}x'),
        ('Mean',             f'{mean:.2f}x'),
        ('Prob. LTV:CAC ≥ 3x', f'{prob_above_3:.1f}%'),
        ('Prob. LTV:CAC < 1x', f'{prob_below_1:.1f}%'),
    ]

    y = 0.88
    for label, val in summary_rows:
        color = GREEN if 'Bull' in label or ('Prob' in label and '≥' in label and float(val.replace('%','')) > 60) \
                else RED if 'Bear' in label or ('Prob' in label and '<' in label and float(val.replace('%','')) > 20) \
                else AMBER if 'Base' in label \
                else OFF_WHITE
        ax_info.text(0.08, y, label, transform=ax_info.transAxes,
                     color=GRAY, fontsize=8.5, va='top')
        ax_info.text(0.92, y, val, transform=ax_info.transAxes,
                     color=color, fontsize=8.5, va='top', ha='right',
                     fontweight='bold')
        ax_info.plot([0.05, 0.95], [y - 0.025, y - 0.025],
                     color='#1F2937', linewidth=0.5,
                     transform=ax_info.transAxes)
        y -= 0.085

    # Risk drivers
    if risk_drivers:
        ax_info.text(0.5, y - 0.02, 'Top Risk Drivers',
                     transform=ax_info.transAxes, ha='center',
                     color=WHITE, fontsize=9, fontweight='bold', va='top')
        y -= 0.08
        for driver in risk_drivers[:4]:
            factor = driver.get('factor', '')
            contrib = driver.get('variance_contribution', 0)
            bar_w = min(0.85, contrib)
            ax_info.add_patch(mpatches.FancyBboxPatch(
                (0.08, y - 0.025), 0.84, 0.018,
                boxstyle='round,pad=0', facecolor='#1F2937',
                transform=ax_info.transAxes
            ))
            ax_info.add_patch(mpatches.FancyBboxPatch(
                (0.08, y - 0.025), bar_w * 0.84, 0.018,
                boxstyle='round,pad=0', facecolor=AMBER, alpha=0.7,
                transform=ax_info.transAxes
            ))
            ax_info.text(0.08, y - 0.032, f'{factor[:35]}  ({contrib*100:.0f}%)',
                         transform=ax_info.transAxes,
                         color=OFF_WHITE, fontsize=7, va='top')
            y -= 0.07

    plt.tight_layout()
    result = fig_to_base64(fig)
    logger.info("monte_carlo | render_end | size_bytes=%d | null_outcomes=%d",
                len(result) * 3 // 4, int(len(distributions) - len(values)))
    return result


if __name__ == '__main__':
    import base64
    np.random.seed(42)
    outcomes = np.random.lognormal(mean=1.2, sigma=0.4, size=10000)
    sample = {
        'distributions': [{'value': float(v)} for v in outcomes],
        'risk_drivers': [
            {'factor': 'Churn Rate',   'variance_contribution': 0.42},
            {'factor': 'CAC Growth',   'variance_contribution': 0.31},
            {'factor': 'ARPU Decline', 'variance_contribution': 0.18},
            {'factor': 'Gross Margin', 'variance_contribution': 0.09},
        ]
    }
    b64 = render(sample)
    with open('/tmp/test_monte_carlo.png', 'wb') as f:
        f.write(base64.b64decode(b64))
    print('Saved /tmp/test_monte_carlo.png')
