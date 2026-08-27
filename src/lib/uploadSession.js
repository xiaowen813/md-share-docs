// 读取上传的文档文件（utf-8），按扩展名识别类型
export function readMdFile(file) {
  return new Promise((resolve, reject) => {
    const ext = (file.name || '').split('.').pop().toLowerCase()
    const type = ext === 'tex' ? 'latex' : ext === 'typ' ? 'typst' : 'md'
    const name = (file.name || '').replace(/\.(md|markdown|txt|tex|typ)$/i, '')
    const reader = new FileReader()
    reader.onload = () =>
      resolve({ title: name || '未命名文档', content: String(reader.result || ''), type })
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file, 'utf-8')
  })
}

// 仅内存：把上传的内容带到新建文档页预填（刷新即失效）
const pending = { title: '', content: '', type: 'md' }

export function rememberUpload(title, content, type = 'md') {
  pending.title = title
  pending.content = content
  pending.type = type
}

export function takeUpload() {
  const p = { title: pending.title, content: pending.content, type: pending.type }
  pending.title = ''
  pending.content = ''
  pending.type = 'md'
  return p
}
