"""
VelocityCSO Chart Theme
Shared color palette, figure defaults, and utilities.
Matches the existing PDF color system exactly.
"""
import io
import base64
import logging
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend — required for server-side rendering
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

logger = logging.getLogger("vcso.theme")

# ── Color Palette (mirrors pdfService.ts) ─────────────────────────────────────
NAVY    = '#0D1B2A'
BLUE    = '#1B4F8A'
ACCENT  = '#2563EB'
VIOLET  = '#7C3AED'
GRAY    = '#6B7280'
GRAY_DIM= '#374151'
WHITE   = '#FFFFFF'
OFF_WHITE = '#E5E7EB'
RED     = '#DC2626'
GREEN   = '#16A34A'
AMBER   = '#F59E0B'
TEAL    = '#0D9488'
INDIGO  = '#4F46E5'

# Framework-specific accents
PORTER_COLOR  = ACCENT    # Blue — competitive analysis
ANSOFF_COLOR  = AMBER     # Amber — growth vectors
VRIO_COLOR    = VIOLET    # Violet — resource analysis
BLUE_OCEAN_COLOR = TEAL   # Teal — market creation
WARDLEY_COLOR = INDIGO    # Indigo — capability mapping
MONTE_COLOR   = '#10B981' # Emerald — financial simulation
PESTLE_COLOR  = '#6366F1' # Indigo-violet — macro environment
UNIT_ECO_COLOR = AMBER    # Amber — financial metrics

# ── Score Color Logic ─────────────────────────────────────────────────────────
def score_color(score: float) -> str:
    """Returns RAG color for a 0-100 score."""
    if score >= 70:
        return GREEN
    elif score >= 40:
        return BLUE
    return RED

def score_label(score: float) -> str:
    if score >= 70:
        return 'Healthy'
    elif score >= 40:
        return 'Developing'
    return 'Critical'

# ── Figure Defaults ───────────────────────────────────────────────────────────
def apply_dark_theme():
    """Apply VelocityCSO dark theme to all matplotlib figures."""
    plt.rcParams.update({
        'figure.facecolor':  NAVY,
        'axes.facecolor':    '#111827',
        'axes.edgecolor':    '#1F2937',
        'axes.labelcolor':   OFF_WHITE,
        'axes.titlecolor':   WHITE,
        'xtick.color':       GRAY,
        'ytick.color':       GRAY,
        'text.color':        OFF_WHITE,
        'grid.color':        '#1F2937',
        'grid.alpha':        0.5,
        'grid.linewidth':    0.5,
        'figure.dpi':        150,
        'savefig.dpi':       150,
        'savefig.facecolor': NAVY,
        'savefig.bbox':      'tight',
        'savefig.pad_inches': 0.2,
        'font.size':         9,
        'axes.titlesize':    11,
        'axes.labelsize':    9,
        'legend.fontsize':   8,
        'legend.facecolor':  '#1F2937',
        'legend.edgecolor':  '#374151',
        'legend.labelcolor': OFF_WHITE,
    })

apply_dark_theme()

# ── Section Header Helper ─────────────────────────────────────────────────────
def draw_section_title(ax, title: str, subtitle: str = '', color: str = ACCENT):
    """Draw a consistent section title at top of axes."""
    ax.set_title(title, color=WHITE, fontsize=12, fontweight='bold',
                 loc='left', pad=12)
    if subtitle:
        ax.text(0, 1.02, subtitle, transform=ax.transAxes,
                color=GRAY, fontsize=8, va='bottom')

# ── PNG Export ────────────────────────────────────────────────────────────────
def fig_to_base64(fig) -> str:
    """Convert matplotlib figure to base64-encoded PNG string."""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', facecolor=NAVY,
                bbox_inches='tight', pad_inches=0.2)
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode('utf-8')
    buf.close()
    plt.close(fig)
    return b64

def fig_to_bytes(fig) -> bytes:
    """Convert matplotlib figure to raw PNG bytes."""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', facecolor=NAVY,
                bbox_inches='tight', pad_inches=0.2)
    buf.seek(0)
    data = buf.read()
    buf.close()
    plt.close(fig)
    return data
