<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { renderDocument } from '../lib/markdown'
import { renderMermaidElements } from '../lib/mermaid'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

// 返回上一页（从哪进来回哪去）；没有上一页时才回首页
function goBack() {
  if (window.history.state && window.history.state.back) router.back()
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

function downloadMd() {
  if (!doc.value) return
  const blob = new Blob([doc.value.content_md], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${doc.value.slug || 'document'}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

// 纯前端方案：调用浏览器打印对话框，选择“另存为 PDF”即可导出排版良好的 PDF
function downloadPdf() {
  window.print()
}
</script>

<template>
  <section>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else-if="doc">
      <div class="toolbar no-print">
        <button class="btn" @click="goBack">← 返回</button>
        <h1 class="doc-title">{{ doc.title }}</h1>
        <div class="spacer"></div>
        <button class="btn" @click="downloadMd">下载 .md</button>
        <button class="btn" @click="downloadPdf">下载 PDF</button>
        <router-link :to="`/doc/${doc.id}/edit`" class="btn btn-primary">编辑</router-link>
      </div>

      <article ref="contentEl" class="markdown-body" v-html="html"></article>
      <p class="muted no-print" style="text-align:center;margin-top:12px">
        💡 下载 PDF 时，在浏览器打印对话框里选择“另存为 PDF”即可
      </p>
    </template>
  </section>
</template>
