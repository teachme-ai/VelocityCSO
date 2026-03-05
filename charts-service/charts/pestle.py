"""
PESTLE Analysis — Styled factor table with severity bars and signal counts
"""
import logging
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from theme import (apply_dark_theme, fig_to_base64,
                   NAVY, WHITE, OFF_WHITE, GRAY, AMBER, RED, GREEN, BLUE, ACCENT)

logger = logging.getLogger("vcso.charts.pestle")

PESTLE_KEYS = [
    ('political',      'P',  'Political',      '#6B21A8'),   # purple
    ('economic',       'E',  'Economic',       '#1D4ED8'),   # blue
    ('social',         'S',  'Social',         '#065F46'),   # green
    ('technological',  'T',  'Technological',  '#0E7490'),   # teal
    ('legal',          'L',  'Legal',          '#92400E'),   # brown
    ('environmental',  'Env','Environmental',  '#166534'),   # dark green
]

IMPACT_COLORS = {
    'high':   RED,
    'medium': AMBER,
    'low':    GREEN,
}
IMPACT_WIDTHS = {'high': 1.0, 'medium': 0.6, 'low': 0.3}


def render(data: dict) -> str:
    """
    data: pestleAnalysis object
    {
        political: [{factor, impact_level, signal, time_horizon}],
        economic:  [...],
        social:    [...],
        ...
        overall_risk_score: 62,
        dominant_force: "Technological disruption..."
    }
    """
    apply_dark_theme()
    overall_risk = data.get('overall_risk_score', 50)
    dominant = data.get('dominant_force', '')

    logger.info("pestle | render_start | overall_risk=%s", overall_risk)

    # Collect all rows across dimensions
    all_rows = []
    for key, abbr, label, color in PESTLE_KEYS:
        factors = data.get(key, [])
        if isinstance(factors, list):
            for f in factors[:3]:  # cap 3 per dimension to keep chart readable
                all_rows.append({
                    'abbr':   abbr,
                    'label':  label,
                    'color':  color,
                    'factor': f.get('factor', '') if isinstance(f, dict) else str(f),
                    'impact': (f.get('impact_level', 'medium') if isinstance(f, dict) else 'medium').lower(),
                    'signal': f.get('signal', '') if isinstance(f, dict) else '',
                    'horizon': f.get('time_horizon', '') if isinstance(f, dict) else '',
                })
        elif isinstance(factors, dict):
            # Sometimes comes in as {factor, impact_level, ...} directly
            all_rows.append({
                'abbr':   abbr,
                'label':  label,
                'color':  color,
                'factor': factors.get('factor', label),
                'impact': factors.get('impact_level', 'medium').lower(),
                'signal': factors.get('signal', ''),
                'horizon': factors.get('time_horizon', ''),
            })

    if not all_rows:
        # Fallback: generate placeholder rows
        for key, abbr, label, color in PESTLE_KEYS:
            all_rows.append({
                'abbr': abbr, 'label': label, 'color': color,
                'factor': f'{label} factor data pending',
                'impact': 'medium', 'signal': '', 'horizon': ''
            })

    n_rows = len(all_rows)
    row_h = 0.055          # fraction of axes height per row
    header_h = 0.10
    fig_h = max(6, n_rows * 0.42 + 2.5)

    fig, ax = plt.subplots(figsize=(12, fig_h), facecolor=NAVY)
    ax.set_facecolor('#0D1117')
    ax.axis('off')

    # ── Title ──────────────────────────────────────────────────────────────────
    ax.text(0.5, 0.98, 'PESTLE Environmental Scan',
            transform=ax.transAxes, ha='center', va='top',
            color=WHITE, fontsize=13, fontweight='bold')

    risk_color = RED if overall_risk >= 65 else AMBER if overall_risk >= 40 else GREEN
    ax.text(0.5, 0.94, f'Macro Risk Score: {int(overall_risk)}/100',
            transform=ax.transAxes, ha='center', va='top',
            color=risk_color, fontsize=9, fontweight='bold')

    # ── Column headers ──────────────────────────────────────────────────────────
    col_defs = [
        (0.01,  0.05, 'DIM',    GRAY,     'left'),
        (0.07,  0.38, 'Factor / Signal',  GRAY, 'left'),
        (0.46,  0.13, 'Impact',  GRAY,    'center'),
        (0.60,  0.22, 'Severity Bar',  GRAY, 'left'),
        (0.83,  0.16, 'Horizon',  GRAY,   'center'),
    ]

    header_y = 0.90
    for cx, cw, ctxt, ccolor, calign in col_defs:
        ax.text(cx, header_y, ctxt,
                transform=ax.transAxes, color=ccolor,
                fontsize=7.5, fontweight='bold', va='top', ha=calign)

    ax.axhline(y=header_y - 0.025, xmin=0.01, xmax=0.99,
               color='#374151', linewidth=0.8, transform=ax.transAxes)

    # ── Rows ───────────────────────────────────────────────────────────────────
    usable_h = header_y - 0.08 - 0.06  # top to bottom margin
    dy = usable_h / max(n_rows, 1)
    dy = min(dy, 0.085)   # cap row height

    y = header_y - 0.045
    last_label = None

    for row in all_rows:
        impact = row['impact']
        imp_color = IMPACT_COLORS.get(impact, AMBER)
        bar_w = IMPACT_WIDTHS.get(impact, 0.5)
        dim_color = row['color']

        # Alternating stripe
        if all_rows.index(row) % 2 == 0:
            ax.add_patch(mpatches.FancyBboxPatch(
                (0.01, y - dy + 0.005), 0.98, dy - 0.006,
                boxstyle='round,pad=0', facecolor='#111827', alpha=0.5,
                transform=ax.transAxes
            ))

        # Dimension badge — only print when label changes
        if row['label'] != last_label:
            ax.add_patch(mpatches.FancyBboxPatch(
                (0.01, y - 0.022), 0.048, 0.028,
                boxstyle='round,pad=0.005',
                facecolor=dim_color, edgecolor='none',
                transform=ax.transAxes, alpha=0.85
            ))
            ax.text(0.035, y - 0.008, row['abbr'],
                    transform=ax.transAxes, ha='center', va='center',
                    color=WHITE, fontsize=7, fontweight='bold')
            last_label = row['label']

        # Factor text
        factor_txt = row['factor'][:70]
        ax.text(0.07, y - 0.006, factor_txt,
                transform=ax.transAxes, color=OFF_WHITE,
                fontsize=7.5, va='top')

        # Signal sub-text
        if row['signal']:
            ax.text(0.07, y - 0.022, row['signal'][:75],
                    transform=ax.transAxes, color=GRAY,
                    fontsize=6.5, va='top', style='italic')

        # Impact label
        ax.text(0.52, y - 0.012, impact.upper(),
                transform=ax.transAxes, ha='center', va='center',
                color=imp_color, fontsize=7, fontweight='bold')

        # Severity bar background
        ax.add_patch(mpatches.FancyBboxPatch(
            (0.60, y - 0.020), 0.22, 0.012,
            boxstyle='round,pad=0', facecolor='#1F2937',
            transform=ax.transAxes, zorder=2
        ))
        # Severity bar fill
        ax.add_patch(mpatches.FancyBboxPatch(
            (0.60, y - 0.020), 0.22 * bar_w, 0.012,
            boxstyle='round,pad=0', facecolor=imp_color, alpha=0.8,
            transform=ax.transAxes, zorder=3
        ))

        # Time horizon
        if row['horizon']:
            ax.text(0.91, y - 0.012, row['horizon'][:15],
                    transform=ax.transAxes, ha='center', va='center',
                    color=GRAY, fontsize=6.5)

        # Separator
        ax.axhline(y=y - dy + 0.005, xmin=0.01, xmax=0.99,
                   color='#1F2937', linewidth=0.4, transform=ax.transAxes)

        y -= dy

    # ── Dominant force note ─────────────────────────────────────────────────────
    if dominant:
        ax.add_patch(mpatches.FancyBboxPatch(
            (0.01, 0.01), 0.98, 0.045,
            boxstyle='round,pad=0.01',
            facecolor='#0F2027', edgecolor=AMBER, linewidth=0.8,
            transform=ax.transAxes
        ))
        ax.text(0.5, 0.032, f'Dominant Force: {dominant[:120]}',
                transform=ax.transAxes, ha='center', va='center',
                color=AMBER, fontsize=7.5, style='italic')

    plt.tight_layout()
    result = fig_to_base64(fig)
    logger.info("pestle | render_end | rows=%d | size_bytes=%d", n_rows, len(result) * 3 // 4)
    return result


if __name__ == '__main__':
    import base64
    sample = {
        'political': [
            {'factor': 'EU AI Act enforcement ramps in 2025', 'impact_level': 'high',
             'signal': 'Mandatory risk assessments for embedded AI workflows', 'time_horizon': 'Near-term'},
            {'factor': 'US export controls on advanced ML chips', 'impact_level': 'medium',
             'signal': 'Supply chain impact on GPU-dependent tooling', 'time_horizon': 'Mid-term'},
        ],
        'economic': [
            {'factor': 'SME budget compression post-rate hike', 'impact_level': 'high',
             'signal': 'Churn risk in sub-$50/mo automation seats', 'time_horizon': 'Immediate'},
        ],
        'social': [
            {'factor': 'Developer-led buying in mid-market', 'impact_level': 'medium',
             'signal': 'PLG motion favoured over top-down enterprise sales', 'time_horizon': 'Ongoing'},
        ],
        'technological': [
            {'factor': 'LLM-native automation displacing rules-based iPaaS', 'impact_level': 'high',
             'signal': 'GPT-4o function calling reducing connector complexity', 'time_horizon': 'Immediate'},
            {'factor': 'Open-source foundation model commoditisation', 'impact_level': 'medium',
             'signal': 'Llama-3 enables on-prem fine-tuning without cloud dependency', 'time_horizon': 'Mid-term'},
        ],
        'legal': [
            {'factor': 'GDPR enforcement on workflow data residency', 'impact_level': 'high',
             'signal': 'Self-hosted tier is a compliance moat', 'time_horizon': 'Active'},
        ],
        'environmental': [
            {'factor': 'Data centre PUE regulation in EU', 'impact_level': 'low',
             'signal': 'Minimal direct impact — cloud-hosted workloads only', 'time_horizon': 'Long-term'},
        ],
        'overall_risk_score': 68,
        'dominant_force': 'Technological disruption via LLM-native automation is compressing the value proposition of rules-based iPaaS players within 18 months.',
    }
    b64 = render(sample)
    with open('/tmp/test_pestle.png', 'wb') as f:
        f.write(base64.b64decode(b64))
    print('Saved /tmp/test_pestle.png')
