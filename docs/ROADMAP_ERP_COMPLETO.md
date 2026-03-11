# Roadmap – ERP completo e visão Admin (Vendedores + Caixa)

Este documento resume o que falta para o ERP ficar completo para uso prolongado e garante que o **admin** tenha acesso **detalhado** a **vendedores** e **caixa**.

---

## 1. O que já existe (resumo)

- **RBAC:** ADMIN vê todos os pedidos; VENDEDOR só os próprios; CAIXA/ADMIN acessam Financeiro e Fiscal.
- **Dashboard:** Por role (Vendedor, Caixa, Admin). Admin vê: pedidos do mês, faturamento, OPs abertas, saldo caixa, estoque crítico. **Sem** filtro por vendedor nem resumo “por vendedor”.
- **Caixa:** Sessões por usuário; lista de sessões fechadas é global (todos da empresa). Admin e Caixa acessam a mesma tela Abrir/Fechar Caixa.
- **Vendedores:** Só existe CRUD de usuários (Admin → Usuários). **Não** existe tela de desempenho por vendedor (vendas, recebimentos, métricas).
- **Relatórios:** Não há módulo Relatórios nem APIs como `/api/reports/margins`.
- **Auditoria:** Existe `AuditLog` e uso em várias APIs; não há tela central de consulta de auditoria.

---

## 2. O que falta para o Admin ver tudo (Vendedores + Caixa)

### 2.1 Vendedores – visão detalhada
- [x] **Listagem de vendedores com métricas:** Nome, pedidos no mês, faturamento no mês, pedidos hoje (API dashboard/stats retorna `vendedores[]`).
- [x] **Filtro por vendedor no dashboard:** Admin escolhe um vendedor no dropdown e vê os cards filtrados (pedidos mês, faturamento) daquele vendedor.
- [x] **Página dedicada “Vendedores” (Admin):** Admin → Vendedores: tabela por vendedor com métricas e links “Pedidos” e “Recebimentos” (URL com `vendedorId`; pedidos e recebimentos aplicam o filtro).

### 2.2 Caixa – visão detalhada
- [x] **No dashboard Admin:** Bloco “Caixa” com: quem tem sessão aberta (nome do operador), saldo atual, entradas/saídas do dia, link para Abrir/Fechar Caixa, quantidade de sessões fechadas.
- [x] **Listagem de sessões (já existe):** Na tela Abrir/Fechar Caixa, “Ver sessões fechadas” mostra todas as sessões da empresa com operador. Admin vê tudo.
- [ ] **Opcional:** Tela “Visão Caixa” só para Admin com consolidado (todas as sessões abertas, totais por operador).

### 2.3 Dashboard Admin – melhorias
- [x] Filtro por vendedor (dropdown) que, quando selecionado, mostra métricas daquele vendedor.
- [x] Bloco “Por vendedor” com tabela (nome, pedidos mês, pedidos hoje, faturamento mês) e link para Admin → Vendedores.
- [x] Bloco “Caixa” com: sessão aberta (por quem, saldo), totais do dia, link para Abrir/Fechar Caixa.

---

## 3. Outros itens para ERP “completo” (uso por bastante tempo)

### Relatórios
- [ ] Módulo ou página “Relatórios” (Admin/Contador): vendas por período, por vendedor, margem (implementar `/api/reports/margins` se for usado), DRE simplificado.
- [ ] Exportação (Excel/CSV) de listas importantes: pedidos, recebimentos, contas a pagar.

### Auditoria
- [ ] Tela “Auditoria” ou “Log de ações”: consulta a `AuditLog` por entidade, período, usuário (consumindo API existente de audit-logs).

### Configurações e manutenção
- [ ] Backup/exportação de dados (ou orientação em documentação).
- [ ] Preferências globais (moeda, formato de data, etc.) se ainda não existir.

### Usabilidade
- [ ] Mensagens/alertas no dashboard (ex.: estoque crítico, contas a vencer, pedidos parados há X dias).
- [ ] Relatório “Pipeline de pedidos” com contagem por status (já há badges no dashboard; pode evoluir para gráfico ou tabela).

---

## 4. Prioridade sugerida

1. **Alta:** Admin com visão detalhada de **vendedores** (listagem com métricas + filtro no dashboard).
2. **Alta:** Admin com visão detalhada de **caixa** (resumo no dashboard: quem está com caixa aberto, saldo, link para a tela de caixa).
3. **Média:** Página dedicada “Vendedores” no menu Admin.
4. **Média:** Relatórios básicos (vendas por período, por vendedor).
5. **Baixa:** Tela de Auditoria, backup/export, alertas no dashboard.

---

## 5. Arquivos principais envolvidos

| Objetivo | Arquivos |
|----------|----------|
| Dashboard stats (filtro vendedor + por vendedor + caixa) | `app/api/dashboard/stats/route.ts` |
| Dashboard Admin UI | `app/page.tsx` (AdminDashboard) |
| Página Vendedores | `app/admin/vendedores/page.tsx` |
| Sidebar (links Admin) | `components/layout/sidebar.tsx` (Admin → Vendedores) |
| Caixa (já existe) | `app/financeiro/caixa/page.tsx`, `app/api/cash/sessions/route.ts` |
| Pedidos filtrados por vendedor (Admin) | `app/api/orders/route.ts` (GET `?vendedorId=`), `app/pedidos/page.tsx` (useSearchParams) |
| Recebimentos com vendedor na URL | `app/financeiro/recebimentos/page.tsx` (?vendedorId= aplica filtro ao carregar) |

---

## 6. Erros corrigidos (testes / build)

- **Página Admin → Vendedores:** Erro de compilação "Unexpected token `div`" resolvido ao extrair o prop `actions` do `PageHeader` para uma variável (`backButton`) em vez de JSX inline.
- **API cash/sessions:** Removido `userId` não utilizado no GET.
- **Cadastros → Produtos:** Variáveis não utilizadas (markDirty, suggested, suggestInfo, suggestMut, applySuggestMut, saveRuleMut, loadRuleMut, clearRuleMut) prefixadas com `_` e adicionada regra no ESLint: `varsIgnorePattern: "^_"` em `.eslintrc.json` para não acusar variáveis que começam com `_`.
- **Warnings restantes (não bloqueiam build):** `react-hooks/exhaustive-deps` em produtos/bom, pdv e pedidos — podem ser ajustados depois com useMemo/useCallback conforme sugerido.

---

## 7. Módulo fiscal – como está

- **Fiscal → Documentos** (`/fiscal/documentos`): Listagem de documentos fiscais (NF-e, NFC-e, etc.) com filtros por tipo, status e período; paginação infinita; ações: consultar na SEFAZ, emitir, baixar XML/PDF, marcar como enviado ao contador, cancelar. Exibe numeração pendente de inutilização e permite inutilizar.
- **Fiscal → Documentos → [id]** (`/fiscal/documentos/[id]`): Detalhe do documento: status, chave, datas, payload/artefatos (XML/PDF quando disponível), ações (emitir, cancelar, baixar).
- **Fiscal → Contabilidade** (`/fiscal/contabilidade`): Exportar mês para contador (CSV) e marcar notas como “enviadas ao contador” em lote (período + observação).
- **APIs:** `/api/fiscal/invoices` (lista com filtros e cursor), `/api/fiscal/invoices/[id]` (detalhe), emit, cancel, consult, download, sent-to-accountant, sent-to-accountant-bulk, export; `/api/fiscal/inutilize` (pendentes + POST inutilizar). Configuração fiscal em `/api/fiscal/config` e `/api/company-fiscal`.
- **O que pode faltar no fiscal:** Relatório consolidado por período (totais por CFOP/NCM), validação de certificado digital na tela de configuração, e documentação de uso (quando emitir NF-e vs NFC-e, fluxo com contador).

---

## 8. O que falta para terminar o projeto por completo

Resumo objetivo:

1. **Build estável:** Garantir que `npm run build` conclua sem erros (correções acima; warnings de hooks opcionais).
2. **Relatórios:** Módulo ou página de relatórios (vendas por período/vendedor, margem, DRE simplificado) e exportação CSV/Excel onde fizer sentido.
3. **Auditoria:** Tela de consulta ao log de auditoria (por entidade, período, usuário).
4. **Fiscal:** Documentação de uso; relatório consolidado e validação de certificado (conforme item 7).
5. **Usabilidade:** Alertas no dashboard (estoque crítico, contas a vencer); pipeline de pedidos com contagem por status.
6. **Backup/export:** Orientação ou ferramenta de exportação de dados para o contador/backup.

Este roadmap deve ser atualizado conforme itens forem concluídos.
