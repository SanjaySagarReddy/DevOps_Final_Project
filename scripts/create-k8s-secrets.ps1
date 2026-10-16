param(
    [string]$Namespace = 'signaldesk',
    [switch]$SkipGhcrPullSecret
)

$ErrorActionPreference = 'Stop'

function Read-SecretString([string]$Prompt) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function To-Base64([string]$Value) {
    return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Value))
}

function Apply-Secret($Secret) {
    $Secret | ConvertTo-Json -Depth 8 -Compress | kubectl apply --server-side --field-manager=signaldesk-secret-bootstrap -f -
    if ($LASTEXITCODE -ne 0) {
        throw "kubectl failed to create or update secret $($Secret.metadata.name)"
    }
}

kubectl get namespace $Namespace -o name | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Namespace $Namespace does not exist"
}

$databasePassword = Read-SecretString 'PostgreSQL password'
if ([string]::IsNullOrEmpty($databasePassword)) {
    throw 'PostgreSQL password must not be empty'
}

$encodedPassword = [Uri]::EscapeDataString($databasePassword)
$databaseUrl = "postgresql+psycopg://incident_app:$encodedPassword@signaldesk-postgresql:5432/incidentops"
Apply-Secret @{
    apiVersion = 'v1'
    kind = 'Secret'
    metadata = @{ name = 'signaldesk-db'; namespace = $Namespace }
    type = 'Opaque'
    data = @{
        'postgres-password' = To-Base64 $databasePassword
        'database-url' = To-Base64 $databaseUrl
    }
}

if (-not $SkipGhcrPullSecret) {
    $ghcrUsername = Read-Host 'GitHub username with package read access'
    $ghcrToken = Read-SecretString 'GHCR read token'
    if ([string]::IsNullOrWhiteSpace($ghcrUsername) -or [string]::IsNullOrEmpty($ghcrToken)) {
        throw 'GHCR username and token are required'
    }

    $dockerConfig = @{
        auths = @{
            'ghcr.io' = @{
                auth = To-Base64 "${ghcrUsername}:$ghcrToken"
            }
        }
    } | ConvertTo-Json -Depth 8 -Compress

    Apply-Secret @{
        apiVersion = 'v1'
        kind = 'Secret'
        metadata = @{ name = 'ghcr-pull'; namespace = $Namespace }
        type = 'kubernetes.io/dockerconfigjson'
        data = @{
            '.dockerconfigjson' = To-Base64 $dockerConfig
        }
    }
}

$databasePassword = $null
$databaseUrl = $null
$ghcrToken = $null
$dockerConfig = $null
Write-Host 'Kubernetes Secrets are ready in the selected namespace.'
