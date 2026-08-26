// 仅内存：记录“刚创建的文档”密码，用于创建后直接进入编辑免二次输入。
// 刷新页面或离开页面后即失效，不会写入 localStorage / sessionStorage。
const pending = new Map()

export function rememberPassword(docId, password) {
  pending.set(docId, password)
}

export function takePassword(docId) {
  const p = pending.get(docId)
  pending.delete(docId)
  return p
}
