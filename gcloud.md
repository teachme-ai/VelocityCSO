cd ..

# Run this block together
export PROJECT_ID="velocitycso"
export REGION="us-central1"
export SERVICE_NAME="business-strategy-api"
export ARTIFACT_REGISTRY="business-agent-repo"
export IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY}/${SERVICE_NAME}:latest"

gcloud builds submit --tag $IMAGE_NAME .

gcloud run deploy $SERVICE_NAME --image $IMAGE_NAME --region $REGION --allow-unauthenticated
