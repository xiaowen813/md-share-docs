<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { isSupabaseConfigured } from './lib/supabase'
import { supabase } from './lib/supabase'
import { user, role, canWrite, refreshAuth, login, logout, displayName } from './lib/session'

const route = useRoute()
const isEditor = computed(() => route.name === 'edit' || route.name === 'read')

// 全站主题：黑夜 / 白天（class 挂到 <html>）
const theme = ref(localStorage.getItem('mdshare-theme') || 'light')
function applyTheme(t) {
  document.documentElement.classList.toggle('theme-dark', t === 'dark')
  localStorage.setItem('mdshare-theme', t)
}
function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

// 管理员：添加/移除授权用户
const showUsers = ref(false)
const newUsername = ref('')
const userMsg = ref('')
const userError = ref('')
const authorized = ref([])

async function loadAuthorized() {
  const { data, error } = await supabase
    .from('authorized_users')
    .select('github_username, is_admin, created_at')
    .order('created_at', { ascending: true })
  if (!error) authorized.value = data ?? []
  else userError.value = error.message
}

async function openUsers() {
  showUsers.value = true
  userMsg.value = ''
  userError.value = ''
  newUsername.value = ''
  await loadAuthorized()
}

async function addUser() {
  const name = newUsername.value.trim()
  if (!name) { userError.value = '请输入 GitHub 用户名'; return }
  userError.value = ''
  const { error } = await supabase.rpc('add_authorized_user', { p_github_username: name })
  if (error) userError.value = error.message
  else {
    userMsg.value = `已添加 ${name}（对方登录后生效）`
    newUsername.value = ''
    await loadAuthorized()
  }
}

async function removeUser(name) {
  if (!confirm(`确定移除授权用户 ${name} 吗？`)) return
  const { error } = await supabase.rpc('remove_authorized_user', { p_github_username: name })
  if (error) userError.value = error.message
  else { userMsg.value = `已移除 ${name}`; await loadAuthorized() }
}

onMounted(async () => {
  applyTheme(theme.value)
  await refreshAuth()
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') refreshAuth()
    if (event === 'SIGNED_OUT') { user.value = null; role.value = 'anonymous' }
  })
})
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
        <button class="btn btn-ghost" :title="theme === 'dark' ? '切换到白天' : '切换到黑夜'" @click="toggleTheme">
          {{ theme === 'dark' ? '☀ 白天' : '🌙 黑夜' }}
        </button>
        <template v-if="user">
          <button v-if="role === 'admin'" class="btn btn-ghost" @click="openUsers">👥 添加用户</button>
          <span class="user-chip" :title="role === 'admin' ? '管理员' : role === 'editor' ? '授权用户' : '未授权'">
            <img v-if="user.user_metadata?.avatar_url" :src="user.user_metadata.avatar_url" class="avatar" alt="" />
            <span class="uname">{{ displayName(user) }}</span>
            <span class="role-badge" :class="'role-' + role">{{ role === 'admin' ? '管理员' : role === 'editor' ? '编辑' : '游客' }}</span>
          </span>
          <button class="btn btn-ghost" @click="logout">退出</button>
        </template>
        <button v-else class="btn btn-primary btn-sm" @click="login">GitHub 登录</button>
        <router-link v-if="canWrite()" to="/new" class="btn btn-primary btn-sm">＋ 新建文档</router-link>
      </nav>
    </header>

    <div v-if="!isSupabaseConfigured" class="config-warning">
      未检测到 Supabase 配置：请复制 <code>.env.example</code> 为 <code>.env</code>，填入
      <code>VITE_SUPABASE_URL</code> 和 <code>VITE_SUPABASE_ANON_KEY</code> 后重启 <code>npm run dev</code>。
    </div>

    <main class="container" :class="{ 'container-wide': isEditor }">
      <router-view />
    </main>

    <footer class="footer no-print">由 GitHub Pages + Supabase 驱动</footer>

    <!-- 管理员：用户管理弹窗 -->
    <div v-if="showUsers" class="modal-overlay" @click.self="showUsers = false">
      <div class="modal modal-wide">
        <div class="modal-head">
          <h3>👥 用户管理</h3>
          <button class="btn btn-icon" @click="showUsers = false">✕</button>
        </div>
        <div class="field">
          <label for="newUser">添加授权用户（输入对方的 GitHub 用户名）</label>
          <div class="add-user-row">
            <input id="newUser" v-model="newUsername" placeholder="例如：octocat" @keyup.enter="addUser" />
            <button class="btn btn-primary" @click="addUser">添加</button>
          </div>
          <p class="hint">被添加的用户用该 GitHub 账号登录后即可新建/编辑/上传；未授权用户只能阅读。</p>
        </div>
        <p v-if="userMsg" class="message">{{ userMsg }}</p>
        <p v-if="userError" class="error">{{ userError }}</p>
        <ul class="version-list" style="max-height:36vh">
          <li v-for="u in authorized" :key="u.github_username" class="version-item">
            <div class="version-info">
              <strong>{{ u.github_username }}</strong>
              <span class="tag">{{ u.is_admin ? '管理员' : '编辑' }}</span>
            </div>
            <button v-if="!u.is_admin" class="btn btn-danger btn-sm" @click="removeUser(u.github_username)">移除</button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
