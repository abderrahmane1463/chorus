import type { NextConfig } from 'next';

/**
 * Origins allowed to invoke Server Actions.
 *
 * Next verifies the request Origin against the Host and silently rejects
 * anything it does not recognise, which makes every form appear to do nothing.
 * Add the public origin here when serving behind a reverse proxy, a custom
 * domain, or a LAN address (handy for testing on a phone).
 */
const allowedOrigins = [
  'localhost:3000',
  '127.0.0.1:3000',
  ...(process.env.SERVER_ACTION_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default nextConfig;
