# ERP Industrial – Serralheria

ERP modular para serralheria com foco em **produto**, **BOM**, **produção (PWA)** e **financeiro**. UI inspirada no Olist: sidebar colapsável, tabelas densas, cards e status badges.

---

## 🤖 Se você é uma IA (ou vai usar IA para continuar)

**Ao receber só o link deste repositório:** leia primeiro o arquivo **[PARA-IA.md](./PARA-IA.md)** (na raiz do projeto).  
Lá está todo o contexto: o que é o projeto, onde estamos, o que fazer em seguida, onde está cada coisa e como atualizar o checklist (marcar + commit + push). Assim você só manda o link do repo e a IA entende tudo.

---

## Controle de progresso

- **[STATUS.md](./STATUS.md)** — Fase atual e próximos passos (atualize quando mudar o foco).
- **[CHECKLIST.md](./CHECKLIST.md)** — Lista completa do escopo; marque `[x]` no que for concluído e faça commit.

## Tech stack

- **Framework:** Next.js 14 (App Router)
- **Linguagem:** TypeScript
- **UI:** Tailwind CSS + Shadcn/UI (Lucide React)
- **Banco:** PostgreSQL + Prisma ORM
- **Auth:** Base pronta para NextAuth.js ou Clerk (RBAC)
- **State/Server:** TanStack Query

## Pré-requisitos

- Node.js 18+
- npm ou pnpm
- Docker (para PostgreSQL local)

## Como rodar

### 1. Clone e instale dependências

```bash
cd erp-serralheria
npm install
```

### 2. Banco de dados

Copie o arquivo de ambiente e suba o Postgres com Docker:

```bash
cp .env.example .env
docker compose up -d
```

Ajuste o `DATABASE_URL` no `.env` se necessário (usuário/senha/porta).

### 3. Migrations e seed

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts

| Script        | Descrição                    |
|---------------|------------------------------|
| `npm run dev` | Sobe o Next.js em modo dev   |
| `npm run build` | Build de produção          |
| `npm run start` | Sobe o Next.js em produção |
| `npm run db:generate` | Gera o Prisma Client   |
| `npm run db:migrate` | Roda migrations        |
| `npm run db:seed` | Popula dados iniciais    |
| `npm run db:studio` | Abre Prisma Studio     |
| `npm run zip` | Gera zip do projeto sem node_modules |

## Estrutura do projeto

```
erp-serralheria/
├── app/
│   ├── api/                 # Rotas API (dashboard, módulos)
│   ├── (auth)/              # Login (a implementar)
│   ├── layout.tsx
│   ├── page.tsx             # Dashboard
│   └── globals.css
├── components/
│   ├── layout/              # Sidebar, Topbar, MainContent
│   ├── ui/                  # Shadcn (Button, Card, Badge, etc.)
│   └── modules/             # Por módulo (comercial, produção, estoque, etc.)
├── lib/
│   ├── prisma.ts
│   ├── utils.ts
│   └── constants.ts         # Status pipeline (Order, Production)
├── hooks/
│   └── use-mobile.ts
├── prisma/
│   ├── schema.prisma        # Modelo completo (Company, Order, BOM, etc.)
│   └── seed.ts
├── docker-compose.yml
└── .env.example
```

## Módulos

- **Comercial:** Pedidos, orçamentos, clientes
- **Produção (PWA):** OPs, etapas (Corte/Solda/Pintura/Montagem), apontamento
- **Estoque:** Materiais, movimentações, reserva ao confirmar pedido
- **Financeiro:** Contas a receber, caixa, contas a pagar
- **Fiscal:** Stub (NF, configurações)
- **IA Copilot:** Análise de dados (produto mais lucrativo, material acabando, etc.)

## Fluxos obrigatórios (MVP)

1. Criar pedido na frente de loja  
2. Confirmar pedido → gera OP e reserva materiais  
3. Produção atualiza status e finaliza OP  
4. Baixa/consumo de materiais no estoque  
5. Gerar AR e marcar como pago no Caixa  
6. Dashboard refletindo os números  

## Logins / perfis (base para RBAC)

Perfis previstos: Admin, Vendedor, Caixa, Produção, Instalador, Contador.  
CRUD de usuários e permissões por módulo ficam na base (AuditLog, Company, User no schema).

## Subir para o GitHub

1. **Crie um repositório no GitHub** (sem README, sem .gitignore — o projeto já tem).

2. **Na pasta do projeto, inicialize o Git e faça o primeiro push:**

   ```bash
   cd erp-serralheria
   git init
   git add .
   git commit -m "chore: esqueleto inicial ERP Serralheria (Next.js 14, Prisma, checklist)"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/erp-serralheria.git
   git push -u origin main
   ```

   Troque `SEU_USUARIO/erp-serralheria` pela URL do seu repositório (pode ser SSH: `git@github.com:SEU_USUARIO/erp-serralheria.git`).

3. **Não commite o `.env`** — ele já está no `.gitignore`. Use `.env.example` como referência para configurar em outro ambiente.

Com o código no GitHub, fica mais fácil dar continuidade com outras IAs ou com o Cursor em outra máquina: clone o repo, instale dependências, configure o `.env` e use o [CHECKLIST.md](./CHECKLIST.md) para ver o que falta.

## Licença

Uso interno / sob demanda.
