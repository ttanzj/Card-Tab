# Card Tab - 个人导航系统

一个基于 Cloudflare Pages 的个人导航系统，支持多用户模式，每个用户拥有独立的导航数据,最初代码是单用户。

## 技术栈

- **前端**: HTML + JavaScript
- **后端**: Cloudflare Workers Functions
- **存储**: Cloudflare KV (Key-Value Storage)
- **部署**: Cloudflare Pages

## 项目结构

```
├── functions/
│   └── api/
│       ├── addCategory.js    # 添加分类
│       ├── addLink.js        # 添加链接
│       ├── backupData.js     # 数据备份
│       ├── deleteCategory.js # 删除分类
│       ├── deleteLink.js     # 删除链接
│       ├── getLinks.js       # 获取链接数据
│       ├── saveOrder.js      # 保存排序
│       ├── updateCategory.js # 更新分类名称
│       ├── updateLink.js     # 更新链接
│       └── verifyPassword.js # 密码验证
├── index.html                # 主页面
└── wrangler.toml             # Cloudflare 配置文件，本地调试用，部署不用
```

## 部署步骤

### 1. 准备工作

首先确保你已经注册了 Cloudflare 账号，并安装了 Cloudflare Wrangler CLI：

```bash
npm install -g wrangler
```

### 2. 创建 KV 命名空间

登录 Cloudflare 控制台，进入 **Workers & Pages** -> **KV**，点击 **Create namespace** 创建所需的 KV 命名空间。建议创建以下命名空间：

- `CARD_ORDER` (必填，主用户数据存储)
- `CARD_ORDER1` (可选，用户2数据存储)
- `CARD_ORDER2` (可选，用户3数据存储)
- `CARD_ORDER3` (可选，用户4数据存储)

### 3. 配置环境变量

进入 Pages 项目 -> **Settings** -> **Environment variables**，添加以下环境变量：

#### 必设变量
- `ADMIN_PASSWORD`: 主用户密码，对应 CARD_ORDER KV 绑定

#### 可选变量（多用户支持）
- `ADMIN_PASSWORD1`: 用户1密码，对应 CARD_ORDER1
- `ADMIN_PASSWORD2`: 用户2密码，对应 CARD_ORDER2  
- `ADMIN_PASSWORD3`: 用户3密码，对应 CARD_ORDER3
- `NAV_TITLE`: 网站标题，默认"我的导航"

### 4. 绑定 KV 命名空间

进入 Pages 项目 -> **Settings** -> **Functions** -> **KV namespace bindings**，将 KV 命名空间绑定到对应的变量名：

| 变量名 | KV 命名空间 |
|--------|-------------|
| `CARD_ORDER` | 你的 CARD_ORDER 命名空间 |
| `CARD_ORDER1` | 你的 CARD_ORDER1 命名空间 |
| `CARD_ORDER2` | 你的 CARD_ORDER2 命名空间 |
| `CARD_ORDER3` | 你的 CARD_ORDER3 命名空间 |

### 5. 部署项目

#### 方法一：Git 部署（推荐）

将代码推送到 GitHub/GitLab 仓库，在 Cloudflare Pages 中连接该仓库，配置构建命令为空（无需构建步骤），设置部署分支即可。

#### 方法二：Wrangler CLI 部署

```bash
wrangler login
wrangler pages deploy . --production
```

## 使用说明

### 登录系统

访问部署的网站，在登录页面输入密码，系统会根据密码自动匹配对应的用户数据。

### 用户配置

系统支持多用户模式，每个用户拥有独立的导航数据：

| 密码环境变量 | KV 绑定 | 用户ID |
|--------------|---------|--------|
| `ADMIN_PASSWORD` | `CARD_ORDER` | `testUser` |
| `ADMIN_PASSWORD1` | `CARD_ORDER1` | `testUser` |
| `ADMIN_PASSWORD2` | `CARD_ORDER2` | `testUser` |
| `ADMIN_PASSWORD3` | `CARD_ORDER3` | `testUser` |

### 功能说明

**导航功能**: 点击分类标签快速跳转，点击卡片打开链接，鼠标悬停显示链接描述。

**管理功能（登录后）**:
- **设置按钮**: 进入编辑模式，可添加/删除链接和分类
- **注销按钮**: 退出登录并清空所有数据
- **+ 按钮**: 添加新链接
- **✎ 按钮**: 切换卡片编辑模式（显示编辑/删除按钮）
- **C+ 按钮**: 添加新分类
- **E 按钮**: 切换分类编辑模式（显示编辑/删除/上移/下移按钮）

**拖拽排序**: 在编辑模式下，可拖拽卡片改变顺序或移动到其他分类。

### 数据结构

KV 存储的 `testUser` 键包含以下结构：

```json
{
  "links": [
    {
      "name": "链接名称",
      "url": "https://example.com",
      "tips": "描述信息",
      "icon": "",
      "category": "分类名称",
      "isPrivate": false
    }
  ],
  "categories": {
    "分类名称": []
  }
}
```

## 注意事项

- **密码安全**: 请使用强密码并妥善保管
- **数据备份**: 系统会自动备份数据到同一 KV 命名空间，保留最近10份备份
- **私密链接**: 未登录时只显示非私密链接，登录后显示所有链接
- **多用户隔离**: 不同密码对应不同的 KV 命名空间，数据完全隔离

## 故障排除

**问题**: 登录后看不到内容

**解决方案**: 检查 KV 绑定是否正确、KV 命名空间中是否有 `testUser` 键、环境变量是否正确配置。

**问题**: 注销后切换用户仍显示旧数据

**解决方案**: 已修复，注销时会自动清空所有本地缓存数据。

---

*本项目基于 Cloudflare Pages 构建，享受全球边缘部署的极速体验*
