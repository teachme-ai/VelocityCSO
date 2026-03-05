"""
Unit Economics — KPI metric bars + LTV:CAC gauge + sensitivity heatmap
"""
import logging
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import LinearSegmentedColormap
from theme import (apply_dark_theme, fig_to_base64, score_color,
                   NAVY, WHITE, OFF_WHITE, GRAY, GREEN, AMBER, RED, BLUE, ACCENT)

logger = logging.getLogger("vcso.charts.unit_economics")

# Metric display config: (key, label, unit, benchmark, good_direction)
# good_direction: 'high' = higher is better, 'low' = lower is better
METRIC_DEFS = [
    ('ltv_cac_ratio',      'LTV:CAC Ratio',        'x',   3.0,  'high'),
    ('cac',                'CAC',                   '$',   None, 'low'),
    ('ltv',                'LTV',                   '$',   None, 'high'),
    ('arpu',               'ARPU',                  '$',   None, 'high'),
    ('gross_margin',       'Gross Margin',           '%',   70.0, 'high'),
    ('churn_rate',         'Monthly Churn',          '%',   2.0,  'low'),
    ('payback_period',     'CAC Payback Period',     'mo',  12.0, 'low'),
    ('nrr',                'Net Revenue Retention',  '%',   100.0,'high'),
]


def _fmt(val: float, unit: str) -> str:
    if unit == '$':
        if val >= 1_000_000:
            return f'${val/1_000_000:.1f}M'
        elif val >= 1_000:
            return f'${val/1_000:.1f}K'
        return f'${val:.0f}'
    elif unit == '%':
        return f'{val:.1f}%'
    elif unit == 'mo':
        return f'{val:.1f} mo'
    elif unit == 'x':
        return f'{val:.2f}x'
    return f'{val:.2f}'


def _metric_color(val: float, benchmark, good_direction: str) -> str:
    if benchmark is None:
        return OFF_WHITE
    if good_direction == 'high':
        if val >= benchmark * 1.1:
            return GREEN
        elif val >= benchmark * 0.7:
            return AMBER
        return RED
    else:  # low is better
        if val <= benchmark * 0.9:
            return GREEN
        elif val <= benchmark * 1.3:
            return AMBER
        return RED


def render(data: dict) -> str:
    """
    data: unitEconomics object
    {
        ltv_cac_ratio: 3.2,
        cac: 1200,
        ltv: 3840,
        arpu: 320,
        gross_margin: 72,
        churn_rate: 1.8,
        payback_period: 11,
        nrr: 108,
        sensitivity: {
            rows: [{label, low, base, high}],  # optional sensitivity table
        },
        health_verdict: "Strong",
        improvement_levers: ["Reduce CAC by 15% via content-led growth", ...]
    }
    """
    apply_dark_theme()
    health = data.get('health_verdict', '')
    levers = data.get('improvement_levers', [])
    sensitivity = data.get('sensitivity', {})

    # Build metric list from data
    metrics = []
    for key, label, unit, benchmark, direction in METRIC_DEFS:
        val = data.get(key)
        if val is not None:
            try:
                metrics.append((label, float(val), unit, benchmark, direction))
            except (TypeError, ValueError):
                pass

    logger.info("unit_economics | render_start | metrics=%d | has_sensitivity=%s",
                len(metrics), bool(sensitivity.get('rows')))

    has_sensitivity = bool(sensitivity.get('rows'))
    n_cols = 3 if has_sensitivity else 2
    fig_w = 14 if has_sensitivity else 11

    fig = plt.figure(figsize=(fig_w, 7), facecolor=NAVY)

    # ── Left: Metric bars ────────────────────────────────────────────────────────
    ax_metrics = fig.add_subplot(1, n_cols, 1, facecolor='#111827')
    ax_metrics.axis('off')

    ax_metrics.text(0.5, 0.98, 'Unit Economics Dashboard',
                    transform=ax_metrics.transAxes, ha='center', va='top',
                    color=WHITE, fontsize=11, fontweight='bold')

    if health:
        hc = GREEN if 'strong' in health.lower() or 'healthy' in health.lower() \
             else RED if 'weak' in health.lower() or 'poor' in health.lower() \
             else AMBER
        ax_metrics.text(0.5, 0.93, f'Health: {health}',
                        transform=ax_metrics.transAxes, ha='center', va='top',
                        color=hc, fontsize=8.5, fontweight='bold')

    y = 0.87
    bar_x = 0.48
    bar_w = 0.46
    bar_h = 0.028

    for i, (label, val, unit, benchmark, direction) in enumerate(metrics):
        mc = _metric_color(val, benchmark, direction)
        val_str = _fmt(val, unit)

        # Label
        ax_metrics.text(0.04, y - 0.004, label,
                        transform=ax_metrics.transAxes,
                        color=OFF_WHITE, fontsize=8, va='center')

        # Background bar
        ax_metrics.add_patch(mpatches.FancyBboxPatch(
            (bar_x, y - bar_h / 2), bar_w, bar_h,
            boxstyle='round,pad=0', facecolor='#1F2937',
            transform=ax_metrics.transAxes, zorder=2
        ))

        # Filled bar: normalize relative to benchmark or just val
        if benchmark and benchmark > 0:
            fill = min(1.0, val / (benchmark * 2)) if direction == 'high' else \
                   min(1.0, (benchmark * 2 - val) / (benchmark * 2))
            fill = max(0.02, fill)
        else:
            fill = 0.5

        ax_metrics.add_patch(mpatches.FancyBboxPatch(
            (bar_x, y - bar_h / 2), bar_w * fill, bar_h,
            boxstyle='round,pad=0', facecolor=mc, alpha=0.8,
            transform=ax_metrics.transAxes, zorder=3
        ))

        # Benchmark marker
        if benchmark and benchmark > 0:
            bm_x = bar_x + bar_w * 0.5  # benchmark at midpoint
            ax_metrics.axvline(x=bm_x, ymin=y - bar_h, ymax=y + bar_h,
                               color=GRAY, linewidth=1, linestyle=':',
                               transform=ax_metrics.transAxes, alpha=0.6, zorder=4)

        # Value label on right
        ax_metrics.text(bar_x + bar_w + 0.03, y - 0.002,
                        val_str,
                        transform=ax_metrics.transAxes,
                        color=mc, fontsize=8.5, fontweight='bold', va='center')

        ax_metrics.axhline(y=y - 0.042, xmin=0.02, xmax=0.98,
                           color='#1F2937', linewidth=0.4,
                           transform=ax_metrics.transAxes)
        y -= 0.10

    # ── Middle: LTV:CAC Gauge + Levers ───────────────────────────────────────────
    ax_gauge = fig.add_subplot(1, n_cols, 2, facecolor=NAVY)
    ax_gauge.axis('off')

    ltv_cac = data.get('ltv_cac_ratio', 0)
    try:
        ltv_cac = float(ltv_cac)
    except (TypeError, ValueError):
        ltv_cac = 0.0

    # Semi-circle gauge
    gauge_cx, gauge_cy = 0.5, 0.68
    gauge_r = 0.22
    theta = np.linspace(np.pi, 0, 200)

    # Color band arcs
    for t1, t2, gc in [
        (np.pi,     np.pi*2/3, RED),
        (np.pi*2/3, np.pi/3,   AMBER),
        (np.pi/3,   0,         GREEN),
    ]:
        ts = np.linspace(t1, t2, 50)
        xs = gauge_cx + gauge_r * np.cos(ts)
        ys = gauge_cy + gauge_r * np.sin(ts)
        ax_gauge.plot(xs, ys, color=gc, linewidth=8, alpha=0.4,
                      transform=ax_gauge.transAxes, solid_capstyle='butt')

    # Needle
    max_val = 6.0
    needle_frac = min(1.0, max(0.0, ltv_cac / max_val))
    needle_angle = np.pi * (1 - needle_frac)
    nx = gauge_cx + gauge_r * 0.85 * np.cos(needle_angle)
    ny = gauge_cy + gauge_r * 0.85 * np.sin(needle_angle)
    ax_gauge.annotate('', xy=(nx, ny), xytext=(gauge_cx, gauge_cy),
                      xycoords='axes fraction', textcoords='axes fraction',
                      arrowprops=dict(arrowstyle='->', color=WHITE, lw=2))
    ax_gauge.plot(gauge_cx, gauge_cy, 'o', color=WHITE,
                  markersize=6, transform=ax_gauge.transAxes, zorder=5)

    # Center value
    gc_color = _metric_color(ltv_cac, 3.0, 'high')
    ax_gauge.text(gauge_cx, gauge_cy - 0.06, f'{ltv_cac:.2f}x',
                  transform=ax_gauge.transAxes, ha='center', va='top',
                  color=gc_color, fontsize=16, fontweight='bold')
    ax_gauge.text(gauge_cx, gauge_cy - 0.14, 'LTV : CAC',
                  transform=ax_gauge.transAxes, ha='center', va='top',
                  color=GRAY, fontsize=8)

    # Scale labels
    for label, angle in [('<1x', np.pi), ('3x', np.pi/2), ('>6x', 0)]:
        lx = gauge_cx + (gauge_r + 0.04) * np.cos(angle)
        ly = gauge_cy + (gauge_r + 0.04) * np.sin(angle)
        ax_gauge.text(lx, ly, label, transform=ax_gauge.transAxes,
                      ha='center', va='center', color=GRAY, fontsize=6.5)

    ax_gauge.text(0.5, 0.97, 'LTV:CAC Health Gauge',
                  transform=ax_gauge.transAxes, ha='center', va='top',
                  color=WHITE, fontsize=10, fontweight='bold')

    # Levers
    if levers:
        ax_gauge.text(0.5, 0.37, 'Improvement Levers',
                      transform=ax_gauge.transAxes, ha='center', va='top',
                      color=WHITE, fontsize=8.5, fontweight='bold')
        ly2 = 0.30
        for lever in levers[:4]:
            ax_gauge.add_patch(mpatches.FancyBboxPatch(
                (0.04, ly2 - 0.045), 0.92, 0.040,
                boxstyle='round,pad=0.01',
                facecolor='#1F2937', edgecolor=ACCENT, linewidth=0.6,
                transform=ax_gauge.transAxes
            ))
            ax_gauge.text(0.08, ly2 - 0.025, f'→  {str(lever)[:70]}',
                          transform=ax_gauge.transAxes,
                          color=OFF_WHITE, fontsize=7, va='center')
            ly2 -= 0.065

    # ── Right: Sensitivity heatmap (optional) ─────────────────────────────────
    if has_sensitivity:
        ax_heat = fig.add_subplot(1, 3, 3, facecolor=NAVY)
        ax_heat.axis('off')

        rows_data = sensitivity.get('rows', [])
        ax_heat.text(0.5, 0.97, 'Sensitivity Analysis',
                     transform=ax_heat.transAxes, ha='center', va='top',
                     color=WHITE, fontsize=10, fontweight='bold')

        if rows_data:
            n_r = len(rows_data)
            cell_h = 0.85 / (n_r + 1)

            # Header
            for cx, txt in [(0.04, 'Driver'), (0.38, 'Bear'), (0.58, 'Base'), (0.78, 'Bull')]:
                ax_heat.text(cx, 0.90, txt, transform=ax_heat.transAxes,
                             color=GRAY, fontsize=7.5, fontweight='bold', va='top')

            y3 = 0.84
            for row in rows_data[:8]:
                label3 = str(row.get('label', ''))[:30]
                low  = row.get('low',  row.get('bear', ''))
                base = row.get('base', '')
                high = row.get('high', row.get('bull', ''))

                ax_heat.text(0.04, y3, label3, transform=ax_heat.transAxes,
                             color=OFF_WHITE, fontsize=7, va='top')

                for cx2, val2, bg in [
                    (0.36, str(low),  RED),
                    (0.56, str(base), AMBER),
                    (0.76, str(high), GREEN),
                ]:
                    ax_heat.add_patch(mpatches.FancyBboxPatch(
                        (cx2 - 0.01, y3 - 0.02), 0.18, 0.032,
                        boxstyle='round,pad=0.005',
                        facecolor=bg, alpha=0.25,
                        transform=ax_heat.transAxes
                    ))
                    ax_heat.text(cx2 + 0.08, y3 - 0.004, val2[:12],
                                 transform=ax_heat.transAxes,
                                 ha='center', color=WHITE,
                                 fontsize=7, va='top')

                ax_heat.axhline(y=y3 - 0.025, xmin=0.02, xmax=0.98,
                                color='#1F2937', linewidth=0.4,
                                transform=ax_heat.transAxes)
                y3 -= cell_h

    plt.tight_layout()
    result = fig_to_base64(fig)
    logger.info("unit_economics | render_end | size_bytes=%d", len(result) * 3 // 4)
    return result


if __name__ == '__main__':
    import base64
    sample = {
        'ltv_cac_ratio':   3.8,
        'cac':             1100,
        'ltv':             4180,
        'arpu':            348,
        'gross_margin':    74,
        'churn_rate':      1.6,
        'payback_period':  10.5,
        'nrr':             112,
        'health_verdict':  'Strong',
        'improvement_levers': [
            'Reduce CAC 15% via content-led PLG motion',
            'Increase NRR to 115% through expansion plays in enterprise tier',
            'Cut churn to 1.2% with proactive CSM program for accounts >$5K ARR',
        ],
        'sensitivity': {
            'rows': [
                {'label': 'ARPU ±20%',         'low': '2.9x', 'base': '3.8x', 'high': '4.6x'},
                {'label': 'Churn ±50%',         'low': '2.1x', 'base': '3.8x', 'high': '6.2x'},
                {'label': 'CAC ±25%',           'low': '2.8x', 'base': '3.8x', 'high': '5.1x'},
                {'label': 'Gross Margin ±10pp', 'low': '3.2x', 'base': '3.8x', 'high': '4.4x'},
            ]
        }
    }
    b64 = render(sample)
    with open('/tmp/test_unit_economics.png', 'wb') as f:
        f.write(base64.b64decode(b64))
    print('Saved /tmp/test_unit_economics.png')
