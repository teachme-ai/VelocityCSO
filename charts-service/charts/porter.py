"""
Porter's Five Forces — Pentagon Radar Chart
"""
import logging
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from theme import (apply_dark_theme, fig_to_base64, score_color,
                   NAVY, WHITE, OFF_WHITE, GRAY, ACCENT, RED, GREEN, PORTER_COLOR)

logger = logging.getLogger("vcso.charts.porter")

FORCE_LABELS = [
    'Competitive\nRivalry',
    'Threat of\nNew Entrants',
    'Threat of\nSubstitutes',
    'Buyer\nPower',
    'Supplier\nPower',
]

FORCE_KEYS = [
    'competitive_rivalry',
    'threat_of_new_entrants',
    'threat_of_substitutes',
    'buyer_power',
    'supplier_power',
]


def render(data: dict) -> str:
    """
    data: portersFiveForces object from innovation_frameworks agent
    {
        scores: { competitive_rivalry: {score, primary_driver}, ... },
        structural_attractiveness_score: 62,
        interaction_effect_warning: "..." | null
    }
    Returns base64 PNG string.
    """
    apply_dark_theme()
    logger.info("porter | render_start | keys_present=%s", list(data.keys()))

    scores_raw = data.get('scores', {})
    structural = data.get('structural_attractiveness_score', 50)
    warning = data.get('interaction_effect_warning')

    # Extract scores — each force score is HIGH = BAD (high rivalry = bad for profitability)
    # Invert for display: high radar area = attractive industry
    force_scores = []
    force_drivers = []
    for key in FORCE_KEYS:
        entry = scores_raw.get(key, {})
        raw_score = entry.get('score', 50) if isinstance(entry, dict) else 50
        driver = entry.get('primary_driver', '') if isinstance(entry, dict) else ''
        # Invert: attractiveness = 100 - force_intensity
        force_scores.append(max(0, min(100, 100 - raw_score)))
        force_drivers.append(driver)

    N = len(FORCE_LABELS)
    angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
    angles += angles[:1]  # close polygon

    values = [s / 100 for s in force_scores]
    values += values[:1]

    fig = plt.figure(figsize=(10, 7), facecolor=NAVY)

    # ── Left: Radar Chart ──────────────────────────────────────────────────────
    ax_radar = fig.add_subplot(121, polar=True, facecolor='#111827')
    ax_radar.set_theta_offset(np.pi / 2)
    ax_radar.set_theta_direction(-1)

    # Grid rings
    ax_radar.set_rgrids(
        [0.2, 0.4, 0.6, 0.8, 1.0],
        labels=['20', '40', '60', '80', '100'],
        color=GRAY, size=6, alpha=0.5
    )
    ax_radar.set_ylim(0, 1)
    ax_radar.spines['polar'].set_color('#1F2937')
    ax_radar.grid(color='#1F2937', linewidth=0.5, alpha=0.5)

    # Axis labels
    ax_radar.set_xticks(angles[:-1])
    ax_radar.set_xticklabels(FORCE_LABELS, color=OFF_WHITE, size=8)

    # Fill polygon
    ax_radar.fill(angles, values, color=PORTER_COLOR, alpha=0.2)
    ax_radar.plot(angles, values, color=PORTER_COLOR, linewidth=2)

    # Score dots
    for i, (angle, val) in enumerate(zip(angles[:-1], values[:-1])):
        raw = scores_raw.get(FORCE_KEYS[i], {})
        raw_score = raw.get('score', 50) if isinstance(raw, dict) else 50
        c = score_color(100 - raw_score)  # color based on attractiveness
        ax_radar.plot(angle, val, 'o', color=c, markersize=7, zorder=5)
        ax_radar.annotate(
            f'{int(force_scores[i])}',
            xy=(angle, val),
            xytext=(angle, val + 0.1),
            ha='center', va='center',
            color=WHITE, fontsize=7, fontweight='bold'
        )

    ax_radar.set_title('Five Forces\nAttractiveness', color=WHITE,
                       fontsize=10, fontweight='bold', pad=20)

    # ── Right: Force table ─────────────────────────────────────────────────────
    ax_table = fig.add_subplot(122, facecolor=NAVY)
    ax_table.axis('off')

    # Structural score badge
    sa_color = score_color(structural)
    ax_table.text(0.5, 0.97,
                  f'Structural Attractiveness: {int(structural)}/100',
                  transform=ax_table.transAxes,
                  ha='center', va='top',
                  color=sa_color, fontsize=11, fontweight='bold')

    y = 0.88
    for i, key in enumerate(FORCE_KEYS):
        entry = scores_raw.get(key, {})
        raw_score = entry.get('score', 50) if isinstance(entry, dict) else 50
        driver = force_drivers[i]
        attractiveness = 100 - raw_score
        c = score_color(attractiveness)
        label = FORCE_LABELS[i].replace('\n', ' ')

        # Force name + score
        ax_table.text(0.02, y, f'● {label}',
                      transform=ax_table.transAxes,
                      color=OFF_WHITE, fontsize=9, fontweight='bold', va='top')
        ax_table.text(0.78, y, f'{int(raw_score)}/100',
                      transform=ax_table.transAxes,
                      color=c, fontsize=9, fontweight='bold', va='top', ha='right')

        # Intensity bar
        bar_y = y - 0.025
        bar_w = 0.75
        ax_table.add_patch(mpatches.FancyBboxPatch(
            (0.02, bar_y - 0.01), bar_w, 0.012,
            boxstyle='round,pad=0', facecolor='#1F2937',
            transform=ax_table.transAxes, zorder=2
        ))
        ax_table.add_patch(mpatches.FancyBboxPatch(
            (0.02, bar_y - 0.01), bar_w * (raw_score / 100), 0.012,
            boxstyle='round,pad=0', facecolor=c, alpha=0.8,
            transform=ax_table.transAxes, zorder=3
        ))

        # Driver text
        if driver:
            ax_table.text(0.02, bar_y - 0.018, driver[:70],
                          transform=ax_table.transAxes,
                          color=GRAY, fontsize=7, va='top', style='italic')

        y -= 0.16

    # Warning box
    if warning:
        ax_table.add_patch(mpatches.FancyBboxPatch(
            (0.02, 0.02), 0.96, 0.06,
            boxstyle='round,pad=0.01',
            facecolor='#1F0A00', edgecolor='#F59E0B',
            transform=ax_table.transAxes, zorder=2
        ))
        ax_table.text(0.5, 0.05, f'⚠  {warning[:90]}',
                      transform=ax_table.transAxes,
                      ha='center', va='center',
                      color=AMBER if True else GRAY,
                      fontsize=7.5)

    fig.suptitle("Porter's Five Forces Analysis", color=WHITE,
                 fontsize=13, fontweight='bold', y=1.01)
    plt.tight_layout()

    result = fig_to_base64(fig)
    logger.info("porter | render_end | size_bytes=%d", len(result) * 3 // 4)
    return result


# Allow standalone test
if __name__ == '__main__':
    sample = {
        'scores': {
            'competitive_rivalry':    {'score': 78, 'primary_driver': 'Zapier, Make, and Microsoft Power Automate dominate market share'},
            'threat_of_new_entrants': {'score': 45, 'primary_driver': 'Open-source ecosystem lowers entry barrier for technical challengers'},
            'threat_of_substitutes':  {'score': 38, 'primary_driver': 'Custom code and iPaaS alternatives serve enterprise segment'},
            'buyer_power':            {'score': 62, 'primary_driver': 'Technical buyers have high switching awareness and low lock-in'},
            'supplier_power':         {'score': 25, 'primary_driver': 'API providers have limited leverage given multi-source architecture'},
        },
        'structural_attractiveness_score': 64,
        'interaction_effect_warning': 'High rivalry combined with moderate buyer power creates margin compression risk'
    }
    b64 = render(sample)
    with open('/tmp/test_porter.png', 'wb') as f:
        import base64
        f.write(base64.b64decode(b64))
    print('Saved /tmp/test_porter.png')
