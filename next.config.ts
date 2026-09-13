import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static output: the whole app runs in the browser, so it can be
  // hosted for free on Vercel / Netlify / GitHub Pages with no server or DB.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
