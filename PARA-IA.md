# PARA-IA.md

## Projeto
ERP Serralheria (DELIMAEPFINAL2026) - Next.js 14 + Prisma + Postgres.

## Regras IMPORTANTES do mantenedor (Bruno)
- Tudo via PowerShell (Windows). Evitar instruções de "editar manualmente" — prefira comandos automatizados.
- Quando lidar com paths contendo [id] (colchetes), use sempre PowerShell com -LiteralPath.
- Para mudanças grandes: gere diff/patch e aplique via Cursor (ver AI_CONTINUIDADE.md).

## Como rodar
- DEV: http://localhost:3001
- npm run dev
- npm run build

## Auth (NextAuth Credentials)
Seed login:
- admin@demo.com / admin123

Testes por API:
- usar curl.exe + cookies.txt (evitar Invoke-WebRequest)

## Convenções
- Respostas das APIs: preferir { ok, error?, message? } e status HTTP coerentes.
- Estoque: ledger com types (RECEIVED, ISSUED, ADJUSTMENT, RESERVED, CONSUMED) + audit.