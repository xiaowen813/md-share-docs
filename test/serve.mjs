import http from 'http'
import { readFile } from 'fs/promises'
import { join, extname, resolve } from 'path'

const root = resolve(process.cwd(), 'dist')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.json': 'application/json' }
http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (p.endsWith('/')) p += 'index.html'
    if (p.startsWith('/')) p = p.slice(1)
    const data = await readFile(join(root, p))
    res.writeHead(200, { 'Content-Type': mime[extname(p)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
}).listen(8123, () => console.log('serving on 8123'))
