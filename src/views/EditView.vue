<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { renderDocument } from '../lib/markdown'
import { renderMermaidElements } from '../lib/mermaid'
import { canWrite } from '../lib/session'
import HistoryModal from '../components/HistoryModal.vue'
import DocSidebar from '../components/DocSidebar.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const doc = ref(null)
const loading = ref(true)
const denied = ref(false)
const error = ref('')
const message = ref('')

const title = ref('')
const content = ref('')
let savedContent = ''
const saving = ref(false)
const dirty = computed(() => content.value !== savedContent)

const previewHtml = computed(() => renderDocument(content.value, doc.value?.doc_type || 'md'))

watch(previewHtml, () => {
  nextTick(() => renderMermaidElements(splitRef.value))
})

const showHistory = ref(false)

const splitRef = ref(null)
const taRef = ref(null)
let dragging = false

async function loadDoc() {
  if (!canWrite()) { loading.value = false; denied.value = true; return }
  const { data, error: err } = await supabase
    .from('documents')
    .select('*')
    .eq('id', props.id)
    .maybeSingle()
  loading.value = false
  if (err) { error.value = err.message; return }
  if (!data) { error.value = '文档不存在'; return }
  doc.value = data
  title.value = data.title
  content.value = data.content_md
  savedContent = data.content_md
}

async function save() {
  saving.value = true
  error.value = ''
  message.value = '保存中…'
  const { data, error: err } = await supabase.rpc('update_document', {
    p_id: props.id,
    p_content_md: content.value,
    p_title: title.value.trim() || null,
  })
  saving.value = false
  if (err) { error.value = err.message; message.value = ''; return }
  savedContent = data.content_md
  message.value = `已保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`
}

function onRestored(docData) {
  content.value = docData.content_md
  title.value = docData.title
  savedContent = docData.content_md
  showHistory.value = false
  message.value = '已恢复历史版本'
}

async function removeDoc() {
  if (!confirm('确定删除这篇文档吗？删除后无法恢复。')) return
  const { error: err } = await supabase.rpc('delete_document', { p_id: props.id })
  if (err) { error.value = err.message; return }
  router.push('/')
}

function fmt(before, after) {
  const ta = taRef.value
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = content.value.slice(start, end)
  const insert = before + selected + after
  content.value = content.value.slice(0, start) + insert + content.value.slice(end)
  requestAnimationFrame(() => {
    ta.focus()
    ta.setSelectionRange(start + before.length, start + before.length + selected.length)
  })
}

function fmtCode() {
  fmt('```\n', '\n```')
}

const TAB = '    ' // 4 空格，与 VSCode 默认 tabSize 一致

function getSelectionBlock() {
  const ta = taRef.value
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const lineStart = content.value.lastIndexOf('\n', start - 1) + 1
  const nlIdx = content.value.indexOf('\n', end)
  const lineEnd = nlIdx === -1 ? content.value.length : nlIdx
  return { start, end, lineStart, lineEnd }
}

function indentSelection() {
  const ta = taRef.value
  const { start, end, lineStart, lineEnd } = getSelectionBlock()
  const block = content.value.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  const indented = lines.map((l) => TAB + l).join('\n')
  content.value = content.value.slice(0, lineStart) + indented + content.value.slice(lineEnd)
  const linesBefore = content.value.slice(lineStart, end).split('\n').length
  const newStart = start + TAB.length
  const newEnd = end + linesBefore * TAB.length
  requestAnimationFrame(() => {
    ta.focus()
    ta.setSelectionRange(newStart, newEnd)
  })
}

function outdentSelection() {
  const ta = taRef.value
  const { start, end, lineStart, lineEnd } = getSelectionBlock()
  const block = content.value.slice(lineStart, lineEnd)
  let removed = 0
  const outdented = block
    .split('\n')
    .map((l) => {
      if (l.startsWith(TAB)) { removed += TAB.length; return l.slice(TAB.length) }
      const m = l.match(/^(\s+)/)
      if (m) { removed += m[1].length; return l.slice(m[1].length) }
      return l
    })
    .join('\n')
  content.value = content.value.slice(0, lineStart) + outdented + content.value.slice(lineEnd)
  const newStart = Math.max(lineStart, start - removed)
  const newEnd = Math.max(newStart, end - removed)
  requestAnimationFrame(() => {
    ta.focus()
    ta.setSelectionRange(newStart, newEnd)
  })
}

function onEditorKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    if (e.shiftKey) outdentSelection()
    else indentSelection()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    save()
    return
  }
}

function onSplitterDown(e) {
  dragging = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

function onMouseMove(e) {
  if (!dragging || !splitRef.value) return
  const rect = splitRef.value.getBoundingClientRect()
  if (rect.width === 0) return
  const pct = ((e.clientX - rect.left) / rect.width) * 100
  const clamped = Math.min(75, Math.max(25, pct))
  splitRef.value.style.setProperty('--split', clamped + '%')
}

function onMouseUp() {
  dragging = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && document.activeElement !== taRef.value) {
    e.preventDefault()
    save()
  }
}

onMounted(() => {
  loadDoc()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})
// 侧边栏切换文档时重新加载
watch(() => props.id, () => {
  doc.value = null
  loading.value = true
  denied.value = false
  error.value = ''
  message.value = ''
  savedContent = ''
  content.value = ''
  title.value = ''
  loadDoc()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <section class="edit-page">
    <div class="page-with-sidebar">
      <DocSidebar :current-id="id" mode="edit" />
      <div class="sidebar-content">
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="denied" class="muted" style="padding:40px;text-align:center">
      🔒 你没有编辑权限，请联系管理员授权后登录。
    </p>
    <p v-else-if="error && !doc" class="error">{{ error }}</p>

    <template v-else-if="doc">
      <div class="editor-toolbar no-print">
        <router-link :to="`/doc/${id}`" class="btn btn-ghost">← 阅读</router-link>
        <input v-model="title" class="title-input" placeholder="文档标题" />
        <span v-if="dirty" class="dirty-dot">● 未保存</span>
        <span v-if="message" class="message">{{ message }}</span>
        <span v-if="error" class="error">{{ error }}</span>
        <div class="spacer"></div>
        <button class="btn btn-ghost" @click="showHistory = true">🕘 历史版本</button>
        <button class="btn btn-danger" @click="removeDoc">删除</button>
        <button class="btn btn-primary" :disabled="saving || !dirty" @click="save">
          {{ saving ? '保存中…' : '保存 (Ctrl+S)' }}
        </button>
      </div>

      <div class="format-bar no-print">
        <button class="fmt-btn" title="加粗" @click="fmt('**', '**')"><strong>B</strong></button>
        <button class="fmt-btn" title="斜体" @click="fmt('*', '*')"><em>I</em></button>
        <button class="fmt-btn" title="标题" @click="fmt('## ', '')">H2</button>
        <span class="fmt-sep"></span>
        <button class="fmt-btn" title="行内代码" @click="fmt('`', '`')">&lt;/&gt;</button>
        <button class="fmt-btn" title="代码块" @click="fmtCode()">代码块</button>
        <button class="fmt-btn" title="链接" @click="fmt('[', '](https://)')">链接</button>
        <button class="fmt-btn" title="引用" @click="fmt('> ', '')">引用</button>
        <span class="fmt-sep"></span>
        <button class="fmt-btn" title="无序列表" @click="fmt('- ', '')">• 列表</button>
        <button class="fmt-btn" title="有序列表" @click="fmt('1. ', '')">1. 列表</button>
        <div class="spacer"></div>
        <span class="fmt-hint">Ctrl+S 保存</span>
      </div>

      <div class="editor-split no-print" ref="splitRef">
        <div class="pane">
          <div class="pane-label"><span class="dot"></span> Edit · Markdown</div>
          <textarea ref="taRef" v-model="content" spellcheck="false" @keydown="onEditorKeydown"></textarea>
        </div>
        <div class="splitter" title="拖动调整分栏" @mousedown="onSplitterDown"></div>
        <div class="pane">
          <div class="pane-label"><span class="dot"></span> Preview</div>
          <div class="preview markdown-body" v-html="previewHtml"></div>
        </div>
      </div>
    </template>

    <HistoryModal
      v-if="showHistory"
      :doc-id="id"
      @restored="onRestored"
      @close="showHistory = false"
    />
      </div>
    </div>
  </section>
</template>
