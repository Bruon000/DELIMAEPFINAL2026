param(
  [string]$Base = "http://localhost:3001",
  [string]$Email = "admin@demo.com",
  [string]$Password = "admin123",
  [string]$Cookies = "cookies.txt",
  [Parameter(Mandatory=$true)][string]$XmlPath,
  [switch]$TestDedupe
)

$ErrorActionPreference = "Stop"

# UTF-8 para console e payload
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

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
$xml = Get-Content $XmlPath -Raw -Encoding UTF8
$xmlSize = [System.Text.Encoding]::UTF8.GetByteCount($xml)
Write-Host "Arquivo XML: $XmlPath"
Write-Host "Tamanho: $xmlSize bytes"
Write-Host ""

$payloadObj = @{ xml = $xml }
$payload = ($payloadObj | ConvertTo-Json -Depth 10)
$tmp = Join-Path $env:TEMP ("nfe_payload_" + [guid]::NewGuid().ToString("N") + ".json")
[System.IO.File]::WriteAllText($tmp, $payload, [System.Text.UTF8Encoding]::UTF8)

Write-Host "POST $Base/api/fiscal/nfe/import"
$respRaw = curl.exe -s -w "`n%{http_code}" -b $Cookies -c $Cookies -H "Content-Type: application/json; charset=utf-8" --data-binary "@$tmp" "$Base/api/fiscal/nfe/import"
Remove-Item $tmp -ErrorAction SilentlyContinue

$lines = $respRaw -split "`n"
$httpCode = $lines[-1]
$body = ($lines[0..($lines.Length - 2)] -join "`n").Trim()

Write-Host "HTTP code: $httpCode"
Write-Host "Body: $body"

if ($httpCode -match "^\d{3}$") {
  $obj = $body | ConvertFrom-Json -ErrorAction SilentlyContinue
  if ($obj -and $obj.ok -and $obj.purchaseOrderId) {
    $url = "$Base/compras/pedidos/$($obj.purchaseOrderId)"
    Write-Host "URL do pedido: $url"
  }
  if ([int]$httpCode -ge 400) {
    Write-Host "Erro: $body"
  }
}

# Teste de dedupe opcional
if ($TestDedupe -and ($httpCode -eq "201" -or $httpCode -eq "200")) {
  $first = $body | ConvertFrom-Json -ErrorAction SilentlyContinue
  $firstPoId = $first.purchaseOrderId
  Write-Host ""
  Write-Host "Teste de dedupe: reenviando mesmo XML..."
  $tmp2 = Join-Path $env:TEMP ("nfe_payload2_" + [guid]::NewGuid().ToString("N") + ".json")
  [System.IO.File]::WriteAllText($tmp2, $payload, [System.Text.UTF8Encoding]::UTF8)
  $resp2 = curl.exe -s -w "`n%{http_code}" -b $Cookies -c $Cookies -H "Content-Type: application/json; charset=utf-8" --data-binary "@$tmp2" "$Base/api/fiscal/nfe/import"
  Remove-Item $tmp2 -ErrorAction SilentlyContinue
  $lines2 = $resp2 -split "`n"
  $body2 = ($lines2[0..($lines2.Length - 2)] -join "`n").Trim()
  $second = $body2 | ConvertFrom-Json -ErrorAction SilentlyContinue
  if (-not $second.alreadyImported) { throw "Dedupe falhou: segundo request deveria retornar alreadyImported=true" }
  if ($firstPoId -and $second.purchaseOrderId -and $firstPoId -ne $second.purchaseOrderId) {
    throw "Dedupe falhou: purchaseOrderId divergente (primeiro=$firstPoId, segundo=$($second.purchaseOrderId))"
  }
  Write-Host "Dedupe OK: alreadyImported=true, purchaseOrderId=$($second.purchaseOrderId)"
}
