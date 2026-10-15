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
npm run dev
```

## Frontend

O frontend atual é uma interface visual (mock) pronta para ser conectada às APIs do backend.

```bash
cd frontend
npm install   # ou pnpm install
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
