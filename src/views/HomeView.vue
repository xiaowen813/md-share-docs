<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { readMdFile, rememberUpload } from '../lib/uploadSession'
import { useFileDrop } from '../lib/useFileDrop'
import { canWrite } from '../lib/session'
import DropOverlay from '../components/DropOverlay.vue'

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

// 拖拽上传（拖入文件 → 跳转新建页预填）
const { dragging } = useFileDrop({ onBeforePush: () => router.push('/new') })

// 拖拽移动：把文档拖到文件夹卡片上
const dragDocId = ref(null)
const dragOverFolder = ref(null)
function onDocDragStart(doc) {
  dragDocId.value = doc.id
}
function goDoc(id) {
  router.push(`/doc/${id}`)
}

async function onFolderDrop(folderId) {
  const id = dragDocId.value
  dragDocId.value = null
  dragOverFolder.value = null
  if (!id) return
  const { error: err } = await supabase.rpc('move_document', {
    p_doc_id: id,
    p_folder_id: folderId,
  })
  if (err) error.value = '移动失败：' + err.message
  else await load()
}

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

// ---------- 文件夹改名 / 删除 ----------
const showRenameFolder = ref(false)
const renameTarget = ref(null)
const renameName = ref('')
const renameError = ref('')

function openRenameFolder(f) {
  renameTarget.value = f
  renameName.value = f.name
  renameError.value = ''
  showRenameFolder.value = true
}

async function renameFolder() {
  const name = renameName.value.trim()
  if (!name) { renameError.value = '请输入文件夹名称'; return }
  renameError.value = ''
  const { error: err } = await supabase.rpc('rename_folder', {
    p_folder_id: renameTarget.value.id,
    p_new_name: name,
  })
  if (err) { renameError.value = err.message; return }
  showRenameFolder.value = false
  window.dispatchEvent(new Event('mdshare-docs-changed'))
  await load()
}

async function deleteFolder(f) {
  if (!confirm(`确定删除文件夹「${f.name}」吗？
文件夹内的文档会自动移回根目录，不会删除文档。`)) return
  const { error: err } = await supabase.rpc('delete_folder', { p_folder_id: f.id })
  if (err) { error.value = err.message; return }
  window.dispatchEvent(new Event('mdshare-docs-changed'))
  await load()
}

onMounted(load)
</script>

<template>
  <section>
    <div class="home-head">
      <h1>文档列表</h1>
      <div class="head-actions">
        <template v-if="canWrite()">
          <button class="btn" @click="showNewFolder = true">＋ 新建文件夹</button>
          <button class="btn" @click="fileInput?.click()">⬆ 上传文件</button>
          <router-link to="/new" class="btn btn-primary">＋ 新建文档</router-link>
          <input ref="fileInput" type="file" accept=".md,.markdown,.txt,.tex,.typ" class="hidden-file" @change="onPickFile" />
        </template>
      </div>
    </div>

    <p v-if="!isSupabaseConfigured" class="muted">
      尚未配置 Supabase，请按 README 完成配置后刷新页面。
    </p>
    <p v-else-if="loading" class="muted">加载中…</p>
    <p v-else-if="error" class="error">加载失败：{{ error }}</p>

    <template v-else>
      <!-- 文件夹区（文档拖到文件夹卡片上可移动） -->
      <h2 class="section-title">📁 文件夹</h2>
      <div v-if="folders.length" class="folder-grid">
        <router-link
          v-for="f in folders"
          :key="f.id"
          :to="`/folder/${f.id}`"
          class="folder-card"
          :class="{ 'drop-target': dragOverFolder === f.id }"
          @dragover.prevent="dragOverFolder = f.id"
          @dragleave="dragOverFolder = null"
          @drop.prevent="onFolderDrop(f.id)"
        >
          <div class="folder-icon">📁</div>
          <div class="folder-info">
            <h3>{{ f.name }}</h3>
            <p class="muted">创建于 {{ fmtDate(f.created_at) }}</p>
          </div>
          <div v-if="canWrite()" class="folder-card-ops" @click.stop>
            <button class="btn btn-icon" title="改名" @click="openRenameFolder(f)">✏️</button>
            <button class="btn btn-icon" title="删除" @click="deleteFolder(f)">🗑</button>
          </div>
        </router-link>
      </div>
      <p v-else class="muted section-gap">还没有文件夹，点「＋ 新建文件夹」创建一个。</p>

      <!-- 根目录文档区 -->
      <h2 class="section-title">📄 文档</h2>
      <div v-if="docs.length" class="empty-gap"></div>
      <ul v-if="docs.length" class="doc-list">
        <li
          v-for="doc in docs"
          :key="doc.id"
          class="doc-card draggable"
          :draggable="canWrite()"
          @dragstart="onDocDragStart(doc)"
          @click="goDoc(doc.id)"
        >
          <router-link
            v-if="canWrite()"
            :to="`/doc/${doc.id}/edit`"
            class="edit-gear"
            title="编辑"
            @click.stop
          >⚙️</router-link>
          <div class="doc-card-main">
            <h3>{{ doc.title }}</h3>
            <div class="doc-meta">
              <span class="tag">{{ doc.slug }}</span>
              <span>更新于 {{ fmtDate(doc.updated_at) }}</span>
            </div>
          </div>
        </li>
      </ul>
      <div v-else-if="folders.length === 0" class="empty-state">
        <div class="big">📄</div>
        还没有内容，先新建文件夹或文档吧。
      </div>
      <p v-else class="muted">根目录还没有文档，点「＋ 新建文档」创建一篇。</p>
      <p class="muted no-print" style="margin-top:16px;font-size:13px">💡 提示：拖拽 .md/.tex/.typ 文件到页面任意位置即可上传；把文档卡片拖到文件夹卡片上可移动文件。</p>
    </template>

    <!-- 拖拽上传遮罩 -->
    <DropOverlay :show="dragging" />

    <!-- 文件夹改名弹窗 -->
    <div v-if="showRenameFolder" class="modal-overlay" @click.self="showRenameFolder = false">
      <div class="modal">
        <div class="modal-head">
          <h3>✏️ 文件夹改名</h3>
          <button class="btn btn-icon" @click="showRenameFolder = false">✕</button>
        </div>
        <div class="field">
          <label for="renameFolderHome">文件夹名称</label>
          <input id="renameFolderHome" v-model="renameName" @keyup.enter="renameFolder" />
        </div>
        <p v-if="renameError" class="error">{{ renameError }}</p>
        <div class="row">
          <button class="btn" @click="showRenameFolder = false">取消</button>
          <button class="btn btn-primary" @click="renameFolder">保存</button>
        </div>
      </div>
    </div>

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
