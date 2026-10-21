import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pelli Kathalu by Prem & Pavan",
    short_name: "Pelli Kathalu",
    description: "Wedding photography & films in Hyderabad — captured the way they feel.",
    start_url: "/",
    display: "standalone",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    background_color: "#ffffff",
    theme_color: "#ffffff",
  };
}
