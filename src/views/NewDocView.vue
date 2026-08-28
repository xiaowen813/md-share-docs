<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { canWrite } from '../lib/session'
import { takeUpload } from '../lib/uploadSession'

const router = useRouter()
const route = useRoute()
const folderId = route.query.folder || null
const folderName = route.query.name ? decodeURIComponent(route.query.name) : ''

const title = ref('')
const slug = ref('')
const content = ref('')
const docType = ref('md') // md | latex | typst
const slugTouched = ref(false)
const submitting = ref(false)
const error = ref('')
const denied = ref(false)

function slugify(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// 权限检查 + 上传预填
onMounted(() => {
  if (!canWrite()) { denied.value = true; return }
  const up = takeUpload()
  if (up && up.title) {
    title.value = up.title
    slug.value = slugify(up.title)
    content.value = up.content
    docType.value = up.type || 'md'
  }
})

function onTitleInput() {
  if (!slugTouched.value) slug.value = slugify(title.value)
}

function validate() {
  if (!title.value.trim()) return '请填写标题'
  if (!slug.value.trim()) return '请填写 slug（URL 标识，只能含字母/数字/连字符）'
  if (!/^[a-z0-9\u4e00-\u9fa5]+(-[a-z0-9\u4e00-\u9fa5]+)*$/.test(slug.value)) return 'slug 格式不正确'
  return ''
}

async function submit() {
  const msg = validate()
  if (msg) { error.value = msg; return }
  submitting.value = true
  error.value = ''
  const { data, error: err } = await supabase.rpc('create_document', {
    p_slug: slug.value,
    p_title: title.value.trim(),
    p_content_md: content.value,
    p_folder_id: folderId,
    p_doc_type: docType.value,
  })
  submitting.value = false
  if (err) {
    error.value = /duplicate|unique/i.test(err.message)
      ? '该 slug 已被占用，请换一个'
      : err.message
    return
  }
  router.push(`/doc/${data.id}/edit`)
}
</script>

<template>
  <section>
    <div v-if="denied" class="empty-state">
      <div class="big">🔒</div>
      <p>你没有新建文档的权限，请联系管理员授权后登录。</p>
    </div>

    <template v-else>
      <h1>新建文档</h1>
      <p v-if="folderName" class="muted" style="margin:0 0 14px">📁 将创建在文件夹「{{ folderName }}」中</p>
      <div class="form-card">
        <div class="field">
          <label for="title">标题</label>
          <input id="title" v-model="title" placeholder="文档标题" @input="onTitleInput" />
        </div>
        <div class="field">
          <label>文件类型</label>
          <div class="type-select">
            <label class="type-option">
              <input type="radio" value="md" v-model="docType" /> Markdown
            </label>
            <label class="type-option">
              <input type="radio" value="latex" v-model="docType" /> LaTeX (.tex)
            </label>
            <label class="type-option">
              <input type="radio" value="typst" v-model="docType" /> Typst (.typ)
            </label>
          </div>
          <p class="hint">Markdown 完整渲染；LaTeX / Typst 以源码视图展示，其中 $...$ 公式会用 KaTeX 渲染。</p>
        </div>
        <div class="field">
          <label for="slug">Slug（URL 标识）</label>
          <input id="slug" v-model="slug" placeholder="my-first-doc" @input="slugTouched = true" />
          <p class="hint">自动根据标题生成，也可手动修改；创建后不可更改。</p>
        </div>
        <div class="field">
          <label for="content">初始内容（可选）</label>
          <textarea id="content" v-model="content" rows="10" placeholder="# 我的第一篇文档&#10;&#10;支持 **Markdown** 语法…"></textarea>
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <div class="row">
          <router-link to="/" class="btn">取消</router-link>
          <button class="btn btn-primary" :disabled="submitting" @click="submit">
            {{ submitting ? '创建中…' : '创建并进入编辑' }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>
