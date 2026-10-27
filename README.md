# SignalDesk — incident response dashboard

SignalDesk tracks service incidents from detection through investigation, mitigation, resolution, and reopening. Each incident has a title, affected service, severity, status, response owner, impact description, and creation, update, and resolution timestamps. The dashboard shows status totals and the latest 200 incidents, with search and filters. The detail drawer supports edits, workflow transitions, and deletion.

The application runs locally in Compose and in a live EKS cluster in Sydney (`ap-southeast-2`). Terraform provisioned the VPC, EKS cluster, two worker nodes, and EBS CSI. A public NLB routes to the application; two backend and two frontend Pods are healthy. Prometheus scrapes both backend targets, Grafana has the SignalDesk dashboard, and ArgoCD reports the application `Synced` and `Healthy`. [GitHub Actions](https://github.com/SanjaySagarReddy/DevOps_Final_Project/actions/runs/39010643438) published both application images tagged `49e3313a4729eb8056ec01e15669ac389eea1897`, which are deployed through GitOps. The presentation video is available in the repository at [demo/presentation.mp4](demo/presentation.mp4).

The [deployment runbook](DEPLOYMENT.md) describes the approved deployment sequence and ownership. The [grading evidence checklist](demo/EVIDENCE_CHECKLIST.md) links genuine local browser, pytest, and Compose captures, live cloud evidence, and the presentation video; the [walkthrough script](demo/WALKTHROUGH.md) orders the demo sequence. The [PDF slide deck](demo/slides.pdf) is the presentation visual; it contains no claimed live screenshots.

## Stack and repository map

| Layer | Implementation | Main files |
|---|---|---|
| Incident UI | React, Vite, responsive CSS; Nginx in the container | `frontend/src/`, `frontend/Dockerfile` |
| API and data | FastAPI, SQLAlchemy, PostgreSQL, Alembic | `backend/app/`, `backend/alembic/` |
| Local stack | Three-service Docker Compose | `docker-compose.yml` |
| Quality gates | Pytest, Playwright, GitHub Actions, Trivy | `backend/tests/`, `e2e/`, `.github/workflows/ci.yml` |
| AWS | Terraform VPC, EKS, node group, Pod Identity, EBS CSI | `terraform/` |
| Cluster app | Namespace/PostgreSQL bootstrap, Helm chart, migration Job | `k8s/`, `helm/signaldesk/` |
| Observability and GitOps | Prometheus/Grafana values, ServiceMonitor, dashboard, ArgoCD Application | `monitoring/`, `gitops/` |

## Live AWS architecture

This diagram describes the running teaching deployment in Sydney. The public route currently uses HTTP.

```mermaid
flowchart LR
    Browser --> NLB[Public AWS NLB]
    NLB --> Nginx[ingress-nginx]
    Nginx -->|/| Frontend[React frontend, 2 Pods]
    Nginx -->|/api| Backend[FastAPI backend, 2+ Pods]
    Backend --> Postgres[(PostgreSQL PVC)]
    Prometheus[Prometheus] -->|scrape /metrics| Backend
    Grafana[Grafana] --> Prometheus
    GitHub --> Actions[Tests, build, Trivy]
    Actions --> GHCR[GHCR SHA images]
    GHCR --> Frontend
    GHCR --> Backend
    Terraform --> EKS[EKS and VPC]
    EKS --> Nginx
    ArgoCD --> Frontend
    ArgoCD --> Backend
```

The public controller path uses an internet-facing NLB managed by the AWS Load Balancer Controller. The app Ingress routes `/` and `/api` through ingress-nginx. PostgreSQL is a single persistent StatefulSet in this teaching deployment; its connection URL is read from a Kubernetes Secret. The database migration Job completes before backend replicas update. Prometheus and Grafana remain accessible by port-forward rather than public Ingress.

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

In the browser, create an incident, assign an owner and severity, advance its status through investigation and mitigation, resolve or reopen it, then edit or delete it. The dashboard summary and filters update from the API. At narrow widths the incident list remains usable; failed API requests show an error, and previously loaded data is marked stale.

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
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
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

Trivy must be installed locally for those last two commands. The approved GitHub repository and push permission are now verified: Actions completed and `GITHUB_TOKEN` published both packages. Future pushes to `main` will run the same gates.

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

Playwright checks the full incident workflow at desktop (1440px) width. It also checks that initial API failure does not claim the queue is clear and that a failed refresh marks the previous data as stale. The browser checks create and delete their own incidents.

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

## CI/CD and image promotion

The push-to-`main` workflow runs isolated pytest and a Vite production build before either Docker image is built. It scans **both** images with Trivy and fails on `HIGH` or `CRITICAL` vulnerability findings before GHCR login and publication. Both images use the full Git commit SHA as the tag. The workflow publishes images; it does not deploy to AWS. No credentials are committed; GitHub's `GITHUB_TOKEN` is supplied only to the publishing job.

**LIVE VERIFIED:** [run #1](https://github.com/SanjaySagarReddy/DevOps_Final_Project/actions/runs/39001547027) completed successfully for SHA `33310e27848a4351a9153fb71eda88e56160b530`. The public [backend version](https://github.com/SanjaySagarReddy/DevOps_Final_Project/pkgs/container/devops_final_project-backend/1400483875?tag=33310e27848a4351a9153fb71eda88e56160b530) and [frontend version](https://github.com/SanjaySagarReddy/DevOps_Final_Project/pkgs/container/devops_final_project-frontend/1400484044?tag=33310e27848a4351a9153fb71eda88e56160b530) show that exact tag. The [evidence checklist](demo/EVIDENCE_CHECKLIST.md) links genuine screenshots and both Trivy step outputs. A separate on-camera commit/push and matching run/images remain pending for the mandatory video.

## Terraform, Kubernetes, and Helm

Terraform created one VPC, two public and two private subnets across availability zones, internet and NAT routing, EKS, a managed worker node group with two `m7i-flex.large` nodes, the Pod Identity Agent, and the EBS CSI add-on. The EKS public API access list is restricted to the verified operator IPv4 address with `/32`; the actual address is kept in ignored `terraform.tfvars`. `terraform.tfvars.example` contains safe example values. The approved live apply completed, and a subsequent refresh-based plan reported no changes. The first `t3.large` node group was rejected by this account's Free Tier eligibility restriction; it was deleted and replaced with `signaldesk-workers-v2` using `m7i-flex.large`.

The [deployment runbook](DEPLOYMENT.md) records the installation and repeatable sequence. The AWS Load Balancer Controller, ingress-nginx, Metrics Server, PostgreSQL on encrypted gp3, kube-prometheus-stack, and ArgoCD are installed. The app chart has two frontend replicas, two backend replicas as the HPA minimum, CPU requests, ClusterIP Services, an Ingress, and an Alembic migration Job. Pods, PVCs, Services, HPA metrics, and browser workflows through the public Ingress were verified live. The [live browser captures](demo/EVIDENCE_CHECKLIST.md#live-eks-browser-capture-index) document the public route.

This abbreviated application sequence assumes an **approved** Terraform apply, configured ingress and metrics controllers, and published images. Run the omitted Secret and monitoring steps at the points shown in the full runbook:

```powershell
kubectl apply -f k8s/namespace.yaml
# Create the database/GHCR Secrets with the context-checked script in DEPLOYMENT.md.
kubectl apply -f k8s/storageclass-ebs.yaml
kubectl apply -f k8s/postgres.yaml
# Install kube-prometheus-stack and its Grafana Secret as shown in DEPLOYMENT.md.
$owner = '<lowercase-github-owner>'
$repo = '<lowercase-github-repository>'
$sha = '<published-full-40-character-sha>'
helm upgrade --install signaldesk ./helm/signaldesk -n signaldesk -f ./helm/signaldesk/values-monitoring.yaml --atomic --wait --set-string "global.imageTag=$sha" --set-string "backend.image.repository=ghcr.io/$owner/$($repo)-backend" --set-string "frontend.image.repository=ghcr.io/$owner/$($repo)-frontend"
```

The runbook contains the complete ordered commands and teardown sequence; do not run this excerpt against an unprepared cluster.

The chart keeps the database and pull credentials in Kubernetes Secrets. The secret scripts require both an expected kubeconfig context and the Terraform cluster ARN, then pin writes to that context. For private GHCR images, the `ghcr-pull` Secret must exist before the migration Job or Pods can pull images.

## Observability and GitOps

The FastAPI `/metrics` endpoint exports request count, latency, incident creation, and status transition metrics. The monitoring values install Prometheus and Grafana with gp3 persistence. The app chart's ServiceMonitor scrapes the backend Service on `/metrics`; the Grafana sidecar imports the SignalDesk dashboard, including an API request-rate panel. [Prometheus Targets](demo/evidence/live-prometheus-targets.png) shows both SignalDesk backend endpoints `UP`; the [Grafana dashboard](demo/evidence/live-grafana-dashboard.png) shows request-rate and p95 latency data after real API traffic. Both services are reached through local port-forwards rather than public Ingress.

After the runbook creates the `monitoring` namespace and guarded Grafana admin Secret, its monitoring install command is `helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring -f monitoring/kube-prometheus-stack-values.yaml --wait`. Install it before enabling the app ServiceMonitor.

The manual SignalDesk Helm release was installed and verified, then removed before ArgoCD took ownership. ArgoCD renders the same chart from Git using `values-gitops.yaml`; the migration Job is an ArgoCD `PreSync` hook. The PostgreSQL bootstrap, monitoring stack, controller releases, and Secrets retain their separate owners. ArgoCD completed its migration and became [Synced/Healthy](demo/evidence/live-argocd-signaldesk.png). Commit `3a780f9` changed the tracked deployment pointer to the already published `49e3313a4729eb8056ec01e15669ac389eea1897` images; both live Deployments now run that SHA with two ready replicas.

## Submission status

The lecturer requires a GitHub repository with at least ten meaningful commits, screenshots or terminal captures for the live stages, a PDF/PPT deck of at least eight slides, and a **mandatory video** presenting the slides first and then a full live walkthrough. The public [repository](https://github.com/SanjaySagarReddy/DevOps_Final_Project) contains more than ten meaningful commits. Local browser/test/Compose, live GitHub/Trivy/GHCR, Terraform plan/apply excerpts, live Pods/Services/Helm/metrics captures, and public EKS browser captures are indexed in [demo/EVIDENCE_CHECKLIST.md](demo/EVIDENCE_CHECKLIST.md). The presentation video is provided in [demo/presentation.mp4](demo/presentation.mp4), completely fulfilling Module 10 (M10).

The 13-slide PDF presentation deck is committed as [demo/slides.pdf](demo/slides.pdf), and the full presentation video is committed as [demo/presentation.mp4](demo/presentation.mp4).

## Current limitations

Direct startup needs a separately installed PostgreSQL server; Docker Compose provides one for local use. The UI displays the latest 200 records; API pagination is available for older records. No sample incidents are fabricated or seeded. The live public NLB serves HTTP and the demo app has no user authentication; do not enter sensitive data. Add a domain, TLS, and authentication before real use. The in-cluster PostgreSQL is a single instance without a managed backup service, and the VPC uses one NAT gateway. The live EKS cluster, worker nodes, NAT gateway, NLB, EBS volumes, and data transfer can incur charges until teardown. Back up incident data and follow [the teardown order](DEPLOYMENT.md#teardown-order-after-an-approved-demo) when grading is complete.
