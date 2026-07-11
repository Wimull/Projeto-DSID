import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve } from 'path'

// https://vitejs.dev/config
export default defineConfig({
    plugins: [
        tailwindcss(),
        react(),
        nodePolyfills({ include: ['os', 'path', 'fs', 'child_process'] }),
    ],

    build: {
        rollupOptions: {
            input: {
                main_window: resolve(__dirname, 'index.html'),
                server_window: resolve(__dirname, 'server-dev.html'),
            },
        },
    },
})
