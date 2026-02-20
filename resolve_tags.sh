#!/bin/bash

# Script to help resolve missing 'environment' tag on Google Cloud projects.
# Usage: ./resolve_tags.sh <PROJECT_ID_OR_NUMBER>

PROJECT=$1
if [ -z "$PROJECT" ]; then
  PROJECT="velocitycso"
fi

echo "--- Resolving tags for project: $PROJECT ---"

# 1. Get Project Parent
echo "Finding project parent for $PROJECT..."
ID_OUTPUT=$(gcloud projects describe "$PROJECT" --format="json" 2>&1)
if [ $? -ne 0 ]; then
  echo "Error running gcloud projects describe:"
  echo "$ID_OUTPUT"
  exit 1
fi

PARENT_ID=$(echo "$ID_OUTPUT" | jq -r '.parent.id // empty')
PARENT_TYPE=$(echo "$ID_OUTPUT" | jq -r '.parent.type // empty')

if [ -z "$PARENT_ID" ]; then
  echo "Warning: Project $PROJECT does not appear to have an organization or folder parent."
  echo "Tags require an organization resource. Checking for accessible organizations..."
  ORG_LIST=$(gcloud organizations list --format="json" 2>/dev/null)
  ORG_COUNT=$(echo "$ORG_LIST" | jq '. | length' 2>/dev/null || echo "0")
  
  if [[ "$ORG_COUNT" -gt 0 ]]; then
    echo "Found $ORG_COUNT organization(s). Using the first one to look for tags."
    PARENT_ID=$(echo "$ORG_LIST" | jq -r '.[0].name' | cut -d'/' -f2)
    PARENT_TYPE="organization"
    PARENT_RESOURCE="organizations/${PARENT_ID}"
  else
    echo "Result: No organizations found."
    echo "---"
    echo "IMPORTANT: Standalone Google Cloud projects (projects not in an organization) do not support Tags."
    echo "The warning you saw from 'gcloud' is likely an informational notice or a result of account-level defaults."
    echo "Since your project is successfully set ('Updated property [core/project]'), you can safely ignore this warning."
    echo "If you absolutely need tags, you would need to create or move this project into a Google Cloud Organization."
    exit 0
  fi
else
  PARENT_RESOURCE="${PARENT_TYPE}s/${PARENT_ID}"
fi

echo "Using resource for tag lookup: $PARENT_RESOURCE"

# 2. List Tag Keys
echo "Looking for 'environment' tag key under $PARENT_RESOURCE..."
TAG_KEYS=$(gcloud resource-manager tags keys list --parent="$PARENT_RESOURCE" --format="json" 2>&1)
if [ $? -ne 0 ]; then
  echo "Error listing tag keys. You might not have permission at the parent level ($PARENT_RESOURCE)."
  echo "Error output:"
  echo "$TAG_KEYS"
  exit 1
fi

# Try to find exactly 'environment'.
ENV_KEY=$(echo "$TAG_KEYS" | jq -r '.[] | select(.shortName == "environment") | .name' | head -n 1)

if [ -z "$ENV_KEY" ] || [ "$ENV_KEY" == "null" ]; then
  echo "Could not find a tag key named 'environment'. Available keys:"
  echo "$TAG_KEYS" | jq -r '.[] | "\(.shortName) (\(.name))"'
  echo ""
  echo "Please enter the tag key ID you want to use (e.g., tagKeys/12345):"
  read -r ENV_KEY
else
  echo "Found 'environment' tag key: $ENV_KEY"
fi

if [ -z "$ENV_KEY" ]; then
  echo "Exiting: No tag key selected."
  exit 1
fi

# 3. List Tag Values
echo "Looking for available values for $ENV_KEY..."
TAG_VALUES=$(gcloud resource-manager tags values list --parent="$ENV_KEY" --format="json" 2>&1)
if [ $? -ne 0 ]; then
  echo "Error listing tag values for $ENV_KEY."
  echo "Error output:"
  echo "$TAG_VALUES"
  exit 1
fi

echo "Available values:"
echo "$TAG_VALUES" | jq -r '.[] | "\(.shortName) (\(.name))"'
echo ""
echo "Enter the value shortName you want to apply (e.g., Production, Development):"
read -r VAL_NAME

ENV_VAL=$(echo "$TAG_VALUES" | jq -r ".[] | select(.shortName == \"$VAL_NAME\") | .name" | head -n 1)

if [ -z "$ENV_VAL" ] || [ "$ENV_VAL" == "null" ]; then
  echo "Could not find tag value for '$VAL_NAME'. Please enter the full tag value ID (e.g., tagValues/67890):"
  read -r ENV_VAL
fi

if [ -z "$ENV_VAL" ]; then
  echo "Exiting: No tag value selected."
  exit 1
fi

# 4. Bind the Tag
echo "Binding $ENV_VAL to project $PROJECT..."
gcloud resource-manager tags bindings create \
  --location="global" \
  --tag-value="$ENV_VAL" \
  --resource="//cloudresourcemanager.googleapis.com/projects/$PROJECT"

echo "Done! verify by running: gcloud config set project $PROJECT"
