"""
Wardley Map — Scatter plot with dependency arrows
X: Evolution (Genesis → Custom → Product → Commodity)
Y: Value Chain Position (Visible/User-facing → Invisible/Infrastructure)
"""
import logging
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.patheffects as pe
try:
    import networkx as nx
    HAS_NX = True
except ImportError:
    HAS_NX = False
    logging.getLogger("vcso.charts.wardley").warning(
        "networkx not available — dependency arrows disabled"
    )

from theme import (apply_dark_theme, fig_to_base64,
                   NAVY, WHITE, OFF_WHITE, GRAY, WARDLEY_COLOR, INDIGO,
                   AMBER, GREEN, RED, TEAL)

logger = logging.getLogger("vcso.charts.wardley")

EVOLUTION_STAGES = ['Genesis', 'Custom Built', 'Product', 'Commodity']
EVOLUTION_BOUNDARIES = [0, 25, 50, 75, 100]


def render(data: dict) -> str:
    """
    data: wardley object
    {
        capabilities: [
            {id, name, evolution (0-100), value_chain_position (0-100),
             is_differentiator, will_commoditize_in_18m,
             build_buy_partner, dependency_ids}
        ],
        strategic_warnings: [...],
        build_buy_decisions: [{capability, recommendation, rationale}],
        core_differentiators: [...]
    }
    """
    apply_dark_theme()
    capabilities = data.get('capabilities', [])
    warnings = data.get('strategic_warnings', [])
    core_diff = data.get('core_differentiators', [])

    logger.info("wardley | render_start | capabilities=%d | warnings=%d",
                len(capabilities), len(warnings))

    if not capabilities:
        logger.warning("wardley | no_capabilities | rendering empty state")

    fig, ax = plt.subplots(figsize=(13, 8), facecolor=NAVY)
    ax.set_facecolor('#0B1120')

    # ── Axes setup ─────────────────────────────────────────────────────────────
    ax.set_xlim(-2, 102)
    ax.set_ylim(-5, 105)
    ax.set_xlabel('Evolution →', color=GRAY, fontsize=9)
    ax.set_ylabel('← Value Chain Position (Visible at top)', color=GRAY, fontsize=9)
    ax.tick_params(colors=GRAY, labelsize=7)
    ax.spines['bottom'].set_color('#1F2937')
    ax.spines['left'].set_color('#1F2937')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    # Evolution stage bands
    stage_colors = ['#0D1117', '#0F1318', '#0E1420', '#0D1420']
    for i, (x_start, x_end) in enumerate(zip(EVOLUTION_BOUNDARIES[:-1], EVOLUTION_BOUNDARIES[1:])):
        ax.axvspan(x_start, x_end, facecolor=stage_colors[i], alpha=0.4, zorder=0)
        ax.text((x_start + x_end) / 2, -3.5,
                EVOLUTION_STAGES[i],
                ha='center', color=GRAY, fontsize=7.5, style='italic')

    # Stage dividers
    for x in EVOLUTION_BOUNDARIES[1:-1]:
        ax.axvline(x=x, color='#1F2937', linewidth=0.8, linestyle=':', alpha=0.6)

    # Horizontal value chain reference lines
    ax.axhline(y=50, color='#1F2937', linewidth=0.5, linestyle='--', alpha=0.4)
    ax.text(-1.5, 97, 'User\nVisible', color=GRAY, fontsize=7, ha='right', va='top')
    ax.text(-1.5, 3,  'Infrastructure', color=GRAY, fontsize=7, ha='right', va='bottom')

    # ── Build capability lookup ────────────────────────────────────────────────
    cap_by_id = {c.get('id', c.get('name', '')): c for c in capabilities}

    # ── Draw dependency arrows ─────────────────────────────────────────────────
    for cap in capabilities:
        x1 = cap.get('evolution', 50)
        y1 = cap.get('value_chain_position', 50)
        for dep_id in (cap.get('dependency_ids') or []):
            dep = cap_by_id.get(dep_id)
            if dep:
                x2 = dep.get('evolution', 50)
                y2 = dep.get('value_chain_position', 50)
                ax.annotate('',
                    xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(
                        arrowstyle='->', color='#374151',
                        lw=1.2, connectionstyle='arc3,rad=0.1'
                    ), zorder=2
                )

    # ── Draw capability nodes ──────────────────────────────────────────────────
    for cap in capabilities:
        x = cap.get('evolution', 50)
        y = cap.get('value_chain_position', 50)
        name = cap.get('name', 'Unknown')
        is_diff = cap.get('is_differentiator', False)
        will_comm = cap.get('will_commoditize_in_18m', False)
        bbp = cap.get('build_buy_partner', 'build')

        # Node color
        if is_diff:
            color = TEAL
            size = 120
        elif will_comm:
            color = AMBER
            size = 80
        else:
            color = WARDLEY_COLOR
            size = 70

        # Node shape: differentiator = star, commoditize = diamond, else circle
        marker = '*' if is_diff else ('D' if will_comm else 'o')
        edge = WHITE if is_diff else '#374151'

        scatter = ax.scatter(x, y, s=size, c=color, marker=marker,
                             edgecolors=edge, linewidths=1.2,
                             zorder=5, alpha=0.9)

        # Commoditize indicator — dashed circle
        if will_comm:
            circle = plt.Circle((x, y), 4.5, fill=False,
                                 edgecolor=AMBER, linestyle='--',
                                 linewidth=1.0, alpha=0.6, zorder=4)
            ax.add_patch(circle)

        # Label — offset to avoid overlap
        offset_y = 3.5 if y < 90 else -5
        ax.text(x, y + offset_y, name[:22],
                ha='center', va='bottom' if y < 90 else 'top',
                color=WHITE if is_diff else OFF_WHITE,
                fontsize=7, fontweight='bold' if is_diff else 'normal',
                path_effects=[pe.withStroke(linewidth=2, foreground='#0B1120')],
                zorder=6)

        # Build/Buy badge
        if bbp and bbp != 'build':
            ax.text(x, y - 5, bbp[:3].upper(),
                    ha='center', va='top',
                    color=AMBER, fontsize=5.5, fontweight='bold',
                    zorder=7)

    # ── Legend ─────────────────────────────────────────────────────────────────
    legend_elements = [
        mpatches.Patch(facecolor=TEAL, label='Core Differentiator'),
        mpatches.Patch(facecolor=AMBER, label='Commoditizing in 18m'),
        mpatches.Patch(facecolor=WARDLEY_COLOR, label='Standard Capability'),
    ]
    ax.legend(handles=legend_elements, loc='upper right',
              framealpha=0.3, fontsize=7)

    # ── Strategic warnings ─────────────────────────────────────────────────────
    if warnings:
        warning_text = '  |  '.join(f'⚠ {w}' for w in warnings[:3])
        fig.text(0.5, -0.04, warning_text[:160],
                 ha='center', color=AMBER, fontsize=7.5, style='italic')

    ax.set_title('Wardley Capability Map', color=WHITE,
                 fontsize=13, fontweight='bold', pad=14)
    plt.tight_layout()

    result = fig_to_base64(fig)
    logger.info("wardley | render_end | size_bytes=%d", len(result) * 3 // 4)
    return result


if __name__ == '__main__':
    import base64
    sample = {
        'capabilities': [
            {'id': 'c1', 'name': 'Workflow Engine',      'evolution': 55, 'value_chain_position': 85, 'is_differentiator': True,  'will_commoditize_in_18m': False, 'build_buy_partner': 'build',   'dependency_ids': ['c4', 'c5']},
            {'id': 'c2', 'name': 'Fair-Code License',    'evolution': 20, 'value_chain_position': 95, 'is_differentiator': True,  'will_commoditize_in_18m': False, 'build_buy_partner': 'build',   'dependency_ids': []},
            {'id': 'c3', 'name': 'AI Nodes',             'evolution': 15, 'value_chain_position': 80, 'is_differentiator': True,  'will_commoditize_in_18m': False, 'build_buy_partner': 'build',   'dependency_ids': ['c1']},
            {'id': 'c4', 'name': 'Node Integrations',    'evolution': 70, 'value_chain_position': 60, 'is_differentiator': False, 'will_commoditize_in_18m': True,  'build_buy_partner': 'partner', 'dependency_ids': []},
            {'id': 'c5', 'name': 'Self-Hosting Infra',   'evolution': 65, 'value_chain_position': 30, 'is_differentiator': False, 'will_commoditize_in_18m': True,  'build_buy_partner': 'buy',     'dependency_ids': []},
            {'id': 'c6', 'name': 'Cloud Hosting',        'evolution': 80, 'value_chain_position': 20, 'is_differentiator': False, 'will_commoditize_in_18m': False, 'build_buy_partner': 'buy',     'dependency_ids': []},
            {'id': 'c7', 'name': 'Community & Docs',     'evolution': 40, 'value_chain_position': 75, 'is_differentiator': True,  'will_commoditize_in_18m': False, 'build_buy_partner': 'build',   'dependency_ids': []},
        ],
        'strategic_warnings': [
            'Node Integrations approaching commodity — differentiation window closing',
            'Self-Hosting Infra dependency creates scaling bottleneck'
        ],
        'core_differentiators': ['Workflow Engine', 'Fair-Code License', 'AI Nodes'],
    }
    b64 = render(sample)
    with open('/tmp/test_wardley.png', 'wb') as f:
        f.write(base64.b64decode(b64))
    print('Saved /tmp/test_wardley.png')
