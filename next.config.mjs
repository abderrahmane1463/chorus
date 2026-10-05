/**
 * Plain JavaScript, not TypeScript, on purpose.
 *
 * Next compiles a .ts config with its native SWC binary before it can read it.
 * On hosts with an older glibc that binary will not load, which fails the build
 * and the server start. A .mjs config needs no compilation step.
 *
 * @type {import('next').NextConfig}
 */

import createNextIntlPlugin from 'next-intl/plugin';

/**
 * Origins allowed to invoke Server Actions.
 *
 * Next verifies the request Origin against the Host and silently rejects
 * anything it does not recognise, which makes every form appear to do nothing.
 * Add the public origin here when serving behind a reverse proxy, a custom
 * domain, or a LAN address.
 */
const allowedOrigins = [
  'localhost:3000',
  '127.0.0.1:3000',
  ...(process.env.SERVER_ACTION_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
];

/**
 * Headers sent with every response.
 *
 * - HSTS: once a browser has seen the site over HTTPS, it never tries plain
 *   HTTP again, so nobody on the venue's Wi-Fi can serve it a fake copy.
 *   Browsers ignore it over plain HTTP, so local development is unaffected.
 * - Framing refused: no other site can show Chorus inside its own page and
 *   trick a host into clicking Delete or Start on it.
 * - nosniff: a file is only ever treated as the type it was sent as.
 * - Referrer: other sites learn which site a visitor came from, never the
 *   page, which would include an event's join code.
 * - Permissions: the app never needs the camera, microphone or location,
 *   so no page of it can ask for them.
 *
 * No full content policy: Next.js and the theme script rely on inline
 * scripts, and a policy that blocked them would break every page.
 */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig = {
  // Do not announce the framework and version to every visitor.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default createNextIntlPlugin('./i18n/request.ts')(nextConfig);
