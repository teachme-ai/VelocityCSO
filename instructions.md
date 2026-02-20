# Setup Instructions: Google Cloud & GitHub Actions

Follow these steps to configure your Google Cloud project `VelocityCSO` and connect it to GitHub.

## 1. Google Cloud Configuration

### Set Project Context
First, ensure your local gcloud is using the correct project:
```bash
gcloud config set project VelocityCSO
```

### Enable Necessary APIs
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  firestore.googleapis.com
```

### Artifact Registry
Create a repository named `business-agent-repo`:
```bash
gcloud artifacts repositories create business-agent-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker repository for VelocityCSO"
```

### Workload Identity Federation (WIF)
1. Create a Workload Identity Pool:
   ```bash
   gcloud iam workload-identity-pools create "github-pool" \
     --location="global" \
     --display-name="GitHub Pool"
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

### Service Account & IAM Roles
1. Create a service account for GitHub Actions:
   ```bash
   gcloud iam service-accounts create github-actions-sa --display-name="GitHub Actions Service Account"
   ```
2. Bind the WIF provider to the service account:
   ```bash
   gcloud iam service-accounts add-iam-policy-binding github-actions-sa@VelocityCSO.iam.gserviceaccount.com \
     --role="roles/iam.workloadIdentityUser" \
     --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe VelocityCSO --format='get(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/teachme-ai/VelocityCSO"
   ```
3. Grant necessary roles:
   ```bash
   gcloud projects add-iam-policy-binding VelocityCSO --role="roles/artifactregistry.writer" --member="serviceAccount:github-actions-sa@VelocityCSO.iam.gserviceaccount.com"
   gcloud projects add-iam-policy-binding VelocityCSO --role="roles/run.admin" --member="serviceAccount:github-actions-sa@VelocityCSO.iam.gserviceaccount.com"
   gcloud projects add-iam-policy-binding VelocityCSO --role="roles/iam.serviceAccountUser" --member="serviceAccount:github-actions-sa@VelocityCSO.iam.gserviceaccount.com"
   gcloud projects add-iam-policy-binding VelocityCSO --role="roles/datastore.user" --member="serviceAccount:github-actions-sa@VelocityCSO.iam.gserviceaccount.com"
   ```

## 2. GitHub Secrets
Add these secrets to your GitHub repo (`teachme-ai/VelocityCSO`):

| Secret Name | Value |
| ----------- | ----- |
| `GCP_PROJECT_ID` | `VelocityCSO` |
| `GCP_WIF_PROVIDER` | `projects/$(gcloud projects describe VelocityCSO --format='get(projectNumber)')/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_WIF_SERVICE_ACCOUNT` | `github-actions-sa@VelocityCSO.iam.gserviceaccount.com` |

## 3. Firestore
Initialize Firestore in **Native mode** if not already done. The app will use the `enterprise_strategy_reports` collection.
