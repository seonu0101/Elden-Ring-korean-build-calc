import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// 배포 주소가 er-sin.com/buildplanner/ 라서 빌드할 때만 경로 앞에 /buildplanner/ 를 붙인다.
// 결과물도 dist/buildplanner/ 에 만들어서, Netlify에서 /buildplanner/... 주소로 그대로 열린다.
// 개발 서버와 테스트는 지금처럼 / 에서 돈다. (vite preview는 빌드 결과를 보는 것이라 /buildplanner/)
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/buildplanner/' : '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist/buildplanner',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
  },
}))
