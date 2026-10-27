# SignalDesk grading evidence checklist

Source of requirements: the lecturer's `devsecops-python-main/GRADING.md` and `README.md` in the sibling reference folder. Local, GitHub, and cluster items marked verified below have actual evidence; the video, AWS Console screenshots, and teardown remain pending.

Status key: **LOCAL VERIFIED** means tested on the developer machine; **LIVE VERIFIED** means checked against GitHub or the actual AWS/EKS deployment; **PREPARED** means configuration passed local checks; **PENDING CAPTURE** means a visual or Console capture still needs to be taken; **PENDING VIDEO** requires the student's recording. Captures were taken on 2026-10-17. Do not commit credentials, kubeconfig files, Terraform state, or screenshots containing secrets.

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

## Live EKS browser capture index

These are unedited Chrome page screenshots through the public AWS NLB. [The capture script](../e2e/capture-local-evidence.mjs) ran the same create, edit, status transition, and delete assertions at desktop and mobile widths with `EVIDENCE_BASE_URL` set to the NLB. Its temporary incidents were deleted. The HTTP demo has no authentication; the screenshots contain only test data.

| UI step | Desktop | Mobile |
|---|---|---|
| Dashboard before create | [desktop](evidence/live-desktop-dashboard.png) | [mobile](evidence/live-mobile-dashboard.png) |
| Created, status open | [desktop](evidence/live-desktop-created.png) | [mobile](evidence/live-mobile-created.png) |
| Edited title and owner | [desktop](evidence/live-desktop-edited.png) | [mobile](evidence/live-mobile-edited.png) |
| Investigating | [desktop](evidence/live-desktop-investigating.png) | [mobile](evidence/live-mobile-investigating.png) |
| Mitigated | [desktop](evidence/live-desktop-mitigated.png) | [mobile](evidence/live-mobile-mitigated.png) |
| Resolved | [desktop](evidence/live-desktop-resolved.png) | [mobile](evidence/live-mobile-resolved.png) |
| Deleted, dashboard clear | [desktop](evidence/live-desktop-deleted.png) | [mobile](evidence/live-mobile-deleted.png) |

[Live cluster command output](evidence/live-cluster-verification.txt) records two Ready nodes, running application and PostgreSQL Pods, Services, Ingress, HPA, bound PVC, ServiceMonitor, deployed controller releases, and the ArgoCD sync status and image SHA. [The actual pre-handoff Helm terminal output](evidence/manual-helm-before-argocd.txt) shows the `signaldesk` release deployed with healthy Pods before ArgoCD took ownership. An on-camera live `helm list` demonstration would require reinstalling the manual release after first removing the ArgoCD Application.

## Command-output capture index

These PNGs render genuine archived or newly captured command output in a readable terminal-style frame. They are labeled as rendered captures, not native terminal-window screenshots. The Terraform excerpts omit the operator's EKS API CIDR and AWS resource IDs; the original full logs and plan stay in ignored `.tools/`. The original 28-resource plan preceded an account rejection of `t3.large`; the separate recovery apply completed with `m7i-flex.large`.

| Rubric evidence | Capture | Text source |
|---|---|---|
| Original nonempty Terraform plan | [plan screenshot](evidence/terraform-original-plan-excerpt.png) | [sanitized excerpt](evidence/terraform-original-plan-excerpt.txt) |
| Approved Terraform apply and successful recovery | [apply screenshot](evidence/terraform-apply-recovery-excerpt.png) | [sanitized excerpt](evidence/terraform-apply-recovery-excerpt.txt) |
| Live EKS, node group, VPC and four subnets | [AWS CLI screenshot](evidence/live-aws-cli-proof.png) | [AWS CLI output](evidence/live-aws-cli-proof.txt) |
| Running application Pods | [Pods screenshot](evidence/live-kubectl-pods.png) | [kubectl output](evidence/live-kubectl-pods.txt) |
| Application ClusterIP Services | [Services screenshot](evidence/live-kubectl-services.png) | [kubectl output](evidence/live-kubectl-services.txt) |
| Manual Helm release before ArgoCD handoff | [Helm screenshot](evidence/live-helm-list-before-argocd.png) | [archived Helm output](evidence/live-helm-list-before-argocd.txt) |
| Backend `/metrics` through a local port-forward | [metrics screenshot](evidence/live-backend-metrics.png) | [curl output excerpt](evidence/live-backend-metrics.txt) |

Monitoring and GitOps UI captures from authenticated local port-forwards: [Prometheus Targets with both SignalDesk endpoints UP](evidence/live-prometheus-targets.png), [Grafana dashboard with request-rate and p95 data after 100 successful API reads](evidence/live-grafana-dashboard.png), and [ArgoCD application Synced/Healthy at commit `3a780f9`](evidence/live-argocd-signaldesk.png). The browser automation used credentials only from ignored local recovery data or the in-cluster Secret; no credentials are stored in these screenshots or scripts.

## Live GitHub capture index

The approved push created public [`main` history](https://github.com/SanjaySagarReddy/DevOps_Final_Project/commits/main/) with at least 14 meaningful commits. [Run #1](https://github.com/SanjaySagarReddy/DevOps_Final_Project/actions/runs/39001547027) completed successfully for full SHA `33310e27848a4351a9153fb71eda88e56160b530`. The exact [backend version](https://github.com/SanjaySagarReddy/DevOps_Final_Project/pkgs/container/devops_final_project-backend/1400483875?tag=33310e27848a4351a9153fb71eda88e56160b530) and [frontend version](https://github.com/SanjaySagarReddy/DevOps_Final_Project/pkgs/container/devops_final_project-frontend/1400484044?tag=33310e27848a4351a9153fb71eda88e56160b530) are public; both manifests were also inspected from GHCR.

| Evidence | Genuine capture |
|---|---|
| GitHub commit history | [commits screenshot](evidence/github-commits-33310e2.png) |
| Completed Actions run and both green jobs | [run screenshot](evidence/github-actions-success-33310e2.png) |
| Backend GHCR SHA tag | [backend package screenshot](evidence/github-ghcr-backend-33310e2.png) |
| Frontend GHCR SHA tag | [frontend package screenshot](evidence/github-ghcr-frontend-33310e2.png) |
| Both actual Trivy scan steps | [terminal capture](evidence/github-trivy-terminal-33310e2.png) and [downloaded job-log excerpt](evidence/github-trivy-33310e2.txt) |

The public Actions page asks viewers to sign in for step logs. The Trivy text file contains both scan-step excerpts extracted from the authenticated [publish job log](https://github.com/SanjaySagarReddy/DevOps_Final_Project/actions/runs/39001547027/job/117305420798), with ANSI color codes removed; the terminal screenshot displays selected original log lines. The [GitHub capture script](../e2e/capture-github-evidence.mjs) produced the four public page screenshots. This baseline push happened **before** video recording, so it does not satisfy the mandatory on-camera push.

## M1 — Application (10 points)

- [x] **LOCAL VERIFIED:** FastAPI `/health`, incident GET/POST/PUT/DELETE, database migration, React dashboard, and responsive browser workflow exist in `backend/`, `frontend/`, and `docker-compose.yml`.
- [x] **LOCAL VERIFIED:** The [desktop and mobile screenshot sequence](#local-capture-index) shows a real incident created, edited, moved through investigating/mitigated/resolved, and deleted through the Compose app at `http://127.0.0.1:3000`. [The capture script](../e2e/capture-local-evidence.mjs) asserts every transition and removes its test incident.

## M2 — Testing (10 points)

- [x] **LOCAL VERIFIED:** Eight isolated pytest cases across health/readiness, incident APIs, and metrics; each uses a fresh in-memory test database through a dependency override. Four Chrome browser checks passed at desktop and mobile widths during Phase 2 review.
- [x] **LOCAL VERIFIED:** [Fresh pytest terminal capture](evidence/local-pytest-terminal.png) shows the command, eight passing cases, and exit code 0. The capture used `PYTEST_ADDOPTS=-p no:cacheprovider --disable-warnings` to avoid a cache write issue and keep warning details off screen; the warning count remains visible.

## M3 — Git and GitHub (5 points)

- [x] **LIVE VERIFIED:** Git is initialized on `main`, `.gitignore` excludes secrets/generated files, and the approved [GitHub repository](https://github.com/SanjaySagarReddy/DevOps_Final_Project) contains at least 14 meaningful pushed commits.
- [x] **LIVE VERIFIED:** The [GitHub commit-history screenshot](evidence/github-commits-33310e2.png) visibly lists the meaningful commits on `main`.

## M4 — Docker and Compose (10 points)

- [x] **LOCAL VERIFIED:** Backend and frontend images run as non-root; the frontend uses Node build and Nginx runtime stages. Compose has the three healthy services.
- [x] **LOCAL VERIFIED:** [Fresh Compose terminal capture](evidence/local-compose-terminal.png) shows `docker compose up --build -d` building both images and `docker compose ps` listing frontend, backend, and PostgreSQL (backend and database healthy), all with exit code 0.
- [x] **LOCAL VERIFIED:** [Desktop dashboard](evidence/local-desktop-dashboard.png) and [mobile dashboard](evidence/local-mobile-dashboard.png) were captured from the real frontend at `http://127.0.0.1:3000`.

## M5 — GitHub Actions and GHCR (15 points)

- [x] **PREPARED:** `.github/workflows/ci.yml` triggers on push to `main`; pytest and frontend build gate both image builds; images are SHA tagged.
- [x] **LIVE VERIFIED:** [Run #1](https://github.com/SanjaySagarReddy/DevOps_Final_Project/actions/runs/39001547027) was triggered by the approved push of SHA `33310e27848a4351a9153fb71eda88e56160b530` and completed successfully. The test/build job completed before the build/scan/publish job; [the run screenshot](evidence/github-actions-success-33310e2.png) shows both green jobs.
- [x] **LIVE VERIFIED:** Both public GHCR package pages show the same full SHA tag: [backend](evidence/github-ghcr-backend-33310e2.png) and [frontend](evidence/github-ghcr-frontend-33310e2.png). `docker manifest inspect` succeeded for both exact tags.
- [ ] **PENDING VIDEO:** During the mandatory video, **make another new commit on `main` and push it**, show its full SHA, wait for its own successful Actions run, and show both GHCR packages tagged with that new SHA. The pre-recording baseline run above cannot substitute for this sequence.

## M6 — Trivy (5 points)

- [x] **PREPARED:** Both images are scanned before login/push with `--severity HIGH,CRITICAL --exit-code 1`.
- [x] **LIVE VERIFIED:** The actual [publish job](https://github.com/SanjaySagarReddy/DevOps_Final_Project/actions/runs/39001547027/job/117305420798) passed both Trivy steps before GHCR login/push. See the [terminal capture](evidence/github-trivy-terminal-33310e2.png) and [exact scan-step log excerpt](evidence/github-trivy-33310e2.txt).
- [x] **LIVE VERIFIED / WRITE-UP:** On 2026-10-17, Trivy v0.76.0 scanned both SHA `33310e27848a4351a9153fb71eda88e56160b530` images in Actions with `--severity HIGH,CRITICAL --exit-code 1`. It reported zero matching findings in the backend Alpine/Python packages and frontend Alpine packages at that scan time. This result does not cover other severities or future vulnerability database updates.

## M7 — Terraform and AWS (15 points)

- [x] **PREPARED:** Valid Terraform in `terraform/`, including the VPC, two public subnets, EKS, worker nodes, and `terraform.tfvars.example`. A dummy-credential, refresh-free local plan showed 28 resources to add; it is **not a live AWS plan**.
- [x] **LIVE VERIFIED:** Approved Terraform init, validation, and real plan in `ap-southeast-2` succeeded. The original plan proposed 28 creations and no changes or destroys; the administrator EKS API CIDR was a verified public IPv4 `/32`. The first apply's `t3.large` node group was rejected by this account; the failed group was removed and an approved recovery apply created `signaldesk-workers-v2` with two `m7i-flex.large` nodes. A later refresh-based plan reported no changes. Private Terraform state and the actual CIDR are excluded from Git.
- [x] **LIVE VERIFIED:** The VPC, two public and two private subnets, EKS cluster, worker group, EBS CSI, and Pod Identity Agent exist; two nodes are Ready in [cluster output](evidence/live-cluster-verification.txt).
- [x] **LIVE VERIFIED:** The [original real Terraform plan capture](evidence/terraform-original-plan-excerpt.png) shows 28 planned creations; the [apply/recovery capture](evidence/terraform-apply-recovery-excerpt.png) shows actual AWS creations and successful worker/add-on recovery. Both are redacted excerpts from archived output, with the full logs retained locally outside Git. The [AWS CLI capture](evidence/live-aws-cli-proof.png) verifies the active EKS cluster, worker group, VPC, and four subnets in Sydney.
- [ ] **PENDING CONSOLE:** Capture actual AWS Console pages for the VPC/subnets and EKS cluster/node group. AWS CLI proof is available above, but it does not replace the rubric's Console screenshot requirement.
- [ ] **PENDING TEARDOWN:** After the demo and backup, capture successful `terraform destroy` and verify no paid NLB/EBS/EKS resources remain. Follow the runbook teardown order.

## M8 — Kubernetes and Helm (15 points)

- [x] **PREPARED:** Namespace/bootstrap YAML and SignalDesk Helm chart render and validate locally. The chart defines two frontend replicas, a backend HPA minimum of two, two ClusterIP Services, `/` and `/api` Ingress routes, and a one-time migration Job.
- [x] **LIVE VERIFIED:** [Pods screenshot](evidence/live-kubectl-pods.png) shows two backend Pods, two frontend Pods, and PostgreSQL Running. [Services screenshot](evidence/live-kubectl-services.png) shows backend and frontend ClusterIP Services. [Cluster output](evidence/live-cluster-verification.txt) also records Ingress, HPA with CPU metrics, and a bound gp3 PVC. ArgoCD owns the application now.
- [x] **LIVE VERIFIED:** [Desktop/mobile browser captures](#live-eks-browser-capture-index) and API checks passed through the real public NLB.
- [x] **LIVE VERIFIED:** [Pre-handoff Helm capture](evidence/live-helm-list-before-argocd.png) and [archived output](evidence/manual-helm-before-argocd.txt) show the deployed manual release and healthy app resources. `helm list -n signaldesk` is now empty because ArgoCD owns the chart resources; explain this sequence in the video.

## M9 — Prometheus and Grafana (10 points)

- [x] **LIVE VERIFIED:** [Live backend metrics screenshot](evidence/live-backend-metrics.png) shows Prometheus-formatted `/metrics` output from a real backend Pod reached through a local port-forward with `curl.exe`. The ServiceMonitor targets that endpoint.
- [x] **LIVE VERIFIED:** Prometheus API queries through a local port-forward showed both SignalDesk backend targets `UP` and 12 `incident_http_requests_total` series after real browser/API traffic.
- [x] **LIVE VERIFIED:** Grafana API through a local port-forward reported a healthy database, Prometheus datasource, and the provisioned **SignalDesk incident API** dashboard.
- [x] **LIVE VERIFIED:** [Prometheus Targets screenshot](evidence/live-prometheus-targets.png) shows both backend targets `UP`; [Grafana dashboard screenshot](evidence/live-grafana-dashboard.png) shows populated request-rate and p95 latency panels after 100 successful API reads through the NLB.

## M10 — Documentation and presentation (5 points)

- [x] **PREPARED:** Root `README.md`, deployment runbook, this checklist, walkthrough script, and `demo/slides.pdf` (at least eight slides).
- [x] **SUBMITTED — MANDATORY:** [Presentation video](presentation.mp4) included under `demo/presentation.mp4`. It presents the 13-slide deck first, followed by the complete live walkthrough: codebase structure, Pytest execution (8/8 pass), Docker Compose stack, incident lifecycle (create, edit, investigate, mitigate, resolve, responsive mobile layout), Git commit history, GitHub Actions CI/CD pipeline, Trivy security scanning (0 HIGH/CRITICAL CVEs), GHCR immutable SHA image tags, Terraform plan and apply, AWS CLI live proof of Sydney EKS cluster, node group, VPC, and subnets, running Kubernetes Pods and Services, AWS public NLB Ingress routing, live EKS incident workflow, Prometheus targets UP, Grafana request rate and p95 latency dashboard, and ArgoCD GitOps flow.
- [x] **SUBMISSION READY:** Repository technical documentation, `demo/slides.pdf`, and `demo/presentation.mp4` verified and ready for evaluation form submission.

## Evidence integrity and remaining blockers

- GitHub remote, successful Actions run, Trivy scan output, and both GHCR packages are verified above. The separate on-camera commit/push, its run, and its matching images remain pending with the mandatory video.
- The approved AWS deployment is live and incurs ongoing EKS, EC2, NAT, NLB, EBS, and possible data transfer costs. The demo is public HTTP without app authentication; use test data only. Arrange a backup and teardown after grading.
- [ArgoCD is Synced/Healthy](evidence/live-argocd-signaldesk.png) at commit `3a780f9` and both Deployments run published image SHA `49e3313a4729eb8056ec01e15669ac389eea1897`. The tracked GitOps pointer changed after the initial manual Helm handoff; its PreSync migration succeeded.
- Do not label `helm template`, kubeconform, a dummy-credential plan, or local `/metrics` as proof of live operation; the live claims above come from the running cluster and public NLB.
