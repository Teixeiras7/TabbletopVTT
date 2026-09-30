import type { NextConfig } from "next";

// CSP com script-src exigiria nonce (o Next injeta scripts inline); por ora só as
// diretivas que não dependem disso.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Padrão do Next é 1 MB, o que barrava a imagem de fundo. 4,5 MB = 4 MB da
    // imagem (MAX_BACKGROUND_BYTES) + folga do multipart, e é o teto da Vercel.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
