<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { renderDocument } from '../lib/markdown'
import { renderMermaidElements } from '../lib/mermaid'
import { convertDoc } from '../lib/convert'
import DocSidebar from '../components/DocSidebar.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

// 返回文档所在目录：在文件夹内 → 文件夹页；根目录 → 首页。
// 避免在编辑/阅读之间用浏览器历史来回跳
function goBack() {
  if (doc.value && doc.value.folder_id) router.push(`/folder/${doc.value.folder_id}`)
  else router.push('/')
}

const doc = ref(null)
const loading = ref(true)
const error = ref('')
const contentEl = ref(null)

const html = computed(() => (doc.value ? renderDocument(doc.value.content_md, doc.value.doc_type) : ''))

async function load() {
  const { data, error: err } = await supabase
    .from('documents')
    .select('*')
    .eq('id', props.id)
    .maybeSingle()
  if (err) error.value = err.message
  else if (!data) error.value = '文档不存在'
  else doc.value = data
  loading.value = false
  await nextTick()
  renderMermaidElements(contentEl.value)
}
onMounted(load)
// 侧边栏切换文档时重新加载
watch(() => props.id, () => {
  doc.value = null
  loading.value = true
  error.value = ''
  load()
})

// 按文档类型下载源文件：md → .md，latex → .tex，typst → .typ
function downloadMd() {
  if (!doc.value) return
  const type = doc.value.doc_type || 'md'
  const ext = { md: 'md', latex: 'tex', typst: 'typ' }[type] || 'md'
  const mime = { md: 'text/markdown', latex: 'text/x-tex', typst: 'text/plain' }[type] || 'text/plain'
  const blob = new Blob([doc.value.content_md], { type: mime + ';charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${doc.value.slug || 'document'}.${ext}`
  a.click()
  URL.revokeObjectURL(a.href)
}

// 纯前端方案：调用浏览器打印对话框，选择“另存为 PDF”即可导出排版良好的 PDF
function downloadPdf() {
  window.print()
}

// 导出为指定格式：md/latex/typst 转换后下载，pdf 走打印
const showExport = ref(false)
function exportAs(fmt) {
  showExport.value = false
  if (fmt === 'pdf') { downloadPdf(); return }
  const out = convertDoc(doc.value.content_md, doc.value.doc_type, fmt)
  const ext = { md: 'md', latex: 'tex', typst: 'typ' }[fmt] || 'md'
  const mime = { md: 'text/markdown', latex: 'text/x-tex', typst: 'text/plain' }[fmt] || 'text/plain'
  const blob = new Blob([out], { type: mime + ';charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${doc.value.slug || 'document'}.${ext}`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <section>
    <div class="page-with-sidebar">
      <DocSidebar :current-id="id" mode="read" />
      <div class="sidebar-content">
        <p v-if="loading" class="muted">加载中…</p>
        <p v-else-if="error" class="error">{{ error }}</p>

        <template v-else-if="doc">
      <div class="toolbar no-print">
        <button class="btn" @click="goBack">← 返回</button>
        <h1 class="doc-title">{{ doc.title }}</h1>
        <div class="spacer"></div>
        <div class="dropdown no-print">
          <button class="btn" @click="showExport = !showExport">⬇ 导出 ▾</button>
          <div v-if="showExport" class="dropdown-menu">
            <button class="dropdown-item" @click="exportAs('md')">Markdown (.md)</button>
            <button class="dropdown-item" @click="exportAs('pdf')">PDF（打印导出）</button>
            <button class="dropdown-item" @click="exportAs('latex')">LaTeX (.tex)</button>
            <button class="dropdown-item" @click="exportAs('typst')">Typst (.typ)</button>
          </div>
          <div v-if="showExport" class="dropdown-backdrop" @click="showExport = false"></div>
        </div>
        <router-link :to="`/doc/${doc.id}/edit`" class="btn btn-primary">编辑</router-link>
      </div>

        <article ref="contentEl" class="markdown-body" v-html="html"></article>
        <p class="muted no-print" style="text-align:center;margin-top:12px">
          💡 下载 PDF 时，在浏览器打印对话框里选择“另存为 PDF”即可
        </p>
        </template>
      </div>
    </div>
  </section>
</template>
