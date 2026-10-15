# Gilvane Nails — Sistema de Gestão para Manicure

Agenda, clientes, serviços, atendimentos, pagamentos (parciais e múltiplos), despesas e relatórios financeiros.

```
gilvane-nails/
├── frontend/   Interface (Next.js + React) — http://localhost:3000
├── backend/    API (Next.js + Prisma + PostgreSQL + login) — http://localhost:3001
├── scripts/    setup.mjs (instalação automática)
└── tests/      e2e.mjs (teste de ponta a ponta)
```

## Como o front e o back se conectam

O navegador só conversa com o **frontend** (porta 3000). Tudo que começa com `/api/` é repassado
automaticamente para o **backend** (porta 3001) — veja `rewrites()` em `frontend/next.config.mjs`.
Assim o cookie de login funciona sem configurar CORS.

## Instalação (uma vez)

Precisa de **Node.js 20+** e **Docker Desktop** (para o banco PostgreSQL).

```bash
npm install          # só o "concurrently" (liga front e back juntos)
npm run setup        # cria .env, instala tudo, sobe o banco e cria as tabelas
npm run create-owner -- --name "Gilvane" --email "email@exemplo.com" --password "UmaSenhaForte123"
```

## Uso diário

```bash
npm run dev          # liga banco + API + site
```

Abra **http://localhost:3000** e entre com o e-mail e a senha criados acima.
(Se o banco estiver parado: `npm run db:up`.)

## O que o sistema faz

| Tela | Funções |
|------|---------|
| Início | Recebido hoje, atendimentos do dia, total a receber, clientes ativas, agenda de hoje, gráfico de 7 dias |
| Agenda | Navegar por dia, agendar, editar/remarcar, confirmar, cancelar, marcar falta, atender, WhatsApp. Não deixa dois horários se sobreporem |
| Atendimentos | Por mês; registrar com ou sem agendamento; desconto; receber pagamentos parciais; ver saldo |
| Clientes | Buscar, cadastrar, editar, arquivar, histórico (atendimentos, saldo, próximos horários) |
| Serviços | Preço e duração; desativar/reativar |
| Financeiro | Resumo do mês, despesas (categorias, vencimento), pagar/cancelar despesa |
| Relatórios | Receitas × despesas, serviços mais feitos, formas de pagamento, despesas por categoria |
| Configurações | Nome do negócio, telefone, trocar senha, sair |

## Testes

```bash
npm test                                  # testes unitários (datas, validações)
E2E_EMAIL=... E2E_PASSWORD=... npm run e2e   # fluxo completo contra o sistema ligado
```

O `e2e` cria dados "[E2E] ..." na conta usada — prefira uma conta de teste.

## Colocar na internet (resumo)

1. Banco PostgreSQL gerenciado (Neon, Supabase, Railway…) → `DATABASE_URL`.
2. Backend: `NEXTAUTH_URL` = endereço **público do site** (https://…), `NEXTAUTH_SECRET` forte; rode `npm run db:deploy` (em `backend/`) para criar as tabelas.
3. Frontend: `BACKEND_URL` = endereço do backend.
4. Sempre em HTTPS. Faça backup do banco com regularidade.

Detalhes da API: [backend/README.md](./backend/README.md).
# GilvaneNails
