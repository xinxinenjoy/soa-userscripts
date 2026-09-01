<div align="center">

# 🧰 WanXin Userscripts

**个人维护的 Tampermonkey 用户脚本集合**

🌐 **脚本主页：[https://scripts.wanxinxin.dpdns.org](https://scripts.wanxinxin.dpdns.org)**

GitHub 作为唯一开发源，Cloudflare Pages 提供展示、安装与自动更新。

当前正式发布 **9** 个脚本 · 最近修改 **2026-09-01 17:07**

</div>

---

## 🚀 快速开始

### 1. 安装 Tampermonkey

| 浏览器 | 安装入口 |
|---|---|
| Chrome | [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Edge | [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/) |
| 官方网站 | [Tampermonkey](https://www.tampermonkey.net/) |

### 2. 安装脚本

推荐进入上方 **脚本主页**，找到需要的脚本后点击 **立即安装**。

> 安装和自动更新统一使用 `https://scripts.wanxinxin.dpdns.org`，GitHub Raw 仅作为备用。

### 3. 检查更新

打开 **Tampermonkey → 管理面板 → 检查用户脚本更新**。

脚本通过元数据中的 `@version` 判断新版，并通过固定的 `@updateURL` / `@downloadURL` 自动更新。

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
| **SOA.2.5订单流程自动化** | `1.32` | 2026-09-01 17:07 | SOA订单流程自动化：内勤复核、合同补充、发起落单、落单审核、落单完成及数据提取；支持文件绑定、异常等待、流程状态判定及卡池数量查询。 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/soaxg/soa-dingdanauto.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-dingdanauto.user.js) |

### 红领巾的游戏脚本 · 2 个

| 脚本 | 版本 | 修改时间 | 功能说明 | 安装 |
|---|---:|---|---|---|
| **CurseForge增强** | `4.2` | 2026-09-01 09:12 | 增强CurseForge网站的中文显示，翻译部分英文为中文，支持动态加载内容的翻译。 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/hljdyxjb/game-curseforge.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/hljdyxjb/game-curseforge.user.js) |
| **GOW底下尖塔** | `4.2.27` | 2026-09-01 09:12 | GOW底下尖塔火把管理与节点同步工具 | [⚡ 推荐安装](https://scripts.wanxinxin.dpdns.org/hljdyxjb/game-gowdxjt.user.js) · [GitHub 备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/hljdyxjb/game-gowdxjt.user.js) |

---

## 🧩 Tampermonkey 使用说明

<details>
<summary><strong>如何安装脚本</strong></summary>

1. 安装 Tampermonkey。
2. 打开脚本主页。
3. 点击对应脚本的 **立即安装**。
4. 在 Tampermonkey 安装页面确认后点击 **安装**。

</details>

<details>
<summary><strong>如何手动检查更新</strong></summary>

打开 Tampermonkey 管理面板，点击 **检查用户脚本更新**。

Tampermonkey 会读取 `@updateURL`，比较远程与本地 `@version`；远程版本更高时，通过 `@downloadURL` 获取新版。

</details>

<details>
<summary><strong>新版刚发布但暂时没有检测到</strong></summary>

请先等待 GitHub Actions 与 Cloudflare Pages 部署完成，再重新检查。

如果需要立即更新，也可以重新点击脚本主页中的 **立即安装** 覆盖更新。

</details>

---

## 🔄 发布架构

```text
本地修改
   ↓
GitHub main
   ↓
Build Userscripts
   ↓
publish/
   ↓
Update Userscripts README
   ├─ README.md
   └─ publish/index.html
          ↓
Cloudflare Pages
   ├─ 展示主页
   ├─ 脚本安装
   └─ Tampermonkey 自动更新

同时：README + publish/ → GitCode 备用镜像
```

---

<div align="center">

README 与脚本主页由 GitHub Actions 自动维护。

</div>
