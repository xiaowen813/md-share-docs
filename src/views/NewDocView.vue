<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { rememberPassword } from '../lib/editorSession'
import { takeUpload } from '../lib/uploadSession'

const router = useRouter()
const route = useRoute()
const folderId = route.query.folder || null
const folderName = route.query.name ? decodeURIComponent(route.query.name) : ''

const title = ref('')
const slug = ref('')
const password = ref('')
const confirm = ref('')
const content = ref('')
const slugTouched = ref(false)
const submitting = ref(false)
const error = ref('')

function slugify(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// 从首页/文件夹页上传 .md 后自动预填标题和内容
onMounted(() => {
  const up = takeUpload()
  if (up && up.title) {
    title.value = up.title
    slug.value = slugify(up.title)
    content.value = up.content
  }
})

function onTitleInput() {
  if (!slugTouched.value) slug.value = slugify(title.value)
}

function validate() {
  if (!title.value.trim()) return '请填写标题'
  if (!slug.value.trim()) return '请填写 slug（URL 标识，只能含字母/数字/连字符）'
  if (!/^[a-z0-9\u4e00-\u9fa5]+(-[a-z0-9\u4e00-\u9fa5]+)*$/.test(slug.value)) return 'slug 格式不正确'
  if (password.value.length < 4) return '编辑密码至少 4 位'
  if (password.value !== confirm.value) return '两次输入的密码不一致'
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
    p_password: password.value,
    p_content_md: content.value,
    p_folder_id: folderId,
  })
  submitting.value = false
  if (err) {
    error.value = /duplicate|unique/i.test(err.message)
      ? '该 slug 已被占用，请换一个'
      : err.message
    return
  }
  // 创建成功后把密码暂存内存（不落任何持久存储），跳转编辑页免二次输入；
  // 刷新页面后失效，需要重新输入密码
  rememberPassword(data.id, password.value)
  router.push(`/doc/${data.id}/edit`)
}
</script>

<template>
  <section>
    <h1>新建文档</h1>
    <p v-if="folderName" class="muted" style="margin:0 0 14px">📁 将创建在文件夹「{{ folderName }}」中</p>
    <div class="form-card">
      <div class="field">
        <label for="title">标题</label>
        <input id="title" v-model="title" placeholder="文档标题" @input="onTitleInput" />
      </div>
      <div class="field">
        <label for="slug">Slug（URL 标识）</label>
        <input id="slug" v-model="slug" placeholder="my-first-doc" @input="slugTouched = true" />
        <p class="hint">自动根据标题生成，也可手动修改；创建后不可更改。</p>
      </div>
      <div class="field">
        <label for="password">编辑密码</label>
        <input id="password" v-model="password" type="password" placeholder="至少 4 位" />
        <p class="hint">密码以 bcrypt 加密存储在后端数据库，任何访问者都无法看到明文。</p>
      </div>
      <div class="field">
        <label for="confirm">确认密码</label>
        <input id="confirm" v-model="confirm" type="password" placeholder="再输入一次" />
      </div>
      <div class="field">
        <label for="content">初始内容（可选）</label>
        <textarea id="content" v-model="content" rows="8" placeholder="# 我的第一篇文档&#10;&#10;支持 **Markdown** 语法…"></textarea>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="row">
        <router-link to="/" class="btn">取消</router-link>
        <button class="btn btn-primary" :disabled="submitting" @click="submit">
          {{ submitting ? '创建中…' : '创建并进入编辑' }}
        </button>
      </div>
    </div>
  </section>
</template>
