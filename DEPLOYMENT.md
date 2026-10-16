# Phase 4 deployment runbook

This is a prepared runbook, not a record of a live deployment. No Terraform apply, EKS cluster, Kubernetes workload, or GHCR image has been created for this project yet.

## Ownership and order

| Owner | Resources |
|---|---|
| Terraform | AWS VPC, two public and two private subnets, internet/NAT routing, EKS, worker node group, Pod Identity Agent, and EBS CSI add-on |
| Kubernetes bootstrap files in `k8s/` | Namespace, gp3 StorageClass, PostgreSQL Services and StatefulSet with a persistent volume claim |
| Helm release `signaldesk` | Backend and frontend Deployments and ClusterIP Services, CPU HPA, Ingress, and an Alembic migration Job |
| Cluster operator | Database and GHCR pull Secrets, ingress-nginx, and Metrics Server |

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

## Cluster prerequisites after approval

The Ingress resource needs an ingress controller; the CPU HPA needs Metrics Server. Install them before the application. These commands are examples for the approved cluster, not commands executed in phase 4:

```powershell
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace --set controller.service.type=LoadBalancer --wait
helm upgrade --install metrics-server metrics-server/metrics-server --namespace kube-system --wait
kubectl get ingressclass
kubectl top nodes
```

Confirm that the `nginx` IngressClass exists and that the controller's LoadBalancer Service receives an address. The public subnet tags in Terraform allow load balancer discovery. An external load balancer can incur AWS charges. The [ingress-nginx chart](https://kubernetes.github.io/ingress-nginx/) supplies the controller; [Metrics Server](https://github.com/kubernetes-sigs/metrics-server) supplies resource metrics. For a cluster where the default Service load balancer integration does not provision a public endpoint, install and configure the AWS Load Balancer Controller before exposing ingress-nginx.

## Database and pull Secrets

From the project root, create the namespace, then run the interactive script. It reads the PostgreSQL password and, for private GHCR packages, a GitHub username and token with package read access. It sends Kubernetes Secret objects over standard input and does not write values to this repository or print them. The database Secret holds both `postgres-password` and a URL-encoded `database-url`; both use the same password. The pull Secret is named `ghcr-pull`.

```powershell
kubectl apply -f k8s/namespace.yaml
.\scripts\create-k8s-secrets.ps1
```

If both GHCR packages are public, run `.\scripts\create-k8s-secrets.ps1 -SkipGhcrPullSecret` and set `imagePullSecrets: []` in a private Helm values override. Never put a real database URL, password, token, Docker config, or private values file in Git. A Kubernetes Secret is an API object; access to it still needs appropriate RBAC and cluster encryption controls.

## Persistent database and application

The gp3 StorageClass uses the EBS CSI driver, `WaitForFirstConsumer`, encryption, and a 10 GiB `ReadWriteOnce` claim. The single PostgreSQL replica retains data through Pod restarts. Deleting its PVC deletes the EBS volume because this StorageClass has `reclaimPolicy: Delete`; take a backup before any database teardown.

```powershell
kubectl apply -f k8s/storageclass-ebs.yaml
kubectl apply -f k8s/postgres.yaml
kubectl rollout status statefulset/signaldesk-postgresql -n signaldesk --timeout=5m
kubectl get pvc -n signaldesk
```

Use the **full 40-character SHA from a successful push-to-main Actions run** and the exact lowercase owner/repository used by that run. The chart rejects an empty or non-SHA tag. It defaults to two frontend replicas and an HPA minimum of two backend replicas.

```powershell
$owner = '<lowercase-github-owner>'
$repo = '<lowercase-github-repository>'
$sha = '<full-published-commit-sha>'
helm upgrade --install signaldesk ./helm/signaldesk --namespace signaldesk --atomic --wait --timeout 10m --set-string global.imageTag=$sha --set-string backend.image.repository="ghcr.io/$owner/$($repo)-backend" --set-string frontend.image.repository="ghcr.io/$owner/$($repo)-frontend"
kubectl get pods,svc,ingress,hpa,pvc -n signaldesk
kubectl get ingress signaldesk -n signaldesk
```

The Ingress sends `/api` directly to the backend ClusterIP Service and `/` to the frontend ClusterIP Service. The frontend's Nginx also proxies `/api` to the backend for direct frontend Service access. The API readiness probe checks PostgreSQL; liveness only checks the process. The HPA uses CPU requests, so `kubectl top pods -n signaldesk` and `kubectl get hpa -n signaldesk` should show metrics after Metrics Server starts.

Use backward-compatible schema migrations for future rolling upgrades: existing backend Pods may continue serving while the pre-upgrade Job changes the schema.

## Teardown order after an approved demo

First back up incident data. Remove the Helm release and PostgreSQL bootstrap resources, then delete the database PVC and confirm the EBS volume is gone. Remove ingress-nginx and Metrics Server if they were installed only for this cluster. Only then run an approved `terraform destroy`; destroying EKS before CSI cleans the PVC can leave an orphaned paid EBS volume.

No cluster commands in this runbook have been executed against AWS for this handoff.
