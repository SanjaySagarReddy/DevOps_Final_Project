variable "project_name" {
  description = "Short name used for AWS resource names."
  type        = string
  default     = "signaldesk"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,25}$", var.project_name))
    error_message = "Use 3-26 lowercase letters, numbers, or hyphens, starting with a letter."
  }
}

variable "aws_region" {
  description = "AWS region for the VPC and EKS cluster."
  type        = string
  default     = "ap-southeast-2"
}

variable "availability_zones" {
  description = "Two availability zones in aws_region, in a stable order."
  type        = list(string)
  default     = ["ap-southeast-2a", "ap-southeast-2b"]

  validation {
    condition     = length(var.availability_zones) >= 2 && length(distinct(var.availability_zones)) == length(var.availability_zones)
    error_message = "Provide at least two distinct availability zones."
  }
}

variable "vpc_cidr" {
  description = "VPC IPv4 CIDR. The subnet layout uses /24s from this /16."
  type        = string
  default     = "10.50.0.0/16"

  validation {
    condition     = can(regex("/16$", var.vpc_cidr)) && can(cidrhost(var.vpc_cidr, 1))
    error_message = "Provide a valid IPv4 /16 CIDR."
  }
}

variable "node_instance_types" {
  description = "EC2 instance types for the managed node group."
  type        = list(string)
  default     = ["t3.large"]
}

variable "node_desired_size" {
  description = "Initial count of worker nodes."
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum count of worker nodes."
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum count of worker nodes; this configuration does not install Cluster Autoscaler."
  type        = number
  default     = 3
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "Public CIDRs allowed to reach the EKS API. Replace the example before deployment."
  type        = list(string)
  default     = ["203.0.113.0/24"]
}

variable "offline_plan" {
  description = "Skip AWS credential/account checks only for a local, refresh-free plan. Never apply with this true."
  type        = bool
  default     = false
}
