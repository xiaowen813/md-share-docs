# 📚 MD Share · 共享 Markdown 文档站

一个**部署在 GitHub Pages** 的共享 Markdown 文档网站：

- 首页展示文档列表，可选择已有文档，也可新建文档
- 新建文档时需要**设置编辑密码**（bcrypt 加密存于服务端数据库，任何人看不到明文）
- **阅读模式**：只能查看，支持一键下载 `.md` 文件，或通过浏览器打印导出 PDF
- **编辑模式**：输入密码解锁后，左侧编辑 Markdown 源码，右侧实时预览，Ctrl+S 保存
- **修改密码**：编辑模式中可随时更换编辑密码（需验证旧密码，服务端校验）
- **历史版本**：每次保存自动生成版本快照，可在编辑模式中查看任意历史版本并一键恢复（需密码）
- **真正的密码安全**：密码校验、文档读写全部由后端（Supabase）的 RLS + 服务端函数把关，
  即使拿到前端公开的 anon key 也无法绕过密码修改文档

## 技术架构

```
┌──────────────────┐         HTTPS          ┌───────────────────────┐
│  GitHub Pages     │  ───────────────────►  │  Supabase (免费后端)   │
│  Vue 3 + Vite SPA │  supabase-js          │  PostgreSQL + RLS     │
│  (纯静态托管)      │                        │  bcrypt 密码校验 RPC   │
└──────────────────┘                        └───────────────────────┘
```

> 为什么用 Supabase？GitHub Pages 只能托管静态文件，没有服务器、数据库和后端鉴权。
> Supabase 免费版提供 Postgres 数据库 + 行级安全（RLS），前端仍然 100% 部署在 GitHub Pages，
> 通过 HTTPS API 与后端通信，实现“真正的密码保护”，而不是纯前端摆设。

## 目录结构

```
md-share-docs/
├── .github/workflows/deploy.yml   # push 到 main 自动构建并部署到 GitHub Pages
├── supabase/schema.sql            # 数据库结构：表 + RLS + 密码校验函数（在 Supabase 里执行一次）
├── public/                        # 静态资源（favicon 等）
├── src/
│   ├── lib/supabase.js            # Supabase 客户端
│   ├── lib/markdown.js            # Markdown 渲染（marked + DOMPurify 防 XSS）
│   ├── views/
│   │   ├── HomeView.vue           # 首页：文档列表 + 新建入口
│   │   ├── NewDocView.vue         # 新建文档（设置编辑密码）
│   │   ├── ReadView.vue           # 阅读模式（渲染 + MD/PDF 下载）
│   │   └── EditView.vue           # 编辑模式（密码门 + 左右分栏）
│   └── router.js                  # hash 路由（GitHub Pages 下不会 404）
├── .env.example                   # 环境变量模板
├── index.html
├── package.json
└── vite.config.js                 # base:'./' 适配 Pages 子路径
```

## 快速开始

### 1. 创建 Supabase 项目（免费）

1. 打开 <https://supabase.com> 注册并创建新项目（选 Free 计划）
2. 项目创建完成后，进入 **SQL Editor**，把 `supabase/schema.sql` 的全部内容粘贴进去并 **Run**
3. 进入 **Project Settings → API**，复制：
   - `Project URL`（即 `VITE_SUPABASE_URL`）
   - `anon public` key（即 `VITE_SUPABASE_ANON_KEY`）

### 2. 本地运行

```bash
# 1) 克隆本项目后
npm install

# 2) 配置环境变量
cp .env.example .env
# 编辑 .env，填入上面复制的两个值

# 3) 启动开发服务器
npm run dev
# 浏览器打开终端提示的地址（默认 http://localhost:5173）
```

### 3. 部署到 GitHub Pages

1. 在 GitHub 新建一个仓库，把本目录代码推上去（**确保仓库是 Public**，共享阅读需要公开站）
2. 仓库 **Settings → Secrets and variables → Actions → New repository secret**，添加：
   - `VITE_SUPABASE_URL` → Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` → Supabase anon key
3. 仓库 **Settings → Pages**，Source 选择 **GitHub Actions**
4. push 到 `main` 分支（或手动触发 Actions 里的 `Deploy to GitHub Pages` 工作流）
5. 完成后访问 `https://你的用户名.github.io/你的仓库名/`

之后每次 push 都会自动重新构建并部署。

## 安全设计说明

| 项目 | 做法 |
| --- | --- |
| 密码存储 | bcrypt（`pgcrypto crypt + gen_salt('bf')`），数据库只存哈希 |
| 编辑权限 | 每次保存/删除都要携带密码，由服务端函数重新校验，错误直接拒绝 |
| 历史版本 / 改密码 | 恢复版本、修改密码同样由服务端函数校验密码，无法绕过 |
| 版本快照 | 保存前自动把旧内容写入 `document_versions` 表；删除文档时级联清理 |
| 直接写表 | RLS 只开放 SELECT，客户端无法绕过密码直接 INSERT/UPDATE/DELETE |
| XSS | 阅读/预览都经过 DOMPurify 消毒 |
| 前端密钥 | 只使用公开的 anon key；service_role key 永远不会出现在前端 |

已知限制（后续可扩展）：

- 任何人（拿到链接）都可以创建新文档——如需限制，可给 `create_document` 加访问令牌或接 Supabase Auth
- 还没有“找回密码”功能，忘记密码只能通过 Supabase 控制台手动重置 `password_hash`
- PDF 下载依赖浏览器打印（跨平台最稳）；如需服务端生成 PDF 可后续接 Cloudflare Workers
- 历史版本会无限累积占用存储，可后续增加“只保留最近 N 个版本”的清理任务

## License

MIT
