# Sentinel — Complexity-Aware AI Model Router

Sentinel is a full-stack AI orchestration project that analyzes each prompt, assigns an explainable complexity score, and routes the request to an appropriate model tier.

The portfolio MVP uses:

- **Low complexity:** Gemini 3.5 Flash-Lite
- **Medium complexity:** Gemini 3.8 Flash
- **High complexity:** NVIDIA Nemotron 3 Ultra (free) through OpenRouter
- **Fallback:** Gemini 3.8 Flash if the automatically selected OpenRouter high tier fails

The goal is to demonstrate practical LLM orchestration, provider abstraction, explainable routing, observability, and paid-equivalent cost analysis without requiring paid OpenAI API usage.

## Why this version is intentionally simpler

Sentinel does **not** require Ollama, Docker, n8n, Telegram, Streamlit, or a separate ML training pipeline. The core project is one web app plus one API, with routing logic that can be inspected and evaluated.

## Architecture

```text
Browser / Next.js
       |
       v
FastAPI /api/chat
       |
       v
Complexity analyzer (0-100)
       |
       +-- score < 40 ------> Gemini 3.5 Flash-Lite
       |
       +-- score 40-69 -----> Gemini 3.8 Flash
       |
       +-- score >= 70 -----> OpenRouter
                                |
                                v
                    NVIDIA Nemotron 3 Ultra :free
                                |
                       failure in auto mode
                                v
                        Gemini 3.8 Flash

Every request -> SQLite log -> analytics/history dashboard
```

## Features implemented

- Modern dark full-stack dashboard inspired by AI/SaaS control planes
- Heuristic, explainable prompt complexity scoring from 0–100
- Three routing tiers with configurable thresholds
- Manual provider override for testing
- Gemini REST integration
- OpenRouter REST integration
- NVIDIA Nemotron 3 Ultra free high-complexity tier
- Automatic high-tier fallback to Gemini
- Token, latency, provider, model, tier, and routing-reason logging
- SQLite by default; SQLAlchemy keeps the persistence layer easy to migrate to PostgreSQL
- Request history
- Provider configuration status
- Analytics dashboard
- Paid-equivalent reference-cost and baseline-savings estimates
- FastAPI Swagger docs
- Backend unit tests

## Important cost wording

The Gemini models used by the project have a free developer tier, and the selected OpenRouter Nemotron endpoint is marked free. Sentinel therefore **does not label its dashboard values as your actual bill**.

Instead it records:

- **Reference cost** — a configurable paid-equivalent estimate for the model used
- **Baseline cost** — the configurable estimate if every request were handled by the baseline tier
- **Estimated savings** — baseline minus reference cost

This makes the portfolio claim honest and reproducible. Update the values in `backend/.env` when provider pricing changes.

Pricing/model references checked while this project was rebuilt (2026-09-26):

- Gemini models: https://ai.google.dev/gemini-api/docs/models
- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
- OpenRouter Nemotron 3 Ultra free: https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free
- OpenRouter developer docs: https://openrouter.ai/developers

## Tech stack

### Frontend

- Next.js
- React
- TypeScript
- Recharts
- Lucide icons
- Custom responsive CSS design system

### Backend

- Python
- FastAPI
- Pydantic Settings
- SQLAlchemy
- HTTPX
- SQLite (local default)
- Pytest

### AI providers

- Google Gemini API
- OpenRouter API
- NVIDIA Nemotron 3 Ultra (through OpenRouter)

## Project structure

```text
sentinel-rebuilt/
├── backend/
│   ├── app/
│   │   ├── providers/
│   │   │   ├── base.py
│   │   │   ├── gemini.py
│   │   │   └── openrouter.py
│   │   ├── complexity.py
│   │   ├── config.py
│   │   ├── costs.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── router.py
│   │   └── schemas.py
│   ├── tests/
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── .env.local.example
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
├── setup.ps1
├── run-backend.ps1
├── run-frontend.ps1
└── reset-local-db.ps1
```

## Local setup — Windows / PowerShell

### Prerequisites

Install:

- Python 3.11 or newer
- Node.js 20 or newer
- Git

No Docker is required for the local MVP.

### 1. Open the project root

```powershell
cd D:\Development\Projects\sentinel
```

### 2. Run setup

```powershell
.\setup.ps1
```

This creates the Python virtual environment, installs Python packages, installs frontend packages, creates local env files, and runs backend unit tests.

### 3. Add API keys

Open:

```text
backend/.env
```

Set only these two secret values:

```env
GEMINI_API_KEY=your_google_ai_studio_key
OPENROUTER_API_KEY=your_openrouter_key
```

Do not commit `.env`. The included `.gitignore` excludes it.

The default non-secret model settings are already correct:

```env
GEMINI_LOW_MODEL=gemini-3.5-flash-lite
GEMINI_MEDIUM_MODEL=gemini-3.8-flash
OPENROUTER_HIGH_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
MEDIUM_THRESHOLD=40
HIGH_THRESHOLD=70
DATABASE_URL=sqlite:///./sentinel.db
```

### 4. Start the backend

Terminal 1:

```powershell
.\run-backend.ps1
```

Expected backend URLs:

- API: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs

### 5. Start the frontend

Terminal 2:

```powershell
.\run-frontend.ps1
```

Open:

```text
http://localhost:3000
```

## Suggested routing test prompts

### Low

```text
Rewrite this sentence to be shorter: Artificial intelligence systems are increasingly being used by companies to automate repetitive tasks.
```

Expected: Gemini Flash-Lite.

### Medium

```text
Write a Python function that groups a list of dictionaries by a key and explain the time complexity.
```

Expected: usually Gemini 3.8 Flash.

### High

```text
Design a production-ready architecture for a multi-tenant AI SaaS serving millions of users. Compare database sharding, caching, queue design, failure modes, observability, security trade-offs, and provide a step-by-step migration plan.
```

Expected: OpenRouter / Nemotron 3 Ultra. If the free endpoint is temporarily unavailable, automatic mode falls back to Gemini 3.8 Flash and logs that fallback.

## API

### `POST /api/chat`

```json
{
  "message": "Design a scalable API architecture and explain the trade-offs.",
  "provider": "auto"
}
```

`provider` can be:

- `auto`
- `gemini`
- `openrouter`

### Other endpoints

- `GET /api/health`
- `GET /api/providers`
- `GET /api/history`
- `GET /api/analytics`
- `GET /api/settings`
- `PUT /api/settings`

## Database

Local development uses SQLite:

```env
DATABASE_URL=sqlite:///./sentinel.db
```

For PostgreSQL later:

```env
DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/sentinel
```

The PostgreSQL driver is already listed in `requirements.txt`.

## Testing

Backend:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -q
```

## Resume-safe project description

> Built Sentinel, a full-stack LLM orchestration platform that scores prompt complexity and dynamically routes requests across Gemini and OpenRouter model tiers, with explainable routing decisions, provider fallback, token/latency logging, request history, and paid-equivalent cost analytics.

Avoid claiming a specific cost-reduction percentage until you run an evaluation dataset and calculate it from real logs.

## Future upgrades

Good next upgrades after the MVP is stable:

1. Streaming responses with SSE
2. Authentication and per-user quotas
3. Evaluation dataset for routing quality vs baseline
4. User feedback and adaptive routing
5. Persistent settings in the database
6. Redis caching
7. PostgreSQL deployment
8. Developer API keys / rate limiting
9. Provider/model plug-in registry

## License

Portfolio / educational project. Add your preferred license before public distribution.
