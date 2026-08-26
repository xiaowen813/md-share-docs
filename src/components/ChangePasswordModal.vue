<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const props = defineProps({ docId: { type: String, required: true } })
const emit = defineEmits(['changed', 'close'])

const oldPw = ref('')
const newPw = ref('')
const confirmPw = ref('')
const submitting = ref(false)
const error = ref('')

async function submit() {
  if (newPw.value.length < 4) { error.value = '新密码至少 4 位'; return }
  if (newPw.value !== confirmPw.value) { error.value = '两次输入的新密码不一致'; return }
  submitting.value = true
  error.value = ''
  const { data, error: err } = await supabase.rpc('change_document_password', {
    p_id: props.docId,
    p_old_password: oldPw.value,
    p_new_password: newPw.value,
  })
  submitting.value = false
  if (err) { error.value = err.message; return }
  if (!data) { error.value = '修改失败'; return }
  emit('changed', newPw.value)
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h3>🔑 修改编辑密码</h3>
        <button class="btn btn-icon" @click="emit('close')">✕</button>
      </div>
      <div class="field">
        <label for="oldpw">当前密码</label>
        <input id="oldpw" v-model="oldPw" type="password" />
      </div>
      <div class="field">
        <label for="newpw">新密码（至少 4 位）</label>
        <input id="newpw" v-model="newPw" type="password" @keyup.enter="submit" />
      </div>
      <div class="field">
        <label for="confirmpw">确认新密码</label>
        <input id="confirmpw" v-model="confirmPw" type="password" @keyup.enter="submit" />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="row">
        <button class="btn" @click="emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="submitting" @click="submit">
          {{ submitting ? '提交中…' : '确认修改' }}
        </button>
      </div>
    </div>
  </div>
</template>
