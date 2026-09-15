/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel Hobby / Cloudflare friendly: no image optimisation daemon needed
  images: { unoptimized: true },
};

export default nextConfig;
