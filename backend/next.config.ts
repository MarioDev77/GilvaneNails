import type { NextConfig } from 'next'

// Backend é só API. O frontend conversa com ele via proxy (/api/* → :3001),
// então navegador e API ficam na mesma origem e o cookie de login funciona.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['pg', '@prisma/adapter-pg', 'bcryptjs'],
}

export default nextConfig
