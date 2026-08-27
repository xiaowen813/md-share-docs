<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import JSZip from 'jszip'
import { supabase } from '../lib/supabase'
import { renderDocument } from '../lib/markdown'
import { renderMermaidElements } from '../lib/mermaid'
import { readMdFile, rememberUpload } from '../lib/uploadSession'
import { useFileDrop } from '../lib/useFileDrop'
import DropOverlay from '../components/DropOverlay.vue'

const route = useRoute()
const router = useRouter()

// 返回上一页（从哪进来回哪去）；没有上一页时才回首页
function goBack() {
  if (window.history.state && window.history.state.back) router.back()
  else router.push('/')
}
const fileInput = ref(null)
const folder = ref(null)

// 拖拽上传：拖入文件 → 跳转到本文件夹内的新建页
const { dragging } = useFileDrop({
  onBeforePush: () =>
    router.push(`/new?folder=${folder.value?.id}&name=${encodeURIComponent(folder.value?.name || '')}`),
})
const docs = ref([])
const loading = ref(true)
const error = ref('')
const downloading = ref('')
const printDocs = ref([])
const printWrapRef = ref(null)

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

async function onPickFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    const { title, content, type } = await readMdFile(file)
    rememberUpload(title, content, type)
    router.push(`/new?folder=${folder.value.id}&name=${encodeURIComponent(folder.value.name)}`)
  } catch (err) {
    error.value = err.message || '上传失败'
  }
}

async function load() {
  loading.value = true
  error.value = ''
  const id = route.params.id
  const [fRes, dRes] = await Promise.all([
    supabase.from('folders').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('documents')
      .select('id, slug, title, updated_at, doc_type')
      .eq('folder_id', id)
      .order('sort_order', { ascending: true })
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
    .select('slug, title, content_md, updated_at, doc_type')
    .eq('folder_id', folder.value.id)
    .order('sort_order', { ascending: true })
  if (err) throw new Error(err.message)
  return data ?? []
}

// ---------- 手动拖拽排序 ----------
const dragIndex = ref(null)

function onDragStart(i) {
  dragIndex.value = i
}

function onDrop(i) {
  if (dragIndex.value === null || dragIndex.value === i) {
    dragIndex.value = null
    return
  }
  const arr = [...docs.value]
  const [moved] = arr.splice(dragIndex.value, 1)
  arr.splice(i, 0, moved)
  docs.value = arr
  dragIndex.value = null
  saveOrder()
}

async function saveOrder() {
  const ids = docs.value.map((d) => d.id)
  const { error: err } = await supabase.rpc('reorder_documents', { p_ids: ids })
  if (err) error.value = '排序保存失败：' + err.message
}

// 文档类型标签
function typeLabel(t) {
  return { md: 'MD', latex: 'TEX', typst: 'TYP' }[t] || 'MD'
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
    const extOf = (t) => ({ md: 'md', latex: 'tex', typst: 'typ' }[t] || 'md')
    for (const doc of list) {
      const file = `${doc.slug || doc.title || 'document'}.${extOf(doc.doc_type)}`
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

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 一键导出全部 PDF：JS 分页 → 封面 + 目录（含页码）+ 正文每页右下角页码
async function downloadAllPdf() {
  downloading.value = 'pdf'
  error.value = ''
  try {
    const list = await fetchAllDocs()
    if (list.length === 0) { alert('这个文件夹里还没有文档'); return }
    printDocs.value = list
    await nextTick()
    await renderMermaidElements(printWrapRef.value)
    await nextTick()
    // 等待字体加载完成，保证测量高度与打印一致
    if (document.fonts && document.fonts.ready) await document.fonts.ready
    paginateAndPrint(printWrapRef.value, folder.value.name, list)
  } catch (e) {
    error.value = e.message || '下载失败'
    printDocs.value = []
  } finally {
    downloading.value = ''
  }
}

// A4 打印可用尺寸（@page: A4 + margin 14mm/16mm/16mm，总内容高约 1010px）
// PAGE_H = 985：底部留 25px 页码区（页码固定显示在此空白区，不与内容重叠）
const PAGE_W = 674
const PAGE_H = 985

// 把打印容器里的内容重排为：封面页 + 目录页 + 按块分页的正文页，并加页码
function paginateAndPrint(wrap, folderName, docs) {
  const articles = Array.from(wrap.querySelectorAll('.print-doc'))
  // 注意：不能提前清空 wrap！分页时通过 appendChild 移动元素，
  // 这样块元素始终在 DOM 中，offsetHeight 才能测量出真实高度

  // 封面
  const cover = document.createElement('div')
  cover.className = 'print-cover'
  cover.innerHTML = `<h1>${escapeHtml(folderName)}</h1><p>共 ${docs.length} 篇文档</p>`

  // 目录（页码稍后回填）
  const toc = document.createElement('div')
  toc.className = 'print-toc'
  toc.innerHTML =
    '<h2>目录</h2><ul>' +
    docs
      .map((d, i) => `<li data-idx="${i}"><span class="toc-title">${escapeHtml(d.title)}</span><span class="toc-page"></span></li>`)
      .join('') +
    '</ul>'

  // 正文块：每篇文档的标题 + 正文子块。
  // 子块移动后仍用 .markdown-body 包裹，保证 .markdown-body pre / .code-line 等后代选择器样式不失效
  const blocks = []
  articles.forEach((article, di) => {
    const titleEl = article.querySelector('.print-doc-title')
    const body = article.querySelector('.markdown-body')
    if (titleEl) blocks.push({ el: titleEl, docIndex: di, wrap: false })
    if (body) Array.from(body.children).forEach((el) => blocks.push({ el, docIndex: di, wrap: true }))
  })

  // 分页器
  let page = null
  let used = 0
  let pageNo = 0 // 正文页码从 1 开始
  const pages = []
  const newPage = () => {
    page = document.createElement('div')
    page.className = 'print-page'
    wrap.appendChild(page)
    pages.push(page)
    used = 0
    return page
  }
  const closePage = () => { page = null }

  const blockHeight = (el) => {
    const cs = getComputedStyle(el)
    const margin = (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0)
    return el.offsetHeight + margin
  }
  const addBlock = (el, isBody) => {
    if (!page) {
      newPage()
      if (isBody) pageNo++
    }
    // 先挂载再测量：未挂载的元素 offsetHeight 为 0，会导致所有内容挤在一页
    page.appendChild(el)
    const h = blockHeight(el)
    if (used + h > PAGE_H && used > 0) {
      // 超页：移到新页（重复 append 会自动从原页移动）
      closePage()
      newPage()
      if (isBody) pageNo++
      page.appendChild(el)
      used = blockHeight(el)
    } else {
      used += h
    }
  }

  // 代码块按行跨页拆分：填满当前页剩余空间，超高自动续页，不整块跳页也不截断
  const SEG_PAD = 30 // 代码段上下 padding(14px×2) + 边框(1px×2)
  const addCodeLines = (pre, isBody) => {
    const lines = Array.from(pre.querySelectorAll('.code-line, .src-line'))
    if (!lines.length) {
      // 无行结构的 pre 按整块处理
      addBlock(pre, isBody)
      return
    }
    const mkSeg = () => {
      if (!page) {
        newPage()
        if (isBody) pageNo++
      }
      const w = document.createElement('div')
      w.className = 'markdown-body'
      const segPre = document.createElement('pre')
      segPre.className = 'code-seg'
      w.appendChild(segPre)
      page.appendChild(w)
      return w
    }
    let segWrap = null
    for (const line of lines) {
      if (!segWrap) {
        segWrap = mkSeg()
        used += SEG_PAD
      }
      // 先挂载再测量：移动前后环境一致，避免测量偏差导致页尾丢行
      segWrap.querySelector('pre').appendChild(line)
      const h = line.offsetHeight || 20
      if (used + h > PAGE_H) {
        // 当前页放不下：移到新页重放（行已在旧页，重复 append 会自动移动）
        closePage()
        segWrap = mkSeg()
        used = SEG_PAD
        segWrap.querySelector('pre').appendChild(line)
        used += line.offsetHeight || 20
      } else {
        used += h
      }
    }
    pre.remove() // 行已全部移走，移除空壳
  }

  // 封面页
  newPage()
  wrap.lastChild.appendChild(cover)
  closePage()
  // 目录页
  newPage()
  wrap.lastChild.appendChild(toc)
  closePage()

  // 正文分页（标题页码在自愈后统一计算）
  for (const b of blocks) {
    const isTitle = b.el.classList.contains('print-doc-title')
    if (b.el.tagName === 'PRE') {
      // 代码块：按行拆分跨页，不整块跳页
      addCodeLines(b.el, true)
    } else {
      let node = b.el
      if (b.wrap) {
        const w = document.createElement('div')
        w.className = 'markdown-body'
        w.appendChild(b.el)
        node = w
      }
      addBlock(node, true)
    }
  }
  closePage()

  // 移除被掏空的 article 空壳
  articles.forEach((a) => a.remove())

  // ---------- 自愈：分页后检查每页实际高度，溢出的块/代码行移到下一页 ----------
  // 无论测量有多少误差，都能保证页尾不丢行、页码不与内容重叠
  const makeSegIn = (p) => {
    const w = document.createElement('div')
    w.className = 'markdown-body'
    const segPre = document.createElement('pre')
    segPre.className = 'code-seg'
    w.appendChild(segPre)
    p.insertBefore(w, p.querySelector('.print-page-num') || null)
    return w
  }
  const healPages = () => {
    // 多轮处理：单轮中前一页会把块推给下一页导致链式污染，
    // 循环到没有溢出为止（最多 15 轮）
    let rounds = 0
    let anyMoved = true
    while (anyMoved && rounds++ < 15) {
      anyMoved = false
      for (let i = 0; i < pages.length - 1; i++) {
        const p = pages[i]
        let guard = 0
        while (p.scrollHeight > PAGE_H + 1 && guard++ < 200) {
        const next = pages[i + 1]
        const blocks = [...p.children].filter((c) => !c.classList.contains('print-page-num'))
        let movedAny = false
        for (let j = blocks.length - 1; j >= 0; j--) {
          const b = blocks[j]
          if (b.offsetTop + b.offsetHeight <= PAGE_H) continue
          const pre = b.querySelector('pre.code-seg')
          if (pre) {
            // 代码段：把超出页底的那行及之后的行移到下一页新段
            const lines = [...pre.querySelectorAll('.code-line, .src-line')]
            let movedLine = false
            for (let k = 0; k < lines.length; k++) {
              if (lines[k].offsetTop + lines[k].offsetHeight > PAGE_H) {
                const nextSeg = makeSegIn(next)
                for (let m = k; m < lines.length; m++) nextSeg.querySelector('pre').appendChild(lines[m])
                if (pre.querySelectorAll('.code-line, .src-line').length === 0) b.remove()
                movedLine = true
                break
              }
            }
            if (movedLine) { movedAny = true; break }
          } else {
            // 普通块整体移到下一页顶部
            next.insertBefore(b, next.querySelector('.print-page-num') || null)
            movedAny = true
            break
          }
        }
        if (!movedAny) {
          // 兜底：检测不到具体溢出块（如最后一块的底部 margin 计入 scrollHeight）时，
          // 强制把最后一个内容块移到下一页
          const last = blocks[blocks.length - 1]
          if (last) {
            next.insertBefore(last, next.querySelector('.print-page-num') || null)
            movedAny = true
          }
        }
          if (!movedAny) break
          anyMoved = true
        }
      }
    }
  }
  healPages()

  // 正文页右下角加页码（封面/目录页不加）
  pages.forEach((p, i) => {
    if (i < 2) return
    const num = document.createElement('div')
    num.className = 'print-page-num'
    num.textContent = String(i - 1)
    p.appendChild(num)
  })

  // 自愈后重新计算每篇文档标题所在页
  const docStartPage = new Map()
  wrap.querySelectorAll('.print-doc-title').forEach((h, di) => {
    const pgEl = h.closest('.print-page')
    const idx = pages.indexOf(pgEl)
    if (idx >= 2) docStartPage.set(di, idx - 1)
  })

  // 回填目录页码
  toc.querySelectorAll('li[data-idx]').forEach((li) => {
    const idx = Number(li.dataset.idx)
    const pg = docStartPage.get(idx)
    if (pg) li.querySelector('.toc-page').textContent = '第 ' + pg + ' 页'
  })

  setTimeout(() => window.print(), 150)
}
</script>

<template>
  <section>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else-if="folder">
      <div class="toolbar no-print">
        <button class="btn btn-ghost" @click="goBack">← 返回</button>
        <h1 class="doc-title">📁 {{ folder.name }}</h1>
        <span class="muted">{{ docs.length }} 篇文档</span>
        <div class="spacer"></div>
        <button class="btn" :disabled="downloading !== ''" @click="downloadAllMd">
          {{ downloading === 'md' ? '打包中…' : '下载全部源文件' }}
        </button>
        <button class="btn" :disabled="downloading !== ''" @click="downloadAllPdf">
          {{ downloading === 'pdf' ? '准备中…' : '下载全部 PDF' }}
        </button>
        <button class="btn" @click="fileInput?.click()">⬆ 上传文件</button>
        <input ref="fileInput" type="file" accept=".md,.markdown,.txt,.tex,.typ" class="hidden-file" @change="onPickFile" />
        <router-link :to="`/new?folder=${folder.id}&name=${encodeURIComponent(folder.name)}`" class="btn btn-primary">
          ＋ 新建文档
        </router-link>
      </div>
      <p v-if="error" class="error no-print">{{ error }}</p>

      <!-- 文件夹内文档（按住卡片拖动可手动排序） -->
      <p class="muted no-print" style="margin:0 0 10px;font-size:13px">↕ 按住卡片拖动可调整顺序，打印/PDF 按此顺序输出</p>
      <p class="muted no-print" style="margin:0 0 10px;font-size:13px;color:#b45309">🖨 导出 PDF 时请在打印对话框选择：纸张 A4 · 缩放 100% · 边距默认</p>
      <ul v-if="docs.length" class="doc-list no-print">
        <li
          v-for="(doc, i) in docs"
          :key="doc.id"
          class="doc-card draggable"
          draggable="true"
          @dragstart="onDragStart(i)"
          @dragover.prevent
          @drop="onDrop(i)"
        >
          <div>
            <h3>{{ doc.title }}</h3>
            <div class="doc-meta">
              <span class="tag type-tag" :class="'type-' + doc.doc_type">{{ typeLabel(doc.doc_type) }}</span>
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

      <p class="muted no-print" style="margin-top:14px;font-size:13px">💡 提示：拖拽 .md/.tex/.typ 文件到页面任意位置即可上传到本文件夹。</p>

      <!-- 拖拽上传遮罩 -->
      <DropOverlay :show="dragging" />

      <!-- 打印容器：仅打印时显示，输出合并 PDF -->
      <div v-if="printDocs.length" ref="printWrapRef" class="print-only">
        <article
          v-for="doc in printDocs"
          :key="doc.id"
          class="print-doc"
        >
          <h1 class="print-doc-title">{{ doc.title }}</h1>
          <div class="markdown-body" v-html="renderDocument(doc.content_md, doc.doc_type)"></div>
        </article>
      </div>
    </template>
  </section>
</template>
