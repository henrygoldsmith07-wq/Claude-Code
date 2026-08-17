const securityHeaders = [
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

export default {
  // Set by the one-origin shell (apps/ecosystem-shell) to serve this app
  // under a path prefix. Unset means serve at the root, exactly as today.
  basePath: process.env.APP_BASE_PATH || '',
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
