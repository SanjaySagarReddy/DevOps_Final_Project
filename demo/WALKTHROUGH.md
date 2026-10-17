# SignalDesk final video walkthrough script

**Recording status: PENDING.** This is a script for the student's future live demonstration, not a record that the commands below have run. Follow [DEPLOYMENT.md](../DEPLOYMENT.md) for the full approved deployment procedure and [EVIDENCE_CHECKLIST.md](EVIDENCE_CHECKLIST.md) for captures. Never display tokens, database passwords, kubeconfig contents, Terraform state, or Grafana credentials on screen. AWS creation and teardown require explicit approval.

## Before recording

1. Have an approved GitHub repository remote and permission to push to `main`. Prepare a small, reviewed change to a tracked documentation or source file, but leave it **uncommitted and unpushed** for the recording. Keep a previously published image SHA available for the initial live deployment; the new video commit will be a separate pipeline demonstration.
2. Agree on the AWS cost window and approval; replace the example EKS API CIDR, confirm AWS identity and region, and prepare a secure state location. Follow the runbook to create the cluster and install the controller, Secrets, database, monitoring stack, and app. Record real plan/apply output when performed.
3. Open the local app, GitHub Actions, GHCR packages, AWS Console, Kubernetes terminal, Prometheus Targets, Grafana dashboard, and ArgoCD UI. Keep the app's manual Helm release in place until its `helm list` evidence is captured.
4. Rehearse the full sequence once without recording. Keep the planned video change uncommitted after rehearsal. Put actual screenshots and URLs in the evidence checklist; the committed captures under `demo/evidence/` prove only local runs.

## Recording order

| Segment | Show and say | Actual proof to capture |
|---|---|---|
| 1. Slides first | Present every slide in `demo/slides.pdf`: problem, stack, architecture, CI security gate, AWS, Kubernetes, public route, observability, GitOps, validation, and lessons. State which live items were pending when the deck was prepared. | Video begins with the slide deck, as the rubric requires. |
| 2. Application | Open the real UI. Create an incident with service, severity, owner, and description; edit it; move it through investigating, mitigated, and resolved; reopen and delete it. Resize to mobile width. | Browser and dashboard; API requests in browser developer tools if useful. |
| 3. Code and local quality | Point to `backend/app/main.py`, the Alembic migration, `frontend/src/App.jsx`, isolated tests, Dockerfiles, and Compose. Run `python -m pytest -v` inside `backend/`; show `docker compose ps`. | Passing test output, three services, non-root images, local browser. |
| 4. Git, CI, and GHCR | Show the meaningful commit history and the prepared, reviewed file diff. **While recording, make a new commit on `main` and push it to the approved remote.** Show `git rev-parse HEAD`, then open the run triggered by that push. Wait until both `verify` and `publish` finish successfully. Open both Trivy scan steps and both GHCR package pages; show that the backend and frontend tags equal the full SHA of the commit just pushed. | Continuous video of the commit, push, completed Actions run, both scan steps, and both GHCR SHA image tags; save the run URL and full SHA. If a gate fails, fix it and repeat the commit/push/run sequence before claiming success. |
| 5. Terraform and AWS | Show `terraform/` and `terraform.tfvars.example`. Show the **real** plan/apply output from the approved deployment and AWS Console VPC, two public subnets, EKS cluster, and node group. Explain private worker subnets, NAT, and EBS CSI. | Real plan/apply and Console proof. The offline plan is only local syntax/graph evidence. |
| 6. Kubernetes and Helm | Run `kubectl get nodes`, `kubectl get pods,svc,ingress,hpa,pvc -n signaldesk`, and `helm list -n signaldesk` while the manual app Helm release still exists. Explain the one-time migration Job, database Secret, two replicas, and HPA. | Healthy Pods/Services and Helm release screenshot. |
| 7. Public Ingress | Show the `ingress-nginx-controller` Service hostname and the `internet-facing` NLB scheme. Visit `/` and create/read an incident through `/api` at that hostname. | Browser over the real public route. Do not substitute `localhost`. |
| 8. Metrics | Show deployed backend `/metrics`, Prometheus **Status → Targets** with SignalDesk `UP`, and Grafana's SignalDesk dashboard. Generate actual API traffic and wait for a request-rate or latency panel to populate. | Prometheus `UP` and a populated **application** panel. |
| 9. ArgoCD GitOps | After preserving Helm evidence, uninstall only the app Helm release. Apply the prepared ArgoCD Application with the real repo URL and a tracked `values-gitops.yaml` referencing an **already published** SHA. Show `Synced`/`Healthy`. For the GitOps change, commit a different published SHA to the tracked values, push, and show ArgoCD update the Deployment images after the `PreSync` migration succeeds. | ArgoCD app, Git change, migration and new image SHA. Helm and ArgoCD must not own the app concurrently. |
| 10. Close and cleanup | Recap how a commit becomes a scanned image and then a monitored app. After the demo, back up data and use the runbook teardown order; record actual `terraform destroy` and AWS resource cleanup. | Destroy output and absence of paid resources, if teardown occurs during/after recording. |

## Recorded GitHub pipeline sequence

Run this sequence on camera **only after** the repository URL has been supplied and the push approved. Use the reviewed, uncommitted demo change prepared before recording; replace the example path with that actual tracked file. Keep credentials and token prompts out of the capture.

```powershell
git branch --show-current          # must say main
git diff -- demo/WALKTHROUGH.md    # replace with the reviewed demo file
git add -- demo/WALKTHROUGH.md     # stage that file only
git commit -m "Document incident response example"
git rev-parse HEAD                 # copy the full commit SHA into the evidence checklist
git push origin main               # show the real push completing
```

In GitHub Actions, open the run for **that SHA**, wait for `verify` and `publish` to finish successfully, and show both Trivy scan steps. Then open the backend and frontend GHCR packages and show each image tag equals the same full SHA. Record the run URL and both package URLs. A queued or failed run, a prior run, or images with a different tag does not complete this segment.

## Useful read-only verification commands

Run these only against the intended, approved cluster after checking `kubectl config current-context` and the Terraform `cluster_arn` output:

```powershell
kubectl get nodes
kubectl get pods,svc,ingress,hpa,pvc,servicemonitor -n signaldesk
kubectl get service ingress-nginx-controller -n ingress-nginx -o wide
helm list -n signaldesk
kubectl get applications.argoproj.io signaldesk -n argocd
kubectl get pods,pvc -n monitoring
```

For a fresh Prometheus or Grafana view, use the port-forward commands in `DEPLOYMENT.md`; stop each forward when its segment is done. The mandatory video and all live screenshots remain to be created after actual deployment.
