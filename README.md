# PersonaLens

PersonaLens is a two-service project:
- `backend/`: FastAPI + SQLAlchemy + Alembic + Supabase Postgres + OpenAI evaluation + Supabase Auth token validation
- `frontend/`: Next.js (TypeScript, App Router, Tailwind)

## What We Implemented

1. Backend validates Supabase access tokens for protected routes.
2. Core data routes are protected (`/personas`, `/evaluate`, `/evaluations`).
3. Database is on Supabase Postgres with Alembic migrations.
4. AI evaluation is real (OpenAI call) and persisted in DB.
5. Upload files are currently saved locally in `backend/uploads`.

## Install First

1. Python 3.11+ (tested on 3.14)
2. Node.js 18+ (tested on 24)
3. npm
4. Supabase project (DB + Auth)
5. OpenAI API key

## 1) Configure Supabase + Env

Set `backend/.env` with:

```env
CORS_ORIGINS=http://localhost:3000
DATABASE_URL=postgresql://postgres.<project_ref>:<URL_ENCODED_DB_PASSWORD>@<region-pooler-host>.pooler.supabase.com:6543/postgres?sslmode=require
UPLOAD_DIR=./uploads

OPENAI_API_KEY=your_key_here
MODEL_NAME=gpt-4o-mini

AUTH_PROVIDER=supabase
SUPABASE_URL=https://<project_ref>.supabase.co
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
SUPABASE_JWT_AUDIENCE=authenticated
```

Use the exact `DATABASE_URL` shown in Supabase Dashboard:
`Project Settings -> Database -> Connect -> Transaction pooler`.
Do not use the direct host (`db.<project_ref>.supabase.co`) if your network is IPv4-only.
For this current project (`feiaiuiqzqfrjcgkemrt`), the validated pooler host is `aws-1-us-east-1.pooler.supabase.com`.

If DB password has special characters (`@`, `#`, `:`, `/`, etc.), URL-encode first:

```bash
python -c "import urllib.parse; print(urllib.parse.quote_plus('YOUR_DB_PASSWORD'))"
```

## 2) Backend Setup

PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Git Bash:

```bash
cd "/c/Users/Bharg/OneDrive/Documents/HCI capstone/PersonaLens/backend"
python -m venv .venv
source .venv/Scripts/activate
python -m pip install -r requirements.txt
```

Run migrations:

```bash
alembic upgrade head
```

## 3) Frontend Setup

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## 4) Run Backend

PowerShell:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --reload-dir app --port 8000
```

Git Bash:

```bash
cd "/c/Users/Bharg/OneDrive/Documents/HCI capstone/PersonaLens/backend"
source .venv/Scripts/activate
python -m uvicorn app.main:app --reload --reload-dir app --port 8000
```

## 5) Run Frontend

```powershell
cd frontend
npm run dev -- --port 3000
```

## 6) Backend API (Current)

Public:
- `GET /health`
- `POST /auth/register` (returns error when `AUTH_PROVIDER=supabase`)
- `POST /auth/login` (returns error when `AUTH_PROVIDER=supabase`)
- `POST /auth/refresh` (returns error when `AUTH_PROVIDER=supabase`)

Protected:
- `GET /auth/me`
- `GET /personas`
- `POST /personas`
- `POST /evaluate`
- `GET /evaluations`

All protected calls require:

```http
Authorization: Bearer <supabase_access_token>
```

## 7) Supabase Auth Usage

Sign in with Supabase Auth (frontend SDK or Supabase auth API), get access token, then call backend:

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/personas" -Method Get -Headers @{ Authorization = "Bearer $token" }
```

## 8) Verified Backend Status (March 2, 2026)

These checks were executed successfully against the current codebase and Supabase DB:

1. `GET /health` -> `200` with `{"status":"ok"}`
2. Auth guard works:
   - `GET /personas` without token -> `401`
   - `GET /auth/me` with valid Supabase-style access token -> `200`
3. Supabase auth mode behavior:
   - `POST /auth/register` -> `400` (expected, use Supabase Auth)
   - `POST /auth/login` -> `400` (expected, use Supabase Auth)
   - `POST /auth/refresh` -> `400` (expected, use Supabase Auth)
4. Persona routes:
   - `POST /personas` -> `201`
   - `GET /personas` -> `200` and returns created rows
5. Evaluation routes:
   - `POST /evaluate` missing image -> `400`
   - `POST /evaluate` invalid persona id -> `400`
   - `POST /evaluate` with image + valid persona -> `200` and `status="succeeded"`
   - `GET /evaluations` -> `200` and includes the created evaluation with score/status
6. Database/migrations:
   - `alembic upgrade head` completed on Supabase Postgres
   - tables present: `users`, `personas`, `evaluations`, `alembic_version`

Note: AI evaluation success depends on a valid `OPENAI_API_KEY`, model access, and internet connectivity.

## Current AI + Storage Behavior

1. AI evaluation is active and returns structured JSON.
2. Evaluation rows are saved in Supabase (`evaluations` table).
3. Uploaded files are saved locally in `backend/uploads`.
4. Stored in DB: result JSON + metadata; full chat transcript is not separately stored.

## Frontend Going Forward

1. Integrate Supabase Auth UI (signup/login/logout).
2. Store Supabase session and pass access token to backend API calls.
3. Add auto refresh via Supabase client session handling.
4. Protect frontend routes based on session state.

## How To Use

1. Configure `.env` with Supabase DB + Supabase Auth values.
2. Run `alembic upgrade head`.
3. Start backend and frontend.
4. Sign in via Supabase Auth and get access token.
5. Use token to create personas and run evaluations.
6. Review previous feedback.

## What Needs Implementation

1. Full frontend Supabase Auth integration.
2. Per-user ownership filtering in backend (currently token-validated, not row-scoped).
3. Optional migration of uploads to Supabase Storage.
4. Optional local auth route cleanup/removal now that Supabase Auth is primary.
