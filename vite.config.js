import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base 使用相对路径：GitHub Pages 部署在 https://user.github.io/仓库名/ 子路径下也能正常加载资源
export default defineConfig({
  plugins: [vue()],
  base: './',
})
