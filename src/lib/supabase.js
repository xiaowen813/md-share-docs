import { createClient } from '@supabase/supabase-js'

// 注意：anon key 是“公开”的，真正的安全由数据库 RLS + 服务端 RPC 函数保证，
// 见 supabase/schema.sql。不要把 service_role key 放到前端！
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url || 'http://localhost', anonKey || 'missing')

export const isSupabaseConfigured = Boolean(url && anonKey)
