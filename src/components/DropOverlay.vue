<template>
  <div v-if="show" class="drop-overlay">
    <div class="drop-hint">
      📥 松开鼠标上传文件
      <small>支持 .md / .tex / .typ</small>
    </div>
  </div>
</template>

<script setup>
defineProps({ show: { type: Boolean, default: false } })
</script>
