/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework version in every response.
  poweredByHeader: false,
  // The app renders no next/image, so the image optimizer is switched off —
  // that closes the /_next/image endpoint several Next.js advisories target.
  images: { unoptimized: true },
};

export default nextConfig;
