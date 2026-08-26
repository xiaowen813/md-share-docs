<script setup>
import { onMounted, ref } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const docs = ref([])
const loading = ref(true)
const error = ref('')

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

async function load() {
  if (!isSupabaseConfigured) { loading.value = false; return }
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase
    .from('documents')
    .select('id, slug, title, updated_at')
    .order('updated_at', { ascending: false })
  if (err) error.value = err.message
  else docs.value = data ?? []
  loading.value = false
}

onMounted(load)
</script>

<template>
  <section>
    <div class="home-head">
      <h1>文档列表</h1>
      <router-link to="/new" class="btn btn-primary">＋ 新建文档</router-link>
    </div>

    <p v-if="!isSupabaseConfigured" class="muted">
      尚未配置 Supabase，请按 README 完成配置后刷新页面。
    </p>
    <p v-else-if="loading" class="muted">加载中…</p>
    <p v-else-if="error" class="error">加载失败：{{ error }}</p>
    <div v-else-if="docs.length === 0" class="empty-state">
      <div class="big">📄</div>
      还没有文档，点击右上角「＋ 新建文档」创建第一篇。
    </div>

    <ul v-else class="doc-list">
      <li v-for="doc in docs" :key="doc.id" class="doc-card">
        <div>
          <h3>{{ doc.title }}</h3>
          <div class="doc-meta">
            <span class="tag">{{ doc.slug }}</span>
            <span>更新于 {{ fmtDate(doc.updated_at) }}</span>
          </div>
        </div>
        <div class="doc-actions">
          <router-link :to="`/doc/${doc.id}`" class="btn">阅读</router-link>
          <router-link :to="`/doc/${doc.id}/edit`" class="btn">编辑</router-link>
        </div>
      </li>
    </ul>
  </section>
</template>
