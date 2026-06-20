/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cross-origin isolation so multi-threaded stockfish.wasm (SharedArrayBuffer) works
  // client-side later (BUILD.md §6.5). Applied app-wide.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
