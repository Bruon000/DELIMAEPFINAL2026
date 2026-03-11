# Como usar: Compras e Estoque (dia a dia)

Guia rápido para usar as telas de **Compras**, **Pedido de Compra** e **Movimentações de Estoque** no dia a dia.

---

## 1. Quando você já tem o XML da nota (NF-e)

1. Vá em **Compras** e clique em **Importar NF-e (XML)** (no card “Tenho o XML da nota fiscal”).
2. Selecione o arquivo **.xml** que o fornecedor enviou (e-mail, portal, etc.).
3. O sistema cria sozinho o pedido de compra, o fornecedor, os itens (com CFOP/NCM) e o valor. Confira e, se quiser, clique em **Abrir pedido** para ver os detalhes.
4. No detalhe do pedido: quando a mercadoria chegar, clique em **Receber (entrada estoque)**. Isso dá entrada no estoque, atualiza custos e gera as movimentações (ledger).

Se a nota já foi importada antes, o sistema avisa. Você pode abrir o pedido existente pela lista em Compras.

---

## 2. Quando ainda não tem a nota — só quer anotar o pedido

1. Em **Compras**, no card “Ainda não tenho a nota”, escolha o **fornecedor** e clique em **Criar pedido**.
2. Você cai no detalhe do pedido em **Rascunho**. Adicione os itens (material, quantidade, preço). Pode editar e remover itens à vontade.
3. Quando o pedido for enviado ao fornecedor, clique em **Marcar como Enviado**. A partir daí o pedido não pode mais ser editado.
4. Quando a mercadoria e a nota chegarem, você pode:
   - **Importar o XML** da NF-e (Compras → Importar NF-e) e, se der, vincular ao pedido; ou
   - No próprio pedido, clicar em **Receber (entrada estoque)** para dar entrada com os itens que você cadastrou.

---

## 3. O que significa cada status do pedido?

| Status      | O que fazer |
|------------|-------------|
| **Rascunho** | Pode editar itens. Depois use “Marcar como Enviado”. Quando a mercadoria chegar, use “Receber (entrada estoque)”. |
| **Enviado**  | Pedido já enviado ao fornecedor; não dá mais para editar. Quando a mercadoria chegar, use “Receber (entrada estoque)”. |
| **Recebido** | Entrada no estoque já feita. Os itens ficam só para consulta. |
| **Cancelado**| Pedido não será processado. |

---

## 4. Ledger e Movimentações de Estoque

- O **Ledger** é o histórico de entradas e saídas por material. Cada linha é uma movimentação (entrada de compra, saída de venda, ajuste, etc.).
- Na lista de **Compras**, o botão **Ledger** abre a tela de **Movimentações de Estoque** já filtrada por aquele pedido (referência **PO:…** ou **NFE:…**).
- Na tela de **Movimentações de Estoque** você vê todas as entradas/saídas/ajustes. No topo, quando veio do Ledger, aparece o botão **Voltar ao pedido de compra** para retornar ao pedido. Use **Limpar filtro e ver todas** para ver todas as movimentações.
- **Referência** = identificador do movimento (ex.: PO: id do pedido, NFE: chave da nota). Você pode colar no campo “Referência” para filtrar.

---

## Resumo rápido

- **Tenho XML** → Compras → Importar NF-e → abrir pedido → quando chegar, Receber (entrada estoque).
- **Não tenho XML** → Compras → Criar pedido (fornecedor) → adicionar itens → Marcar como Enviado → quando chegar, Receber (entrada estoque).
- **Conferir movimentações** → Compras → Ledger (no pedido) ou Estoque → Movimentações. Para voltar ao pedido, use o botão “Voltar ao pedido de compra” no topo.
