"""Extract safe, traceable excerpts from ignored Terraform deployment logs.

Run from the project root after a real deployment. The raw logs and plan file
remain under ignored .tools/ because they contain the operator's EKS API CIDR.
"""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".tools"
OUT = ROOT / "demo" / "evidence"


def archived_lines(name: str) -> list[str]:
    return (SOURCE / name).read_text(encoding="utf-16").splitlines()


def write(name: str, lines: list[str]) -> None:
    (OUT / name).write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


plan = archived_lines("signaldesk-approved-plan-output.txt")
resources = [line.strip() for line in plan if re.fullmatch(r"\s*# aws_[^\r\n]+ will be created", line)]
summary = [line.strip() for line in plan if re.fullmatch(r"Plan: \d+ to add, \d+ to change, \d+ to destroy\.", line)]
if len(resources) != 28 or summary != ["Plan: 28 to add, 0 to change, 0 to destroy."]:
    raise RuntimeError("Archived original plan does not match the reviewed 28-resource plan")

write(
    "terraform-original-plan-excerpt.txt",
    [
        "Archived original approved Terraform plan, 2026-10-17, ap-southeast-2",
        "Source: ignored .tools/signaldesk-approved-plan-output.txt (real plan output)",
        "Selected resource headings and summary only; operator EKS API CIDR omitted.",
        "The original t3.large node group failed account eligibility; recovery used m7i-flex.large.",
        "",
        *resources,
        "",
        summary[0],
    ],
)

first_apply = archived_lines("signaldesk-apply.log")
recovery = archived_lines("signaldesk-recovery-apply.log")
initial_created = [
    re.sub(r" \[id=[^]]+\]", " [resource ID omitted]", line.strip())
    for line in first_apply
    if re.match(r"^aws_[^:]+: Creation complete after ", line)
]
recovery_created = [
    re.sub(r" \[id=[^]]+\]", " [resource ID omitted]", line.strip())
    for line in recovery
    if re.match(r"^aws_[^:]+: Creation complete after ", line)
]
recovery_summary = [line.strip() for line in recovery if line.startswith("Apply complete!")]
if len(initial_created) < 20 or len(recovery_created) != 3 or recovery_summary != [
    "Apply complete! Resources: 3 added, 0 changed, 0 destroyed."
]:
    raise RuntimeError("Archived apply logs do not match the reviewed deployment")

write(
    "terraform-apply-recovery-excerpt.txt",
    [
        "Archived approved Terraform apply and recovery, 2026-10-17, ap-southeast-2",
        "Sources: ignored .tools/signaldesk-apply.log and signaldesk-recovery-apply.log",
        "Actual resource creation lines; AWS resource IDs omitted.",
        "First apply created the network and EKS but t3.large worker launch was rejected by this account.",
        "The failed node group was removed; the recovery apply used m7i-flex.large.",
        "",
        "First apply: completed resource creations before the node group error",
        *initial_created,
        "",
        "Recovery apply: successful replacement node group and add-ons",
        *recovery_created,
        recovery_summary[0],
    ],
)

print("Wrote two sanitized excerpts from the archived Terraform logs")
