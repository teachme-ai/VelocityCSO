# VelocityCSO Continuous Development Rules

1. **Always maintain Firestore persistence.** The system relies on `/analyze` saving to `enterprise_strategy_reports`. Never bypass or remove this.
2. **All UI updates must follow the Glassmorphism theme.** Use Tailwind utilities like `bg-savvy-glass`, `backdrop-blur-md`, and custom gradients (`savvy-purple`, `savvy-green`, `savvy-gold`). Maintain the "executive command center" aesthetic.
3. **Every feature must be verified via a Video Artifact before deployment.** Use the browser subagent to record interactions and verify visual correctness before proposing any deployment changes.
