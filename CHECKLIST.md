# CHECKLIST


**Notas técnicas importantes:** ver NOTES.md
## Estoque (P0)

- [x] Razão do estoque (ledger) com filtros e paginação
- [x] Saída manual (ISSUED) com auditoria
- [x] Ajuste de inventário por saldo (ADJUSTMENT) com auditoria
- [x] Reservas (RESERVED) — tela + API (visão reservado vs disponível)
- [x] Estoque crítico (minStock) — tela + API (abaixo do mínimo)


### Rotas
- `GET /api/stock/ledger`
  - Query: `q`, `materialId`, `type`, `from`, `to`, `cursor`, `take`
  - Resposta: `{ ok, rows, nextCursor }`
- `POST /api/stock/issue`
  - Body: `{ materialId, quantity, reason?, reference?, note? }`
- `POST /api/stock/inventory-adjust`
  - Body: `{ materialId, newQuantity, reference?, note? }`

### Testes rápidos (curl)
1) Ledger (20 últimos)
```bash
curl.exe -s -b cookies.txt "http://localhost:3001/api/stock/ledger?take=20"
```

2) Saída manual
```bash
curl.exe -s -b cookies.txt -X POST "http://localhost:3001/api/stock/issue" ^
  -H "Content-Type: application/json" ^
  -d "{\"materialId\":\"SEU_MATERIAL_ID\",\"quantity\":1,\"reason\":\"perda\"}"
```

3) Ajuste inventário
```bash
curl.exe -s -b cookies.txt -X POST "http://localhost:3001/api/stock/inventory-adjust" ^
  -H "Content-Type: application/json" ^
  -d "{\"materialId\":\"SEU_MATERIAL_ID\",\"newQuantity\":10,\"note\":\"contagem\"}"
```

### UI (P0)
- [x] /estoque/movimentacoes: filtros + busca + "Carregar mais"
- [x] /estoque/movimentacoes: modal "Saída manual" e "Ajuste inventário"



---

## Status atual (ATUALIZE SEMPRE)
$12026-03-04 10:46:34
- Ambiente: Windows / Next.js 14 / Prisma / Postgres (docker)
- Login seed: admin@demo.com / admin123
- DB (DEV): DATABASE_URL em .env apontando para delima_epfinal2026
- Observação: para testes via PowerShell use curl.exe (não Invoke-WebRequest) + cookies.txt

## ✅ O que está funcionando (confirmado via testes)
### Produção (OP)
- [x] Detalhe da OP com pedido + itens + materiais calculados
- [x] Ações: iniciar OP (start) e finalizar OP (finish)
- [x] Offline/outbox na tela da OP: enfileira start/finish e tenta flush ao voltar online

### Comercial → Pedido → Produção/Financeiro
- [x] Confirmar pedido: valida estoque (BOM), reserva (RESERVED ledger), muda status para CONFIRMED, cria OP (QUEUED) e cria AccountsReceivable (PENDING)

### Compras
- [x] Lista de compras com padrão ERP (PageHeader + filtros + DataTable + status badge)
- [x] Detalhe do Pedido de Compra (PO) com padrão ERP industrial (Resumo/Total/Ações + itens)
- [x] Fluxo industrial do PO:
  - [x] Criar PO (POST /api/purchase-orders)
  - [x] Adicionar item (POST /api/purchase-orders/:id/items)
  - [x] Marcar como ENVIADO (POST /api/purchase-orders/:id/send)
  - [x] Receber compra (POST /api/purchase-orders/:id/receive) -> entrada estoque + ledger
  - [x] Cancelar (POST /api/purchase-orders/:id/cancel)
- [x] **Importação NF-e (XML) -> Compras/Estoque**
  - [x] POST /api/fiscal/nfe/import (XML no body) cria Supplier/PO/Items, recebe estoque, cria FiscalInvoice (dedupe)
  - [x] Dedupe por chNFe (FiscalInvoice @@unique companyId+type+key) + tratamento P2002 em race
  - [x] Resposta padronizada { ok, error?, message? }; unit_required e erros claros
  - [x] Unidade: fallback preferir code "UN"; mapear uCom por code/nome
  - [x] Material: buscar por code (cProd) depois nome; criar com code/unit/currentCost
  - [x] Audit: NFE_IMPORTED e NFE_IMPORT_DEDUPE (chNFe, purchaseOrderId, itemsCount, supplierName, emittedAt)
  - [x] UI /compras/pedidos: botão "Importar NF-e (XML)" no PageHeader, toast (sonner), validação .xml e tamanho, CTA Unidades
  - [x] Script scripts/nfe-import-test.ps1: UTF-8, exibe arquivo/tamanho/HTTP/URL; -TestDedupe opcional

**Aplicar unique FiscalInvoice no banco:** o schema tem `@@unique([companyId, type, key])`. Se o projeto usa migrations: `npx prisma migrate dev --name add_fiscalinvoice_unique`. Se não usar migrations: `npx prisma db push`.

**Testar na UI (3 passos):** (1) Acessar `/compras/pedidos`, (2) Clicar em "Importar NF-e (XML)" no header e escolher um .xml válido, (3) Ver toast de sucesso e redirecionamento para o pedido; repetir com o mesmo XML e ver toast "já importada".

**Testar script (2 comandos):** `.\scripts\nfe-import-test.ps1 -XmlPath "C:\caminho\para\nfe.xml"` e com dedupe: `.\scripts\nfe-import-test.ps1 -XmlPath "C:\caminho\para\nfe.xml" -TestDedupe`.

### Estoque / Ledger
- [x] Ledger grava RECEIVED no recebimento de PO (reference PO:...)
- [x] **GET /api/stock/ledger** — Filtros (materialId, type, q, from, to), paginação por cursor (cursor, take 1–200), busca em reference/note/material.name/code; resposta `{ ok, rows, nextCursor }`.
- [x] **POST /api/stock/issue** — Saída manual de estoque (tipo ISSUED): body `materialId`, `quantity` (>0), opcional `reference`, `note`, `reason`; valida estoque disponível; grava ledger e audit STOCK_ISSUED.
- [x] **POST /api/stock/inventory-adjust** — Ajuste de inventário por saldo: body `materialId`, `newQuantity` (>=0), opcional `reference`, `note`; não permite ajustar abaixo do reservado; grava tipo ADJUSTMENT e audit STOCK_INVENTORY_ADJUST.

**Testar (curl/Insomnia, com sessão autenticada):**
- Ledger: `GET /api/stock/ledger?take=20&materialId=xxx` ou `?q=texto&from=2026-01-01&to=2026-12-31&cursor=...`
- Saída manual: `POST /api/stock/issue` body `{ "materialId": "<id>", "quantity": 5, "reason": "perda" }`
- Ajuste: `POST /api/stock/inventory-adjust` body `{ "materialId": "<id>", "newQuantity": 100, "note": "inventário cíclico" }`

- [x] Bootstrap demo cria materiais + estoque inicial + produtos + cliente + fornecedor + pedido + PO (scripts/bootstrap-demo.js)

### Auditoria
- [x] lib/audit.ts (writeAuditLog) não derruba operação
- [x] GET /api/audit-logs?entity=...&entityId=... (consulta trilha)
- [x] Audit no PO: PO_SENT e PO_RECEIVED gravando payload + userAgent/ip

### Cadastros/API suporte a testes
- [x] BOM industrial: perdas global (BOM.lossPercent) + por material (BOMItem.lossPercent) + cálculo aplicado em /orders/materials e /orders/confirm (confirmado via curl 03/03/2026)
- [x] GET /api/suppliers OK via curl (POST a confirmar)

## 🟡 Pendências / Melhorias (pra não esquecer)
- [ ] Padronizar “ERP UI” no resto das telas (Pedidos, Produção, Estoque, Financeiro)
- [ ] Criar tela/aba de “Audit Trail” no detalhe do PO (consumir /api/audit-logs)
- [x] Melhorar o runner de testes via PowerShell (script único end-to-end)
- [x] Revisar seed/bootstrap para incluir BOM nos produtos (para confirmar pedido reservar materiais de verdade)
- [ ] Revisar outbox: tratar falhas/retry/backoff e identificar ações duplicadas (idempotência)

Use este arquivo para marcar o progresso do projeto. Troque `[ ]` por `[x]` quando concluir cada item.

**Status atual:** esqueleto inicial entregue (schema Prisma, layout Olist, dashboard com cards, Docker, seed, scripts). Itens marcados com `[x]` já foram implementados nessa base.

**Última atualização (verificação):** 02/03/2026 — Checklist conferido; esta linha foi adicionada para você ver no GitHub que a marcação está funcionando. ✅

- [x] **Teste de marcação (01/03/2026):** este item foi marcado de propósito para você conferir no GitHub se o `[x]` aparece. Se aparecer, está tudo certo.

---

## 0) Base do Produto Estilo Olist

- [x] Plataforma modular (módulos separados + navegação clara)
- [x] UI "fintech/olist": sidebar/topbar, cards (tabelas com filtros e ações rápidas pendentes)
- [x] Multiusuário + permissões por módulo/ação (RBAC)
- [x] Multiempresa preparado (Company), mesmo que MVP use 1
- [ ] Logs/Auditoria (quem fez o quê e quando) — entidade AuditLog existe
- [x] Padrão de status/timeline em fluxos (Pedido/Produção/Financeiro/Instalação)
- [ ] Integrações plugáveis (providers + webhooks) desde o começo

---

## 1) Acesso, Usuários e Segurança

- [x] Login (NextAuth Credentials)
- [x] Perfis: Admin, Vendedor, Caixa, Produção, Instalador, Contador (enum Role no schema)
- [x] CRUD de usuários (Admin)
- [x] Controle de permissões (base pronta para granularidade)
- [ ] Logs de auditoria (AuditLog) — entidade existe, falta registrar ações
- [x] Soft delete / isActive em entidades críticas (schema)
- [ ] Proteções básicas (CORS, Helmet, rate limit opcional)

---

## 2) Cadastros Fundamentais (Base de Dados do ERP)

- [x] Empresas (Company) + configurações (schema)
- [x] Tema por empresa (CompanyTheme: cores, modo, logo placeholder) (schema)
- [x] Clientes (CPF/CNPJ, contatos, endereços) (schema)
- [x] Fornecedores (schema)
- [x] Colaboradores (fábrica/instalação) (schema)
- [x] Unidades de medida (m, kg, un, barra etc.) (schema)
- [x] Materiais / Matéria-prima (custo atual, estoque, unidade) (schema)
- [x] Produtos (simples, composto, sob medida) (schema)
- [x] Serviços (instalação, transporte, pintura, etc.) (schema)
- [x] Categorias/Tags (catálogo) (schema)
- [ ] Telas de CRUD para todos os cadastros acima
  - [x] Unidades (CRUD) — tela + API (GET/POST/PATCH/DELETE)
  - [x] Materiais (CRUD) — tela + API (GET/POST/PATCH/DELETE)
  - [x] Produtos (CRUD) — tela + API (GET/POST/PATCH/DELETE)
  - [x] Clientes (CRUD) — tela + API (GET/POST/PATCH/DELETE)

---

## 3) Comercial (Estilo Olist)

- [x] Orçamentos (BASE pronta; UI pode ficar opcional/oculta) — entidade Quote no schema
- [x] Pedidos (frente de loja) (FOCO)
- [x] Criar pedido com itens, preços, desconto
- [x] Status: DRAFT, OPEN, CONFIRMED, IN_PRODUCTION, READY, INSTALLED, DELIVERED, CANCELED (schema + constantes)
- [ ] Timeline/histórico de status (OrderStatusHistory existe)
- [ ] Observações técnicas (medidas, detalhes)
- [ ] Anexos/fotos (upload base)
- [ ] Comissões (base pronta: regras + lançamentos)

---

## 4) BOM / Engenharia do Produto (Estrutura de Materiais)

- [x] BOM por produto (itens + quantidades) (schema BOM + BOMItem)
- [x] % de perda/sobra (opcional) (campo lossPercent no schema)
- [x] Cálculo de custo automático via BOM
- [x] Geração da "lista de materiais" por pedido (BOM * quantidade)
- [ ] Base para custo de mão de obra (stub)
- [ ] Base para terceiros (stub)
- [x] Markup/margem configurável (base) — campo markup no Product

---

## 5) Estoque Inteligente (Almoxarifado)

- [x] Saldo por material (StockItem) (schema)
- [x] Livro razão de estoque (StockLedger) (schema)
- [x] Tipos de movimento: RECEIVED, RESERVED, CONSUMED, ADJUSTMENT (schema)
- [x] Entrada de compra (RECEIVED) — tela/fluxo
- [x] Reserva automática ao confirmar pedido (RESERVED) usando BOM
- [x] Baixa ao finalizar produção (CONSUMED)
- [x] Ajuste manual (ADJUSTMENT) — POST /api/stock/inventory-adjust
- [ ] Estoque mínimo + alertas (base) — campo minStock existe
- [ ] Inventário (contagem) base

---

## 6) Produção (PWA do Colaborador – receber pedidos fechados)

- [x] Ordem de Produção gerada ao CONFIRMAR pedido
- [x] Status: QUEUED, IN_PROGRESS, BLOCKED, DONE (schema + constantes)
- [x] Etapas de produção (Corte/Solda/Pintura/Montagem/Acabamento) (enum ProductionStep)
- [x] Apontamento de tempo (TimeEntry) (schema)
- [ ] PWA Produção (mobile-first)
- [x] Lista de OPs com filtro por status
- [x] Detalhe da OP com: pedido, itens, anexos, materiais calculados
- [x] Atualizar status (iniciar/finalizar)
- [ ] Offline: cache + fila (outbox) de updates
- [ ] Sync automático ao voltar online
- [ ] Indicador "offline/sincronizando"

---

## 7) Instalação / Entrega

- [x] Ordem de Instalação vinculada ao pedido (schema InstallationOrder)
- [x] Status: SCHEDULED, ON_THE_WAY, INSTALLED, FAILED (schema)
- [ ] Checklist de instalação (stub) — campo JSON no schema
- [ ] Fotos e assinatura do cliente (stub/base)
- [ ] Tela para instalador (web responsivo)

---

## 8) Financeiro Completo (Estilo Olist)

### Contas a Receber (AR)

- [x] Gerar automaticamente ao confirmar pedido (mínimo 1 parcela)
- [x] Parcelas (base pronta) — entidade AccountsReceivable
- [x] Status: PENDING, PAID, OVERDUE, CANCELED (schema)
- [x] Baixa manual (mark paid)

### Caixa

- [x] Abertura/fechamento de caixa (CashSession) (schema)
- [x] Lançamentos (CashTransaction) (schema)
- [ ] Tela de abertura/fechamento e lançamentos
- [x] Receber pagamento do pedido (vincular AR + registrar no caixa)

### Contas a Pagar (AP)

- [x] Modelo (AccountsPayable) (schema)
- [ ] CRUD (despesa, vencimento, status)
- [ ] Recorrência (stub)

### Fluxo de Caixa

- [ ] Visão diário/mensal (agregações)
- [ ] Projeção (stub)

### Categorias/centro de custo

- [x] FinancialCategory (schema)
- [x] CostCenter (schema)

---

## 9) Boletos (Base Plugável para Contador)

- [x] Entidade Boleto (schema)
- [ ] Interface de provider (IBoletoProvider)
- [ ] Endpoints stub: emitir / consultar / webhook
- [ ] UI "Gerar boleto" (CAIXA/CONTADOR) mostrando "integração pendente"
- [ ] Preparado para plugar Asaas/Gerencianet/MercadoPago

---

## 10) Fiscal (Base Plugável)

- [x] Configurações fiscais (FiscalConfig) base (schema)
- [x] Nota fiscal (FiscalInvoice) base (schema)
- [ ] Tabelas stub: CFOP / CST / NCM (seeds simples)
- [ ] Endpoints stub: emitir/consultar/cancelar (501)
- [ ] Webhook stub fiscal (logar payload)
- [ ] UI Fiscal (lista/detalhe/status)

---

## 11) Dashboard e Relatórios (Gestão "Olist-like")

### Dashboard com cards

- [x] pedidos do mês
- [x] faturamento (AR pago)
- [x] produção em andamento (OPs em aberto)
- [x] estoque crítico
- [x] saldo do caixa

### Relatórios base

- [ ] vendas por período (base)
- [ ] conversão orçamento→pedido (stub)
- [x] lucratividade por produto (base via BOM)
- [ ] produtividade (stub com TimeEntry)

---

## 12) Notificações e Experiência (Plataforma)

- [x] Notificações in-app (Notification) base (schema)
- [ ] Preferências (stub)
- [x] Busca global (stub) — barra na topbar existe, falta lógica
- [x] Ações rápidas (novo pedido, nova OP, receber pagamento) — botões na topbar, falta rotas

---

## 13) Integrações (Stubs Estilo Olist)

- [ ] WhatsApp stub (templates + "send" log)
- [ ] Pagamentos stub (PaymentProvider + endpoint 501)
- [ ] Webhooks genéricos /integrations/webhook/:source
- [ ] API pública stub (ApiKey + endpoint exemplo)

---

## 14) Infra e Qualidade (Obrigatório pra "ver projeto de verdade")

- [x] Docker Compose (Postgres)
- [x] Prisma migrations + seed robusto
- [ ] Swagger no back
- [x] README completo (como rodar, logins, fluxos)
- [x] Scripts padrão: dev, migrate, seed, build
- [x] Script de zip sem node_modules

---

## 15) Fluxos obrigatórios funcionando (MVP real)

- [x] Criar pedido na frente de loja
- [x] Confirmar pedido
- [x] Gerar OP automaticamente
- [x] Produção atualizar status e finalizar OP
- [ ] Baixar/consumir materiais do estoque
- [x] Gerar AR e marcar como pago no Caixa
- [x] Dashboard refletir os números

---

## Legenda

- **Feito:** marque com `[x]`
- **Parcial / em andamento:** pode anotar no item, ex: `[ ] Item (50% – falta X)`
- Use este arquivo no GitHub para acompanhar evolução e retomar com IA ou equipe.

---

## ERP Completo — Backlog (para não faltar nada)

### A) Estoque (operacional completo)
- [x] Movimentações (StockLedger) — listar com filtros (material, tipo, período), paginação por cursor e busca (q)
- [x] Entrada de estoque (RECEIVED) — tela + API (compra/nota) atualiza StockItem.quantity e grava StockLedger
- [x] Saída de estoque manual (ISSUED) — POST /api/stock/issue com materialId, quantity, reference, note, reason
- [x] Ajuste de inventário (ADJUSTMENT) — POST /api/stock/inventory-adjust com materialId, newQuantity, reference, note
- [x] Reservas (RESERVED) — tela + API (visão reservado vs disponível)
- [ ] Consumo na produção (CONSUMED) — já baixa; falta gravar StockLedger (consumo) + auditoria
- [ ] Alertas de mínimo (Material.minStock) — lista “abaixo do mínimo”
- [ ] Histórico por material (extrato do material) — saldo antes/depois (balance) e referências

- [x] RESERVED — ao confirmar pedido, gravar StockLedger por material (referência Order/OP)
- [x] CONSUMED — ao finalizar produção, gravar StockLedger por material (referência OP)

### B) Compras / Fornecedores (base)
- [ ] Compras (UI) — finalizar fluxo: badge status + ações ENVIAR/CANCELAR + receber só em SENT + confirmações
- [ ] Compras (UX) — mostrar fornecedor completo no detalhe (doc/tel) + mensagens/toast melhores
- [ ] Compras (Regras) — travar edição quando status != DRAFT e validar transições (API + UI)
- [ ] Compras (Extra) — após receber, invalidar materiais e exibir “custos atualizados”
- [x] Recebimento de compra → entrada estoque (RECEIVED) + ledger + atualiza custo do material
- [x] Pedido de compra (PurchaseOrder) — listar OK via curl; criar/detalhe/itens: a confirmar
- [ ] Cadastro de fornecedores (Supplier) — CRUD
- [x] Pedido de compra (PurchaseOrder) — criar/editar, itens, status

- [x] Recebimento de compra → gera entrada (RECEIVED) + StockLedger + atualiza StockItem

### C) Fiscal / XML / NF-e (stub → completo)
- [ ] Tabelas CFOP/CST/NCM — seeds simples
- [x] Importação XML de compra (NF-e entrada) — ler itens, mapear material/produto, gerar RECEIVED + ledger (ver seção Compras acima)
- [ ] Emissão/consulta/cancelamento NF-e (endpoints 501 inicialmente)
- [ ] Webhook fiscal (log payload)
- [ ] Configurações fiscais por empresa (FiscalConfig) — UI

### D) Financeiro (carteira + caixa + pagar)
- [ ] Caixa: fechar caixa (API) + validar diferenças (saldo esperado vs informado)
- [ ] Caixa: saída (OUT) manual + motivo
- [ ] Caixa: extrato completo (por sessão, período) + totais
- [ ] Contas a Receber (carteira AR): listar PENDING/PAID/OVERDUE + filtros
- [ ] Parcelamento AR (mínimo 1) — já gera; falta UI para ver parcelas
- [ ] Contas a Pagar (AccountsPayable): CRUD + marcar pago + vincular ao caixa (OUT)
- [ ] Relatórios: DRE simples, fluxo de caixa, inadimplência

### E) Comercial (orçamentos e conversão)
- [ ] Orçamentos: CRUD + itens + impressão/PDF
- [ ] Converter orçamento → pedido
- [ ] Descontos, condições, anexos do cliente/pedido
- [ ] Timeline completa (OrderStatusHistory) — UI

### F) Produção / Apontamentos
- [ ] Apontamentos por etapa (corte/solda/pintura) — tempo e status
- [ ] Bloqueios/pendências (BLOCKED) com motivo
- [ ] Anexos na OP (desenho, medidas, fotos)
- [ ] Checklist de qualidade e entrega

### G) Instalação
- [ ] Ordem de Instalação — UI do instalador (mobile)
- [ ] Fotos/assinatura do cliente
- [ ] Roteiro/agenda (calendário simples)

### H) Usuários / Auditoria / Segurança
- [ ] AuditLog — gravar ações críticas (login, CRUD, confirmar pedido, baixa estoque, recebimento)
- [ ] Proteções básicas (rate limit, headers)
- [ ] Permissões por módulo/ação (RBAC granular)

### I) Integrações (Boletos / pagamentos)
- [ ] Boletos: provider interface (IBoletoProvider)
- [ ] UI “Gerar boleto” (integração pendente)
- [ ] Webhook de pagamento / conciliação

### J) Qualidade / Produto
- [ ] Seeds completos (unidades, materiais, categorias, exemplos)
- [ ] Validações e masks (CPF/CNPJ, moeda, decimal)
- [ ] Testes mínimos (smoke) e página “Saúde do sistema”












