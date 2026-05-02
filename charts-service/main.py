"""
VelocityCSO Charts Microservice
FastAPI sidecar on port 8001 — renders strategy charts as base64 PNGs
"""
import os
import sys
import time
import logging
import asyncio
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend — MUST be before any plt import

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ── Logging setup ───────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s  %(name)s | %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger("vcso.charts_service")

# ── Lazy chart renderer imports ─────────────────────────────────────────────────
# Import individually so one broken module doesn't kill the whole service
_renderers: dict[str, Any] = {}

def _load_renderers():
    global _renderers
    modules = [
        ('porter',         'charts.porter',         'render'),
        ('ansoff',         'charts.ansoff',          'render'),
        ('vrio',           'charts.vrio',            'render'),
        ('blue_ocean_canvas', 'charts.blue_ocean',   'render_canvas'),
        ('blue_ocean_errc',   'charts.blue_ocean',   'render_errc'),
        ('wardley',        'charts.wardley',         'render'),
        ('monte_carlo',    'charts.monte_carlo',     'render'),
        ('pestle',         'charts.pestle',          'render'),
        ('unit_economics', 'charts.unit_economics',  'render'),
        ('runway',         'charts.runway',           'render'),
        ('moat_decay',     'charts.moat_decay',       'render'),
    ]
    for name, module_path, fn_name in modules:
        try:
            mod = __import__(module_path, fromlist=[fn_name])
            _renderers[name] = getattr(mod, fn_name)
            logger.info("charts_service | renderer_loaded | chart=%s", name)
        except Exception as e:
            logger.error("charts_service | renderer_load_failed | chart=%s | error=%s", name, str(e))

_load_renderers()

# ── Thread pool for CPU-bound rendering ─────────────────────────────────────────
_executor = ThreadPoolExecutor(max_workers=4)

# ── FastAPI app ──────────────────────────────────────────────────────────────────
app = FastAPI(title="VelocityCSO Charts Service", version="1.0.0")

STARTUP_TIME = time.time()


# ── Request / Response models ────────────────────────────────────────────────────
class ChartRequest(BaseModel):
    session_id: str = ""
    report_id:  str = ""
    charts: dict[str, Any]   # {chart_name: data_dict}


class ChartResponse(BaseModel):
    session_id:  str
    report_id:   str
    images:      dict[str, str]     # {chart_name: base64_png | ""}
    errors:      dict[str, str]     # {chart_name: error_msg} for failed charts
    latency_ms:  int


# ── Health endpoint ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    uptime = round(time.time() - STARTUP_TIME, 1)
    return {
        "status":     "ok",
        "uptime_s":   uptime,
        "renderers":  list(_renderers.keys()),
        "renderer_count": len(_renderers),
    }


# ── Main render endpoint ─────────────────────────────────────────────────────────
@app.post("/charts", response_model=ChartResponse)
async def render_charts(req: ChartRequest, request: Request):
    t_start = time.time()
    session_id = req.session_id or "unknown"
    report_id  = req.report_id  or "unknown"

    logger.info(
        "charts_service | request_start | session_id=%s | report_id=%s | chart_count=%d | charts=%s",
        session_id, report_id, len(req.charts), list(req.charts.keys())
    )

    images: dict[str, str] = {}
    errors: dict[str, str] = {}

    # Render each chart in thread pool (CPU-bound matplotlib work)
    loop = asyncio.get_event_loop()
    tasks = {}
    for chart_name, chart_data in req.charts.items():
        if chart_name not in _renderers:
            logger.warning(
                "charts_service | unknown_chart | session_id=%s | chart=%s",
                session_id, chart_name
            )
            errors[chart_name] = f"No renderer registered for '{chart_name}'"
            continue
        tasks[chart_name] = loop.run_in_executor(
            _executor,
            _render_one,
            chart_name, chart_data, session_id, report_id
        )

    # Gather results (allow individual failures)
    for chart_name, future in tasks.items():
        try:
            b64, err = await asyncio.wait_for(future, timeout=30.0)
            if err:
                errors[chart_name] = err
                images[chart_name] = ""
            else:
                images[chart_name] = b64
        except asyncio.TimeoutError:
            msg = f"Render timed out after 30s"
            logger.error(
                "charts_service | timeout | session_id=%s | report_id=%s | chart=%s",
                session_id, report_id, chart_name
            )
            errors[chart_name] = msg
            images[chart_name] = ""
        except Exception as e:
            msg = f"Unexpected error: {str(e)}"
            logger.error(
                "charts_service | unexpected_error | session_id=%s | chart=%s | error=%s",
                session_id, chart_name, str(e)
            )
            errors[chart_name] = msg
            images[chart_name] = ""

    latency_ms = int((time.time() - t_start) * 1000)
    ok_count   = sum(1 for v in images.values() if v)
    fail_count = len(errors)

    logger.info(
        "charts_service | request_complete | session_id=%s | report_id=%s | "
        "ok=%d | failed=%d | latency_ms=%d",
        session_id, report_id, ok_count, fail_count, latency_ms
    )

    return ChartResponse(
        session_id=session_id,
        report_id=report_id,
        images=images,
        errors=errors,
        latency_ms=latency_ms,
    )


def _render_one(chart_name: str, data: dict, session_id: str, report_id: str) -> tuple[str, str]:
    """
    Runs in thread pool. Returns (base64_png, error_msg).
    error_msg is empty string on success.
    """
    t0 = time.time()
    renderer = _renderers.get(chart_name)
    if not renderer:
        return "", f"No renderer for '{chart_name}'"

    try:
        import matplotlib.pyplot as plt
        plt.close('all')  # prevent figure accumulation across renders

        b64 = renderer(data)

        latency_ms = int((time.time() - t0) * 1000)
        logger.info(
            "charts_service | render_ok | session_id=%s | report_id=%s | "
            "chart=%s | latency_ms=%d | size_bytes=%d",
            session_id, report_id, chart_name, latency_ms, len(b64) * 3 // 4
        )
        return b64, ""

    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000)
        tb = traceback.format_exc()
        logger.error(
            "charts_service | render_failed | session_id=%s | report_id=%s | "
            "chart=%s | latency_ms=%d | error=%s | traceback=%s",
            session_id, report_id, chart_name, latency_ms, str(e), tb.replace('\n', ' ')
        )
        return "", str(e)


# ── Error handler ────────────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("charts_service | unhandled_exception | path=%s | error=%s",
                 request.url.path, str(exc))
    return JSONResponse(status_code=500, content={"detail": str(exc)})


# ── Startup / Shutdown logging ───────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    logger.info(
        "charts_service | startup | renderers_loaded=%d | pid=%d",
        len(_renderers), os.getpid()
    )


@app.on_event("shutdown")
async def on_shutdown():
    logger.info("charts_service | shutdown | uptime_s=%.1f", time.time() - STARTUP_TIME)
    _executor.shutdown(wait=False)


# ── Entrypoint ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        log_level="info",
        access_log=True,
    )
