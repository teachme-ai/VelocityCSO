Fetch and analyse the latest Cloud Run logs for the VelocityCSO `business-strategy-api` service, then produce a structured run report.

## Step 1 — Fetch logs

Run this bash command. Use `$ARGUMENTS` as the lookback window in minutes (default 15 if empty):

```bash
MINUTES="${ARGUMENTS:-15}"
SINCE=$(date -u -v-${MINUTES}M +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u --date="${MINUTES} minutes ago" +"%Y-%m-%dT%H:%M:%SZ")

gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"business-strategy-api\" AND timestamp>=\"${SINCE}\"" \
  --project velocitycso \
  --limit 300 \
  --format='json' \
  --order asc \
  --freshness 1h \
  2>&1
```

If no logs are returned, double the window to 30 minutes and retry automatically.

## Step 2 — Produce a Run Analysis Report

Parse the JSON log entries and output a clean report with these sections:

### ✅ Pipeline Status
List every agent that completed, in phase order, with latency_ms. State whether the full pipeline ran end-to-end.

### ⚠️ Errors & Warnings
For every ERROR or WARNING log entry:
- Agent name
- Message
- Classify: `TRUNCATION` (hit token cap) | `ESCAPE` (unescaped chars in JSON) | `API_FAILURE` | `PARSE_RECOVERED` | `OTHER`
- Whether it was recovered or caused a fallback-to-50s

### 📊 Token Usage Table
Build a table from all `Token usage [model]` entries:

| Agent | Model | Input tokens | Output tokens | Latency (ms) |
|-------|-------|-------------|---------------|-------------|
| ...   | ...   | ...         | ...           | ...         |
| **TOTAL** | | | | |

### 💰 Cost Summary
List each agent's `cost_usd` and total audit cost. Flag anything unexpectedly expensive.

### 🏁 Conclusion
One paragraph: overall health, any blocking issues, and the single most important thing to fix next.
