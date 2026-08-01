import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this repo at https://kt-hardcharger.github.io/kware-banking/
// so every asset path needs the /kware-banking/ base.
export default defineConfig({
  plugins: [react()],
  base: '/kware-banking/',
})
