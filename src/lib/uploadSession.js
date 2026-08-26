// 读取上传的 Markdown 文件（utf-8）
export function readMdFile(file) {
  return new Promise((resolve, reject) => {
    const name = (file.name || '').replace(/\.(md|markdown|txt)$/i, '')
    const reader = new FileReader()
    reader.onload = () => resolve({ title: name || '未命名文档', content: String(reader.result || '') })
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file, 'utf-8')
  })
}

// 仅内存：把上传的内容带到新建文档页预填（刷新即失效）
const pending = { title: '', content: '' }

export function rememberUpload(title, content) {
  pending.title = title
  pending.content = content
}

export function takeUpload() {
  const p = { title: pending.title, content: pending.content }
  pending.title = ''
  pending.content = ''
  return p
}
