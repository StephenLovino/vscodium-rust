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
    },
    // Vite settings for Tauri
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
});
