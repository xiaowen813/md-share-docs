import { ref } from 'vue'
import { supabase } from './supabase'

export const user = ref(null)
export const role = ref('anonymous') // 'admin' | 'editor' | 'anonymous'

export function canWrite() {
  return role.value === 'admin' || role.value === 'editor'
}

// 刷新登录态与角色（登录后先确保首用户成为管理员）
export async function refreshAuth() {
  const { data } = await supabase.auth.getSession()
  user.value = data.session?.user ?? null
  if (user.value) {
    await supabase.rpc('ensure_admin')
    await supabase.rpc('link_login') // 绑定授权记录到当前登录用户
    const { data: r } = await supabase.rpc('current_user_role')
    role.value = r || 'anonymous'
  } else {
    role.value = 'anonymous'
  }
  return role.value
}

export async function login() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
  if (error) console.error('登录失败', error)
}

export async function logout() {
  await supabase.auth.signOut()
  user.value = null
  role.value = 'anonymous'
}

export function displayName(u) {
  return u?.user_metadata?.user_name || u?.user_metadata?.name || u?.email || '用户'
}