param(
  [string]$OutDir = ".\_inventario\cursor_bundle"
)

$ErrorActionPreference = "Stop"

function EnsureDir([string]$p) {
  New-Item -ItemType Directory -Force -Path $p | Out-Null
}

function Utf8NoBomWrite([string]$path, [string]$content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

function SafeName([string]$path) {
  # evita wildcard e caracteres inválidos: inclusive [ ] que quebram Out-File
  $name = $path -replace '[\\/:*?"<>|\[\]]','_'
  if (-not $name.ToLower().EndsWith(".txt")) { $name += ".txt" }
  return $name
}

EnsureDir $OutDir

Write-Host "== Cursor bundle => $OutDir"

# 1) contexto git
Utf8NoBomWrite (Join-Path $OutDir "git_status.txt") (git status | Out-String)
Utf8NoBomWrite (Join-Path $OutDir "git_diff.txt") (git --no-pager diff | Out-String)
Utf8NoBomWrite (Join-Path $OutDir "git_log_30.txt") (git --no-pager log -30 --oneline | Out-String)

# 2) rotas/páginas (app router)
$appRoot = (Resolve-Path ".\app").Path

$routes = Get-ChildItem -Path .\app -Recurse -File -Include "route.ts","route.js","route.tsx","route.jsx" |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.next\\|\\\.backups\\|\\_inventario\\' } |
  ForEach-Object {
    $rel = $_.FullName.Substring($appRoot.Length).TrimStart('\')
    $asRoute = "/" + ($rel -replace '\\route\.(ts|js|tsx|jsx)$','' -replace '\\','/')
    $asRoute = ($asRoute -replace '/\([^)]+\)','')
    $asRoute
  } | Sort-Object
Utf8NoBomWrite (Join-Path $OutDir "all_routes.txt") (($routes -join "`r`n") + "`r`n")

$pages = Get-ChildItem -Path .\app -Recurse -File -Include "page.tsx","page.ts","page.jsx","page.js" |
  Where-Object { $_.FullName -notmatch '\\app\\api\\|\\node_modules\\|\\\.next\\|\\\.backups\\|\\_inventario\\' } |
  ForEach-Object {
    $rel = $_.FullName.Substring($appRoot.Length).TrimStart('\')
    $route = "/" + ($rel -replace '\\page\.(tsx|ts|jsx|js)$','' -replace '\\','/')
    $route = ($route -replace '/\([^)]+\)','')
    if ($route -eq "/") { $route = "/" }
    $route
  } | Sort-Object
Utf8NoBomWrite (Join-Path $OutDir "all_pages.txt") (($pages -join "`r`n") + "`r`n")

# 3) arquivos "âncora" (sempre úteis pro Cursor)
$anchors = @(
  ".\CHECKLIST.md",
  ".\INVENTORY.md",
  ".\prisma\schema.prisma",
  ".\app\api\fiscal\nfe\import\route.ts",
  ".\app\api\stock\ledger\route.ts",
  ".\app\api\stock\issue\route.ts",
  ".\app\api\stock\inventory-adjust\route.ts",
  ".\app\api\stock\receive\route.ts",
  ".\app\compras\pedidos\page.tsx",
  ".\app\compras\pedidos\[id]\page.tsx",
  ".\app\estoque\movimentacoes\page.tsx",
  ".\app\estoque\entradas\page.tsx",
  ".\components\layout\sidebar.tsx",
  ".\scripts\nfe-import-test.ps1"
)

foreach ($p in $anchors) {
  if (Test-Path -LiteralPath $p) {
    $target = Join-Path $OutDir (SafeName $p)
    $content = Get-Content -LiteralPath $p -Raw
    Utf8NoBomWrite $target $content
  }
}

Write-Host "OK: bundle pronto ✅"
