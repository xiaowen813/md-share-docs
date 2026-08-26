<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { renderMarkdown } from '../lib/markdown'
import { renderMermaidElements } from '../lib/mermaid'

const props = defineProps({
  docId: { type: String, required: true },
  password: { type: String, required: true }, // 当前会话密码，恢复时服务端再次校验
})
const emit = defineEmits(['restored', 'close'])

const versions = ref([])
const loading = ref(true)
const error = ref('')
const viewing = ref(null) // 正在查看的版本
const restoring = ref(false)
const previewRef = ref(null)

const viewingHtml = computed(() => (viewing.value ? renderMarkdown(viewing.value.content_md) : ''))

function fmtDate(iso) {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

async function load() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase
    .from('document_versions')
    .select('id, title, content_md, created_at')
    .eq('document_id', props.docId)
    .order('created_at', { ascending: false })
  if (err) error.value = err.message
  else versions.value = data ?? []
  loading.value = false
}
onMounted(load)

function viewVersion(v) {
  viewing.value = v
}

// 查看版本时渲染 Mermaid 图
watch(viewing, () => {
  nextTick(() => renderMermaidElements(previewRef.value))
})

async function restore(v) {
  if (!confirm(`确定恢复到 ${fmtDate(v.created_at)} 的版本吗？
恢复前会先把当前内容存为历史。`)) return
  restoring.value = true
  error.value = ''
  const { data, error: err } = await supabase.rpc('restore_document_version', {
    p_id: props.docId,
    p_version_id: v.id,
    p_password: props.password,
  })
  restoring.value = false
  if (err) { error.value = err.message; return }
  emit('restored', data)
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal modal-wide">
      <div class="modal-head">
        <h3>🕘 历史版本</h3>
        <button class="btn btn-icon" @click="emit('close')">✕</button>
      </div>

      <!-- 版本预览视图 -->
      <template v-if="viewing">
        <div class="history-preview-head">
          <button class="btn" @click="viewing = null">← 返回列表</button>
          <strong>{{ viewing.title }}</strong>
          <span class="muted">{{ fmtDate(viewing.created_at) }}</span>
          <div class="spacer"></div>
          <button class="btn btn-primary" :disabled="restoring" @click="restore(viewing)">
            {{ restoring ? '恢复中…' : '恢复此版本' }}
          </button>
        </div>
        <div ref="previewRef" class="preview markdown-body" v-html="viewingHtml"></div>
      </template>

      <!-- 版本列表视图 -->
      <template v-else>
        <p v-if="loading" class="muted">加载中…</p>
        <p v-else-if="error" class="error">{{ error }}</p>
        <p v-else-if="versions.length === 0" class="muted">暂无历史版本（每次保存都会自动生成一条）。</p>
        <ul v-else class="version-list">
          <li v-for="(v, i) in versions" :key="v.id" class="version-item">
            <div class="version-info">
              <strong>#{{ versions.length - i }}</strong>
              <span>{{ v.title }}</span>
              <span class="muted">{{ fmtDate(v.created_at) }}</span>
            </div>
            <div class="version-actions">
              <button class="btn" @click="viewVersion(v)">查看</button>
              <button class="btn" @click="restore(v)">恢复</button>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
