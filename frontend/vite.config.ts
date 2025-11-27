import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy API requests to the backend server
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Note: WebSocket proxy disabled by default in dev to prevent connection issues
      // WebSocket is optional - app works fine without real-time updates
      // To enable: set VITE_ENABLE_WEBSOCKET=true in .env.local and uncomment below:
      // '/socket.io': {
      //   target: 'http://localhost:5000',
      //   changeOrigin: true,
      //   ws: true,
      // },
    },
  },
})
