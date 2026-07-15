import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://sorawit.github.io/ofc-fantasy-solver/
  base: '/ofc-fantasy-solver/',
  plugins: [react()],
})
