param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ExpectedContext,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^arn:aws[a-z-]*:eks:[a-z0-9-]+:[0-9]{12}:cluster/.+$')]
    [string]$ExpectedClusterArn
)

$ErrorActionPreference = 'Stop'

$currentContext = kubectl config current-context
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($currentContext)) {
    throw 'Refusing to update Grafana Secret: no current kubeconfig context is available'
}
$currentContext = $currentContext.Trim()
if ($currentContext -ne $ExpectedContext) {
    throw "Refusing to update Grafana Secret: current context '$currentContext' does not match expected '$ExpectedContext'"
}

$currentCluster = kubectl config view --minify -o 'jsonpath={.contexts[0].context.cluster}'
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($currentCluster)) {
    throw 'Refusing to update Grafana Secret: no current kubeconfig cluster is available'
}
$currentCluster = $currentCluster.Trim()
if ($currentCluster -ne $ExpectedClusterArn) {
    throw "Refusing to update Grafana Secret: current cluster '$currentCluster' does not match expected '$ExpectedClusterArn'"
}

kubectl --context $ExpectedContext get namespace monitoring -o name | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Namespace monitoring does not exist'
}

$secure = Read-Host -Prompt 'Grafana admin password' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ([string]::IsNullOrEmpty($password)) {
        throw 'Grafana admin password must not be empty'
    }
    $secret = @{
        apiVersion = 'v1'
        kind = 'Secret'
        metadata = @{ name = 'signaldesk-grafana-admin'; namespace = 'monitoring' }
        type = 'Opaque'
        data = @{
            'admin-user' = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('admin'))
            'admin-password' = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($password))
        }
    }
    $secret | ConvertTo-Json -Depth 6 -Compress | kubectl --context $ExpectedContext apply --server-side --field-manager=signaldesk-secret-bootstrap -f -
    if ($LASTEXITCODE -ne 0) {
        throw 'kubectl failed to create or update Grafana Secret'
    }
}
finally {
    $password = $null
    $secret = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}

Write-Host 'Grafana admin Secret is ready in namespace monitoring.'
