import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mainline: the honest chess training program",
    short_name: "Mainline",
    description:
      "A personalized chess training program with graded, explainable recommendations.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#eeefe9",
    theme_color: "#2f6a4f",
    categories: ["education", "games"],
    icons: [
      {
        src: "/icons/mainline-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/mainline-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/mainline-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
