<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import JSZip from 'jszip'
import { supabase } from '../lib/supabase'
import { renderMarkdown } from '../lib/markdown'

const route = useRoute()
const folder = ref(null)
const docs = ref([])
const loading = ref(true)
const error = ref('')
const downloading = ref('')
const printDocs = ref([])

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

async function load() {
  loading.value = true
  error.value = ''
  const id = route.params.id
  const [fRes, dRes] = await Promise.all([
    supabase.from('folders').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('documents')
      .select('id, slug, title, updated_at')
      .eq('folder_id', id)
      .order('updated_at', { ascending: false }),
  ])
  if (fRes.error) error.value = fRes.error.message
  else if (!fRes.data) error.value = '文件夹不存在'
  else folder.value = fRes.data
  if (dRes.error && !error.value) error.value = dRes.error.message
  else docs.value = dRes.data ?? []
  loading.value = false
}
onMounted(load)

async function fetchAllDocs() {
  const { data, error: err } = await supabase
    .from('documents')
    .select('slug, title, content_md, updated_at')
    .eq('folder_id', folder.value.id)
  if (err) throw new Error(err.message)
  return data ?? []
}

function safeName(name) {
  return (name || 'folder').replace(/[\\/:*?"<>|]/g, '_')
}

// 一键下载全部 .md（打包成 zip）
async function downloadAllMd() {
  downloading.value = 'md'
  error.value = ''
  try {
    const list = await fetchAllDocs()
    if (list.length === 0) { alert('这个文件夹里还没有文档'); return }
    const zip = new JSZip()
    const dir = safeName(folder.value.name)
    for (const doc of list) {
      const file = `${doc.slug || doc.title || 'document'}.md`
      zip.file(`${dir}/${file}`, doc.content_md || '')
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${dir}.zip`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch (e) {
    error.value = e.message || '下载失败'
  } finally {
    downloading.value = ''
  }
}

// 一键导出全部 PDF：把所有文档渲染进打印容器 → 浏览器打印 → 另存为 PDF（合并成一份）
async function downloadAllPdf() {
  downloading.value = 'pdf'
  error.value = ''
  try {
    const list = await fetchAllDocs()
    if (list.length === 0) { alert('这个文件夹里还没有文档'); return }
    printDocs.value = list
    setTimeout(() => window.print(), 150)
  } catch (e) {
    error.value = e.message || '下载失败'
    printDocs.value = []
  } finally {
    downloading.value = ''
  }
}
</script>

<template>
  <section>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else-if="folder">
      <div class="toolbar no-print">
        <router-link to="/" class="btn btn-ghost">← 返回</router-link>
        <h1 class="doc-title">📁 {{ folder.name }}</h1>
        <span class="muted">{{ docs.length }} 篇文档</span>
        <div class="spacer"></div>
        <button class="btn" :disabled="downloading !== ''" @click="downloadAllMd">
          {{ downloading === 'md' ? '打包中…' : '下载全部 .md' }}
        </button>
        <button class="btn" :disabled="downloading !== ''" @click="downloadAllPdf">
          {{ downloading === 'pdf' ? '准备中…' : '下载全部 PDF' }}
        </button>
        <router-link :to="`/new?folder=${folder.id}&name=${encodeURIComponent(folder.name)}`" class="btn btn-primary">
          ＋ 新建文档
        </router-link>
      </div>
      <p v-if="error" class="error no-print">{{ error }}</p>

      <!-- 文件夹内文档 -->
      <ul v-if="docs.length" class="doc-list no-print">
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
      <div v-else class="empty-state no-print">
        <div class="big">📄</div>
        文件夹还是空的，点「＋ 新建文档」添加第一篇。
      </div>

      <!-- 打印容器：仅打印时显示，输出合并 PDF -->
      <div v-if="printDocs.length" class="print-only">
        <article
          v-for="doc in printDocs"
          :key="doc.id"
          class="print-doc"
        >
          <h1 class="print-doc-title">{{ doc.title }}</h1>
          <div class="markdown-body" v-html="renderMarkdown(doc.content_md)"></div>
        </article>
      </div>
    </template>
  </section>
</template>
