#!/bin/bash
# ─── Design DNA — Cloud Run Deployment ───────────────────────────────────────
# Usage: ./deploy.sh
# Prerequisites: gcloud CLI installed, Docker running, logged in to GCP
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── Config — edit these ───────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="design-dna-extractor"
REPO_NAME="design-dna"

# ── Derived ───────────────────────────────────────────────────────────────────
IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Design DNA — Deploying to Cloud Run     ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Project:  $PROJECT_ID"
echo "  Region:   $REGION"
echo "  Service:  $SERVICE_NAME"
echo "  Image:    $IMAGE_TAG"
echo ""

# ── 1. Enable required APIs ───────────────────────────────────────────────────
echo "▸ Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  --project "$PROJECT_ID" \
  --quiet

# ── 2. Create Artifact Registry repo (if needed) ──────────────────────────────
echo "▸ Setting up Artifact Registry..."
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || echo "  (repo already exists — continuing)"

# ── 3. Configure Docker auth ──────────────────────────────────────────────────
echo "▸ Configuring Docker authentication..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ── 4. Build Docker image ─────────────────────────────────────────────────────
echo "▸ Building Docker image..."
echo "  (This takes ~2min first time — Playwright image is large)"
docker build \
  --platform linux/amd64 \
  -t "$IMAGE_TAG" \
  ./extractor

# ── 5. Push to Artifact Registry ──────────────────────────────────────────────
echo "▸ Pushing image to Artifact Registry..."
docker push "$IMAGE_TAG"

# ── 6. Deploy to Cloud Run ────────────────────────────────────────────────────
echo "▸ Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_TAG" \
  --platform managed \
  --region "$REGION" \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 5 \
  --max-instances 10 \
  --min-instances 0 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --project "$PROJECT_ID"

# ── 7. Get the service URL ────────────────────────────────────────────────────
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --format 'value(status.url)' \
  --project "$PROJECT_ID")

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✓ Deployed successfully!                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Service URL: $SERVICE_URL"
echo ""
echo "  Add this to your web/.env.local:"
echo ""
echo "    EXTRACTOR_URL=$SERVICE_URL"
echo "    ANTHROPIC_API_KEY=your_api_key_here"
echo ""
echo "  Test the health check:"
echo "    curl $SERVICE_URL/health"
echo ""

# Optional: write to .env.local automatically
if [ -f "web/.env.local" ]; then
  # Update existing EXTRACTOR_URL
  sed -i.bak "s|^EXTRACTOR_URL=.*|EXTRACTOR_URL=$SERVICE_URL|" web/.env.local && rm -f web/.env.local.bak
  echo "  ✓ Updated EXTRACTOR_URL in web/.env.local"
else
  # Create new .env.local
  echo "EXTRACTOR_URL=$SERVICE_URL" > web/.env.local
  echo "ANTHROPIC_API_KEY=your_api_key_here" >> web/.env.local
  echo "  ✓ Created web/.env.local (add your ANTHROPIC_API_KEY)"
fi
