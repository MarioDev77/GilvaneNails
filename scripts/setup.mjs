/**
 * Prepara o projeto do zero: .env, dependências, banco de dados e tabelas.
 * Uso: npm run setup
 */
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const run = (cmd, cwd = '.') => execSync(cmd, { cwd, stdio: 'inherit' })
const has = (cmd) => spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: true }).status === 0
const step = (t) => console.log(`\n\x1b[35m▸ ${t}\x1b[0m`)

const major = Number(process.versions.node.split('.')[0])
if (major < 20) {
  console.error(`Node.js 20 ou superior é necessário (você tem ${process.versions.node}). Baixe em https://nodejs.org`)
  process.exit(1)
}

step('1/5 Configuração (backend/.env)')
if (!existsSync('backend/.env')) {
  copyFileSync('backend/.env.example', 'backend/.env')
  const env = readFileSync('backend/.env', 'utf8').replace('troque-por-um-segredo-forte', randomBytes(32).toString('base64'))
  writeFileSync('backend/.env', env)
  console.log('Arquivo backend/.env criado com um segredo de login aleatório.')
} else {
  console.log('backend/.env já existe — mantido.')
}

step('2/5 Instalando dependências')
run('npm install', 'backend')
run('npm install', 'frontend')

step('3/5 Banco de dados (PostgreSQL)')
if (has('docker')) {
  try {
    run('docker compose -f backend/docker-compose.yml up -d --wait')
  } catch {
    console.error('\nNão consegui iniciar o banco com o Docker. Verifique se o Docker Desktop está aberto e rode "npm run setup" de novo.')
    process.exit(1)
  }
} else {
  console.log('Docker não encontrado. Tudo bem: aponte DATABASE_URL (em backend/.env) para um PostgreSQL seu\n(pode ser um gratuito em neon.tech ou supabase.com) e o setup continua.')
}

step('4/5 Criando as tabelas')
run('npx prisma generate', 'backend')
run('npx prisma migrate dev --name init', 'backend')

step('5/5 Pronto!')
console.log(`
Próximos passos:

  1) Crie o login da dona do sistema (troque os dados):
     npm run create-owner -- --name "Gilvane" --email "email@exemplo.com" --password "UmaSenhaForte123"

  2) Ligue o sistema:
     npm run dev

  3) Abra http://localhost:3000 e entre com o e-mail e a senha acima.
`)
