import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // PENTING: Perbarui ini dengan nama repositori GitHub Anda.
  // Contoh: jika URL repo Anda adalah https://github.com/user/my-app, atur base menjadi '/my-app/'
  base: '/simple-chart/',
})