<div align="center">

# 🧰 WanXin Userscripts

**个人维护的 Tampermonkey 用户脚本集合**

以 GitHub 作为开发源，Cloudflare Pages 提供稳定安装与自动更新地址，GitCode 保留国内展示镜像。

当前正式发布 **9** 个脚本 · 每条记录显示源脚本最近修改时间

</div>

---

## 🚀 快速开始

### 1. 安装 Tampermonkey

| 浏览器 | 安装入口 |
|---|---|
| Chrome | [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Edge | [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/) |
| 其他浏览器 / 官方说明 | [Tampermonkey 官网](https://www.tampermonkey.net/) |

> 安装扩展后，如果浏览器或 Tampermonkey 提示需要开启“用户脚本”相关权限，请按扩展页面提示启用。

### 2. 安装需要的脚本

在下方脚本列表中点击 **「推荐安装」**。浏览器会打开 Tampermonkey 安装页面，确认脚本名称和权限后点击 **安装** 即可。

> 推荐安装地址使用自有域名 `scripts.wanxinxin.dpdns.org`，由 Cloudflare Pages 提供分发；GitHub Raw 仅作为备用安装源。

### 3. 使用与更新

脚本安装完成后，打开对应业务页面并刷新即可生效。脚本通过 `@version` 判断新版，通过固定的 `@updateURL` / `@downloadURL` 自动更新。

需要主动检查时，可打开：**Tampermonkey → 管理面板 → 检查用户脚本更新**。刚发布新版时，请先等待 GitHub Actions 与 Cloudflare Pages 部署完成；如需立即覆盖更新，也可以重新点击本 README 中的推荐安装链接。

---

## 📦 脚本列表

### SOA相关 · 7 个

| 脚本 | 版本 | 修改时间 | 功能说明 | 安装 |
|---|---:|---|---|---|
| **SOA.1.1蝶美-单位信息填充** | `7.7.24` | 2026-09-01 09:12 | 自动填充单位信息，支持地区、行业、经济类型、单位类型、社会信用代码、企业规模、职工人数、接害人数等字段。 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/soaxg/soa-danweixinxi.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-danweixinxi.user.js) |
| **SOA.1.2蝶美-套餐危害核对** | `4.2.15` | 2026-09-01 09:12 | 增强“套餐危害核对”功能，提供自动化核对、批量处理、用户自定义别名和忽略列表等功能。 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/soaxg/soa-weihaihedui.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-weihaihedui.user.js) |
| **SOA.2.1全局发票页面** | `6.14` | 2026-09-01 09:12 | 优化SOA发票页面的表格布局、文案显示和复制功能，支持动态加载内容的处理。 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/soaxg/soa-quanjufapiao.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-quanjufapiao.user.js) |
| **SOA.2.2订单发票页面** | `1.6` | 2026-09-01 09:12 | SOA订单发票列表页面增强：列重排、宽度调整、文案替换、复制优化。 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/soaxg/soa-dingdanfapiao.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-dingdanfapiao.user.js) |
| **SOA.2.3首页排序模块** | `4.6` | 2026-09-01 09:12 | SOA首页模块排序，支持拖拽排序、保存顺序、恢复默认顺序、设置每行显示列数、设置模块宽度、设置列间距。 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/soaxg/soa-shouyepaixu.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-shouyepaixu.user.js) |
| **SOA.2.4前台批量模块** | `1.15` | 2026-09-01 09:12 | 批量预约单号；支持SPA常驻、14位预约单号智能提取、可调宽度窗口及“已到检”首次查询自动仅当日。 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/soaxg/soa-qiantaipiliang.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-qiantaipiliang.user.js) |
| **SOA.2.5订单流程自动化** | `1.31` | 2026-09-01 09:12 | SOA订单流程自动化脚本，支持订单详情各阶段自动处理，包括审批备注填写、合同配置、体检时间修正等功能，提供数据汇总及操作面板。 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/soaxg/soa-dingdanauto.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-dingdanauto.user.js) |

### 红领巾的游戏脚本 · 2 个

| 脚本 | 版本 | 修改时间 | 功能说明 | 安装 |
|---|---:|---|---|---|
| **CurseForge增强** | `4.2` | 2026-09-01 09:12 | 增强CurseForge网站的中文显示，翻译部分英文为中文，支持动态加载内容的翻译。 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/hljdyxjb/game-curseforge.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/hljdyxjb/game-curseforge.user.js) |
| **GOW底下尖塔** | `4.2.27` | 2026-09-01 09:12 | GOW底下尖塔火把管理与节点同步工具 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/hljdyxjb/game-gowdxjt.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/hljdyxjb/game-gowdxjt.user.js) |

---

## 🧩 Tampermonkey 使用教程

<details>
<summary><strong>如何启用、停用或删除脚本</strong></summary>

1. 点击浏览器工具栏中的 Tampermonkey 图标。
2. 进入 **管理面板**。
3. 使用脚本右侧开关可以临时启用 / 停用。
4. 点击脚本名称可以查看或编辑脚本。
5. 不再需要时，可在脚本详情页删除。

</details>

<details>
<summary><strong>如何手动检查更新</strong></summary>

1. 打开 Tampermonkey **管理面板**。
2. 选择 **检查用户脚本更新**。
3. Tampermonkey 会读取脚本的 `@updateURL`，比较本地与远程 `@version`。
4. 远程版本更高时，再通过 `@downloadURL` 获取并安装完整脚本。

> 脚本窗口标题、更新记录和 `console.log` 中写的版本号不会参与 Tampermonkey 更新判断，真正用于比较的是元数据中的 `@version`。

</details>

<details>
<summary><strong>刚发布新版但检查不到怎么办</strong></summary>

先确认 README 中显示的版本已经更新，并确认 Cloudflare Pages 最新部署已经完成。如果 Tampermonkey 仍提示无新版，可以稍后再次检查。

如果需要立即更新，重新点击该脚本的 **推荐安装** 链接，Tampermonkey 会识别为同一脚本并进入覆盖更新流程。

</details>

---

## 🔄 发布与更新机制

```text
本地修改源脚本
      ↓
GitHub main
      ↓
Build Userscripts
      ↓
生成固定 publish/ 发布文件
      ↓
Update Userscripts README
      ↓
Cloudflare Pages 固定域名分发
      ↓
Tampermonkey 安装 / 自动更新

同时：README + publish/ → GitCode 国内展示镜像
```

每个脚本使用固定的 `@publishGroup + @publishID` 生成永久安装地址，因此源文件改名或移动目录后，已经安装的脚本仍可继续更新。

Cloudflare Pages 自定义域名负责脚本安装与自动更新；GitCode 仅作为国内浏览和展示镜像。正式开发与版本维护始终以 GitHub `main` 为准。

---

<div align="center">

README 与脚本列表由 GitHub Actions 自动维护。

</div>
