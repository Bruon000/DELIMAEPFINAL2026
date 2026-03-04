param(
  [string]$Base = "http://localhost:3001",
  [string]$Email = "admin@demo.com",
  [string]$Password = "admin123",
  [string]$Cookies = "cookies.txt",
  [int]$Take = 1
)

$ErrorActionPreference = "Stop"

# UTF-8 no console
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

function CurlJson([string]$Url) {
  return (curl.exe -s -b $Cookies -c $Cookies $Url)
}

function EnsureLogin() {
  Remove-Item $Cookies -ErrorAction SilentlyContinue

  # 1) pega CSRF e grava cookies
  $csrfJson = curl.exe -s -c $Cookies -b $Cookies "$Base/api/auth/csrf"
  $csrf = ($csrfJson | ConvertFrom-Json).csrfToken
  if (-not $csrf) { throw "Falha ao obter csrfToken em $Base/api/auth/csrf" }

  # 2) faz login via form-urlencoded (NextAuth Credentials)
  $body =
    "csrfToken=$([Uri]::EscapeDataString($csrf))" +
    "&email=$([Uri]::EscapeDataString($Email))" +
    "&password=$([Uri]::EscapeDataString($Password))" +
    "&callbackUrl=$([Uri]::EscapeDataString($Base))"

  curl.exe -s -i -m 20 -c $Cookies -b $Cookies `
    -H "Content-Type: application/x-www-form-urlencoded" `
    --data-raw "$body" `
    "$Base/api/auth/callback/credentials" | Out-Null

  # 3) confere sessão
  $sess = curl.exe -s -b $Cookies "$Base/api/auth/session"
  $obj = $sess | ConvertFrom-Json -ErrorAction SilentlyContinue
  if (-not $obj -or -not $obj.user -or -not $obj.expires) {
    throw "Login falhou. Session retornou: $sess"
  }
  Write-Host "OK login: $($obj.user.email) role=$($obj.user.role) companyId=$($obj.user.companyId)"
}

function GetAnyMaterialIdFromLedger() {
  $raw = CurlJson "$Base/api/stock/ledger?take=$Take"
  $j = $raw | ConvertFrom-Json -ErrorAction SilentlyContinue
  if (-not $j -or -not $j.ok) { throw "Ledger falhou: $raw" }
  if (-not $j.rows -or $j.rows.Count -lt 1) { throw "Ledger vazio: $raw" }
  return $j.rows[0].materialId
}

function PostJson([string]$Url, [string]$Json) {
  $tmp = Join-Path $env:TEMP ("stock_payload_" + [guid]::NewGuid().ToString("N") + ".json")
  [System.IO.File]::WriteAllText($tmp, $Json, [System.Text.UTF8Encoding]::UTF8)
  $respRaw = curl.exe -s -w "`n%{http_code}" -b $Cookies -c $Cookies `
    -H "Content-Type: application/json; charset=utf-8" `
    --data-binary "@$tmp" `
    "$Url"
  Remove-Item $tmp -ErrorAction SilentlyContinue

  $lines = $respRaw -split "`n"
  $http = $lines[-1].Trim()
  $body = ($lines[0..($lines.Length-2)] -join "`n").Trim()
  return @{ http = $http; body = $body }
}

EnsureLogin

Write-Host ""
Write-Host "1) Ledger (sanity)"
$ledger = CurlJson "$Base/api/stock/ledger?take=3"
Write-Host $ledger

$mid = GetAnyMaterialIdFromLedger
Write-Host ""
Write-Host "MaterialId escolhido: $mid"

Write-Host ""
Write-Host "2) Ajuste inventário -> set newQuantity=10"
$adj = PostJson "$Base/api/stock/inventory-adjust" ("{""materialId"":""$mid"",""newQuantity"":10,""note"":""smoke inventario""}")
Write-Host "HTTP=$($adj.http)"
Write-Host $adj.body

Write-Host ""
Write-Host "3) Saída manual -> quantity=1"
$iss = PostJson "$Base/api/stock/issue" ("{""materialId"":""$mid"",""quantity"":1,""reason"":""smoke""}")
Write-Host "HTTP=$($iss.http)"
Write-Host $iss.body

Write-Host ""
Write-Host "4) Ledger filtrado (materialId)"
$ledger2 = CurlJson "$Base/api/stock/ledger?take=5&materialId=$mid"
Write-Host $ledger2

Write-Host ""
Write-Host "OK smoke-test finalizado."
