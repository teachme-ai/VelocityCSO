# Setup Instructions: Google Cloud & GitHub Actions

To enable the CI/CD pipeline, follow these steps to configure Google Cloud and GitHub.

## 1. Google Cloud Configuration

### Artifact Registry
Create a repository named `business-agent-repo` in your target region (e.g., `us-central1`):
```bash
gcloud artifacts repositories create business-agent-repo --repository-format=docker --location=us-central1
```

### Workload Identity Federation (WIF)
1. Create a Workload Identity Pool:
   ```bash
   gcloud iam workload-identity-pools create "github-pool" --location="global" --display-name="GitHub Pool"
   ```
2. Create a Workload Identity Provider:
   ```bash
   gcloud iam workload-identity-pools providers create-oidc "github-provider" \
     --location="global" \
     --workload-identity-pool="github-pool" \
     --display-name="GitHub Provider" \
     --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
     --issuer-uri="https://token.actions.githubusercontent.com"
   ```

### IAM Roles
Grant the following roles to the service account used by WIF:
- `roles/artifactregistry.writer`: To push images to Artifact Registry.
- `roles/run.admin`: To deploy to Cloud Run.
- `roles/iam.serviceAccountUser`: To act as the Cloud Run runtime service account.
- `roles/datastore.user`: To read/write to Firestore.

## 2. GitHub Secrets
Add the following secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

| Secret Name | Description |
| ----------- | ----------- |
| `GCP_PROJECT_ID` | Your Google Cloud Project ID. |
| `GCP_WIF_PROVIDER` | The full name of the WIF provider (e.g., `projects/123/locations/global/workloadIdentityPools/github-pool/providers/github-provider`). |
| `GCP_WIF_SERVICE_ACCOUNT` | The email of the service account configured for WIF (e.g., `github-actions-sa@your-project.iam.gserviceaccount.com`). |

## 3. Firestore
Ensure Firestore is initialized in Native mode in your project.
The application will use the `enterprise_strategy_reports` collection.
