import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// The web build keeps absolute asset paths (base '/'). The Electron build sets
// ELECTRON=true so assets use relative paths ('./'), which is required for
// loading dist/index.html over file://. The web output is unchanged.
export default defineConfig({
  base: process.env.ELECTRON === 'true' ? './' : '/',
  plugins: [react()],
  server: {
    port: 5173,
  },
});
