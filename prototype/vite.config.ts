import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// BASE_PATH is set when publishing under a sub-folder (GitHub Pages serves /microdrama_lessons/).
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
})
