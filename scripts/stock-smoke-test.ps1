param(
  [string]$Base = "http://localhost:3001",
  [string]$Cookies = "cookies.txt"
)

$ErrorActionPreference = "Stop"
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

Write-Host "== STOCK SMOKE TEST ==" -ForegroundColor Cyan

Write-Host "`n1) Session:"
$sess = curl.exe -s -b $Cookies "$Base/api/auth/session"
Write-Host $sess

Write-Host "`n2) Pega 1 materialId:"
$m = curl.exe -s -b $Cookies "$Base/api/stock/ledger?take=1" | ConvertFrom-Json
if (-not $m.rows -or $m.rows.Count -eq 0) { throw "Sem rows no ledger. Faça uma entrada primeiro." }
$mid = $m.rows[0].materialId
Write-Host "materialId=$mid"

Write-Host "`n3) Ajuste inventário -> 10:"
$payloadAdj = "{`"materialId`":`"$mid`",`"newQuantity`":10,`"note`":`"smoke test`"}"
$rAdj = curl.exe -s -b $Cookies -H "Content-Type: application/json" -d $payloadAdj "$Base/api/stock/inventory-adjust"
Write-Host $rAdj

Write-Host "`n4) Saída manual (ISSUED) -> 1:"
$payloadIssue = "{`"materialId`":`"$mid`",`"quantity`":1,`"reason`":`"smoke test`"}"
$rIssue = curl.exe -s -b $Cookies -H "Content-Type: application/json" -d $payloadIssue "$Base/api/stock/issue"
Write-Host $rIssue

Write-Host "`n5) Ledger do material (take=5):"
$rLed = curl.exe -s -b $Cookies "$Base/api/stock/ledger?take=5&materialId=$mid"
Write-Host $rLed

Write-Host "`nOK ✅" -ForegroundColor Green
