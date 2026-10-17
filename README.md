# Gilvane Nails — Sistema de Gestão para Manicure

Aplicativo pessoal de gestão para manicure: clientes, serviços, agendamentos, atendimentos, pagamentos, despesas e relatórios financeiros.

## Estrutura

```
gilvane-nails/
├── frontend/     # Interface Next.js + React (UI existente)
├── backend/      # API Next.js + Prisma + PostgreSQL
└── README.md
```

## Backend

Consulte o [README do backend](./backend/README.md) para instruções completas de configuração, migrations, criação da conta inicial e documentação da API.

### Resumo rápido

```bash
cd backend
docker compose up -d
cp .env.example .env
# Edite NEXTAUTH_SECRET
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run create-owner -- --name "Gilvane" --email "seu@email.com" --password "SenhaForte123!"
npm run dev # backend inicia na porta 3001
```

## Frontend

O frontend agora possui login conectado ao NextAuth do backend, navegação funcional, formulários de criação/edição e listagens que leem e gravam pela API. O frontend encaminha `/api/*` para o backend via rewrite.

```bash
cd frontend
npm install   # ou pnpm install
# backend deve estar em http://localhost:3001
# opcional: BACKEND_URL=http://localhost:3001
npm run dev
```

## Critérios de aceitação atendidos

- Autenticação segura com hash de senha
- Isolamento de dados por proprietária (ownerId da sessão)
- CRUD de clientes, serviços, agendamentos, atendimentos
- Prevenção de conflito de horário em agendamentos
- Atendimentos com ou sem agendamento prévio
- Pagamentos parciais e múltiplos
- Idempotência em pagamentos
- Despesas com status e categorias
- Dashboard e relatórios financeiros
- Valores em centavos
- Timezone America/Bahia
- Docker Compose para desenvolvimento
- Script seguro de criação da conta inicial

## Próximos passos recomendados

1. Conectar o frontend às APIs (substituir dados mockados por fetch/axios + NextAuth).
2. Adicionar testes de integração com banco de testes.
3. Configurar rate limiting e headers de segurança em produção.
4. Deploy (Vercel + Neon/Supabase ou similar).


## Integração frontend/backend

- Inicie o backend na porta 3001 e configure seu `.env` conforme `backend/README.md`.
- No frontend, defina `BACKEND_URL=http://localhost:3001` (esse é o padrão de desenvolvimento).
- O frontend encaminha `/api/*` ao backend; mantenha o `NEXTAUTH_SECRET` igual ao configurado no backend para o fluxo de sessão.
- Execute `npm install` na pasta `frontend` após a atualização para instalar as dependências listadas no `package.json`.
- A tela de login usa a conta criada pelo comando `npm run create-owner` no backend. Não há senha padrão embutida.

## Fechar o dia e financeiro (novo)

No painel, em **Agendamentos → Fechar o dia**, a manicure marca o que atendeu, escolhe a forma de pagamento
(Pix, dinheiro, débito, crédito) e confirma. Cada atendimento concluído:

1. muda o agendamento para `COMPLETED`;
2. cria o **atendimento** (valor combinado; se recebeu menos vira desconto, se recebeu mais o valor sobe);
3. lança o **pagamento** (entrada no caixa) — por isso o valor aparece na hora no saldo.

"Desfazer" reabre o agendamento e remove o atendimento e o pagamento.

Cálculos (todos em centavos, fuso America/Bahia):

- **Saldo do período** = pagamentos recebidos no período − despesas **pagas** no período
- **Saldo total em caixa** = todos os pagamentos − todas as despesas pagas
- **A receber (previsto)** = soma dos agendamentos ainda agendados/confirmados no período
- **Despesas pendentes** não entram no saldo até serem marcadas como pagas ("Pagar")
- **Ticket médio** = recebido ÷ nº de atendimentos

Novas rotas: `POST /api/appointments/:id/complete`, `POST /api/appointments/complete-day`,
`POST /api/appointments/:id/reopen`, `GET /api/finance/movements`.
Correções: datas `YYYY-MM-DD` não voltam mais um dia; relatório agrupa pelo dia local; horários nos formulários
aparecem no fuso local.
