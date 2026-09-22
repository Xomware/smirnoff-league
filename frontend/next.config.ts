import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export to S3 + CloudFront. No server actions or route handlers;
  // private data comes from Cognito-authorized API endpoints instead.
  output: "export",

  // Emits /standings/index.html instead of /standings.html, which is the shape
  // the web-hosting module's subroute rewrite expects.
  trailingSlash: true,

  images: {
    // next/image's optimizer needs a running server; a static export has none.
    unoptimized: true,
  },
};

export default nextConfig;
