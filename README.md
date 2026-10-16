# SignalDesk — incident response dashboard

SignalDesk tracks service incidents from detection through investigation, mitigation, resolution, and reopening. Each incident has a title, affected service, severity, status, response owner, impact description, and creation, update, and resolution timestamps. The dashboard shows status totals and the latest 200 incidents, with search and filters. The detail drawer supports edits, workflow transitions, and deletion.

This is phase 1 of the capstone. Docker, automated tests, CI/CD, Terraform, Kubernetes, monitoring deployment, and submission evidence are scheduled for later review phases.

## Local architecture

```text
Browser (React + Vite on :3000)
        │ /api via Vite development proxy
        ▼
FastAPI on :8000 ── SQLAlchemy / psycopg ── PostgreSQL on :5432
        │
        ├─ /health   process liveness
        ├─ /ready    SELECT 1 against PostgreSQL
        └─ /metrics  Prometheus exposition format
```

Requirements: Python 3.12+, Node.js 20+, npm, and a local PostgreSQL server. Run the commands from **this project folder**, not the lecturer's reference folder. PostgreSQL and `psql` must be installed and running separately for phase 1.

## Direct local startup (PowerShell)

1. Create a PostgreSQL role and database. Run these as a PostgreSQL administrator, replacing the example password with a local password of your choice:

   ```powershell
   psql -U postgres -c "CREATE ROLE incident_app LOGIN PASSWORD 'replace-with-a-local-password';"
   psql -U postgres -c "CREATE DATABASE incidentops OWNER incident_app;"
   ```

   If the role or database already exists, use the existing ones. URL-encode special characters in the password when placing it in `DATABASE_URL`.

2. In a terminal, install backend dependencies, set the connection URL, apply the migration, and start FastAPI:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   $env:DATABASE_URL = 'postgresql+psycopg://incident_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/incidentops'
   alembic upgrade head
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

   On macOS/Linux, activate with `source .venv/bin/activate` and set the URL with `export DATABASE_URL='...'`. The backend uses the environment variable directly; `.env.example` is only a template and is not loaded automatically.

3. In a second terminal, start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) and declare an incident. The Vite development proxy sends browser `/api` calls to `http://127.0.0.1:8000`, avoiding browser CORS configuration. API documentation is at [http://localhost:8000/docs](http://localhost:8000/docs).

5. Check the operational endpoints:

   ```powershell
   Invoke-RestMethod http://localhost:8000/health
   Invoke-RestMethod http://localhost:8000/ready
   (Invoke-WebRequest http://localhost:8000/metrics).Content
   ```

   `/health` reports process liveness without querying PostgreSQL. `/ready` returns HTTP 503 if the database cannot answer `SELECT 1`. `/metrics` includes `incident_http_requests_total`, `incident_http_request_duration_seconds`, `incident_created_total`, and `incident_status_transitions_total`.

## Incident API and workflow

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/incidents` | Latest incidents; accepts `status`, `severity`, `q`, `limit`, `offset` |
| `GET` | `/api/incidents/summary` | Counts by status and severity |
| `GET` | `/api/incidents/{id}` | Incident detail |
| `POST` | `/api/incidents` | Create an open incident |
| `PUT` | `/api/incidents/{id}` | Replace editable fields and advance status |
| `DELETE` | `/api/incidents/{id}` | Delete an incident |

Create requires `title`, `service`, `severity` (`critical`, `high`, `medium`, `low`), `owner`, and `description`. PUT also requires `status`. The allowed status changes are:

```text
open ──► investigating ──► mitigated ──► resolved
                 └──────────────────────► resolved
mitigated ──► investigating
resolved ──► investigating (reopen)
```

An invalid transition returns HTTP 409. `resolved_at` is set when resolved and cleared when reopened. The initial Alembic migration creates the table and database constraints; the application does not create tables on startup.

## Current local limitations

Phase 1 uses a separately installed PostgreSQL server and the Vite development proxy. The Docker Compose stack and browser verification against containerized services belong to phase 2. The UI displays the latest 200 records; API pagination is available for older records. No sample incidents are fabricated or seeded.
