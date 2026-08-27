<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { readMdFile, rememberUpload } from '../lib/uploadSession'

const folders = ref([])
const docs = ref([])
const loading = ref(true)
const error = ref('')

const showNewFolder = ref(false)
const folderName = ref('')
const folderError = ref('')
const creatingFolder = ref(false)

const router = useRouter()
const fileInput = ref(null)

async function onPickFile(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // 允许重复选择同一个文件
  if (!file) return
  try {
    const { title, content, type } = await readMdFile(file)
    rememberUpload(title, content, type)
    router.push('/new')
  } catch (err) {
    error.value = err.message || '上传失败'
  }
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

async function load() {
  if (!isSupabaseConfigured) { loading.value = false; return }
  loading.value = true
  error.value = ''
  const [fRes, dRes] = await Promise.all([
    supabase.from('folders').select('id, name, created_at').order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, slug, title, updated_at')
      .is('folder_id', null)
      .order('updated_at', { ascending: false }),
  ])
  if (fRes.error) error.value = fRes.error.message
  else folders.value = fRes.data ?? []
  if (dRes.error && !error.value) error.value = dRes.error.message
  else docs.value = dRes.data ?? []
  loading.value = false
}

async function createFolder() {
  const name = folderName.value.trim()
  if (!name) { folderError.value = '请输入文件夹名称'; return }
  creatingFolder.value = true
  folderError.value = ''
  const { error: err } = await supabase.rpc('create_folder', { p_name: name })
  creatingFolder.value = false
  if (err) { folderError.value = err.message; return }
  showNewFolder.value = false
  folderName.value = ''
  await load()
}

onMounted(load)
</script>

<template>
  <section>
    <div class="home-head">
      <h1>文档列表</h1>
      <div class="head-actions">
        <button class="btn" @click="showNewFolder = true">＋ 新建文件夹</button>
        <button class="btn" @click="fileInput?.click()">⬆ 上传 .md</button>
        <router-link to="/new" class="btn btn-primary">＋ 新建文档</router-link>
        <input ref="fileInput" type="file" accept=".md,.markdown,.txt,.tex,.typ" class="hidden-file" @change="onPickFile" />
      </div>
    </div>

    <p v-if="!isSupabaseConfigured" class="muted">
      尚未配置 Supabase，请按 README 完成配置后刷新页面。
    </p>
    <p v-else-if="loading" class="muted">加载中…</p>
    <p v-else-if="error" class="error">加载失败：{{ error }}</p>

    <template v-else>
      <!-- 文件夹区 -->
      <h2 class="section-title">📁 文件夹</h2>
      <div v-if="folders.length" class="folder-grid">
        <router-link
          v-for="f in folders"
          :key="f.id"
          :to="`/folder/${f.id}`"
          class="folder-card"
        >
          <div class="folder-icon">📁</div>
          <div class="folder-info">
            <h3>{{ f.name }}</h3>
            <p class="muted">创建于 {{ fmtDate(f.created_at) }}</p>
          </div>
        </router-link>
      </div>
      <p v-else class="muted section-gap">还没有文件夹，点「＋ 新建文件夹」创建一个。</p>

      <!-- 根目录文档区 -->
      <h2 class="section-title">📄 文档</h2>
      <div v-if="docs.length" class="empty-gap"></div>
      <ul v-if="docs.length" class="doc-list">
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
      <div v-else-if="folders.length === 0" class="empty-state">
        <div class="big">📄</div>
        还没有内容，先新建文件夹或文档吧。
      </div>
      <p v-else class="muted">根目录还没有文档，点「＋ 新建文档」创建一篇。</p>
    </template>

    <!-- 新建文件夹弹窗 -->
    <div v-if="showNewFolder" class="modal-overlay" @click.self="showNewFolder = false">
      <div class="modal">
        <div class="modal-head">
          <h3>📁 新建文件夹</h3>
          <button class="btn btn-icon" @click="showNewFolder = false">✕</button>
        </div>
        <div class="field">
          <label for="folderName">文件夹名称</label>
          <input id="folderName" v-model="folderName" placeholder="例如：学习笔记" @keyup.enter="createFolder" />
        </div>
        <p v-if="folderError" class="error">{{ folderError }}</p>
        <div class="row">
          <button class="btn" @click="showNewFolder = false">取消</button>
          <button class="btn btn-primary" :disabled="creatingFolder" @click="createFolder">
            {{ creatingFolder ? '创建中…' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
