import { defineConfig } from 'vite';

// Игра собирается в dist/ и работает из любой папки (GitHub Pages: /-quizlet/).
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
