# Deployment runbook (prepared, not executed)

This is a prepared runbook, not a record of a live AWS deployment. The approved GitHub push created two public SHA-tagged GHCR images, but no Terraform apply, EKS cluster, or Kubernetes workload has been created for this project yet. See the root README and evidence checklist for the verified image SHA and run URL.

## Ownership and order

| Owner | Resources |
|---|---|
| Terraform | AWS VPC, two public and two private subnets, internet/NAT routing, EKS, worker node group, Pod Identity Agent, and EBS CSI add-on |
| Kubernetes bootstrap files in `k8s/` | Namespace, gp3 StorageClass, PostgreSQL Services and StatefulSet with a persistent volume claim |
| Helm release `signaldesk` during the initial demo, then ArgoCD Application `signaldesk` | Backend and frontend Deployments and ClusterIP Services, CPU HPA, Ingress, ServiceMonitor, Grafana dashboard ConfigMap, and an Alembic migration Job |
| Helm release `kube-prometheus-stack` | Prometheus Operator, Prometheus, and Grafana |
| Helm release `argocd` | ArgoCD controllers and UI |
| Cluster operator | Database, GHCR pull, and Grafana admin Secrets; AWS Load Balancer Controller, ingress-nginx, and Metrics Server |

The PostgreSQL StatefulSet must be ready before installing the Helm chart. The chart's `pre-install,pre-upgrade` Job runs `alembic upgrade head` once per release operation. If migration fails, Helm stops before creating or updating the application Deployments. Backend replicas only run Uvicorn; they do not each race to run Alembic.

## Terraform preparation

From `terraform/`, copy `terraform.tfvars.example` to ignored `terraform.tfvars`. Set `cluster_endpoint_public_access_cidrs` to the operator's actual public IP with a `/32` mask. The example `203.0.113.0/24` is documentation space and will not allow normal administrator access. Keep `aws_region` and `availability_zones` consistent. Review the two `t3.large` worker nodes, one NAT gateway, EKS, and EBS costs before approval.

```powershell
cd terraform
terraform fmt -check -recursive
terraform init
terraform validate
terraform plan -var-file=terraform.tfvars
cd ..
```

`terraform plan` is read-only. A live plan still needs AWS credentials with VPC, IAM, EKS, EC2, and EBS permissions. Terraform state and private variable files are ignored by Git; store real state securely before team use. Do not run `terraform apply` until deployment is explicitly approved.

For local syntax and graph validation without AWS credentials, use `terraform init -backend=false`, `terraform validate`, and `terraform plan -refresh=false -var-file=terraform.tfvars.example -var='offline_plan=true'` with dummy AWS environment credentials. `offline_plan` only skips provider account checks for that refresh-free plan. Never apply with it enabled.

After an approved apply, use the `configure_kubectl` Terraform output command. Terraform installs the [EBS CSI add-on with Pod Identity](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html) so the gp3 StorageClass can provision the PostgreSQL claim. Check both add-ons and the worker nodes before proceeding.

## Public Ingress and cluster prerequisites after approval

The chosen path is **internet-facing AWS NLB → ingress-nginx → `/api` backend or `/` frontend**. The [AWS Load Balancer Controller](https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html) creates the NLB from the ingress-nginx `LoadBalancer` Service. The chart values in `k8s/ingress-nginx-values.yaml` explicitly select `service.k8s.aws/nlb`, `internet-facing`, and IP targets. Terraform tags the public subnets for load balancer discovery. Public NLBs incur AWS charges. Install the controller before ingress-nginx; install Metrics Server for the CPU HPA. These commands are for a future approved cluster and have not been executed here.

The cluster operator needs AWS CLI, `eksctl`, `kubectl`, and Helm, plus IAM permissions to create a policy and Pod Identity association. Terraform already installs the EKS Pod Identity Agent. Check the selected AWS identity and kubeconfig before creating anything:

```powershell
$cluster = terraform -chdir=terraform output -raw cluster_name
$region = terraform -chdir=terraform output -raw aws_region
$expectedArn = terraform -chdir=terraform output -raw cluster_arn
$vpcId = terraform -chdir=terraform output -raw vpc_id
aws sts get-caller-identity
kubectl config current-context
kubectl config view --minify -o 'jsonpath={.contexts[0].context.cluster}'
kubectl get nodes
```

Create the controller IAM policy from the [versioned upstream policy](https://docs.aws.amazon.com/eks/latest/userguide/lbc-helm.html). If it already exists, use its ARN instead of running `create-policy` again. The file below stays under ignored `.tools/`; it contains permissions, not credentials. `eksctl` creates the Pod Identity role and associates it with the controller ServiceAccount. Verify the association before installing the chart:

```powershell
New-Item -ItemType Directory -Force .tools | Out-Null
$policyFile = Join-Path (Resolve-Path .tools) 'aws-load-balancer-controller-iam-policy.json'
Invoke-WebRequest 'https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.14.0/docs/install/iam_policy.json' -OutFile $policyFile
$policyArn = aws iam create-policy --policy-name SignalDeskAWSLoadBalancerController --policy-document "file://$policyFile" --query 'Policy.Arn' --output text
kubectl create serviceaccount aws-load-balancer-controller -n kube-system
eksctl create podidentityassociation --cluster $cluster --region $region --namespace kube-system --service-account-name aws-load-balancer-controller --permission-policy-arns $policyArn
eksctl get podidentityassociation --cluster $cluster --region $region --namespace kube-system --service-account-name aws-load-balancer-controller
```

Then install the AWS controller, ingress-nginx, and Metrics Server. For a controller chart upgrade, first apply its [current CRDs](https://docs.aws.amazon.com/eks/latest/userguide/lbc-helm.html), because Helm upgrade does not update them automatically. The pinned AWS controller chart `1.14.0` declares controller app version `v2.14.0`, matching the versioned IAM policy above. Review both versions together before a future upgrade.

```powershell
helm repo add eks https://aws.github.io/eks-charts
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller --namespace kube-system --version 1.14.0 --set-string "clusterName=$cluster" --set serviceAccount.create=false --set-string serviceAccount.name=aws-load-balancer-controller --set-string "region=$region" --set-string "vpcId=$vpcId" --wait
kubectl rollout status deployment/aws-load-balancer-controller -n kube-system --timeout=5m
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace -f k8s/ingress-nginx-values.yaml --wait
helm upgrade --install metrics-server metrics-server/metrics-server --namespace kube-system --wait
kubectl get ingressclass
kubectl get service ingress-nginx-controller -n ingress-nginx -o wide
kubectl top nodes
```

Confirm `nginx` IngressClass and a public hostname in the ingress-nginx Service status. Test the hostname from outside the cluster only after the application is deployed. The controller runs HTTP on port 80 in this demo; arrange a domain, TLS certificate, and HTTPS listener before exposing sensitive production traffic. [ingress-nginx](https://kubernetes.github.io/ingress-nginx/) supplies path routing and [Metrics Server](https://github.com/kubernetes-sigs/metrics-server) supplies HPA CPU metrics.

## Database and pull Secrets

From the project root, create the namespace, then run the interactive script. It reads the PostgreSQL password and, for private GHCR packages, a GitHub username and token with package read access. It sends Kubernetes Secret objects over standard input and does not write values to this repository or print them. The database Secret holds both `postgres-password` and a URL-encoded `database-url`; both use the same password. The pull Secret is named `ghcr-pull`.

```powershell
kubectl apply -f k8s/namespace.yaml
$expectedArn = terraform -chdir=terraform output -raw cluster_arn
$expectedContext = kubectl config current-context # verify this exact context yourself first
.\scripts\create-k8s-secrets.ps1 -ExpectedContext $expectedContext -ExpectedClusterArn $expectedArn
```

If both GHCR packages are public, add `-SkipGhcrPullSecret` to that command and set `imagePullSecrets: []` in a private Helm values override. The script refuses to update any Secret unless the active kubeconfig context and its cluster ARN exactly match the expected values. Never put a real database URL, password, token, Docker config, or private values file in Git. A Kubernetes Secret is an API object; access to it still needs appropriate RBAC and cluster encryption controls.

## Persistent database and application

The gp3 StorageClass uses the EBS CSI driver, `WaitForFirstConsumer`, encryption, and a 10 GiB `ReadWriteOnce` claim. The single PostgreSQL replica retains data through Pod restarts. Deleting its PVC deletes the EBS volume because this StorageClass has `reclaimPolicy: Delete`; take a backup before any database teardown.

```powershell
kubectl apply -f k8s/storageclass-ebs.yaml
kubectl apply -f k8s/postgres.yaml
kubectl rollout status statefulset/signaldesk-postgresql -n signaldesk --timeout=5m
kubectl get pvc -n signaldesk
```

## Prometheus and Grafana after approval

Install the [kube-prometheus-stack chart](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) before enabling the SignalDesk ServiceMonitor. Its committed values select ServiceMonitors across namespaces, persist Prometheus and Grafana data on gp3, and make Grafana's dashboard sidecar watch labeled ConfigMaps in all namespaces. The admin credential comes from a separately created Secret; Grafana is reachable by port-forward only. The monitoring release owns its own CRDs and components, while the SignalDesk chart owns its ServiceMonitor and dashboard ConfigMap. Budget for two more EBS volumes and the stack's memory use.

```powershell
kubectl create namespace monitoring
$expectedArn = terraform -chdir=terraform output -raw cluster_arn
$expectedContext = kubectl config current-context # verify this exact context yourself first
.\scripts\create-grafana-secret.ps1 -ExpectedContext $expectedContext -ExpectedClusterArn $expectedArn
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack --namespace monitoring -f monitoring/kube-prometheus-stack-values.yaml --wait --timeout 15m
kubectl get crd servicemonitors.monitoring.coreos.com
kubectl get pods,pvc -n monitoring
```

Once SignalDesk is deployed with monitoring enabled, inspect its ServiceMonitor and its two backend targets. Forward Prometheus locally with `kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090` and check **Status → Targets** for the SignalDesk target `UP`. Forward Grafana with `kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3001:80`, sign in with the password you supplied, and open **SignalDesk incident API**. Create or edit an incident, then refresh the dashboard. Its request-rate panel uses `incident_http_requests_total` from `/metrics`, and its p95 panel uses `incident_http_request_duration_seconds_bucket`. A fresh system needs API traffic and a few scrape intervals before the rate panels populate. These live checks are still pending a real cluster.

Use the **full 40-character SHA from a successful push-to-main Actions run** and the exact lowercase owner/repository used by that run. The chart rejects an empty or non-SHA tag. It defaults to two frontend replicas and an HPA minimum of two backend replicas.

```powershell
$owner = '<lowercase-github-owner>'
$repo = '<lowercase-github-repository>'
$sha = '<full-published-commit-sha>'
helm upgrade --install signaldesk ./helm/signaldesk --namespace signaldesk -f ./helm/signaldesk/values-monitoring.yaml --atomic --wait --timeout 10m --set-string global.imageTag=$sha --set-string backend.image.repository="ghcr.io/$owner/$($repo)-backend" --set-string frontend.image.repository="ghcr.io/$owner/$($repo)-frontend"
kubectl get pods,svc,ingress,hpa,pvc,servicemonitor -n signaldesk
kubectl get ingress signaldesk -n signaldesk
helm list -n signaldesk
```

The Ingress sends `/api` directly to the backend ClusterIP Service and `/` to the frontend ClusterIP Service. The frontend's Nginx also proxies `/api` to the backend for direct frontend Service access. The API readiness probe checks PostgreSQL; liveness only checks the process. The HPA uses CPU requests, so `kubectl top pods -n signaldesk` and `kubectl get hpa -n signaldesk` should show metrics after Metrics Server starts.

Use backward-compatible schema migrations for future rolling upgrades: existing backend Pods may continue serving while the pre-upgrade Job changes the schema.

## ArgoCD GitOps handoff after approval

The initial manual `signaldesk` Helm release supports a `helm list -n signaldesk` demo. **Do not let that release and ArgoCD manage the same objects at the same time.** Capture the Helm evidence, then uninstall only the application release. The PostgreSQL StatefulSet, Secrets, gp3 StorageClass, monitoring stack, and ingress controller are independent and remain available. Expect brief application downtime during this handoff. [ArgoCD renders Helm charts as manifests rather than installing a Helm release](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/), so `helm list -n signaldesk` will be empty for the application after handoff; use the ArgoCD Application view as the GitOps evidence.

First, when a GitHub remote and a successful GHCR publication exist, edit and commit `helm/signaldesk/values-gitops.yaml` with the exact lowercase `ghcr.io/<owner>/<repo>-backend` and `-frontend` repositories and one published full 40-character Git SHA. The tracked values file is ArgoCD's deployment pointer. A later commit that changes that file to another **already published** SHA triggers the GitOps rollout. The SHA commit containing the values change will itself publish another pair of images; it is fine for the tracked deployment pointer to lag that newer build until intentionally updated. Never add database credentials or GHCR tokens to this file. A private GitHub repository also needs a read-only ArgoCD repository connection configured outside Git; private GHCR images still use the `ghcr-pull` Secret.

```powershell
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm upgrade --install argocd argo/argo-cd --namespace argocd --create-namespace -f gitops/argocd-values.yaml --wait --timeout 15m
kubectl get pods -n argocd
Copy-Item gitops/signaldesk-application.example.yaml gitops/signaldesk-application.local.yaml
# Edit the ignored local copy: replace REPLACE_OWNER and REPLACE_REPO with the real GitHub path.
helm list -n signaldesk # capture initial Helm release evidence before handoff
helm uninstall signaldesk -n signaldesk
kubectl apply -f gitops/signaldesk-application.local.yaml
kubectl get applications.argoproj.io signaldesk -n argocd
```

The ArgoCD Application tracks the `main` branch and uses `values-gitops.yaml`; automated sync has self-heal and prune enabled. Its migration Job is a `PreSync` hook and must complete before the two backend replicas update. The Job runs `alembic upgrade head` once per sync, with the same database Secret. Forward the UI locally with `kubectl port-forward -n argocd svc/argocd-server 8081:443`, retrieve the generated initial admin credential using the [ArgoCD installation guide](https://argo-cd.readthedocs.io/en/stable/getting_started/), and verify the Application is `Synced` and `Healthy`. Confirm the new SHA appears in the Deployment images, the migration Job succeeds, and both `/` and `/api` work through the public NLB. ArgoCD and monitoring have no public Ingress in this runbook.

## Teardown order after an approved demo

First back up incident data. Remove the application from its **current** owner (Helm release or ArgoCD Application), then remove PostgreSQL and the monitoring Helm release. Delete their PVCs and confirm the EBS volumes are gone. Remove ArgoCD, ingress-nginx, the AWS Load Balancer Controller, and Metrics Server if installed only for this cluster; confirm the NLB is gone. Only then run an approved `terraform destroy`; destroying EKS before CSI cleans the PVCs can leave orphaned paid EBS volumes. The controller IAM policy and `eksctl` Pod Identity role/association are separate from Terraform and need their own reviewed cleanup.

No cluster commands in this runbook have been executed against AWS for this handoff.
