# Gilvane Nails — Backend

Sistema de gestão para manicure (uso pessoal).  
API REST construída com **Next.js App Router**, **TypeScript**, **PostgreSQL**, **Prisma ORM**, **NextAuth.js** e **Zod**.

## Arquitetura

```
src/
├── app/api/          # Route Handlers (entrada HTTP)
├── schemas/          # Validação Zod
├── services/         # Regras de negócio
├── lib/              # Prisma, Auth, helpers
├── types/            # Tipagens
prisma/
├── schema.prisma     # Modelagem do banco
scripts/
├── create-owner.ts   # Criação segura da conta inicial
```

**Fluxo:** Route Handler → validação Zod → autenticação → Service → Prisma.

Todas as entidades privadas são isoladas por `ownerId` obtido da sessão.  
Nunca confie em `ownerId` enviado pelo cliente.

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose (para PostgreSQL local)
- npm ou pnpm

## Configuração local

```bash
# 1. Subir o banco
docker compose up -d

# 2. Copiar variáveis de ambiente
cp .env.example .env
# Edite NEXTAUTH_SECRET (use: openssl rand -base64 32)

# 3. Instalar dependências
npm install

# 4. Gerar client Prisma e aplicar migrations
npx prisma generate
npx prisma migrate dev --name init

# 5. Criar a conta da proprietária (obrigatório)
npm run create-owner -- --name "Gilvane" --email "seu@email.com" --password "SuaSenhaForte123!"

# 6. Iniciar o servidor
npm run dev
```

A API ficará disponível em `http://localhost:3001`. O script `npm run dev` já inicia o backend nessa porta para não conflitar com o frontend.

## Autenticação

- **Login:** `POST /api/auth/callback/credentials` (padrão NextAuth)  
  Ou use o fluxo de credentials do NextAuth no frontend.
- Sessões JWT (estratégia `jwt`).
- Todas as rotas privadas exigem sessão válida.
- Não existe endpoint público de cadastro.

### Exemplo de login (frontend)

```ts
import { signIn } from 'next-auth/react'

await signIn('credentials', {
  email: 'seu@email.com',
  password: 'SuaSenhaForte123!',
  redirect: false,
})
```

## Principais endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET/POST | `/api/clients` | Listar / criar clientes |
| GET/PATCH/DELETE | `/api/clients/:id` | Detalhe / editar / arquivar |
| GET | `/api/clients/:id/history` | Histórico do cliente |
| GET/POST | `/api/services` | Listar / criar serviços |
| GET/PATCH/DELETE | `/api/services/:id` | Detalhe / editar / desativar |
| GET/POST | `/api/appointments` | Listar / criar agendamentos |
| GET/PATCH/DELETE | `/api/appointments/:id` | Detalhe / editar / cancelar |
| PATCH | `/api/appointments/:id/status` | Alterar status |
| GET | `/api/appointments/today` | Agendamentos do dia |
| GET/POST | `/api/attendances` | Listar / criar atendimentos |
| GET/PATCH | `/api/attendances/:id` | Detalhe / editar |
| GET/POST | `/api/attendances/:id/payments` | Listar / registrar pagamento |
| GET | `/api/finance/summary` | Resumo financeiro |
| GET/POST | `/api/finance/expenses` | Listar / criar despesas |
| PATCH | `/api/finance/expenses/:id` | Editar despesa |
| PATCH | `/api/finance/expenses/:id/pay` | Marcar como paga |
| PATCH | `/api/finance/expenses/:id/cancel` | Cancelar despesa |
| GET | `/api/dashboard` | Dados do dashboard |
| GET | `/api/reports/financial` | Relatório financeiro |
| GET/POST | `/api/categories` | Categorias de despesa |

### Formato de resposta

**Sucesso:**
```json
{ "data": { ... } }
```

**Erro:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Verifique os dados enviados.",
    "details": []
  }
}
```

## Regras financeiras importantes

- Valores monetários em **centavos** (`Int`).
- Pagamentos parciais são suportados.
- Um agendamento gera no máximo um atendimento.
- Idempotência em pagamentos via `idempotencyKey`.
- Cancelamentos preservam histórico.
- Receitas = soma de pagamentos registrados.
- Despesas pagas = status `PAID`.
- Saldo de caixa = receitas − despesas pagas.
- Valores a receber = saldo positivo dos atendimentos.

## Timezone

Padrão: `America/Bahia`.  
Timestamps são armazenados em UTC; consultas de “dia” respeitam o fuso.

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Produção |
| `npm run db:migrate` | Migrations de desenvolvimento |
| `npm run db:deploy` | Migrations de produção |
| `npm run create-owner` | Criar conta inicial |
| `npm run test` | Testes unitários |

## Backup e restauração

```bash
# Backup
docker exec gilvane-nails-db pg_dump -U gilvane gilvane_nails > backup.sql

# Restauração
docker exec -i gilvane-nails-db psql -U gilvane gilvane_nails < backup.sql
```

## Integração com o frontend

O frontend (pasta `../frontend`) deve apontar as chamadas de API para a URL do backend e enviar o cookie de sessão do NextAuth (mesma origem ou CORS configurado).

Para desenvolvimento em projetos separados, configure `NEXTAUTH_URL` e CORS adequadamente.

## Segurança

- Senhas com bcrypt (custo 12)
- Autorização por proprietário em todas as operações
- Validação Zod em todas as entradas
- Segredos apenas em variáveis de ambiente
- Transações para operações financeiras e de conflito de agenda
- Idempotência em pagamentos

---

Desenvolvido para uso pessoal da proprietária do salão Gilvane Nails.
