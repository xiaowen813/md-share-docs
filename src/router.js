import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

// 使用 hash 路由：GitHub Pages 没有服务器端路由重写，hash 模式刷新不会 404
const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/new', name: 'new', component: () => import('./views/NewDocView.vue') },
  { path: '/doc/:id', name: 'read', component: () => import('./views/ReadView.vue'), props: true },
  { path: '/doc/:id/edit', name: 'edit', component: () => import('./views/EditView.vue'), props: true },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
