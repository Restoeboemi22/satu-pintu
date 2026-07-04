/** @type {import('next').NextConfig} */

const isStaticExport = process.env.WEB_STATIC_EXPORT === "1";

const nextConfig = {
  ...(isStaticExport ? { output: "export" } : {}),
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
