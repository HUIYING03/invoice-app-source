import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static output: the whole app runs in the browser, so it can be
  // hosted for free on Vercel / Netlify / GitHub Pages with no server or DB.
  output: "export",
  images: { unoptimized: true },

  // Dev only. Next blocks cross-origin requests to dev assets and the HMR
  // socket, so opening the Network URL on a phone loads the HTML but never
  // hydrates — the page sits on "Loading…". These entries allow this Mac's
  // LAN address. Hostnames only: no scheme, no port.
  allowedDevOrigins: ["192.168.0.5", "192.168.0.*", "192.168.1.*"],
};

export default nextConfig;
