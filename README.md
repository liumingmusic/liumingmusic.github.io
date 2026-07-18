# 星盘控制台 · 个人应用中心

一个**深色沉浸式「星盘控制台 / Bento 磁贴启动台」**——把你做的一系列小应用汇总成一个统一入口页。纯静态、零构建、原生 HTML/CSS/JS，部署到 GitHub Pages。

> 视觉定位：深空 · 星盘 · 控制台 · 玻璃拟态 · Bento。刻意区别于其他浅色卡片风格的应用，自成一派。

## 特性

- 🌌 深空极光背景 + 玻璃拟态 Bento 磁贴
- 🕹️ 顶部状态栏：实时时钟 / 日期 / 按时段问候
- ⌘ 命令面板：`⌘K` / `Ctrl+K` / 直接按 `/` 唤起，`↑↓` 选择、`Enter` 打开、`Esc` 关闭
- ✨ 磁贴鼠标跟随光晕 + 克制 3D 倾斜 + 首屏 stagger 淡入
- ➕ 页面内「＋ 添加应用」写入 `localStorage`，无需改代码即可上屏
- 📱 移动端单列、禁缩放、深色对比度达标

## 目录结构

```
app-center/
├── index.html
├── assets/
│   ├── css/style.css
│   └── js/app.js
├── data/
│   └── apps.json          # 应用清单（唯一需要维护的配置）
├── package.json
├── .gitignore
└── README.md
```

## 本地预览

```bash
cd app-center
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

> 注意：必须通过本地服务器访问，`fetch('data/apps.json')` 在 `file://` 直接打开时会被浏览器拦截。

## 如何添加 / 删减应用

有两种方式，二选一，**都不会破坏代码**：

### 方式一：改配置文件（推荐用于批量 / 正式维护）

编辑 `data/apps.json`。每个应用支持字段：

| 字段 | 说明 | 必填 |
| --- | --- | --- |
| `title` | 应用名 | ✅ |
| `desc` | 一句话简介 | ✅ |
| `url` | 跳转地址 | ✅ |
| `repo` | 源码仓库（右上角 </> 图标） | 可选 |
| `emoji` | 磁贴图标 | 可选 |
| `color` | 磁贴专属辉光色（深色底高饱和） | 可选 |
| `tags` | 标签数组（参与搜索） | 可选 |
| `status` | `已上线` / `建设中` / `计划中` | 可选 |
| `size` | `lg`（2×2 大磁贴）/ `sm`（1×1），缺省 `sm` | 可选 |

按 `categories` 分区组织即可。改完提交推送，GitHub Pages 自动更新。

### 方式二：页面内「＋ 添加应用」按钮（适合临时挂一个新应用）

点右上角 **＋ 添加应用** → 填表单提交。数据写入浏览器 `localStorage` 覆盖层，与 `apps.json` 合并渲染，即时上屏。
- 可在「＋ 添加应用」弹窗里点 **管理我的添加** 查看 / 删除自己加的应用。
- ⚠️ 该方式仅保存在当前浏览器，换设备 / 清缓存会丢失；**长期保留请用方式一**。

## 部署到 GitHub Pages

1. 推送到仓库（任选其一）：
   - 用户主页根仓库 `liumingmusic.github.io` → 站点即 `https://liumingmusic.github.io/`
   - 独立仓库 `app-center` → `https://liumingmusic.github.io/app-center/`
2. 仓库 Settings → Pages → Source 选 `main` 分支 / 根目录（`/root`），保存。
3. 等待 1~2 分钟，访问线上地址。

无需构建、无需任何 API key、无外部请求（除跳转目标站点）。
