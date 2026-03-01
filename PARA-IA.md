# 🤖 Contexto para IA — Leia primeiro

**Se você é uma IA e recebeu o link deste repositório:** este arquivo contém tudo que você precisa para entender o projeto e continuar o trabalho. Leia-o antes de propor ou fazer qualquer alteração.

---

## O que é este projeto

- **ERP Industrial para Serralheria** (Next.js 14, TypeScript, Prisma, PostgreSQL).
- Foco: **produto** com BOM, **pedidos** → **produção (PWA)** → **estoque** → **financeiro** (caixa, AR/AP).
- UI estilo **Olist**: sidebar colapsável, cards, tabelas, status chips.
- Escopo completo está no **[CHECKLIST.md](./CHECKLIST.md)**. Itens com `[x]` = feito; `[ ]` = pendente.

---

## Onde estamos e o que fazer em seguida

- **Arquivo de status (sempre atualizado):** [STATUS.md](./STATUS.md)  
  Lá estão a **fase atual** do projeto e os **próximos passos sugeridos** em ordem. Leia esse arquivo para saber exatamente em que ponto continuar.

- **Lista completa do que falta:** [CHECKLIST.md](./CHECKLIST.md)  
  Use para escolher a próxima tarefa (pegue um item ainda com `[ ]`) e para marcar o que você concluir.

- **Ordem sugerida de implementação (resumo):**
  1. Login (NextAuth ou Clerk) + proteção de rotas
  2. CRUD de usuários (Admin) e RBAC
  3. Comercial: lista de pedidos + criar/editar pedido com itens
  4. Ao confirmar pedido: gerar OP + reservar estoque (BOM) + gerar AR
  5. Caixa (abrir/fechar, receber pagamento) e Estoque (movimentações)

---

## Regras obrigatórias quando você concluir uma tarefa

1. **Marque no checklist:** no [CHECKLIST.md](./CHECKLIST.md), troque `[ ]` por `[x]` nos itens que você concluiu.
2. **Atualize o status (se mudar a fase):** edite o [STATUS.md](./STATUS.md) se a “fase atual” ou os “próximos passos” mudarem.
3. **Envie para o Git:** rode no terminal (PowerShell ou bash) na **raiz do projeto** (pasta onde está este arquivo):
   ```bash
   git add CHECKLIST.md STATUS.md
   git commit -m "feat: descrição do que foi feito"
   git push
   ```
   Assim a próxima IA (ou a mesma em outra sessão) vê o progresso atualizado só abrindo o repositório. O usuário pode ter clonado com outro nome de pasta (ex.: DELIMAEPFINAL2026); use sempre a raiz do repositório.

---

## Estrutura do projeto (onde achar as coisas)

| O quê | Onde |
|------|------|
| Rotas e páginas | `app/` (App Router) |
| Layout (sidebar, topbar) | `components/layout/` |
| Componentes UI (Shadcn) | `components/ui/` |
| Módulos (comercial, produção, etc.) | `components/modules/` |
| Prisma, utils, constantes | `lib/` |
| Schema do banco (todas as entidades) | `prisma/schema.prisma` |
| Seed (dados iniciais) | `prisma/seed.ts` |
| API (ex.: dashboard) | `app/api/` |
| Status de pedido/produção (labels) | `lib/constants.ts` |

---

## Stack e fluxo principal

- **Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/UI, Prisma (PostgreSQL), TanStack Query.
- **Auth:** ainda não implementado (NextAuth ou Clerk). Perfis no schema: enum `Role` (Admin, Vendedor, Caixa, Produção, Instalador, Contador).
- **Fluxo principal a implementar:**  
  Criar pedido → Confirmar pedido → Gerar OP + reservar estoque (via BOM) + gerar Contas a Receber → Produção atualiza/finaliza OP → Baixar materiais (estoque) → Caixa: receber pagamento (baixar AR) → Dashboard reflete os números.

---

## Resumo em uma frase

**Leia [STATUS.md](./STATUS.md) e [CHECKLIST.md](./CHECKLIST.md); faça a próxima tarefa sugerida; ao terminar, marque no checklist, atualize o status se precisar e faça commit + push.**
