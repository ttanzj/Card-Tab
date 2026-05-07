# Cloudflare KV 自动备份至 WebDAV 部署手册

本手册用于指导如何配置 GitHub Actions，实现每天定时备份 Cloudflare KV 数据库中的 `testUser` 键值到 WebDAV 网盘，并保持 **7天滚动循环备份**。

## 📋 变量准备清单

在部署之前，请先收集以下必要参数。这些参数将用于 GitHub 仓库的 `Secrets` 配置中。

### 1. Cloudflare 相关 (获取数据源)
| 变量名 | 说明 | 获取位置 |
| :--- | :--- | :--- |
| **`CF_ACCOUNT_ID`** | 您的 Cloudflare 账户 ID | 登录 CF 后，在任意域名的“概述”页或 URL 中找 32 位 ID |
| **`CF_API_TOKEN`** | 具有 KV 读取权限的令牌 | [CF 个人资料 -> API 令牌](https://dash.cloudflare.com/profile/api-tokens) (创建自定义令牌) |
| **`CF_NS_ID_1`** | 第一个 KV 空间的 ID | 侧边栏：Workers & Pages -> KV -> 对应的命名空间 ID |
| **`CF_NS_ID_2`** | (预留) 第二个 KV 空间 ID | 同上，若无则留空 |
| **`CF_NS_ID_3`** | (预留) 第三个 KV 空间 ID | 同上，若无则留空 |

### 2. WebDAV 相关 (存储目的地)
| 变量名 | 说明 | 示例 |
| :--- | :--- | :--- |
| **`WEBDAV_URL`** | WebDAV 完整连接路径 | `https://dav.alist.com/dav/Backups` (结尾不加斜杠) |
| **`WEBDAV_USERNAME`** | WebDAV 登录账号 | `admin` 或 邮箱地址 |
| **`WEBDAV_PASSWORD`** | WebDAV 登录密码 | 应用授权码或原始登录密码 |

---

## ⚙️ 部署步骤

### 第一步：配置 GitHub Secrets
1. 进入 GitHub 仓库，点击 **Settings**。
2. 在左侧菜单点击 **Secrets and variables** -> **Actions**。
3. 点击 **New repository secret**，将上述清单中的所有变量名及其对应的值逐一添加。
   * **注意**：即使你只有 1 个 KV 空间，也要确保 `CF_NS_ID_1` 已填。`ID_2` 和 `ID_3` 留空即可，脚本会自动识别并跳过空值。

### 第二步：创建自动化脚本文件
1. 在仓库中新建路径为 `.github/workflows/cfkv-webdav.yml` 的文件。
2. 粘贴配置代码并提交（代码逻辑已包含：自动命名、循环备份、成功后才删除旧库）。

### 第三步：手动触发测试
1. 在仓库顶部点击 **Actions** 选项卡。
2. 选择左侧的 **CF Multi-Namespace Backup** 任务。
3. 点击右侧的 **Run workflow** 按钮进行首次手动测试运行。

---

## 🛡️ 安全与容错机制说明

为了保证数据万无一失，本方案采用了以下保护逻辑：

* **断点保护**：脚本执行顺序为 `读取 KV` -> `上传 WebDAV` -> `删除 7 天前备份`。
* **不成功不删**：如果 Cloudflare 读取失败，或者上传 WebDAV 过程出错（如网盘满了），脚本将立即停止，**绝对不会**执行删除旧备份的指令。
* **自动跳过**：预留了 3 个存储位，如果你只填了 1 个 Secret，脚本会自动打印“跳过”日志并继续执行有效任务，不会因此报错中断。
* **命名规范**：备份文件将以 `[空间名]_[日期].json` 格式保存，确保文件名唯一且清晰。

---

## ❓ 常见报错排查

* **Error 401 (Authentication Error)**：通常是 `CF_API_TOKEN` 配置错误或权限不足。请确保令牌拥有 "Workers KV 存储: 读取" 权限。
* **Error 404 (Not Found)**：
