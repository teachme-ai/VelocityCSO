"""
Ansoff Matrix — 2x2 Growth Vector Quadrant
"""
import logging
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from theme import (apply_dark_theme, fig_to_base64, score_color,
                   NAVY, WHITE, OFF_WHITE, GRAY, AMBER, ANSOFF_COLOR)

logger = logging.getLogger("vcso.charts.ansoff")

QUADRANTS = [
    {
        'key': 'market_penetration',
        'label': 'Market\nPenetration',
        'sub': 'Existing Market × Existing Product',
        'pos': (0, 1),  # (col, row) in 2x2 grid
        'color': '#1E3A5F',
    },
    {
        'key': 'market_development',
        'label': 'Market\nDevelopment',
        'sub': 'New Market × Existing Product',
        'pos': (1, 1),
        'color': '#1B3A4B',
    },
    {
        'key': 'product_development',
        'label': 'Product\nDevelopment',
        'sub': 'Existing Market × New Product',
        'pos': (0, 0),
        'color': '#1A2E44',
    },
    {
        'key': 'diversification',
        'label': 'Diversification',
        'sub': 'New Market × New Product',
        'pos': (1, 0),
        'color': '#12243A',
    },
]

VECTOR_KEY_TO_INDEX = {q['key']: i for i, q in enumerate(QUADRANTS)}


def render(data: dict) -> str:
    """
    data: ansoffMatrix object
    {
        market_penetration: {score, rationale, killer_move},
        market_development: {score, rationale, killer_move},
        product_development: {score, rationale, killer_move},
        diversification: {score, rationale, killer_move},
        primary_vector: "market_penetration",
        strategic_verdict: "..."
    }
    """
    apply_dark_theme()
    logger.info("ansoff | render_start | primary_vector=%s", data.get('primary_vector'))

    primary = data.get('primary_vector', '')
    verdict = data.get('strategic_verdict', '')

    fig, ax = plt.subplots(figsize=(11, 8), facecolor=NAVY)
    ax.set_xlim(0, 2)
    ax.set_ylim(0, 2)
    ax.axis('off')
    ax.set_facecolor(NAVY)

    # Axis labels
    ax.text(0.5, -0.05, 'EXISTING PRODUCTS', ha='center', va='top',
            color=GRAY, fontsize=9, transform=ax.transAxes)
    ax.text(1.0, -0.05, 'NEW PRODUCTS', ha='center', va='top',
            color=GRAY, fontsize=9, transform=ax.transAxes)
    ax.text(-0.05, 0.25, 'EXISTING\nMARKETS', ha='right', va='center',
            color=GRAY, fontsize=9, transform=ax.transAxes, rotation=90)
    ax.text(-0.05, 0.75, 'NEW\nMARKETS', ha='right', va='center',
            color=GRAY, fontsize=9, transform=ax.transAxes, rotation=90)

    cell_w, cell_h = 1.0, 1.0

    for q in QUADRANTS:
        col, row = q['pos']
        x = col * cell_w
        y = row * cell_h
        key = q['key']
        entry = data.get(key, {})
        score = entry.get('score', 50) if isinstance(entry, dict) else 50
        rationale = entry.get('rationale', '') if isinstance(entry, dict) else ''
        killer_move = entry.get('killer_move', '') if isinstance(entry, dict) else ''
        sc = score_color(score)
        is_primary = (key == primary)

        # Background rect
        border_color = ANSOFF_COLOR if is_primary else '#1F2937'
        border_w = 3 if is_primary else 1
        rect = mpatches.FancyBboxPatch(
            (x + 0.02, y + 0.02), cell_w - 0.04, cell_h - 0.04,
            boxstyle='round,pad=0.02',
            facecolor=q['color'],
            edgecolor=border_color,
            linewidth=border_w
        )
        ax.add_patch(rect)

        # Primary badge
        if is_primary:
            badge = mpatches.FancyBboxPatch(
                (x + 0.06, y + cell_h - 0.16), 0.32, 0.12,
                boxstyle='round,pad=0.01',
                facecolor=ANSOFF_COLOR, edgecolor='none'
            )
            ax.add_patch(badge)
            ax.text(x + 0.22, y + cell_h - 0.10, 'PRIMARY VECTOR',
                    ha='center', va='center',
                    color=WHITE, fontsize=6, fontweight='bold')

        # Score badge
        ax.add_patch(mpatches.Circle(
            (x + cell_w - 0.15, y + cell_h - 0.15), 0.09,
            facecolor=sc, edgecolor=NAVY, linewidth=1.5, zorder=5
        ))
        ax.text(x + cell_w - 0.15, y + cell_h - 0.15, str(int(score)),
                ha='center', va='center',
                color=WHITE, fontsize=8, fontweight='bold', zorder=6)

        # Quadrant title
        ax.text(x + 0.10, y + cell_h - 0.18, q['label'],
                color=WHITE, fontsize=10, fontweight='bold', va='top')

        # Rationale (truncated)
        if rationale:
            for j, line in enumerate(rationale[:100].split('. ')[:2]):
                ax.text(x + 0.06, y + cell_h - 0.38 - j * 0.13,
                        line.strip()[:58],
                        color=OFF_WHITE, fontsize=7, va='top')

        # Killer move
        if killer_move:
            ax.add_patch(mpatches.FancyBboxPatch(
                (x + 0.04, y + 0.04), cell_w - 0.08, 0.22,
                boxstyle='round,pad=0.01',
                facecolor='#0F2027', edgecolor=sc, linewidth=0.8, alpha=0.9
            ))
            ax.text(x + 0.08, y + 0.20, '→ KILLER MOVE',
                    color=sc, fontsize=6.5, fontweight='bold', va='top')
            ax.text(x + 0.08, y + 0.12, killer_move[:65],
                    color=OFF_WHITE, fontsize=7, va='top')

    # Divider lines
    ax.axvline(x=1.0, color='#374151', linewidth=1.5, linestyle='--', alpha=0.6)
    ax.axhline(y=1.0, color='#374151', linewidth=1.5, linestyle='--', alpha=0.6)

    # Strategic verdict
    if verdict:
        fig.text(0.5, -0.04, f'Strategic Verdict: {verdict[:120]}',
                 ha='center', color=AMBER, fontsize=8.5,
                 style='italic', wrap=True)

    ax.set_title('Ansoff Growth Matrix', color=WHITE,
                 fontsize=13, fontweight='bold', pad=14)
    plt.tight_layout()

    result = fig_to_base64(fig)
    logger.info("ansoff | render_end | size_bytes=%d", len(result) * 3 // 4)
    return result


if __name__ == '__main__':
    import base64
    sample = {
        'market_penetration': {'score': 82, 'rationale': 'Strong existing user base in technical automation segment with room to increase wallet share.', 'killer_move': 'Launch an enterprise onboarding program targeting Zapier power users.'},
        'market_development': {'score': 67, 'rationale': 'Untapped potential in APAC and LATAM enterprise markets.', 'killer_move': 'Open Singapore office, target regional SIs as channel partners.'},
        'product_development': {'score': 55, 'rationale': 'AI-native workflow builder could unlock a new product tier.', 'killer_move': 'Ship n8n AI Nodes as a paid Pro feature within 2 quarters.'},
        'diversification': {'score': 28, 'rationale': 'High risk — limited adjacencies justify diversification at current stage.', 'killer_move': 'Defer until Series B+ capital available.'},
        'primary_vector': 'market_penetration',
        'strategic_verdict': 'Double down on existing market with penetration before expanding geographically — capital efficiency is paramount.'
    }
    b64 = render(sample)
    with open('/tmp/test_ansoff.png', 'wb') as f:
        f.write(base64.b64decode(b64))
    print('Saved /tmp/test_ansoff.png')
