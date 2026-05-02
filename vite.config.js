import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Raise chunk warning to 600kB (React + app code is fine)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor chunk for better caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  // Optimize deps for faster dev server starts
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js'],
  },
})
