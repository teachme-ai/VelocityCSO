"""
VRIO Analysis — Scorecard with Horizontal Bars and Verdict Box
"""
import logging
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from theme import (apply_dark_theme, fig_to_base64, score_color,
                   NAVY, WHITE, OFF_WHITE, GRAY, VRIO_COLOR, GREEN, AMBER, RED)

logger = logging.getLogger("vcso.charts.vrio")

CRITERIA = [
    ('valuable',   'Valuable',   'Does it help capture value or reduce costs?'),
    ('rare',       'Rare',       'Do few competitors possess this resource?'),
    ('inimitable', 'Inimitable', 'Is it costly or difficult to imitate?'),
    ('organised',  'Organised',  'Is the firm organised to exploit it?'),
]

VERDICT_COLORS = {
    'Sustained Competitive Advantage': GREEN,
    'Temporary Advantage':             AMBER,
    'Competitive Parity':              '#2563EB',
    'No Advantage':                    RED,
}


def render(data: dict) -> str:
    """
    data: vrioAnalysis object
    {
        resource_evaluated: "Fair-Code open architecture",
        valuable:   {score, evidence},
        rare:       {score, evidence},
        inimitable: {score, evidence},
        organised:  {score, evidence},
        verdict: "Sustained Competitive Advantage",
        verdict_rationale: "..."
    }
    """
    apply_dark_theme()
    resource = data.get('resource_evaluated', 'Primary Resource')
    verdict = data.get('verdict', 'Unknown')
    rationale = data.get('verdict_rationale', '')
    logger.info("vrio | render_start | resource=%s | verdict=%s", resource, verdict)

    fig, ax = plt.subplots(figsize=(10, 6), facecolor=NAVY)
    ax.set_facecolor('#111827')
    ax.axis('off')

    # Title
    ax.text(0.5, 0.97, 'VRIO Resource Analysis',
            transform=ax.transAxes, ha='center', va='top',
            color=WHITE, fontsize=13, fontweight='bold')
    ax.text(0.5, 0.91, f'Resource Evaluated: {resource}',
            transform=ax.transAxes, ha='center', va='top',
            color=VRIO_COLOR, fontsize=9, style='italic')

    # Criterion bars
    bar_area_left = 0.04
    bar_area_right = 0.96
    bar_w = bar_area_right - bar_area_left
    label_w = 0.18
    bar_start = bar_area_left + label_w
    bar_len = bar_w - label_w - 0.14  # leave room for score on right

    y_positions = [0.74, 0.58, 0.42, 0.26]

    for (key, label, desc), y in zip(CRITERIA, y_positions):
        entry = data.get(key, {})
        score = entry.get('score', 50) if isinstance(entry, dict) else 50
        evidence = entry.get('evidence', '') if isinstance(entry, dict) else ''
        sc = score_color(score)

        # Criterion label
        ax.text(bar_area_left, y + 0.025, label,
                transform=ax.transAxes, color=WHITE,
                fontsize=10, fontweight='bold', va='top')
        ax.text(bar_area_left, y, desc,
                transform=ax.transAxes, color=GRAY,
                fontsize=7, va='top')

        # Background bar
        ax.add_patch(mpatches.FancyBboxPatch(
            (bar_start, y - 0.025), bar_len, 0.022,
            boxstyle='round,pad=0', facecolor='#1F2937',
            transform=ax.transAxes, zorder=2
        ))
        # Filled bar
        fill_len = bar_len * (score / 100)
        ax.add_patch(mpatches.FancyBboxPatch(
            (bar_start, y - 0.025), fill_len, 0.022,
            boxstyle='round,pad=0', facecolor=sc, alpha=0.85,
            transform=ax.transAxes, zorder=3
        ))

        # Score label
        ax.text(bar_start + bar_len + 0.02, y - 0.014,
                f'{int(score)}/100',
                transform=ax.transAxes, color=sc,
                fontsize=9, fontweight='bold', va='center')

        # Evidence text
        if evidence:
            ax.text(bar_start, y - 0.055, evidence[:95],
                    transform=ax.transAxes, color=GRAY,
                    fontsize=7, va='top', style='italic')

        # Separator line
        ax.axhline(y=y - 0.07, xmin=bar_area_left,
                   xmax=bar_area_right,
                   color='#1F2937', linewidth=0.8,
                   transform=ax.transAxes)

    # Verdict box
    vcolor = VERDICT_COLORS.get(verdict, VRIO_COLOR)
    ax.add_patch(mpatches.FancyBboxPatch(
        (0.04, 0.03), 0.92, 0.14,
        boxstyle='round,pad=0.01',
        facecolor='#0D1117', edgecolor=vcolor, linewidth=2,
        transform=ax.transAxes, zorder=4
    ))
    ax.text(0.5, 0.14, verdict,
            transform=ax.transAxes, ha='center', va='top',
            color=vcolor, fontsize=11, fontweight='bold', zorder=5)
    if rationale:
        ax.text(0.5, 0.09, rationale[:120],
                transform=ax.transAxes, ha='center', va='top',
                color=OFF_WHITE, fontsize=8, zorder=5)

    plt.tight_layout()
    result = fig_to_base64(fig)
    logger.info("vrio | render_end | size_bytes=%d", len(result) * 3 // 4)
    return result


if __name__ == '__main__':
    import base64
    sample = {
        'resource_evaluated': 'Fair-Code open architecture + execution-based pricing',
        'valuable':   {'score': 91, 'evidence': 'Directly reduces CAC and enables enterprise self-hosting.'},
        'rare':       {'score': 78, 'evidence': 'No other major automation platform offers fair-code licensing.'},
        'inimitable': {'score': 65, 'evidence': 'Replicating open-source trust requires 3-5 years of community building.'},
        'organised':  {'score': 72, 'evidence': 'Cloud and self-hosted tiers are well-integrated into go-to-market.'},
        'verdict': 'Sustained Competitive Advantage',
        'verdict_rationale': 'The fair-code model is rare, economically valuable, and moderately difficult to replicate within a 24-month horizon.'
    }
    b64 = render(sample)
    with open('/tmp/test_vrio.png', 'wb') as f:
        f.write(base64.b64decode(b64))
    print('Saved /tmp/test_vrio.png')
