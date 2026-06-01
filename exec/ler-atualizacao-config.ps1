param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath
)

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    exit 1
}

$c = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

if ($c.destinoPadrao) { Write-Output "DEST=$($c.destinoPadrao)" }
if ($c.zipUrl) { Write-Output "ZIPURL=$($c.zipUrl)" }
if ($c.github.owner) { Write-Output "OWNER=$($c.github.owner)" }
if ($c.github.repo) { Write-Output "REPO=$($c.github.repo)" }
if ($c.github.branch) { Write-Output "BRANCH=$($c.github.branch)" }
