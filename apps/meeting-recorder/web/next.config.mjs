/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Recordings are streamed from R2 via presigned URLs, so no remote image config needed.
  experimental: {
    // Allow larger request bodies on server actions / route handlers if ever needed.
  },
};

export default nextConfig;
