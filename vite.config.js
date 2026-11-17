import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: mode === 'e2e' ? false : {
      port: 3000,
    },
    watch: { ignored: ['**/test-results/**', '**/tests/artifacts/**', '**/playwright-report/**'] },
  },
}));
