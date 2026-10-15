/**
 * Script seguro para criar a conta inicial da proprietária.
 * Uso: npm run create-owner -- --name "Gilvane" --email "email@exemplo.com" --password "SenhaForte123!"
 *
 * NÃO utiliza senhas padrão. Exige parâmetros explícitos.
 */

import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { createPrismaClient } from '../src/lib/prisma-client'

const prisma = createPrismaClient()

function parseArgs() {
  const args = process.argv.slice(2)
  const result: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && args[i + 1]) {
      result[args[i].slice(2)] = args[i + 1]
      i++
    }
  }
  return result
}

async function main() {
  const { name, email, password } = parseArgs()

  if (!name || !email || !password) {
    console.error(`
Uso:
  npm run create-owner -- --name "Nome Completo" --email "email@exemplo.com" --password "SenhaSegura123!"

Todos os parâmetros são obrigatórios.
A senha deve ter no mínimo 8 caracteres.
`)
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('Erro: a senha deve ter no mínimo 8 caracteres.')
    process.exit(1)
  }

  const normalizedEmail = email.trim().toLowerCase()

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (existing) {
    console.error(`Erro: já existe um usuário com o e-mail ${normalizedEmail}`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      settings: {
        create: {
          businessName: 'Gilvane Nails',
          timezone: 'America/Bahia',
        },
      },
    },
    include: { settings: true },
  })

  console.log('✅ Conta da proprietária criada com sucesso!')
  console.log(`   ID:    ${user.id}`)
  console.log(`   Nome:  ${user.name}`)
  console.log(`   Email: ${user.email}`)
  console.log('')
  console.log('Faça login com o e-mail e a senha informados.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
