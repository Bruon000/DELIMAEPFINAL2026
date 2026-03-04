# AI_CONTINUIDADE.md

## Contexto do projeto
Repo: DELIMAEPFINAL2026 (ERP Serralheria)
Stack: Next.js 14 (app router) + TS + Prisma + Postgres
UI: padrão "ERP" (PageHeader + FiltersBar + DataTable + StatusBadge), toast Sonner
Modelo: multi-empresa (companyId); autenticação via NextAuth Credentials

## Regras do Bruno (IMPORTANTE)
- Tudo é feito via PowerShell (Windows). Não mandar instrução de "editar manualmente no VSCode".
- Preferir comandos PowerShell que façam replace/patch automaticamente.
- Quando for usar paths com colchetes ([id]) no PowerShell: usar sempre -LiteralPath.

## Portas / ambiente
- DEV roda em: http://localhost:3001 (padrão do Bruno)
- Login seed: admin@demo.com / admin123
- DB: PostgreSQL local (DATABASE_URL em .env)

## Workflow para testes (curl.exe + cookies.txt)
- Sempre usar curl.exe (não Invoke-WebRequest) + cookies.txt

### Login via NextAuth (CSRF + callback/credentials)
1) Remove cookie
2) GET /api/auth/csrf (salva cookies + pega csrfToken)
3) POST form-urlencoded em /api/auth/callback/credentials
4) GET /api/auth/session para confirmar

(Esse fluxo já está validado no projeto.)

## Workflow "differences" para Cursor (APLICAR PATCH)
Objetivo: mandar patches/diffs para o Cursor aplicar sem você copiar arquivo gigante.

### 1) Gerar bundle pro Cursor (já existe script)
- Rodar:
  powershell -ExecutionPolicy Bypass -File .\scripts\cursor-bundle.ps1
Saída: .\_inventario\cursor_bundle

### 2) Gerar patch do que mudou (diff)
- Rodar:
  New-Item -ItemType Directory -Force -Path .\_inventario | Out-Null
  git --no-pager diff > .\_inventario\cursor_patch.diff

### 3) No Cursor
- Abrir o arquivo .\_inventario\cursor_patch.diff e mandar o Cursor aplicar como patch/diff.

## Estado atual (últimos commits importantes)
- Estoque: ledger/issue/inventory-adjust + reservas + crítico + reservas por pedido
- Comercial: páginas /comercial/* e API /api/commercial/orders
- Orçamentos (Quotes): schema + migrations + APIs /api/quotes + UI /orcamentos e /comercial/orcamentos
- Produção: finish com audit e reference OP:<id>

## Próximos focos sugeridos
- Melhorar UI de /orcamentos (wizard vendedor) e fluxo completo de orçamento -> pedido -> confirmar
- Padronizar respostas JSON { ok, error, message } em todas APIs
- Tela de audit trail no detalhe (consumir /api/audit-logs)