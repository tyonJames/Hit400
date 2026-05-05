/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@stacks/connect', '@stacks/auth', '@stacks/wallet-sdk'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'gateway.pinata.cloud' },
      { protocol: 'https', hostname: 'explorer.hiro.so' },
    ],
  },
};

export default nextConfig;
