# Status do Projeto – Contexto para IA e Equipe

**Objetivo:** Qualquer pessoa ou IA que abrir este repositório deve ler este arquivo (ou o [PARA-IA.md](./PARA-IA.md), que aponta para cá) para saber onde o projeto está e o que fazer em seguida.

---

## Onde estamos (última atualização)

- **Última verificação:** 02/03/2026 — Status atualizado (Compras/PO como próximo). ✅
- **Fase atual:** Esqueleto inicial entregue. Backend (Prisma, APIs), layout Olist (sidebar/topbar), dashboard com cards e checklist completo no repositório.
- **Próximos passos sugeridos (em ordem):**
  1. Compras: polir PO (badge status, enviar/cancelar, receber so em SENT, travar edicao quando status != DRAFT, confirmacoes, mensagens melhores, invalidar materials apos receber)
  2. Producao: detalhe da OP (pedido, itens, anexos, materiais calculados)
  3. Caixa/Financeiro: telas de caixa + extrato
  4. Auditoria/Security: AuditLog em acoes criticas
---

## Como saber o que já foi feito

- Abra **[CHECKLIST.md](./CHECKLIST.md)**. Itens marcados com `[x]` estão concluídos; `[ ]` são pendentes.
- Atualize o CHECKLIST.md sempre que concluir um item (mude `[ ]` para `[x]`) e faça commit + push.

---

## Como a IA (ou você) deve usar este repositório

1. **Sempre ler primeiro:** `STATUS.md` (este arquivo) e `CHECKLIST.md`.
2. **Decidir a tarefa:** Pegar um item não marcado no checklist ou seguir os "Próximos passos sugeridos" acima.
3. **Ao terminar uma etapa:** Marcar no CHECKLIST.md, atualizar este STATUS.md se a "Fase atual" ou "Próximos passos" mudar, e commitar:
   ```bash
   git add CHECKLIST.md STATUS.md
   git commit -m "feat: descrição do que foi feito"
   git push
   ```

Assim, na próxima sessão (ou em outra máquina/IA), o contexto continua no Git e todo mundo sabe onde estamos.

---

## Quem pode marcar o checklist

- **Você no GitHub:** Code → arquivo → lápis (Edit) → edite → Commit changes. Na máquina: `git pull`.
- **A IA (Cursor/outra):** A IA pode marcar direto aqui na pasta do projeto: edita o `CHECKLIST.md` (troca `[ ]` por `[x]`) e roda no PowerShell:
  ```powershell
  cd C:\Users\BruoN\erp-serralheria
  git add CHECKLIST.md STATUS.md
  git commit -m "chore: marcar itens concluídos no checklist"
  git push
  ```
  Assim você não precisa ir no GitHub para marcar — a IA atualiza e envia sozinha.

---

## Resumo técnico (para IA)

- **Stack:** Next.js 14 (App Router), TypeScript, Tailwind, Shadcn/UI, Prisma (PostgreSQL), TanStack Query.
- **Estrutura:** `app/` (rotas e páginas), `components/` (layout + ui + modules), `lib/` (prisma, utils, constants), `prisma/schema.prisma` (modelo completo).
- **Auth:** Implementado com NextAuth (Credentials) + proteção de rotas (middleware). RBAC básico: /admin apenas ADMIN.
- **Fluxo principal a implementar:** Pedido → Confirmar → OP + reserva estoque + AR → Produção → Consumir estoque → Caixa (receber pagamento) → Dashboard reflete.


