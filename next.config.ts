import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "archiver", "puppeteer"],
  async redirects() {
    return [
      { source: "/", destination: "/content/my-content", permanent: false },
    ];
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "frame-src 'self' blob:",
              "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
            ].join("; "),
          },
          ...(isDev ? [
            { key: "Cache-Control", value: "no-store, must-revalidate" },
            { key: "Pragma", value: "no-cache" },
            { key: "Expires", value: "0" },
          ] : []),
        ],
      },
    ];
  }
};

export default nextConfig;
