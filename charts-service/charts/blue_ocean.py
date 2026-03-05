"""
Blue Ocean Analysis — Strategy Canvas + ERRC Grid
Returns two charts: 'canvas' and 'errc'
"""
import logging
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from theme import (apply_dark_theme, fig_to_base64,
                   NAVY, WHITE, OFF_WHITE, GRAY, TEAL, BLUE_OCEAN_COLOR,
                   AMBER, RED, GREEN, ACCENT)

logger = logging.getLogger("vcso.charts.blue_ocean")

ERRC_COLORS = {
    'eliminate': '#DC2626',  # Red — remove
    'reduce':    '#F59E0B',  # Amber — reduce
    'raise':     '#2563EB',  # Blue — raise
    'create':    '#16A34A',  # Green — create
}
ERRC_LABELS = {
    'eliminate': '✕  ELIMINATE',
    'reduce':    '↓  REDUCE',
    'raise':     '↑  RAISE',
    'create':    '★  CREATE',
}


def render_canvas(data: dict) -> str:
    """
    Strategy canvas: multi-line chart — your business vs 2 competitors
    across industry factors.
    """
    apply_dark_theme()
    factors = data.get('industry_factors', [])
    comp_names = data.get('competitor_names', ['Competitor 1', 'Competitor 2'])
    title = data.get('strategic_canvas_title', 'Strategic Canvas')
    opportunity = data.get('blue_ocean_opportunity', '')

    logger.info("blue_ocean_canvas | render_start | factors=%d | competitors=%s",
                len(factors), comp_names)

    if not factors:
        logger.warning("blue_ocean_canvas | no_factors | using empty chart")
        factors = []

    factor_names = [f.get('name', f'Factor {i+1}') for i, f in enumerate(factors)]
    biz_scores   = [f.get('businessScore', 5) for f in factors]
    comp1_scores = [f.get('competitor1Score', 5) for f in factors]
    comp2_scores = [f.get('competitor2Score', 5) for f in factors]
    importance   = [f.get('customerImportance', 5) for f in factors]

    n = len(factor_names)
    x = np.arange(n)

    fig, ax = plt.subplots(figsize=(12, 6), facecolor=NAVY)
    ax.set_facecolor('#111827')

    if n > 0:
        # Importance bars (background)
        ax.bar(x, [i / 10 * 10 for i in importance],
               color=TEAL, alpha=0.08, width=0.8, label='Customer Importance')

        # Competitor lines
        c1_name = comp_names[0] if len(comp_names) > 0 else 'Competitor 1'
        c2_name = comp_names[1] if len(comp_names) > 1 else 'Competitor 2'

        ax.plot(x, comp1_scores, 'o--', color='#6B7280',
                linewidth=1.5, markersize=5, label=c1_name, alpha=0.7)
        ax.plot(x, comp2_scores, 's--', color='#9CA3AF',
                linewidth=1.5, markersize=5, label=c2_name, alpha=0.7)

        # Your business — bold
        ax.plot(x, biz_scores, 'D-', color=TEAL,
                linewidth=2.5, markersize=8, label='Your Business',
                zorder=5)

        # Fill between your line and avg competitor
        avg_comp = [(c1 + c2) / 2 for c1, c2 in zip(comp1_scores, comp2_scores)]
        ax.fill_between(x, biz_scores, avg_comp,
                        where=[b > a for b, a in zip(biz_scores, avg_comp)],
                        color=TEAL, alpha=0.15, label='Advantage areas')
        ax.fill_between(x, biz_scores, avg_comp,
                        where=[b <= a for b, a in zip(biz_scores, avg_comp)],
                        color=RED, alpha=0.08, label='Gap areas')

        ax.set_xticks(x)
        ax.set_xticklabels(factor_names, rotation=35, ha='right',
                           color=OFF_WHITE, fontsize=8)
    else:
        ax.text(0.5, 0.5, 'No industry factors data available',
                transform=ax.transAxes, ha='center', color=GRAY)

    ax.set_ylim(0, 11)
    ax.set_yticks(range(0, 11, 2))
    ax.set_ylabel('Score (0–10)', color=GRAY)
    ax.tick_params(colors=GRAY)
    ax.spines['bottom'].set_color('#374151')
    ax.spines['left'].set_color('#374151')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.grid(axis='y', color='#1F2937', linewidth=0.5, alpha=0.5)

    ax.legend(loc='upper right', framealpha=0.4)
    ax.set_title(title, color=WHITE, fontsize=12, fontweight='bold', pad=12)

    if opportunity:
        fig.text(0.5, -0.06, opportunity[:130],
                 ha='center', color=TEAL, fontsize=8, style='italic')

    plt.tight_layout()
    result = fig_to_base64(fig)
    logger.info("blue_ocean_canvas | render_end | size_bytes=%d", len(result) * 3 // 4)
    return result


def render_errc(data: dict) -> str:
    """
    ERRC Grid: 4-column table — Eliminate / Reduce / Raise / Create
    """
    apply_dark_theme()
    errc = data.get('errc_grid', {})
    value_curve = data.get('value_curve_summary', '')

    eliminate = errc.get('eliminate', [])
    reduce    = errc.get('reduce', [])
    raise_    = errc.get('raise', [])
    create    = errc.get('create', [])

    logger.info("blue_ocean_errc | render_start | E=%d R=%d R=%d C=%d",
                len(eliminate), len(reduce), len(raise_), len(create))

    max_rows = max(len(eliminate), len(reduce), len(raise_), len(create), 1)
    fig_h = max(5, max_rows * 0.6 + 2.5)

    fig, axes = plt.subplots(1, 4, figsize=(13, fig_h), facecolor=NAVY)

    sections = [
        ('eliminate', eliminate),
        ('reduce',    reduce),
        ('raise',     raise_),
        ('create',    create),
    ]

    for ax, (key, items) in zip(axes, sections):
        ax.set_facecolor('#0F1923')
        ax.axis('off')
        color = ERRC_COLORS[key]
        label = ERRC_LABELS[key]

        # Header
        ax.add_patch(mpatches.FancyBboxPatch(
            (0, 0.90), 1.0, 0.10,
            boxstyle='round,pad=0',
            facecolor=color, edgecolor='none',
            transform=ax.transAxes, clip_on=False
        ))
        ax.text(0.5, 0.945, label,
                transform=ax.transAxes, ha='center', va='center',
                color=WHITE, fontsize=9, fontweight='bold')

        # Items
        y = 0.86
        dy = min(0.12, 0.80 / max(len(items), 1))
        for item in items:
            ax.add_patch(mpatches.FancyBboxPatch(
                (0.02, y - 0.05), 0.96, 0.06,
                boxstyle='round,pad=0.01',
                facecolor='#1F2937', edgecolor=color, linewidth=0.6,
                transform=ax.transAxes, alpha=0.8
            ))
            ax.text(0.5, y - 0.02, str(item)[:42],
                    transform=ax.transAxes, ha='center', va='center',
                    color=OFF_WHITE, fontsize=7.5)
            y -= dy + 0.02

        # Border
        for spine in ax.spines.values():
            spine.set_edgecolor(color)
            spine.set_linewidth(1.5)
            spine.set_visible(True)

    fig.suptitle('Blue Ocean ERRC Grid', color=WHITE,
                 fontsize=13, fontweight='bold', y=1.02)

    if value_curve:
        fig.text(0.5, -0.04, value_curve[:140],
                 ha='center', color=TEAL, fontsize=8, style='italic')

    plt.tight_layout(rect=[0, 0, 1, 0.98])
    result = fig_to_base64(fig)
    logger.info("blue_ocean_errc | render_end | size_bytes=%d", len(result) * 3 // 4)
    return result


if __name__ == '__main__':
    import base64
    sample = {
        'competitor_names': ['Zapier', 'Make'],
        'industry_factors': [
            {'name': 'Ease of Setup',       'businessScore': 6, 'competitor1Score': 9, 'competitor2Score': 7, 'customerImportance': 8},
            {'name': 'Execution Pricing',   'businessScore': 9, 'competitor1Score': 3, 'competitor2Score': 5, 'customerImportance': 9},
            {'name': 'Self-Hosting',        'businessScore': 10,'competitor1Score': 0, 'competitor2Score': 0, 'customerImportance': 7},
            {'name': 'Custom Code',         'businessScore': 9, 'competitor1Score': 3, 'competitor2Score': 6, 'customerImportance': 6},
            {'name': 'App Integrations',    'businessScore': 7, 'competitor1Score': 10,'competitor2Score': 8, 'customerImportance': 8},
            {'name': 'AI Capabilities',     'businessScore': 7, 'competitor1Score': 6, 'competitor2Score': 5, 'customerImportance': 9},
        ],
        'errc_grid': {
            'eliminate': ['Per-task pricing anxiety', 'Vendor lock-in via proprietary format'],
            'reduce':    ['UI complexity for non-technical users', 'Time-to-first-workflow'],
            'raise':     ['Data privacy & sovereignty', 'Developer experience', 'Enterprise scalability'],
            'create':    ['Fair-code community trust', 'AI-native workflow nodes', 'Self-hosted cloud hybrid'],
        },
        'value_curve_summary': 'n8n differentiates sharply on execution pricing and sovereignty while accepting lower ease-of-setup vs Zapier.',
        'blue_ocean_opportunity': 'A self-hosted AI automation tier capturing enterprise teams priced out of Zapier Teams.',
        'strategic_canvas_title': "n8n Strategic Canvas vs Zapier & Make"
    }
    b64_canvas = render_canvas(sample)
    b64_errc   = render_errc(sample)
    with open('/tmp/test_blue_ocean_canvas.png', 'wb') as f:
        f.write(base64.b64decode(b64_canvas))
    with open('/tmp/test_blue_ocean_errc.png', 'wb') as f:
        f.write(base64.b64decode(b64_errc))
    print('Saved /tmp/test_blue_ocean_canvas.png and /tmp/test_blue_ocean_errc.png')
