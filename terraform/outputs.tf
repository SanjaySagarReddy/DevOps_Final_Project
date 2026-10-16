output "cluster_name" {
  value = aws_eks_cluster.main.name
}

output "aws_region" {
  value = var.aws_region
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = [for subnet in values(aws_subnet.public) : subnet.id]
}

output "private_subnet_ids" {
  value = [for subnet in values(aws_subnet.private) : subnet.id]
}

output "node_group_name" {
  value = aws_eks_node_group.main.node_group_name
}

output "configure_kubectl" {
  value = format("aws eks update-kubeconfig --region %s --name %s", var.aws_region, aws_eks_cluster.main.name)
}
