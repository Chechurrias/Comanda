/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep development artifacts separate so production builds cannot corrupt
  // a running dev server's webpack module/chunk mapping.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',

  // Mantenemos tus configuraciones originales para ignorar errores
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // OPCIONAL: Si tienes paquetes locales en tu monorepo (ej. una carpeta "packages/ui")
  // y al quitar el Webpack te da un error de "Invalid hook call", 
  // descomenta la siguiente línea y pon el nombre de tu paquete:
  // transpilePackages: ["ui"], 
};

module.exports = nextConfig;