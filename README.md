# 📚 MD Share · 共享 Markdown 文档站

一个部署在 **GitHub Pages** 的现代共享文档站，支持 **Markdown / LaTeX / Typst** 三种格式的创建、编辑、格式互转与 PDF 导出，内置 **GitHub OAuth 登录** 与 **管理员权限体系**。

> ✨ 零服务器成本：前端静态托管于 GitHub Pages，后端使用 Supabase 免费版（PostgreSQL + RLS + 服务端函数），数据库与鉴权全部由云服务承担。

---

## 🚀 核心亮点

| 特性 | 说明 |
| --- | --- |
| 🔐 **GitHub 登录** | 顶栏一键 OAuth 登录，第一个登录用户自动成为管理员 |
| 👥 **权限体系** | 管理员授权用户；未授权用户只能阅读，授权用户可新建/编辑/上传/排序 |
| 📝 **三格式支持** | Markdown / LaTeX (.tex) / Typst (.typ) 新建、编辑、互转 |
| 🔄 **格式互转** | 导出时任意转换：Markdown ↔ LaTeX ↔ Typst ↔ PDF |
| 🧮 **LaTeX 数学公式** | KaTeX 渲染行内 `$...$` 与块级 `$$...$$` 公式 |
| 📊 **Mermaid 图** | 代码块 ```mermaid 一键渲染流程图/时序图/类图 |
| 📂 **文件夹管理** | 文件夹嵌套文档、拖拽排序、拖拽移动、拖拽上传 |
| 🖨 **专业 PDF 导出** | A4 精确分页、封面页、目录（含页码）、每页页码、代码跨页不断行 |
| 🕘 **历史版本** | 每次保存自动快照，可查看任意版本并一键恢复 |
| 🌗 **深色/浅色主题** | 全站一键切换（黑夜/白天），打印时自动黑白输出 |
| 🗂 **VSCode 风格侧边栏** | 阅读/编辑页文档树，文件夹展开收起、整栏折叠 |

---

## 📖 功能详解

### 1. 登录与权限

- 未登录 / 未授权用户：**只读**（阅读、下载源文件、导出 PDF）
- **授权用户**（管理员添加）：新建文件夹/文档、编辑、上传、拖拽排序/移动、删除、历史恢复
- **管理员**：全部权限 + 「👥 添加用户」授权/移除其他用户
- 权限在**服务端强制校验**：所有写操作走 RPC，函数内校验角色（`current_user_role`），绕过前端也无法写入

### 2. 文档类型与格式互转

| 格式 | 编辑 | 渲染/阅读 | 导出 |
| --- | --- | --- | --- |
| Markdown | ✅ 完整编辑器 | 全语法渲染 | ✅ 转换到任意格式 |
| LaTeX (.tex) | ✅ 源码编辑 | 源码视图 + `$...$` 公式 KaTeX 渲染、verbatim 代码块 | ✅ 转换到任意格式 |
| Typst (.typ) | ✅ 源码编辑 | 源码视图 + 公式渲染 | ✅ 转换到任意格式 |

导出下拉（单文档/文件夹批量）可选择目标格式，自动转换：

- 标题 / 粗体 / 斜体 / 删除线 / 代码 / 代码块 / 列表 / 链接 / 图片 / 表格 / 引用 / 分隔线 / 数学公式
- 特殊字符正确转义，转换产物可直接编译（LaTeX 需 `graphicx`、`hyperref` 等宏包）

### 3. 编辑器

- **左右分栏**：左 Markdown 源码（Fira Code 等宽字体 + 行号），右实时预览，中间可拖拽调宽
- **格式工具条**：加粗 / 斜体 / 标题 / 行内代码 / 代码块 / 链接 / 引用 / 列表，选中文字一键包裹
- **VSCode 式编辑**：Tab 缩进、Shift+Tab 反缩进、Ctrl+S 保存、代码语法高亮（20+ 语言）
- 深色/浅色主题随全站切换

### 4. 渲染能力（Markdown 全语法）

- ✅ 基础：标题、粗斜体、删除线、行内代码、代码块（带行号）、链接、图片、自动链接
- ✅ 列表：有序 / 无序 / 嵌套 / 任务列表
- ✅ 引用、嵌套引用、表格、分隔线
- ✅ **数学公式**：`$...$` 行内、`$$...$$` 块级（KaTeX）
- ✅ **Mermaid 图**：```mermaid 代码块渲染为矢量图
- ✅ **目录**：`[TOC]` 自动生成可折叠目录
- ✅ **脚注**、**定义列表**、**emoji 简码**（1800+）、**高亮 `==`**、**上下标 `^`/`~`**
- ✅ 内嵌 HTML（`<mark>` `<sub>` `<sup>` `<details>` 等）
- 🛡 XSS 防护：渲染结果经 DOMPurify 消毒

### 5. 文件夹与文件操作

- 文件夹创建（管理员/授权用户）、文件夹内文档列表
- **拖拽上传**：把 .md/.tex/.typ 文件拖到页面任意位置即可上传（自动识别类型）
- **拖拽移动**：首页把文档拖到文件夹卡片上移动
- **拖拽排序**：文件夹内按住卡片拖动排序，打印/导出按此顺序
- 文档类型彩色徽标（MD/TEX/TYP）

### 6. PDF 导出（文件夹批量）

- **A4 精确分页**：JS 分页引擎按页高精确排版，内容不截断
- **封面页**：文件夹名大字居中 + 文档数量
- **目录页**：每篇文档标题 + 起始页码
- **每页右下角页码**（正文从 1 开始，不与内容重叠）
- **代码跨页**：长代码按行续页，行号连续不丢行
- 深色主题下打印自动转黑白

### 7. 历史版本

- 每次保存自动把旧内容写入 `document_versions` 快照表
- 编辑页「🕘 历史版本」查看任意版本（渲染预览）并一键恢复
- 删除文档时级联清理

### 8. 界面

- 阅读/编辑页 **VSCode 风格文档树侧边栏**（文件夹展开收起、整栏折叠、当前文档高亮、类型色点）
- 阅读页**宽版排版**（1560px，适合代码/公式/表格）
- 全站 **黑夜/白天** 主题切换（记忆选择）
- 卡片式文档列表：点击卡片直接阅读，右上角 ⚙️ 齿轮编辑（仅授权用户可见）

---

## 🏗 技术架构

```
┌──────────────────────┐        HTTPS         ┌──────────────────────────┐
│   GitHub Pages        │  ─────────────────►  │   Supabase（免费后端）    │
│   Vue 3 + Vite SPA    │  supabase-js        │   PostgreSQL + RLS       │
│   （纯静态托管）        │                      │   GitHub OAuth 鉴权       │
│   marked / KaTeX /    │                      │   服务端权限函数（RPC）    │
│   Mermaid / hljs      │                      │   历史版本快照表          │
└──────────────────────┘                      └──────────────────────────┘
```

- **前端**：Vue 3 + Vue Router（hash 路由）+ Vite，零后端依赖
- **渲染**：marked（扩展：KaTeX 公式、Mermaid、脚注、定义列表、emoji、TOC、高亮、上下标）+ highlight.js + DOMPurify
- **转换**：自研格式互转引擎（Markdown ↔ LaTeX ↔ Typst，token 级转换 + 特殊字符转义）
- **打印**：JS 分页引擎（A4 精确测量、代码按行跨页、封面/目录/页码）
- **后端**：Supabase PostgreSQL，所有写操作经 SECURITY DEFINER 函数 + 角色校验

---

## 📁 目录结构

```
md-share-docs/
├── .github/workflows/deploy.yml   # push 自动构建部署到 GitHub Pages
├── supabase/schema.sql            # 数据库：表 + RLS + 权限函数 + RPC（执行一次）
├── src/
│   ├── lib/
│   │   ├── supabase.js            # Supabase 客户端
│   │   ├── markdownCore.js        # Markdown 渲染核心（扩展语法）
│   │   ├── markdown.js            # 渲染入口（引入样式）
│   │   ├── convert.js             # 格式互转引擎（md/tex/typ）
│   │   ├── mermaid.js             # Mermaid 按需渲染
│   │   ├── session.js             # 登录态与角色状态
│   │   ├── uploadSession.js       # 上传文件读取与预填
│   │   └── useFileDrop.js         # 页面级拖拽上传
│   ├── views/                     # Home / Folder / Read / Edit / New
│   ├── components/                # DocSidebar / HistoryModal / DropOverlay 等
│   └── App.vue                    # 顶栏：主题切换 / 登录 / 用户管理
├── test/                          # 渲染与转换测试脚本
├── .env.example
└── vite.config.js                 # base:'./' 适配 Pages 子路径
```

---

## 🚦 快速开始

### 1. 创建 Supabase 项目（免费）

1. 打开 <https://supabase.com> 注册并创建新项目（Free 计划）
2. **SQL Editor** 执行 `supabase/schema.sql`（表 + 权限函数 + RLS，幂等可重复执行）
3. **Project Settings → API** 复制 `Project URL` 与 `Publishable key`

### 2. 配置 GitHub 登录

1. GitHub **Developer settings → OAuth Apps → New OAuth App**：
   - Homepage URL：`https://你的用户名.github.io/仓库名/`
   - Authorization callback URL：`https://你的项目.supabase.co/auth/v1/callback`
2. Supabase **Authentication → Providers → GitHub**：填入 Client ID / Client Secret
3. Supabase **Authentication → URL Configuration**：Site URL 与 Redirect URLs 填你的网站地址

### 3. 本地开发

```bash
npm install
cp .env.example .env   # 填入 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```

### 4. 部署到 GitHub Pages

1. 新建 **Public** 仓库并推送代码
2. 仓库 **Settings → Secrets → Actions** 添加：
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
3. 仓库 **Settings → Pages**：Source 选 **GitHub Actions**
4. push 后自动构建部署；**第一个 GitHub 登录的用户自动成为管理员**

---

## 🔒 安全设计

| 项目 | 做法 |
| --- | --- |
| 登录 | GitHub OAuth（Supabase Auth），JWT 鉴权 |
| 角色 | 首用户自动管理员；`authorized_users` 表授权，登录自动绑定用户 ID |
| 写权限 | 所有写 RPC 服务端校验角色（`current_user_role`），仅 admin/editor 可调用 |
| 直接写表 | RLS 只开放 SELECT，客户端无法直接 INSERT/UPDATE/DELETE |
| XSS | 阅读/预览经 DOMPurify 消毒 |
| 前端密钥 | 仅使用公开的 anon key；service_role key 永不进入前端 |

---

## ⚠️ 已知限制与路线图

- 授权以 GitHub 用户名为标识（登录后自动绑定用户 ID，改名不影响已绑定用户）
- LaTeX/Typst 阅读为「源码视图 + 公式渲染」，完整排版编译需接云端编译服务
- 格式互转为基础语法级，复杂 LaTeX 环境（`theorem` 等）与 Typst 高级特性会尽力保留
- 历史版本无限累积，可后续增加"保留最近 N 版"清理任务
- 未提供文档级评论/协作光标（如需要可接入实时协作服务）

---

## 📄 License

MIT
