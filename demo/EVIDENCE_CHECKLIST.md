# SignalDesk grading evidence checklist

Source of requirements: the lecturer's `devsecops-python-main/GRADING.md` and `README.md` in the sibling reference folder. This checklist describes evidence to collect; it is **not** evidence that cloud or GitHub steps have run.

Status key: **LOCAL VERIFIED** means tested on the developer machine with genuine local captures linked below; **PREPARED** means code or configuration exists and passed local checks; **PENDING LIVE** means a real external service or cluster is required. The local captures were taken on 2026-10-17 from the running Compose stack and a fresh test run. They do not prove any GitHub or cloud operation. Save future live captures under `demo/evidence/` with descriptive names and record URLs in the submission form. Do not commit credentials, kubeconfig files, Terraform state, or screenshots containing secrets.

## Local capture index

These are unedited page screenshots from a real headless Chrome run and terminal screenshots of PowerShell windows. The browser captures came from [the repeatable Playwright script](../e2e/capture-local-evidence.mjs) against the local Compose frontend and API. Each row shows the same UI step at desktop (1440 × 900) and mobile (390 × 844) widths; the delete step is confirmed by the script's disappearance assertion and the cleared dashboard. Local screenshots contain no public Ingress, GHCR, or cluster proof.

| UI step | Desktop | Mobile |
|---|---|---|
| Dashboard before create | [desktop](evidence/local-desktop-dashboard.png) | [mobile](evidence/local-mobile-dashboard.png) |
| Created, status open | [desktop](evidence/local-desktop-created.png) | [mobile](evidence/local-mobile-created.png) |
| Edited title and owner | [desktop](evidence/local-desktop-edited.png) | [mobile](evidence/local-mobile-edited.png) |
| Investigating | [desktop](evidence/local-desktop-investigating.png) | [mobile](evidence/local-mobile-investigating.png) |
| Mitigated | [desktop](evidence/local-desktop-mitigated.png) | [mobile](evidence/local-mobile-mitigated.png) |
| Resolved | [desktop](evidence/local-desktop-resolved.png) | [mobile](evidence/local-mobile-resolved.png) |
| Deleted, dashboard clear | [desktop](evidence/local-desktop-deleted.png) | [mobile](evidence/local-mobile-deleted.png) |

Terminal captures: [eight passing pytest cases](evidence/local-pytest-terminal.png) and [three-service Compose build/start](evidence/local-compose-terminal.png).

## M1 — Application (10 points)

- [x] **LOCAL VERIFIED:** FastAPI `/health`, incident GET/POST/PUT/DELETE, database migration, React dashboard, and responsive browser workflow exist in `backend/`, `frontend/`, and `docker-compose.yml`.
- [x] **LOCAL VERIFIED:** The [desktop and mobile screenshot sequence](#local-capture-index) shows a real incident created, edited, moved through investigating/mitigated/resolved, and deleted through the Compose app at `http://127.0.0.1:3000`. [The capture script](../e2e/capture-local-evidence.mjs) asserts every transition and removes its test incident.

## M2 — Testing (10 points)

- [x] **LOCAL VERIFIED:** Eight isolated pytest cases across health/readiness, incident APIs, and metrics; each uses a fresh in-memory test database through a dependency override. Four Chrome browser checks passed at desktop and mobile widths during Phase 2 review.
- [x] **LOCAL VERIFIED:** [Fresh pytest terminal capture](evidence/local-pytest-terminal.png) shows the command, eight passing cases, and exit code 0. The capture used `PYTEST_ADDOPTS=-p no:cacheprovider --disable-warnings` to avoid a cache write issue and keep warning details off screen; the warning count remains visible.

## M3 — Git and GitHub (5 points)

- [x] **LOCAL VERIFIED:** Git is initialized on `main`, with at least ten meaningful local commits and a `.gitignore` that excludes secrets and generated files. Recheck the count with `git rev-list --count HEAD` before capturing.
- [ ] **PENDING LIVE:** Add the approved GitHub repository remote and push only after supplying its URL to the agent. Submit the real repository URL; public visibility or instructor access is required.
- [ ] **PENDING LIVE:** Capture the **GitHub** commit-history page showing at least ten meaningful commits after the approved remote and push exist. The commit history is currently local only.

## M4 — Docker and Compose (10 points)

- [x] **LOCAL VERIFIED:** Backend and frontend images run as non-root; the frontend uses Node build and Nginx runtime stages. Compose has the three healthy services.
- [x] **LOCAL VERIFIED:** [Fresh Compose terminal capture](evidence/local-compose-terminal.png) shows `docker compose up --build -d` building both images and `docker compose ps` listing frontend, backend, and PostgreSQL (backend and database healthy), all with exit code 0.
- [x] **LOCAL VERIFIED:** [Desktop dashboard](evidence/local-desktop-dashboard.png) and [mobile dashboard](evidence/local-mobile-dashboard.png) were captured from the real frontend at `http://127.0.0.1:3000`.

## M5 — GitHub Actions and GHCR (15 points)

- [x] **PREPARED:** `.github/workflows/ci.yml` triggers on push to `main`; pytest and frontend build gate both image builds; images are SHA tagged.
- [ ] **PENDING LIVE:** During the mandatory video, **make a new commit on `main` and push it** to the approved repository. Show the full SHA from `git rev-parse HEAD`, then wait for the Actions run triggered by that push to finish successfully. Save the run URL and verify `verify` finishes before `publish`.
- [ ] **PENDING LIVE:** Open both backend and frontend GHCR package pages in the recording and show that **both image tags equal the full SHA of that newly pushed commit**. Capture both pages and retain the published SHA used for Kubernetes and GitOps values.

## M6 — Trivy (5 points)

- [x] **PREPARED:** Both images are scanned before login/push with `--severity HIGH,CRITICAL --exit-code 1`.
- [ ] **PENDING LIVE:** Capture the Trivy output for **both** images from the actual GitHub Actions run. A locally clean scan does not prove the pipeline ran.
- [ ] **PENDING WRITE-UP:** Add 2–3 sentences about the actual scan result. If clean, explain that no HIGH/CRITICAL findings were reported for those image digests at that scan time; if blocked, explain one CVE and the remediation.

## M7 — Terraform and AWS (15 points)

- [x] **PREPARED:** Valid Terraform in `terraform/`, including the VPC, two public subnets, EKS, worker nodes, and `terraform.tfvars.example`. A dummy-credential, refresh-free local plan showed 28 resources to add; it is **not a live AWS plan**.
- [ ] **PENDING LIVE / APPROVAL REQUIRED:** With approved AWS access, run a real `terraform init` and `terraform plan -var-file=terraform.tfvars` and capture the plan output. Review costs and CIDR values before apply.
- [ ] **PENDING LIVE / APPROVAL REQUIRED:** After explicit approval, capture actual `terraform apply` output and AWS Console proof of the VPC, two public subnets, EKS cluster, and worker node group in the configured region.
- [ ] **PENDING LIVE / APPROVAL REQUIRED:** After the demo and backup, capture successful `terraform destroy` output and verify no paid NLB/EBS/EKS resources remain. Follow the runbook teardown order.

## M8 — Kubernetes and Helm (15 points)

- [x] **PREPARED:** Namespace/bootstrap YAML and SignalDesk Helm chart render and validate locally. The chart defines two frontend replicas, a backend HPA minimum of two, two ClusterIP Services, `/` and `/api` Ingress routes, and a one-time migration Job.
- [ ] **PENDING LIVE:** Capture `kubectl get pods -n signaldesk` with frontend and backend replicas Running, PostgreSQL ready, and `kubectl get svc -n signaldesk` with both ClusterIP Services.
- [ ] **PENDING LIVE:** Capture `kubectl get ingress,hpa,pvc -n signaldesk`, a successful `helm list -n signaldesk` **before the ArgoCD handoff**, and browser access through the real public Ingress hostname.

## M9 — Prometheus and Grafana (10 points)

- [x] **LOCAL VERIFIED / PREPARED:** `/metrics` returned Prometheus text locally; a rendered ServiceMonitor targets `/metrics`, and the dashboard JSON contains live request-rate and latency queries. This is not a cluster scrape result.
- [ ] **PENDING LIVE:** Capture backend `/metrics` output in the deployed cluster and Prometheus **Status → Targets** showing the SignalDesk target `UP`.
- [ ] **PENDING LIVE:** Capture Grafana reachable through a port-forward and the SignalDesk dashboard with at least one **populated application metric panel** after real API traffic.

## M10 — Documentation and presentation (5 points)

- [x] **PREPARED:** Root `README.md`, deployment runbook, this checklist, walkthrough script, and `demo/slides.pdf` (at least eight slides).
- [ ] **PENDING LIVE — MANDATORY:** Record a video presenting the slide deck **first**, followed by the full live walkthrough: **make and push a new `main` commit on camera, wait for its Actions run to complete, and show both GHCR images with that same full SHA**, then show the codebase, real Terraform/AWS proof, Kubernetes/Helm/Ingress, ArgoCD GitOps flow, Prometheus target, and Grafana panel. Upload the actual video under `demo/` or as a GitHub release asset. Without the video, the lecturer awards zero for M10.
- [ ] **PENDING SUBMISSION:** Link the GitHub repository and evidence URLs/files in the submission form. Confirm that the PDF deck and video are accessible to graders.

## Evidence integrity and remaining blockers

- No GitHub remote or successful Actions/GHCR run has been verified yet. Obtain the repository URL at the agreed final push step; ensure the account can push `main` and GitHub Actions can write packages.
- No AWS resources were created in these preparation phases. Obtain explicit deployment approval, suitable AWS credentials/permissions, an actual administrator CIDR, and a cost/teardown window before a live plan/apply.
- Do not label `helm template`, kubeconform, a dummy-credential plan, or local `/metrics` as proof of live EKS, Prometheus, Grafana, Ingress, or ArgoCD operation.
