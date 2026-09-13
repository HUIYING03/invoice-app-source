import type { MetadataRoute } from "next";

// Required by `output: "export"`: the manifest is generated once at build time
// rather than served from a running route handler.
export const dynamic = "force-static";

/**
 * Makes the app installable. On Android, Chrome uses this for the home-screen
 * icon and the "Install app" prompt; on iOS, Safari uses apple-icon.png plus
 * `display: standalone` when you Add to Home Screen.
 *
 * `standalone` also drops the browser chrome, which is what makes it feel like
 * an app rather than a bookmark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Invoice & Quotation",
    short_name: "Invoices",
    description: "Write up a job and get a printable invoice or quotation.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f8",
    theme_color: "#1d4e89",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops icons to its own shape; this one keeps the artwork inside
      // the safe zone so nothing important is cut off.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
