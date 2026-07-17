import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { defineConfig } from 'vite'

// https://vitejs.dev/config
export default defineConfig({
    plugins: [
        nodePolyfills({
            include: ['os', 'path', 'fs', 'child_process', 'net'],
        }),
    ],
})
