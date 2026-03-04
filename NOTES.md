# NOTES (decisões e armadilhas)

## Estoque — UI/Rotas (Movimentações/Entradas/Reservas/Crítico)

- **components/ui/label.tsx** e **components/ui/dialog.tsx**: criados porque não existiam no projeto e são usados nas telas novas (ex.: `/estoque/movimentacoes`, modais e formulários).
- **POST /api/stock/issue** e **POST /api/stock/inventory-adjust**: retornam `result` que **já contém `ok: true`**.
  ✅ Padrão correto: `NextResponse.json(result, { status: 201 })`
  ❌ Evitar: `{ ok: true, ...result }` (duplica `ok` e quebra TS).
- **Reservas e Crítico**: páginas `/estoque/reservas` e `/estoque/critico` e rotas `/api/stock/reservations` e `/api/stock/critical` já existem; falta apenas adicionar links na sidebar (opcional).
- **Build e Prisma**: `npm run build` está passando; após alterações no Prisma, aplicar no banco com `npx prisma migrate dev` (se usa migrations) ou `npx prisma db push`.