import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

export default defineConfig({
    plugins: [tailwindcss()],
    root: 'src',
    build: {
        emptyOutDir: true,
        outDir: '../dist',
    },
    server: {
        open: true,
    },
});
