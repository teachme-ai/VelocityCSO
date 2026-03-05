---
name: Live Deployment Pipeline
description: A specialized skill to deploy the application while providing real-time log visibility to the user.
---

# Live Deployment Skill

This skill allows Antigravity to deploy the application and stream the deployment logs directly to the user's terminal, ensuring full visibility of the process.

## How it Works

Instead of running long deployment commands blindly in the background, this skill uses a wrapper script (\`deploy.sh\`) to execute the deployment. 

When you run this skill, you MUST use the \`run_command\` tool to execute the deployment script. The \`run_command\` tool streams standard output (stdout) and standard error (stderr) directly to the Antigravity session, meaning the user can watch the deployment happen in real-time.

## Execution Steps

1.  **Analyze Deployment Requirements:** Determine what type of deployment is needed (e.g., Docker build, npm run build, Google Cloud Run deployment).
2.  **Verify the Script:** Check the contents of \`.agents/skills/deploy_app/deploy.sh\`. If the script needs to be modified for the specific deployment target (e.g., changing the Docker tag or GCP project ID), use \`replace_file_content\` to update it first.
3.  **Run the Deployment:** Execute the deployment script using the \`run_command\` tool:
    \`\`\`json
    {
      "CommandLine": "bash .agents/skills/deploy_app/deploy.sh",
      "Cwd": "/Users/khalidirfan/projects/Business Agent ",
      "SafeToAutoRun": false,
      "WaitMsBeforeAsync": 500
    }
    \`\`\`
    *Note: \`SafeToAutoRun\` is set to \`false\` so the user has to explicitly approve the deployment command before it starts.*
4.  **Monitor Status:** Once the user approves the command, you can use the \`command_status\` tool to monitor its progress in the background if it takes a long time, though the user will already be seeing the logs stream in their interface.

## Example deploy.sh template

By default, the \`deploy.sh\` script should contain the necessary commands. Ensure commands use the \`-v\` (verbose) flags where applicable to maximize output visibility.

\`\`\`bash
#!/bin/bash
# Example Deployment Script

echo "🚀 Starting Deployment Pipeline..."

echo "📦 Building Docker images..."
docker-compose build --no-cache

echo "⬆️ Bringing up services..."
docker-compose up -d

echo "✅ Deployment complete. Fetching live logs..."
docker-compose logs -f --tail=50
\`\`\`
