param(
  [string]$Base = "http://localhost:3001",
  [string]$Email = "admin@demo.com",
  [string]$Password = "admin123",
  [string]$Cookies = "cookies.txt",
  [Parameter(Mandatory=$true)][string]$XmlPath
)

$ErrorActionPreference = "Stop"

function Login() {
  Remove-Item $Cookies -ErrorAction SilentlyContinue

  $csrfJson = curl.exe -s -c $Cookies "$Base/api/auth/csrf"
  $csrf = ($csrfJson | ConvertFrom-Json).csrfToken
  if (-not $csrf) { throw "CSRF vazio" }

  curl.exe -s -L `
    -b $Cookies -c $Cookies `
    -H "Content-Type: application/x-www-form-urlencoded" `
    --data "csrfToken=$([uri]::EscapeDataString($csrf))&email=$([uri]::EscapeDataString($Email))&password=$([uri]::EscapeDataString($Password))" `
    "$Base/api/auth/callback/credentials" | Out-Null

  $session = (curl.exe -s -b $Cookies "$Base/api/auth/session" | ConvertFrom-Json)
  if (-not $session.user.email) { throw "Sessão inválida" }
  Write-Host "OK: login user=$($session.user.email) role=$($session.user.role)"
}

Login

if (-not (Test-Path $XmlPath)) { throw "XML não encontrado: $XmlPath" }
$xml = Get-Content $XmlPath -Raw

$payloadObj = @{ xml = $xml }
$payload = ($payloadObj | ConvertTo-Json -Depth 10)

$tmp = Join-Path $env:TEMP ("nfe_payload_" + [guid]::NewGuid().ToString("N") + ".json")
Set-Content -Path $tmp -Value $payload -Encoding UTF8

Write-Host "POST $Base/api/fiscal/nfe/import"
$resp = curl.exe -s -b $Cookies -c $Cookies -H "Content-Type: application/json" --data-binary "@$tmp" "$Base/api/fiscal/nfe/import"

Remove-Item $tmp -ErrorAction SilentlyContinue

Write-Host "Response:"
Write-Host $resp