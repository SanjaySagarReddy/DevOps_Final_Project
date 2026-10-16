# SignalDesk — incident response dashboard

SignalDesk tracks service incidents from detection through investigation, mitigation, resolution, and reopening. Each incident has a title, affected service, severity, status, response owner, impact description, and creation, update, and resolution timestamps. The dashboard shows status totals and the latest 200 incidents, with search and filters. The detail drawer supports edits, workflow transitions, and deletion.

Phases 1 and 2 are implemented. Phase 3 CI/CD is prepared but has not run on GitHub because no remote is configured. Phase 4 Terraform, Kubernetes, and Helm files are prepared for review; no AWS resources or cluster workloads have been created. Monitoring deployment and submission evidence remain for later phases.

The [phase 4 deployment runbook](DEPLOYMENT.md) explains infrastructure ownership, the external Secrets, GHCR access, database migration order, ingress and metrics prerequisites, SHA-tagged images, and safe teardown.

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

For direct startup, use Python 3.12+, Node.js 20+, npm, and a local PostgreSQL server. For the container stack, use Docker Engine/Desktop and Docker Compose. Run the commands from **this project folder**, not the lecturer's reference folder.

## Docker Compose startup

From the project root:

```powershell
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Nginx serves the built React app and proxies `/api` to FastAPI. The API docs are at [http://localhost:8000/docs](http://localhost:8000/docs). PostgreSQL is kept on the private Compose network and persisted in the `postgres_data` volume. The backend runs `alembic upgrade head` before Uvicorn starts; health checks make the frontend wait until the API and database are ready.

The Compose database uses `POSTGRES_HOST_AUTH_METHOD=trust` only for local development. Its port is not published to the host. Use authenticated PostgreSQL with a secret for any shared or cloud deployment.

Stop the stack with `docker compose down`. The database volume remains. `docker compose down -v` also deletes local incident data.

The backend image runs as UID 10001. The frontend uses a Node build stage and a small Nginx runtime stage, which runs as UID 101 and listens on port 8080 inside the container.
The backend runtime uses Python on Alpine and removes pip after dependency installation, keeping build tooling out of the running container.

## Automated checks

### GitHub Actions image pipeline

Each push to `main` triggers [the CI workflow](.github/workflows/ci.yml). Its `verify` job installs backend test dependencies, runs the isolated pytest suite, installs frontend dependencies with `npm ci`, and builds the frontend. The `publish` job starts only after those checks pass. It builds separate backend and frontend images, then runs Trivy against each image with `HIGH,CRITICAL` severity and `--exit-code 1`. Either finding blocks GHCR login and both pushes.

The image names are `ghcr.io/<owner>/<repo>-backend:<full-commit-sha>` and `ghcr.io/<owner>/<repo>-frontend:<full-commit-sha>` (lowercase owner and repo). No mutable `latest` tag is published. The publish job requests only `contents: read` and `packages: write` for the repository's `GITHUB_TOKEN`; no registry password or personal access token is stored in this repository. The Compose database's trust authentication is local development configuration and is not used by the CI jobs.

To repeat the local gates from the project root, run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
cd ..\frontend
npm ci
npm run build
cd ..
docker build -t signaldesk-backend:ci ./backend
docker build -t signaldesk-frontend:ci ./frontend
trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 --no-progress signaldesk-backend:ci
trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 --no-progress signaldesk-frontend:ci
```

Trivy must be installed locally for those last two commands. A live Actions run and GHCR publication require a GitHub repository remote and permission to push `main`; the repository or organization must allow Actions and GHCR package writes by `GITHUB_TOKEN`.

Install test dependencies in a backend virtual environment, then run the isolated API suite:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -v
```

Every pytest case creates a fresh in-memory SQLite database and overrides FastAPI's database session dependency. The suite does not connect to the PostgreSQL instance named by `DATABASE_URL`.

With the Compose stack running and Google Chrome installed, run the browser checks:

```powershell
cd e2e
npm ci
npm test
```

Playwright checks the full incident workflow at desktop (1440px) and mobile (390px) widths. It also checks that initial API failure does not claim the queue is clear and that a failed refresh marks the previous data as stale. The browser checks create and delete their own incidents.

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

## Current limitations

Direct startup needs a separately installed PostgreSQL server; Docker Compose provides one for local use. The UI displays the latest 200 records; API pagination is available for older records. No sample incidents are fabricated or seeded. Cloud deployment and live monitoring evidence are planned for later phases.
