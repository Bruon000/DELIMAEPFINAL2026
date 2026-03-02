# INVENTORY.md - Project map (auto-generated)

Generated at: 2026-03-02 18:03:28

## API routes (app/api/**/route.ts)
- /app/api/accounts-receivable
- /app/api/accounts-receivable/[id]/mark-paid
- /app/api/audit-logs
- /app/api/auth/[...nextauth]
- /app/api/bom-items/[id]
- /app/api/br/cnpj
- /app/api/cash/close
- /app/api/cash/open
- /app/api/cash/session
- /app/api/cash/transactions
- /app/api/clients
- /app/api/clients/[id]
- /app/api/dashboard/stats
- /app/api/materials
- /app/api/materials/[id]
- /app/api/order-items/[id]
- /app/api/orders
- /app/api/orders/[id]
- /app/api/orders/[id]/confirm
- /app/api/orders/[id]/items
- /app/api/orders/[id]/materials
- /app/api/production-orders
- /app/api/production-orders/[id]
- /app/api/production-orders/[id]/finish
- /app/api/production-orders/[id]/start
- /app/api/products
- /app/api/products/[id]
- /app/api/products/[id]/bom
- /app/api/products/[id]/bom/items
- /app/api/purchase-order-items/[id]
- /app/api/purchase-orders
- /app/api/purchase-orders/[id]
- /app/api/purchase-orders/[id]/cancel
- /app/api/purchase-orders/[id]/items
- /app/api/purchase-orders/[id]/receive
- /app/api/purchase-orders/[id]/send
- /app/api/search
- /app/api/stock/adjust
- /app/api/stock/ledger
- /app/api/stock/receive
- /app/api/suppliers
- /app/api/units
- /app/api/units/[id]
- /app/api/users
- /app/api/users/[id]

## Pages (app/**/page.tsx)
- /app
- /app/admin/users
- /app/cadastros
- /app/cadastros/fornecedores
- /app/cadastros/materiais
- /app/cadastros/produtos
- /app/cadastros/produtos/[id]/bom
- /app/cadastros/unidades
- /app/clientes
- /app/comercial/clientes
- /app/comercial/orcamentos
- /app/comercial/pedidos
- /app/compras/pedidos
- /app/compras/pedidos/[id]
- /app/configuracoes
- /app/estoque
- /app/estoque/entradas
- /app/estoque/materiais
- /app/estoque/movimentacoes
- /app/financeiro
- /app/financeiro/caixa
- /app/financeiro/contas-pagar
- /app/financeiro/contas-receber
- /app/financeiro/recebimentos
- /app/login
- /app/orcamentos
- /app/pedidos
- /app/pedidos/[id]
- /app/pedidos/novo
- /app/producao/ops
- /app/producao/ops/[id]

## ERP components (components/erp)
| file | bytes |
|---|---:|
| data-table.tsx | 2483 |
| filters-bar.tsx | 2196 |
| filters-shell.tsx | 2196 |
| page-header.tsx | 909 |
| status-badge.tsx | 1475 |

## Last commits
```
bdd753a chore: atualiza checklist + auditoria + fluxo compras (send/cancel/receive) + suppliers api
93a7ae3 chore: ajustar memo deps (compras detalhe PO)
79d3762 ui: compras detalhe PO (padrao ERP industrial)
41ea437 ui: padrao ERP (compras lista + componentes) + sidebar deps + gitignore
77e966e ui: compras/pedidos lista (padrao ERP + filtros + tabela + badges)
6ddcd09 fix: confirmar pedido (status enums corretos + cria OP/AR sem campos invalidos)
4feeb99 fix: producao offline outbox (define flushOutbox)
bde6e54 feat: producao detalhe da OP (pedido+itens+materiais)
9719622 feat: producao detalhe da OP (pedido+itens+materiais)
b740687 chore: ignore backups folder
f40f72b chore: ajustar ESLint (nao bloquear build) + compras PO polimento final
3acc7b4 chore: ponto atual (compras PO polimento)
4c39c0e chore: script where-am-i + ponto atual
04c038b chore: checklist (compras PO fluxo + pendencias)
958cbd1 feat: compras PO (status + send/cancel + receive gated + invalidate materials)
```
