Write-Host "=== REPO ==="
git remote -v
Write-Host "`n=== BRANCH ==="
git branch --show-current
Write-Host "`n=== STATUS ==="
git status
Write-Host "`n=== LAST 10 COMMITS ==="
git --no-pager log -10 --oneline
Write-Host "`n=== PONTO-ATUAL.md ==="
if (Test-Path .\PONTO-ATUAL.md) { Get-Content .\PONTO-ATUAL.md } else { Write-Host "Sem PONTO-ATUAL.md" }
