param(
  [string]$Base = "http://localhost:3001",
  [string]$Email = "admin@demo.com",
  [string]$Password = "admin123",
  [string]$Cookies = "cookies.txt"
)

$ErrorActionPreference = "Stop"

function CurlJson([string]$Method, [string]$Url, $BodyObj = $null) {
  $tmp = Join-Path $env:TEMP ("curl_body_" + [guid]::NewGuid().ToString("N") + ".txt")

  $args = @("-s", "-b", $Cookies, "-c", $Cookies, "-X", $Method)
  if ($BodyObj -ne $null) {
    $json = ($BodyObj | ConvertTo-Json -Depth 20 -Compress)
    $args += @("-H", "Content-Type: application/json", "--data", $json)
  }
  $args += @("-o", $tmp, "-w", "%{http_code}", $Url)

  $code = (& curl.exe @args) -join ""
  $body = ""
  if (Test-Path $tmp) { $body = Get-Content $tmp -Raw }
  Remove-Item $tmp -ErrorAction SilentlyContinue

  if ($code -notmatch '^\d{3}$') { throw "Sem HTTP code em $Url. Retorno: $code`n$body" }
  $n = [int]$code
  if ($n -lt 200 -or $n -ge 300) { throw "HTTP $n em $Url`n$body" }

  if ($body) { return $body }
  return "{}"
}

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

# supplier
$sup = (curl.exe -s -b $Cookies "$Base/api/suppliers" | ConvertFrom-Json)
$supplierId = $sup.suppliers[0].id
if (-not $supplierId) { throw "Nenhum supplier encontrado" }
Write-Host "OK: supplierId=$supplierId"

# material
$m = (curl.exe -s -b $Cookies "$Base/api/materials" | ConvertFrom-Json)
$material = $m.materials[0]
if (-not $material.id) { throw "Nenhum material encontrado" }
$materialId = $material.id
$unitCost = [decimal]$material.currentCost
Write-Host "OK: materialId=$materialId name=$($material.name) cost=$unitCost"

# criar PO
$poCreateBody = @{
  supplierId = $supplierId
  notes = "E2E curl test"
}
$poBody = CurlJson "POST" "$Base/api/purchase-orders" $poCreateBody
$po = $poBody | ConvertFrom-Json
$poId = $po.id
if (-not $poId) { throw "POST /api/purchase-orders não retornou id. Body=`n$poBody" }
Write-Host "OK: PO criado id=$poId status=$($po.status)"

# adicionar item
$itemBody = @{
  materialId = $materialId
  quantity = 2
  unitCost = $unitCost
}
$itemResp = CurlJson "POST" "$Base/api/purchase-orders/$poId/items" $itemBody
Write-Host "OK: item adicionado"

# enviar
$sendResp = CurlJson "POST" "$Base/api/purchase-orders/$poId/send" @{}
Write-Host "OK: PO enviado"

# receber
$recvResp = CurlJson "POST" "$Base/api/purchase-orders/$poId/receive" @{}
Write-Host "OK: PO recebido"

# validar status final
$list = (curl.exe -s -b $Cookies "$Base/api/purchase-orders" | ConvertFrom-Json)
$found = $list.purchaseOrders | Where-Object { $_.id -eq $poId } | Select-Object -First 1
if (-not $found) { throw "PO não apareceu na listagem" }
Write-Host "OK: PO final status=$($found.status)"
if ($found.status -ne "RECEIVED") { throw "Esperado RECEIVED, veio $($found.status)" }

Write-Host "E2E PO PASS ✅"
