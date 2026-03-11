# Como funciona: Recebimentos, PDV e Caixa

## Resumo

- **Recebimentos** (Contas a Receber) e **PDV** usam a **mesma sessão de caixa**. Tudo que entra (venda à vista no PDV ou recebimento de título em Recebimentos) vira **entrada (IN)** na sessão aberta.
- Ao **fechar o caixa**, o sistema grava saldo de abertura, totais e saldo informado. Esse histórico fica em **Abrir/Fechar Caixa → Ver sessões fechadas**.

---

## 1. Contas a Receber (Recebimentos)

- **Onde:** Financeiro → Recebimentos.
- **Filtros:** Status (Pendente / Pago / Todos), vencimento, vendedor.
- **Coluna "Pago em":** Quando o título está pago, a data do pagamento aparece nessa coluna.
- **Ao receber:** Você marca um ou mais títulos e clica em Receber. O valor é lançado como **entrada (IN)** na **sessão de caixa aberta** (a mesma do PDV). Após registrar, a lista passa a mostrar "Pagos" e o item recebido aparece no topo (ordenado por data de pagamento).
- **Texto na tela:** Deixa claro que o valor cai na mesma sessão de caixa do PDV e que os movimentos podem ser vistos em **Abrir/Fechar Caixa**.

---

## 2. PDV (Ponto de Venda)

- **Onde:** Financeiro → PDV.
- Vendas à vista e pagamentos no PDV também entram na **sessão de caixa aberta** (entradas IN).
- Para ver o que entrou (PDV + Recebimentos), use **Abrir/Fechar Caixa** e confira a lista de transações.

---

## 3. Abrir / Fechar Caixa

- **Onde:** Financeiro → Abrir/Fechar Caixa (ou Caixa).
- **Abrir:** Informe o saldo inicial e clique em "Abrir caixa". A partir daí, todas as entradas (PDV, Recebimentos, lançamentos manuais) e saídas (saída manual, etc.) ficam vinculadas a essa sessão.
- **Transações:** A tabela mostra todas as movimentações da sessão **aberta** (data, tipo IN/OUT, valor, descrição/ref).
- **Fechar:** Informe o saldo em caixa no momento do fechamento e clique em "Fechar caixa". O sistema compara com o saldo esperado (abertura + entradas - saídas). Se houver diferença, pode confirmar mesmo assim.
- **O que fica salvo ao fechar:**
  - Data/hora de abertura e de fechamento
  - Saldo de abertura
  - Saldo informado no fechamento
  - (Internamente: totais de entradas e saídas para cálculo do saldo esperado)

---

## 4. Histórico de sessões fechadas

- Na mesma tela **Abrir/Fechar Caixa**, use o botão **"Ver sessões fechadas"**.
- Aparece uma tabela com as sessões já fechadas: data de abertura, data de fechamento, operador, saldo de abertura e saldo de fechamento.
- **Ver detalhes:** Ao clicar em "Ver detalhes" em uma sessão, abre um resumo com:
  - Abertura, fechamento, operador
  - Saldo abertura, total entradas (IN), total saídas (OUT)
  - Saldo esperado e saldo informado no fechamento
  - Lista de transações daquela sessão

---

## APIs utilizadas

- **Listar sessões fechadas:** `GET /api/cash/sessions?closed=true`
- **Detalhe de uma sessão:** `GET /api/cash/sessions/[id]`
- **Contas a receber:** `GET /api/accounts-receivable?status=...` (PENDING, PAID, ALL)
- **Marcar como pago:** `POST /api/accounts-receivable/[id]/mark-paid`

---

## Checklist (o que foi feito)

- [x] API Orders: correção Prisma (select em items sem misturar include).
- [x] Recebimentos: coluna "Pago em"; após receber, filtro vai para "Pagos" e lista ordenada por data de pagamento.
- [x] Recebimentos: texto explicando que o valor cai na mesma sessão de caixa do PDV.
- [x] Caixa: API para listar sessões fechadas e API para detalhe da sessão (com transações).
- [x] Caixa: bloco "Histórico de sessões fechadas" com tabela e modal "Ver detalhes".
