# Design DNA

Extract the complete design system from any website. Use the output to guide Claude when building your next project.

```
URL → Playwright scrapes → Claude analyzes → Design DNA .md file
```

---

## What you get

A dynamic `.md` file that captures — for any website:

- The **aesthetic feel** in plain language
- **Every CSS token** (colors, spacing, radius, shadows, typography scale)
- **Animation system** (exact easing curves, durations, scroll reveal patterns, hover states)
- **Component specs** (nav, hero, cards, buttons — with hover deltas)
- **Tech stack** detection
- **Design rules** (always/never — the constitution of the design)
- **Ready-to-paste CSS tokens** and animation primitives
- **Recreation brief** — a pre-written Claude prompt at the end of every file

---

## Architecture

```
design-dna/
├── extractor/          Node.js + Playwright — deploys to GCP Cloud Run
│   ├── src/
│   │   ├── server.js   Express server (port 8080)
│   │   └── extract.js  Full scraping logic
│   └── Dockerfile      Based on official Playwright image
│
└── web/                Next.js — deploy to Vercel
    ├── app/
    │   ├── page.tsx              Frontend UI (streaming)
    │   └── api/extract/route.ts  Orchestration API route
    └── lib/
        ├── prompt.ts   The Claude prompt (the brain)
        └── types.ts    TypeScript types
```

---

## Setup

### 1. Deploy the Playwright service to GCP Cloud Run

```bash
# Set your project ID
export GCP_PROJECT_ID="your-project-id"

# One command deploys everything
chmod +x deploy.sh
./deploy.sh
```

This will:
- Enable Cloud Run + Artifact Registry APIs
- Build the Docker image (Playwright + Chrome included)
- Push to Artifact Registry
- Deploy to Cloud Run (2GB RAM, 2 CPUs, scales to zero)
- Output the service URL to add to your `.env.local`

**Cost with GCP credits:** ~$0.002 per extraction (basically free)

### 2. Deploy the web app to Vercel

```bash
cd web
npm install

# Add your environment variables
cp .env.example .env.local
# Edit .env.local:
#   EXTRACTOR_URL=https://your-cloud-run-url
#   ANTHROPIC_API_KEY=sk-ant-...

# Deploy
npx vercel deploy
```

Or just connect the `web/` folder to Vercel via GitHub and it auto-deploys.

### 3. Local development

```bash
# Terminal 1 — Run extractor locally (needs Playwright installed)
cd extractor
npm install
npx playwright install chromium
npm run dev

# Terminal 2 — Run web app
cd web
npm install
# Set EXTRACTOR_URL=http://localhost:8080 in .env.local
npm run dev
```

---

## Environment variables

**web/.env.local**
```
EXTRACTOR_URL=https://design-dna-extractor-xxx-uc.a.run.app
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## The workflow

### Step 1 — Extract 3 sites you love

```
https://linear.app        → design-dna-linear.md
https://vercel.com        → design-dna-vercel.md
https://stripe.com        → design-dna-stripe.md
```

### Step 2 — Use with Claude to build something new

Upload all 3 files to Claude and write:

```
I have 3 Design DNA files attached.

I want to build: a SaaS landing page for a developer productivity tool called "Relay".

From linear.md:     use the motion philosophy and animation timing
From vercel.md:     use the color system and dark aesthetic  
From stripe.md:     use the typography hierarchy and section structure

Take the best of all three, improve on them, and build something that feels 
like it belongs alongside these products — but is distinctly its own thing.

Tech: Next.js + Framer Motion + Tailwind
```

Claude reads the ⑬ RECREATION BRIEF from each file and synthesizes a design that combines the influences.

---

## Cost estimates

| Scenario | Claude API | GCP Cloud Run | Total |
|---|---|---|---|
| 1 extraction | ~$0.13 | ~$0.002 | **~$0.13** |
| Full session (3 sites) | ~$0.40 | ~$0.006 | **~$0.41** |
| Personal use (weekly) | ~$2/month | ~$0.10/month | **~$2.10/month** |
| Small SaaS (100 users) | ~$200/month | ~$10/month | **~$210/month** |

Cloud Run scales to zero when idle — you only pay when extracting.

---

## Cloud Run config (in deploy.sh)

| Setting | Value | Why |
|---|---|---|
| Memory | 2Gi | Chrome needs it |
| CPU | 2 | Parallel page operations |
| Timeout | 300s | Complex sites take time |
| Min instances | 0 | Scale to zero (saves credits) |
| Max instances | 10 | Handle concurrent users |
| Concurrency | 5 | Per instance |
