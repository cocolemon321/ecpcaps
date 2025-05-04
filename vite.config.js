import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : '/ecpcaps/',
  publicDir: 'public',
  build: {
    assetsDir: 'assets'
  }
}))