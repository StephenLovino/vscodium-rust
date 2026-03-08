import { defineConfig } from 'vite';

export default defineConfig({
    root: './src',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        strictPort: true,
        host: true,
    },
    // Vite settings for Tauri
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
});
