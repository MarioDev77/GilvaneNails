# Gilvane Nails — Backend (API)

API REST em **Next.js (App Router) + TypeScript + PostgreSQL + Prisma + NextAuth + Zod**.
Roda na porta **3001**. Quem usa é o frontend (porta 3000), que repassa `/api/*` para cá.

## Fluxo de uma requisição

Route Handler (`src/app/api`) → autenticação (`requireAuth`) → validação Zod (`src/schemas`) → regra de negócio (`src/services`) → Prisma.
Toda consulta filtra por `ownerId` vindo da **sessão** (nunca do cliente).

## Rodando sozinho (sem o frontend)

```bash
docker compose up -d                      # PostgreSQL
cp .env.example .env                      # edite NEXTAUTH_SECRET (openssl rand -base64 32)
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run create-owner -- --name "Gilvane" --email "email@exemplo.com" --password "UmaSenhaForte123"
npm run dev                               # http://localhost:3001  (saúde: /api/health)
```

Em geral use `npm run setup` e `npm run dev` na **raiz** do projeto.

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Conexão PostgreSQL |
| `NEXTAUTH_URL` | Endereço onde a pessoa **abre o sistema** (o do frontend: `http://localhost:3000`, ou o https público) |
| `NEXTAUTH_SECRET` | Segredo forte da sessão |

## Autenticação

Login por e-mail/senha (bcrypt, custo 12), sessão JWT em cookie por 30 dias, limite de 8 tentativas erradas / 15 min por e-mail.
Não existe cadastro público — a conta é criada com `npm run create-owner`.
Protocolo (é o do NextAuth): `GET /api/auth/csrf` → `POST /api/auth/callback/credentials` (`csrfToken, email, password, json=true`) → `GET /api/auth/session`.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET/POST | `/api/clients` | Listar (`search`, `includeArchived`) / criar |
| GET/PATCH/DELETE | `/api/clients/:id` | Detalhe / editar / arquivar |
| GET | `/api/clients/:id/history` | Atendimentos, próximos horários, pagamentos, saldo em aberto |
| GET/POST | `/api/services` | Listar (`activeOnly`, `search`) / criar |
| GET/PATCH/DELETE | `/api/services/:id` | Detalhe / editar (`isActive`) / desativar |
| GET/POST | `/api/appointments` | Listar (`startDate`, `endDate`, `status`, `clientId`, `upcoming`) / criar |
| GET/PATCH/DELETE | `/api/appointments/:id` | Detalhe / remarcar-editar / cancelar |
| PATCH | `/api/appointments/:id/status` | Alterar status |
| GET | `/api/appointments/today` | Agendamentos de hoje |
| GET/POST | `/api/attendances` | Listar (com saldo) / registrar (com ou sem agendamento) |
| GET/PATCH | `/api/attendances/:id` | Detalhe / editar |
| GET/POST | `/api/attendances/:id/payments` | Listar / registrar pagamento |
| GET | `/api/finance/summary` | Resumo (recebido, despesas, saldo, a receber) |
| GET/POST | `/api/finance/expenses` | Listar / lançar despesa |
| GET/PATCH | `/api/finance/expenses/:id` | Detalhe / editar |
| PATCH | `/api/finance/expenses/:id/pay` · `/cancel` | Pagar / cancelar |
| GET/POST | `/api/categories` | Categorias de despesa (as padrão são criadas no primeiro acesso) |
| GET | `/api/dashboard` | Painel inicial |
| GET | `/api/reports/financial` | Relatório por dia/mês, top serviços, formas de pagamento |
| GET/PATCH | `/api/settings` | Nome do negócio e telefone |
| POST | `/api/account/password` | Trocar senha |
| GET | `/api/health` | Saúde da API e do banco |

Respostas: sucesso `{ "data": ... }`; erro `{ "error": { "code", "message", "details?" } }`.
Datas de filtro aceitam `YYYY-MM-DD` (interpretadas na Bahia) ou ISO com fuso.

## Regras importantes

- Valores em **centavos** (inteiros).
- Horários não podem se sobrepor (encostar é permitido); a checagem é protegida contra requisições simultâneas.
- Cancelado/faltou libera o horário; reativar só se o horário continuar livre.
- Um agendamento gera no máximo um atendimento (e fica *Concluído*).
- Pagamentos parciais; **não é possível receber mais que o saldo**; reenvio com a mesma `idempotencyKey` não duplica.
- Fuso padrão `America/Bahia` (UTC-3). Timestamps ficam em UTC no banco.
- Excluir cliente = arquivar; excluir serviço = desativar (o histórico fica íntegro).

## Scripts

`npm run dev` · `build` · `start` · `test` · `typecheck` · `db:migrate` · `db:deploy` · `db:studio` · `create-owner`

## Backup

```bash
docker exec gilvane-nails-db pg_dump -U gilvane gilvane_nails > backup.sql
docker exec -i gilvane-nails-db psql -U gilvane gilvane_nails < backup.sql
```
