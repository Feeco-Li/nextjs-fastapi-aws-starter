/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Amplify manual deployment (no Git / SSR compute needed)
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  images: {
    unoptimized: true, // required for static export
  },
};

export default nextConfig;
