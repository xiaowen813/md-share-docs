<script setup>
import { isSupabaseConfigured } from './lib/supabase'
</script>

<template>
  <div class="app">
    <header class="topbar no-print">
      <router-link to="/" class="brand">
        <svg class="logo" viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="var(--primary)" />
          <path d="M7 22V11h4.2l3.3 4.4 3.3-4.4H22v11h-3.9v-6.2l-3.6 4.6-3.6-4.6V22z" fill="#fff" />
        </svg>
        <span class="brand-name">MD&nbsp;Share</span>
      </router-link>
      <div class="spacer"></div>
      <nav class="nav">
        <router-link to="/" class="nav-link">文档列表</router-link>
        <router-link to="/new" class="btn btn-primary btn-sm">＋ 新建文档</router-link>
      </nav>
    </header>

    <div v-if="!isSupabaseConfigured" class="config-warning">
      未检测到 Supabase 配置：请复制 <code>.env.example</code> 为 <code>.env</code>，填入
      <code>VITE_SUPABASE_URL</code> 和 <code>VITE_SUPABASE_ANON_KEY</code> 后重启 <code>npm run dev</code>。
    </div>

    <main class="container">
      <router-view />
    </main>

    <footer class="footer no-print">由 GitHub Pages + Supabase 驱动</footer>
  </div>
</template>
