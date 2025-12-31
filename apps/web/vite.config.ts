import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '@linkup/shared/config': resolve(__dirname, '../../packages/shared/src/config.ts'),
            '@linkup/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:3001',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://127.0.0.1:3001',
                ws: true,
            },
        },
    },
    build: {
        target: 'esnext',
        sourcemap: true,
    },
});
