import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Renderizado dinámico clásico: todas las pantallas dependen de la sesión del usuario.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
