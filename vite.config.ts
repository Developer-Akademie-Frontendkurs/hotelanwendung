import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

export default defineConfig({
    plugins: [tailwindcss()],
    root: 'src',
    build: {
        emptyOutDir: true,
        outDir: '../dist',
        rollupOptions: {
            output: {
                entryFileNames: 'script-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: (info) => {
                    const name = info.names?.[0] ?? '';
                    if (name.endsWith('.css')) {
                        return 'style-[hash][extname]';
                    }
                    const original = info.originalFileNames?.[0] ?? '';
                    if (original.startsWith('assets/')) {
                        const dir = original.slice(0, original.lastIndexOf('/'));
                        return `${dir}/[name]-[hash][extname]`;
                    }
                    return 'assets/[name]-[hash][extname]';
                },
            },
        },
    },
    server: {
        open: true,
    },
});
