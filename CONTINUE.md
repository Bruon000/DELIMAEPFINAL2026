# CONTINUE.md — Retomar desenvolvimento (DELIMAEPFINAL2026)

## Objetivo
Evitar perda de contexto. Este arquivo descreve onde paramos, o que está testado e como reproduzir.

## Ambiente
- Next.js 14.2.18 (app router)
- Prisma + Postgres (docker)
- Windows / PowerShell
- Porta: 3001 (quando 3000 estiver ocupada)

## DB / ENV
- .env: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/delima_epfinal2026?schema=public
- .env.local:
  - NEXTAUTH_URL=http://localhost:3001
  - NEXTAUTH_SECRET=...

## Login seed
- admin@demo.com / admin123

## Testes via PowerShell (padrão)
- Sempre usar curl.exe (não Invoke-WebRequest)
- Usar cookies.txt para sessão

### Função helper (evita HTML quando dá erro)
(use no PowerShell antes de testar)
function Get-JsonOrShowHtml {
  param([string]$Url, [string]$Method="GET", [string]$BodyJson=$null)

  $args = @("-s","-b","cookies.txt","-H","Accept: application/json")
  if ($Method -ne "GET") {
    $args += @("-H","Content-Type: application/json","-X",$Method)
    if ($BodyJson) { $args += @("-d",$BodyJson) }
  }
  $raw = curl.exe @args $Url

  if ($raw -match '^\s*<') {
    Write-Host "
=== VEIO HTML (erro) em $Url ===" -ForegroundColor Red
    $raw.Substring(0,[Math]::Min(800,$raw.Length)) | Write-Host
    return $null
  }

  return ($raw | ConvertFrom-Json)
}

## O que foi testado (ok)
### Compras (PO)
- Criar PO: POST /api/purchase-orders
- Add item: POST /api/purchase-orders/:id/items
- Send: POST /api/purchase-orders/:id/send
- Receive: POST /api/purchase-orders/:id/receive (gera ledger RECEIVED e atualiza estoque/custos)
- Cancel: POST /api/purchase-orders/:id/cancel
- Audit: GET /api/audit-logs?entity=PURCHASE_ORDER&entityId=... (PO_SENT e PO_RECEIVED)

### Produção (OP)
- Detalhe OP melhorado + ações start/finish
- Offline/outbox na tela (enfileira start/finish e flush ao voltar online)

### Pedidos
- Confirmar pedido: POST /api/orders/:id/confirm (status enums corrigidos; cria OP QUEUED e AR PENDING)

## Problemas conhecidos / atenção
- Quando API retorna HTML, normalmente é erro runtime/next bundler (ou falta Accept header). Use a função helper.
- Se Next cair, reiniciar dev server (npm run dev).
- Banco antigo serralheria_erp conflita com migrations; usar delima_epfinal2026.

## Próximos passos recomendados
1) Padronizar UI ERP nos outros módulos (Pedidos, Produção listagens, Estoque, Financeiro)
2) Completar CHECKLIST “real” com tudo que existe (usar INVENTORY.md)
3) Criar script end-to-end de testes PowerShell
4) Revisar BOM dos produtos no bootstrap (para confirmar pedido reservar materiais de verdade)
