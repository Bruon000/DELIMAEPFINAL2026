# PONTO ATUAL (atualize sempre que terminar algo)
Data: 2026-03-02 11:14

## Próximo (agora)
Compras → PO (Pedido de compra) polimento de UI/fluxo:
- Header: fornecedor (doc/telefone), status badge, total
- Botões: Enviar (DRAFT→SENT), Cancelar (DRAFT/SENT→CANCELED), Receber (SENT→RECEIVED)
- UX: travar edição se status != DRAFT, confirmar ações, erros bonitos (toast)
- Recebimento: reference PO:<id> (já), invalidar materials após receber (por causa do currentCost)
- Opcional: toast “Atualizou custo do material para X”

## Já existe
- Criar PO
- Listar PO
- Detalhe: add/remove itens
- Receber compra: atualiza estoque + ledger + Material.currentCost ✅

## Critério de pronto
- Fluxo de status completo + UI redonda
- Checklist: Compras marcado como concluído
