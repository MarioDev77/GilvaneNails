/** @type {import('next').NextConfig} */

// Endereço do backend (API). Em produção, defina BACKEND_URL no ambiente.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001'

const nextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  // O navegador sempre fala só com o frontend (mesma origem); /api/* é repassado
  // ao backend. Assim o cookie de login funciona sem CORS.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }]
  },
}

export default nextConfig
