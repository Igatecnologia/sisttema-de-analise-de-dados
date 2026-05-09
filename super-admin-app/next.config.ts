import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Em prod o nginx/Vercel proxy rotearia /api → backend.
  // Em dev, usamos rewrites pra evitar CORS — admin app fala com backend via mesma origem.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
