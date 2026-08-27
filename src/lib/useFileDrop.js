import { onBeforeUnmount, onMounted, ref } from 'vue'
import { readMdFile, rememberUpload } from './uploadSession'

// 页面级拖拽上传：拖入文件 → 高亮遮罩 → 松开读取并跳转新建页
export function useFileDrop({ onBeforePush } = {}) {
  const dragging = ref(false)
  let counter = 0

  const hasFiles = (e) =>
    e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')

  const onEnter = (e) => {
    if (hasFiles(e)) {
      counter++
      dragging.value = true
    }
  }
  const onOver = (e) => {
    if (hasFiles(e)) e.preventDefault() // 阻止浏览器默认打开文件
  }
  const onLeave = () => {
    counter = Math.max(0, counter - 1)
    if (counter === 0) dragging.value = false
  }
  const onDrop = async (e) => {
    e.preventDefault()
    counter = 0
    dragging.value = false
    const files = e.dataTransfer && e.dataTransfer.files
    if (!files || !files.length) return
    if (files.length > 1) {
      alert('一次只能上传一个文件，请逐个拖入')
      return
    }
    try {
      const { title, content, type } = await readMdFile(files[0])
      rememberUpload(title, content, type)
      if (onBeforePush) onBeforePush()
    } catch (err) {
      alert('读取文件失败：' + err.message)
    }
  }

  onMounted(() => {
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('dragenter', onEnter)
    window.removeEventListener('dragover', onOver)
    window.removeEventListener('dragleave', onLeave)
    window.removeEventListener('drop', onDrop)
  })

  return { dragging }
}
