"""
Blue Ocean Analysis — Strategy Canvas + ERRC Grid
Rendered with Plotly + kaleido for crisp, publication-quality PDF output.
Returns two base64 PNG strings: render_canvas() and render_errc().
"""
import logging
import base64
import textwrap
import plotly.graph_objects as go

logger = logging.getLogger("vcso.charts.blue_ocean")

# ── Color palette (mirrors theme.py / pdfService.ts) ─────────────────────────
NAVY        = '#0D1B2A'
DARK_CARD   = '#111827'
BORDER      = '#1F2937'
WHITE       = '#FFFFFF'
OFF_WHITE   = '#E5E7EB'
GRAY        = '#9CA3AF'
TEAL        = '#0D9488'
TEAL_LIGHT  = '#14B8A6'

ERRC_COLORS = {
    'eliminate': '#DC2626',
    'reduce':    '#F59E0B',
    'raise':     '#2563EB',
    'create':    '#16A34A',
}
ERRC_LABELS = {
    'eliminate': '✕  ELIMINATE',
    'reduce':    '↓  REDUCE',
    'raise':     '↑  RAISE',
    'create':    '★  CREATE',
}

# Competitor line styles
COMP_COLORS = ['#6B7280', '#9CA3AF', '#D1D5DB']
COMP_DASH   = ['dash', 'dot', 'dashdot']


def _fig_to_base64(fig: go.Figure, width: int, height: int) -> str:
    """Export Plotly figure to base64 PNG at 2× scale for crisp PDF embedding."""
    img_bytes = fig.to_image(format='png', width=width, height=height, scale=2)
    return base64.b64encode(img_bytes).decode('utf-8')


def render_canvas(data: dict) -> str:
    """
    Strategy Canvas: multi-line Plotly chart — your business vs competitors
    across industry factors, with score labels on markers.
    """
    factors    = data.get('industry_factors', [])
    comp_names = data.get('competitor_names', ['Competitor 1', 'Competitor 2'])
    title      = data.get('strategic_canvas_title', 'Strategic Canvas')
    opportunity = data.get('blue_ocean_opportunity', '')

    logger.info("blue_ocean_canvas | render_start | factors=%d | competitors=%s",
                len(factors), comp_names)

    factor_names = [f.get('name', f'Factor {i+1}') for i, f in enumerate(factors)]
    biz_scores   = [f.get('businessScore', 5)     for f in factors]
    comp_scores  = [[f.get('competitor1Score', 5)  for f in factors],
                    [f.get('competitor2Score', 5)  for f in factors]]
    importance   = [f.get('customerImportance', 5) for f in factors]

    fig = go.Figure()

    # ── Customer Importance bars (background, very subtle) ───────────────────
    if factor_names:
        fig.add_trace(go.Bar(
            x=factor_names,
            y=importance,
            name='Customer Importance',
            marker_color=TEAL,
            opacity=0.10,
            hovertemplate='%{x}<br>Importance: %{y}<extra></extra>',
        ))

    # ── Competitor lines ──────────────────────────────────────────────────────
    for idx, scores in enumerate(comp_scores):
        name = comp_names[idx] if idx < len(comp_names) else f'Competitor {idx+1}'
        fig.add_trace(go.Scatter(
            x=factor_names,
            y=scores,
            mode='lines+markers',
            name=name,
            line=dict(color=COMP_COLORS[idx], width=1.8, dash=COMP_DASH[idx]),
            marker=dict(size=7, symbol='circle'),
            opacity=0.75,
            hovertemplate=f'{name}<br>%{{x}}: %{{y}}<extra></extra>',
        ))

    # ── Your Business — bold teal, with score labels on markers ──────────────
    if factor_names:
        fig.add_trace(go.Scatter(
            x=factor_names,
            y=biz_scores,
            mode='lines+markers+text',
            name='Your Business',
            line=dict(color=TEAL_LIGHT, width=3),
            marker=dict(size=10, symbol='diamond', color=TEAL_LIGHT,
                        line=dict(color=WHITE, width=1)),
            text=[str(s) for s in biz_scores],
            textposition='top center',
            textfont=dict(color=TEAL_LIGHT, size=10, family='Arial Black'),
            hovertemplate='Your Business<br>%{x}: %{y}<extra></extra>',
            zorder=5,
        ))

        # ── Fill: advantage (above avg competitor) ────────────────────────────
        if len(comp_scores[0]) == len(biz_scores):
            avg_comp = [(c1 + c2) / 2 for c1, c2 in zip(comp_scores[0], comp_scores[1])]
            fig.add_trace(go.Scatter(
                x=factor_names + factor_names[::-1],
                y=biz_scores + avg_comp[::-1],
                fill='toself',
                fillcolor='rgba(13,148,136,0.12)',
                line=dict(color='rgba(0,0,0,0)'),
                showlegend=False,
                hoverinfo='skip',
                name='_advantage_fill',
            ))

    # ── Layout ────────────────────────────────────────────────────────────────
    subtitle = f'<i style="color:{TEAL};font-size:11px">{opportunity[:160]}</i>' if opportunity else ''

    fig.update_layout(
        title=dict(
            text=f'<b>{title}</b><br>{subtitle}',
            font=dict(color=WHITE, size=14, family='Arial'),
            x=0.5, xanchor='center',
            pad=dict(b=10),
        ),
        paper_bgcolor=NAVY,
        plot_bgcolor=DARK_CARD,
        font=dict(color=OFF_WHITE, family='Arial', size=10),
        legend=dict(
            bgcolor='rgba(31,41,55,0.85)',
            bordercolor=BORDER,
            borderwidth=1,
            font=dict(color=OFF_WHITE, size=10),
            orientation='h',
            yanchor='bottom', y=-0.28,
            xanchor='center', x=0.5,
        ),
        xaxis=dict(
            tickangle=-35,
            tickfont=dict(color=OFF_WHITE, size=10),
            gridcolor=BORDER,
            linecolor=BORDER,
            showgrid=False,
        ),
        yaxis=dict(
            range=[0, 11],
            dtick=2,
            tickfont=dict(color=GRAY, size=9),
            gridcolor=BORDER,
            gridwidth=0.5,
            title=dict(text='Score (0–10)', font=dict(color=GRAY, size=10)),
        ),
        margin=dict(l=50, r=30, t=90, b=100),
        barmode='overlay',
        hovermode='x unified',
    )

    result = _fig_to_base64(fig, width=1100, height=520)
    logger.info("blue_ocean_canvas | render_end | size_bytes=%d", len(result) * 3 // 4)
    return result


def render_errc(data: dict) -> str:
    """
    ERRC Grid: 4-column table using Plotly subplots.
    Each column is a proper go.Table with colored header + word-wrapped rows.
    """
    errc        = data.get('errc_grid', {})
    value_curve = data.get('value_curve_summary', '')

    eliminate = errc.get('eliminate', [])
    reduce    = errc.get('reduce', [])
    raise_    = errc.get('raise', [])
    create    = errc.get('create', [])

    logger.info("blue_ocean_errc | render_start | E=%d R=%d R=%d C=%d",
                len(eliminate), len(reduce), len(raise_), len(create))

    sections = [
        ('eliminate', eliminate),
        ('reduce',    reduce),
        ('raise',     raise_),
        ('create',    create),
    ]

    LINE_HEIGHT = 20   # px per text line in a cell
    ROW_PADDING = 14   # vertical padding per cell

    def wrap_items(items: list) -> list:
        """Word-wrap each item to ~28 chars — fits column at 1100px/4 cols."""
        result = []
        for item in items:
            wrapped = '\n'.join(textwrap.wrap(str(item), width=28))
            result.append(wrapped)
        return result

    # Pad all columns to equal length for the combined table
    max_rows = max(len(eliminate), len(reduce), len(raise_), len(create), 1)

    def pad(lst, length):
        return lst + [''] * (length - len(lst))

    col_data = {key: pad(wrap_items(items), max_rows)
                for key, items in sections}

    # Uniform cell height = tallest wrapped item across all cells
    all_cols = [col_data['eliminate'], col_data['reduce'], col_data['raise'], col_data['create']]
    max_lines_any = max(
        (len(cell.split('\n')) for col in all_cols for cell in col if cell),
        default=1
    )
    cell_height = max_lines_any * LINE_HEIGHT + ROW_PADDING

    # ── Single unified go.Table ───────────────────────────────────────────────
    header_colors = [ERRC_COLORS[k] for k in ['eliminate', 'reduce', 'raise', 'create']]
    header_labels = [ERRC_LABELS[k] for k in ['eliminate', 'reduce', 'raise', 'create']]

    row_fill = [[DARK_CARD if i % 2 == 0 else '#161E2D' for i in range(max_rows)]] * 4

    fig = go.Figure(data=[go.Table(
        columnwidth=[1, 1, 1, 1],
        header=dict(
            values=[f'<b>{label}</b>' for label in header_labels],
            fill_color=header_colors,
            font=dict(color=WHITE, size=12, family='Arial Black'),
            align='center',
            height=44,
            line=dict(color=BORDER, width=1),
        ),
        cells=dict(
            values=[
                col_data['eliminate'],
                col_data['reduce'],
                col_data['raise'],
                col_data['create'],
            ],
            fill_color=row_fill,
            font=dict(color=OFF_WHITE, size=11, family='Arial'),
            align='center',
            height=cell_height,
            line=dict(color=BORDER, width=0.5),
        ),
    )])

    # ── Layout ────────────────────────────────────────────────────────────────
    vc_text = f'<i>{value_curve[:180]}</i>' if value_curve else ''
    fig.update_layout(
        title=dict(
            text=f'<b>Blue Ocean ERRC Grid</b><br><span style="color:{TEAL};font-size:11px">{vc_text}</span>',
            font=dict(color=WHITE, size=14, family='Arial'),
            x=0.5, xanchor='center',
        ),
        paper_bgcolor=NAVY,
        font=dict(color=OFF_WHITE, family='Arial'),
        margin=dict(l=20, r=20, t=80, b=30),
    )

    total_height = max(360, max_rows * cell_height + 44 + 110)  # rows + header + title/margin
    result = _fig_to_base64(fig, width=1100, height=total_height)
    logger.info("blue_ocean_errc | render_end | size_bytes=%d", len(result) * 3 // 4)
    return result


if __name__ == '__main__':
    sample = {
        'competitor_names': ['Zapier', 'Make'],
        'industry_factors': [
            {'name': 'Ease of Setup',     'businessScore': 6, 'competitor1Score': 9, 'competitor2Score': 7, 'customerImportance': 8},
            {'name': 'Execution Pricing', 'businessScore': 9, 'competitor1Score': 3, 'competitor2Score': 5, 'customerImportance': 9},
            {'name': 'Self-Hosting',      'businessScore': 10,'competitor1Score': 0, 'competitor2Score': 0, 'customerImportance': 7},
            {'name': 'Custom Code',       'businessScore': 9, 'competitor1Score': 3, 'competitor2Score': 6, 'customerImportance': 6},
            {'name': 'App Integrations',  'businessScore': 7, 'competitor1Score': 10,'competitor2Score': 8, 'customerImportance': 8},
            {'name': 'AI Capabilities',   'businessScore': 7, 'competitor1Score': 6, 'competitor2Score': 5, 'customerImportance': 9},
        ],
        'errc_grid': {
            'eliminate': ['Per-task pricing anxiety', 'Vendor lock-in via proprietary format'],
            'reduce':    ['UI complexity for non-technical users', 'Time-to-first-workflow'],
            'raise':     ['Data privacy & sovereignty', 'Developer experience', 'Enterprise scalability'],
            'create':    ['Fair-code community trust', 'AI-native workflow nodes', 'Self-hosted cloud hybrid'],
        },
        'value_curve_summary': 'n8n differentiates sharply on execution pricing and sovereignty while accepting lower ease-of-setup vs Zapier.',
        'blue_ocean_opportunity': 'A self-hosted AI automation tier capturing enterprise teams priced out of Zapier Teams.',
        'strategic_canvas_title': 'n8n Strategic Canvas vs Zapier & Make',
    }
    b64_canvas = render_canvas(sample)
    b64_errc   = render_errc(sample)
    with open('/tmp/test_blue_ocean_canvas.png', 'wb') as f:
        f.write(base64.b64decode(b64_canvas))
    with open('/tmp/test_blue_ocean_errc.png', 'wb') as f:
        f.write(base64.b64decode(b64_errc))
    print('Saved /tmp/test_blue_ocean_canvas.png and /tmp/test_blue_ocean_errc.png')
