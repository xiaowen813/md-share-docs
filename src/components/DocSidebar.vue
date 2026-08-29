<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { supabase } from '../lib/supabase'

const props = defineProps({
  currentId: { type: String, default: '' },
  mode: { type: String, default: 'read' }, // 'read' | 'edit'
})

const folders = ref([])
const rootDocs = ref([])
const expanded = ref({})
const collapsed = ref(false)

function linkTo(d) {
  return props.mode === 'edit' ? `/doc/${d.id}/edit` : `/doc/${d.id}`
}

function toggle(fid) {
  expanded.value = { ...expanded.value, [fid]: !expanded.value[fid] }
}

async function load() {
  const [fRes, dRes] = await Promise.all([
    supabase.from('folders').select('id, name, created_at').order('created_at', { ascending: true }),
    supabase
      .from('documents')
      .select('id, slug, title, folder_id, doc_type')
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false }),
  ])
  folders.value = fRes.data ?? []
  const docs = dRes.data ?? []
  rootDocs.value = docs.filter((d) => !d.folder_id)
  folders.value.forEach((f) => {
    f.docs = docs.filter((d) => d.folder_id === f.id)
  })
}

onMounted(() => {
  load()
  // 文档/文件夹变更后自动刷新（改名等）
  window.addEventListener('mdshare-docs-changed', load)
})
onBeforeUnmount(() => {
  window.removeEventListener('mdshare-docs-changed', load)
})
watch(() => props.currentId, () => {}, { immediate: true })
</script>

<template>
  <aside class="doc-sidebar" :class="{ collapsed }">
    <div class="sidebar-head no-print">
      <span v-if="!collapsed" class="sidebar-title">📂 文档</span>
      <button
        class="btn-icon sidebar-toggle"
        :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="collapsed = !collapsed"
      >{{ collapsed ? '▸' : '◂' }}</button>
    </div>

    <div v-if="!collapsed" class="sidebar-tree no-print">
      <!-- 根目录 -->
      <div class="tree-group">
        <div class="tree-label">根目录</div>
        <template v-if="rootDocs.length">
          <router-link
            v-for="d in rootDocs"
            :key="d.id"
            :to="linkTo(d)"
            class="tree-item"
            :class="{ active: d.id === props.currentId }"
          >
            <span class="type-dot" :class="'t-' + d.doc_type"></span>
            <span class="tree-title">{{ d.title }}</span>
          </router-link>
        </template>
        <div v-else class="tree-empty">（空）</div>
      </div>

      <!-- 文件夹 -->
      <div v-for="f in folders" :key="f.id" class="tree-group">
        <div class="tree-label tree-folder" @click="toggle(f.id)">
          <span class="folder-arrow" :class="{ open: expanded[f.id] }">▸</span>
          <span class="folder-name">📁 {{ f.name }}</span>
        </div>
        <template v-if="expanded[f.id]">
          <router-link
            v-for="d in f.docs"
            :key="d.id"
            :to="linkTo(d)"
            class="tree-item"
            :class="{ active: d.id === props.currentId }"
          >
            <span class="type-dot" :class="'t-' + d.doc_type"></span>
            <span class="tree-title">{{ d.title }}</span>
          </router-link>
          <div v-if="!f.docs.length" class="tree-empty">（空文件夹）</div>
        </template>
      </div>
    </div>
  </aside>
</template>
