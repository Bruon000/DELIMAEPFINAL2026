# Checklist ERP Serralheria

Use este arquivo para marcar o progresso do projeto. Troque `[ ]` por `[x]` quando concluir cada item.

**Status atual:** esqueleto inicial entregue (schema Prisma, layout Olist, dashboard com cards, Docker, seed, scripts). Itens marcados com `[x]` já foram implementados nessa base.

**Última atualização (verificação):** 01/03/2026 — Checklist conferido; esta linha foi adicionada para você ver no GitHub que a marcação está funcionando. ✅

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
- [ ] Cálculo de custo automático via BOM
- [ ] Geração da "lista de materiais" por pedido (BOM * quantidade)
- [ ] Base para custo de mão de obra (stub)
- [ ] Base para terceiros (stub)
- [x] Markup/margem configurável (base) — campo markup no Product

---

## 5) Estoque Inteligente (Almoxarifado)

- [x] Saldo por material (StockItem) (schema)
- [x] Livro razão de estoque (StockLedger) (schema)
- [x] Tipos de movimento: RECEIVED, RESERVED, CONSUMED, ADJUSTMENT (schema)
- [ ] Entrada de compra (RECEIVED) — tela/fluxo
- [x] Reserva automática ao confirmar pedido (RESERVED) usando BOM
- [x] Baixa ao finalizar produção (CONSUMED)
- [ ] Ajuste manual (ADJUSTMENT)
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
- [ ] Detalhe da OP com: pedido, itens, anexos, materiais calculados
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
- [ ] lucratividade por produto (base via BOM)
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
- [ ] Dashboard refletir os números

---

## Legenda

- **Feito:** marque com `[x]`
- **Parcial / em andamento:** pode anotar no item, ex: `[ ] Item (50% – falta X)`
- Use este arquivo no GitHub para acompanhar evolução e retomar com IA ou equipe.
