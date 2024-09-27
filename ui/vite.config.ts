import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'


function setHeaders(request, response, next) {
  if(request.originalUrl == "/assets/connectionWorker.js"){
    response.setHeader("Service-Worker-Allowed", "/");
    response.setHeader("Cahce-Control", "no-cache");
  }
  next();
}

const customHeaders = {
  name: 'customHeaders',
  configureServer: server => { server.middlewares.use(setHeaders); },
  configurePreviewServer: server => { server.middlewares.use(setHeaders); },
};


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: '../server/public',
    emptyOutDir: true, // also necessary
  },

  server: {
    proxy: {

      // Proxying websockets or socket.io: ws://localhost:5173/socket.io -> ws://localhost:5174/socket.io
      '/sync': {
        target: 'ws://localhost:80',
        ws: true,
      },
    },
  },
})
