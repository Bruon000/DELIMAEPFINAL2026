# Próximas atualizações (wireframes)

Ordem sugerida para as telas que ainda não foram implementadas.

---

## 1. Contas a pagar (prioridade alta) — concluído

- **Onde:** `/financeiro/contas-pagar`
- **Feito:** Modal "Registrar pagamento" com data do pagamento, observações e indicação Conta/Caixa (sessão atual); filtros por status e vencimento (de/até); coluna "Valor pendente"; botão Exportar CSV. *(Fornecedor e responsável exigiriam campos no schema para implementação futura.)*
- **Referência:** wireframe "Contas a Pagar - Pendentes".

---

## 2. Estoque crítico (prioridade média) — concluído

- **Onde:** `/estoque/critico`
- **Feito:** Cards de resumo (itens críticos, quantidade em falta, valor estimado em falta); filtros por busca (material/código) e por unidade de medida; botão "Solicitar compra" no header e por linha (link para Pedidos de Compra); coluna Unidade.
- **Referência:** wireframe "Critical Stock".

---

## 3. Iniciar venda – painel lateral (prioridade média) — concluído

- **Onde:** `/comercial/venda`
- **Feito:** Painel lateral com seções colapsáveis: Rascunhos (link para pedido), Pedidos abertos (link para pedido), Clientes frequentes (clique seleciona cliente), Estoque crítico (alertas + link para /estoque/critico). API GET `/api/commercial/venda-panel` retorna os dados em uma chamada.
- **Referência:** wireframe "Iniciar Venda (ERP Serralheria)".

---

## 4. Ajustes de UX (prioridade baixa) — concluído

- **PDV / Caixa:** Textos e fluxo já revisados (PDV = ponto de venda; Abrir/Fechar Caixa = sessão do dia; Recebimentos = receber títulos).
- **Pedido:** Resumo financeiro sempre visível (subtotal, desconto, impostos, total); atalho **F2** para focar a busca de produto; hint "(F2 para buscar)" no formulário de itens.
- **Contas a receber:** Botão "Imprimir recibo(s)" no header (imprime selecionados ou toda a lista); botão de impressão por linha para imprimir um recibo individual.

---

## Já implementado

- **Contas a pagar:** modal Registrar pagamento (data, observações, Conta/Caixa), filtros por status e vencimento (de/até), coluna valor pendente, Exportar CSV.
- **Estoque crítico:** cards (itens críticos, qtd em falta, valor em falta), filtro por unidade, "Solicitar compra" (link para Pedidos de Compra).
- **Iniciar venda:** painel lateral com Rascunhos, Pedidos abertos, Clientes frequentes, Alertas de estoque crítico.
- **UX Pedido:** resumo financeiro (subtotal, desconto, impostos, total); F2 para buscar produto.
- **UX Recebimentos:** imprimir recibo(s) em lote ou por item.
- Contas a receber / Recebimentos: filtros, DataTable, modal com Conta/Caixa, lote, CSV.
- Pedidos: linha expansível, timeline, ações "Enviar para produção" e "Marcar como entregue".
- PDV e Caixa: fluxo unificado (receber no PDV lança no caixa); menu e textos revisados.
