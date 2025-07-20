/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  ...(process.env.NODE_ENV === 'production' && {
    basePath: '/disconnected-lines-threejs',
    assetPrefix: '/disconnected-lines-threejs/',
  }),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
