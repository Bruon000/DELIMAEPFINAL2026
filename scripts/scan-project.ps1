param()

function MdEscape([string]$s) {
  return ($s -replace '\|','\|')
}

$root = Get-Location
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$api = Get-ChildItem .\app\api -Recurse -File -Filter route.ts -ErrorAction SilentlyContinue |
  ForEach-Object {
    $_.FullName.Replace($root.Path + "\", "").Replace("\route.ts","")
  } | Sort-Object

$pages = Get-ChildItem .\app -Recurse -File -Filter page.tsx -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\app\\api\\' } |
  ForEach-Object {
    $_.FullName.Replace($root.Path + "\", "").Replace("\page.tsx","")
  } | Sort-Object

$erpComps = Get-ChildItem .\components\erp -File -ErrorAction SilentlyContinue |
  Select-Object Name, Length | Sort-Object Name

$lastCommits = git --no-pager log -15 --oneline

$out = New-Object System.Collections.Generic.List[string]
$out.Add("# INVENTORY.md - Project map (auto-generated)")
$out.Add("")
$out.Add("Generated at: $ts")
$out.Add("")
$out.Add("## API routes (app/api/**/route.ts)")
if (-not $api -or $api.Count -eq 0) {
  $out.Add("- (none found)")
} else {
  foreach ($r in $api) { $out.Add("- /" + ($r -replace '\\','/')) }
}
$out.Add("")
$out.Add("## Pages (app/**/page.tsx)")
if (-not $pages -or $pages.Count -eq 0) {
  $out.Add("- (none found)")
} else {
  foreach ($p in $pages) { $out.Add("- /" + ($p -replace '\\','/')) }
}
$out.Add("")
$out.Add("## ERP components (components/erp)")
if (-not $erpComps -or $erpComps.Count -eq 0) {
  $out.Add("- (none found)")
} else {
  $out.Add("| file | bytes |")
  $out.Add("|---|---:|")
  foreach ($c in $erpComps) { $out.Add("| " + (MdEscape($c.Name)) + " | " + $c.Length + " |") }
}
$out.Add("")
$out.Add("## Last commits")
$out.Add('```')
foreach ($l in $lastCommits) { $out.Add($l) }
$out.Add('```')
$out.Add("")

# write UTF8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $root.Path "INVENTORY.md"), ($out -join "`r`n"), $utf8NoBom)

Write-Host "OK: INVENTORY.md generated."