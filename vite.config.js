
import { defineConfig } from 'vite'

export default defineConfig({
    base: '/project_kato/',
    server: {
        port: 3000,
        open: true
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    }
})
