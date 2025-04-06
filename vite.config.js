import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss()
  ],
  json: {
    stringify: true
  },
  server: {
    host: true,
    allowedHosts: ['tailwind-test-zr06.onrender.com']
  }
});
