import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(process.cwd(), '../..'),
  },
  // Em prod o nginx/Vercel proxy rotearia /api → backend.
  // Em dev, usamos rewrites pra evitar CORS — admin app fala com backend via mesma origem.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
