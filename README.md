# WanXin Userscripts

> 红领巾的自用 Tampermonkey 脚本仓库  
> 主要用于 SOA / 蝶美 / 前台登记等工作页面增强，以及部分游戏网页辅助。

本仓库以 **GitHub 作为源码仓库**，并通过 GitHub Actions 自动同步到 **GitCode 发布仓库**。  
脚本中的 `@updateURL` / `@downloadURL` 会自动维护为 GitCode Raw 地址，便于国内网络环境下安装和更新。

---

## 📦 仓库内容

### SOA 相关

| 脚本 | 当前版本 | 主要功能 | 安装 |
|---|---:|---|---|
| **SOA.1.1 蝶美 - 单位信息填充** | 7.7.23 | 蝶美单位信息自动填写，覆盖地区、行业、经济类型、单位类型、统一社会信用代码、企业规模、职工数、接害人数、扁鹊同步等字段 | [安装脚本](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/SOA%E7%9B%B8%E5%85%B3/SOA.1.1%E8%9D%B6%E7%BE%8E-%E5%8D%95%E4%BD%8D%E4%BF%A1%E6%81%AF%E5%A1%AB%E5%85%85.user.js) |
| **SOA.1.2 蝶美 - 套餐危害核对** | 4.2.12 | 用于套餐危害因素核对，并统一处理列表及编辑弹窗中的在岗状态识别 | [安装脚本](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/SOA%E7%9B%B8%E5%85%B3/SOA.1.2%E8%9D%B6%E7%BE%8E-%E5%A5%97%E9%A4%90%E5%8D%B1%E5%AE%B3%E6%A0%B8%E5%AF%B9.user.js) |
| **SOA.2.1 全局发票页面** | 6.13 | 优化 SOA3 合并开票页面的表格显示、列宽及字段布局 | [安装脚本](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/SOA%E7%9B%B8%E5%85%B3/SOA.2.1%E5%85%A8%E5%B1%80%E5%8F%91%E7%A5%A8%E9%A1%B5%E9%9D%A2.user.js) |
| **SOA.2.2 订单发票页面** | 1.5 | 专用于订单发票查看页，对独立发票列表进行布局和显示优化 | [安装脚本](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/SOA%E7%9B%B8%E5%85%B3/SOA.2.2%E8%AE%A2%E5%8D%95%E5%8F%91%E7%A5%A8%E9%A1%B5%E9%9D%A2.user.js) |
| **SOA.2.3 首页排序模块** | 4.5 | 首页应用模块拖拽排序、4～8 列布局、模块宽度和间距调节、悬浮高亮、本地自动保存 | [安装脚本](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/SOA%E7%9B%B8%E5%85%B3/SOA.2.3%E9%A6%96%E9%A1%B5%E6%8E%92%E5%BA%8F%E6%A8%A1%E5%9D%97.user.js) |
| **SOA.2.4 前台批量模块** | 1.2 | 批量输入预约单号，自动提交并监听 Ant Design 提示；异常自动记录并继续，完成后统一汇总 | [安装脚本](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/SOA%E7%9B%B8%E5%85%B3/SOA.2.4%E5%89%8D%E5%8F%B0%E6%89%B9%E9%87%8F%E6%A8%A1%E5%9D%97.user.js) |

### 🎮 红领巾的游戏脚本

| 脚本 | 当前版本 | 主要功能 | 安装 |
|---|---:|---|---|
| **CurseForge 增强** | 4.1 | CurseForge 页面增强及常用界面文本中文化 | [安装脚本](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/%E7%BA%A2%E9%A2%86%E5%B7%BE%E7%9A%84%E6%B8%B8%E6%88%8F%E8%84%9A%E6%9C%AC/CurseForge%E5%A2%9E%E5%BC%BA.user.js) |
| **GOW 底下尖塔** | 4.2.24 | 自动校准、购买建议、重点房间导航、火把需求计算、地图指引以及未处理守卫提示 | [安装脚本](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/%E7%BA%A2%E9%A2%86%E5%B7%BE%E7%9A%84%E6%B8%B8%E6%88%8F%E8%84%9A%E6%9C%AC/GOW%E5%BA%95%E4%B8%8B%E5%B0%96%E5%A1%94.user.js) |

> 版本号以仓库中脚本的 `@version` 为准，README 中的版本信息可能晚于脚本实际更新。

---

## 🚀 安装方法

1. 浏览器安装 Tampermonkey 或 Violentmonkey。
2. 点击上方表格中的 **安装脚本**。
3. 在脚本管理器安装页面确认安装。

---

## 🔄 自动更新与发布

脚本统一使用 GitCode Raw 作为更新源：

```javascript
// @updateURL    https://raw.gitcode.com/...
// @downloadURL  https://raw.gitcode.com/...
```

仓库中的 GitHub Actions 会自动执行：

```text
本地修改脚本
    ↓
Push 到 GitHub main
    ↓
自动扫描所有 *.user.js
    ↓
核对 @updateURL / @downloadURL
    ↓
缺失则补充，错误则修正，重复则清理
    ↓
必要时自动 Commit 回 GitHub
    ↓
同步完整目录结构到 GitCode
    ↓
Tampermonkey 从 GitCode Raw 获取更新
```

当前 Workflow 支持：

- `main` 分支有提交时立即运行
- 每 4 小时自动运行一次
- GitHub Actions 页面手动运行
- 自动根据脚本所在目录生成 GitCode Raw 地址
- 自动维护 GitHub 原始脚本中的 `@updateURL`
- 自动维护 GitHub 原始脚本中的 `@downloadURL`
- 自动同步 GitHub 与 GitCode 的目录及文件变化
- 自动避免回写 GitHub 时造成 Workflow 无限循环

---

## 📁 当前目录结构

```text
wanxin-userscripts/
├─ .github/
│  └─ workflows/
│     └─ sync-atomgit.yml
├─ SOA相关/
│  ├─ SOA.1.1蝶美-单位信息填充.user.js
│  ├─ SOA.1.2蝶美-套餐危害核对.user.js
│  ├─ SOA.2.1全局发票页面.user.js
│  ├─ SOA.2.2订单发票页面.user.js
│  ├─ SOA.2.3首页排序模块.user.js
│  └─ SOA.2.4前台批量模块.user.js
├─ 红领巾的游戏脚本/
│  ├─ CurseForge增强.user.js
│  └─ GOW底下尖塔.user.js
└─ README.md
```

---

## 🛠️ 本地维护

克隆仓库：

```bash
git clone https://github.com/xinxinenjoy/wanxin-userscripts.git
```

进入仓库：

```bash
cd wanxin-userscripts
```

更新本地：

```bash
git pull
```

提交修改：

```bash
git add -A
git commit -m "更新脚本"
git push
```

Push 到 GitHub 后，正常情况下无需再手工维护 GitCode。

---

## ⚠️ 使用说明

- 本仓库主要用于个人工作流和网页功能增强。
- SOA / 蝶美相关脚本依赖对应业务系统的页面结构，仅在匹配页面中运行。
- 页面改版后，脚本选择器或交互逻辑可能需要同步调整。
- 自动填写、批量处理等功能使用前，请确认页面数据与操作目标正确。
- 游戏脚本仅针对对应网页工具进行界面及操作增强。
- 建议保留 Tampermonkey 的自动更新功能。

---

## 🔗 仓库

- GitHub：<https://github.com/xinxinenjoy/wanxin-userscripts>
- GitCode Raw：`https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/`

---

## 👤 Author

**wanxin**

自用脚本持续维护中。

---

<!-- AUTO-USERSCRIPTS:START -->

## 📦 脚本清单

> 本区域由 GitHub Actions 自动维护。安装地址固定指向 `publish/`，源文件改名或移动不会影响已安装脚本的更新。

### hljdyxjb

| 脚本 | 版本 | 说明 | GitCode 安装 | GitHub 备用 |
|---|---:|---|---|---|
| **CurseForge增强** | 4.1 | 测试一下内容看看会不会生效 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/hljdyxjb/game-curseforge.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/hljdyxjb/game-curseforge.user.js) |
| **GOW底下尖塔** | 4.2.24 | 自动校准与购买建议；重点房间按数字顺序优先导航、F最后；主线与每个目标独立计算总火把；新增地图指引开关，关闭后恢复网页原始地图视觉并保留缩放与位移；主线路完成后显示全部未处理守卫 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/hljdyxjb/game-gowdxjt.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/hljdyxjb/game-gowdxjt.user.js) |

### soaxg

| 脚本 | 版本 | 说明 | GitCode 安装 | GitHub 备用 |
|---|---:|---|---|---|
| **SOA.1.1蝶美-单位信息填充** | 7.7.23 | 7.7.23更新测试2026年8月27日16:48:06 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-danweixinxi.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-danweixinxi.user.js) |
| **SOA.1.2蝶美-套餐危害核对** | 4.2.12 | 统一列表核对与编辑弹窗的在岗状态识别，兼容状态后带性别、婚姻等说明。 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-weihaihedui.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-weihaihedui.user.js) |
| **SOA.2.1全局发票页面** | 6.13 | 6.13更新测试的 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-quanjufapiao.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-quanjufapiao.user.js) |
| **SOA.2.2订单发票页面** | 1.5 | 仅用于 #/order/invoice 查看页：独立发票列表优化，不影响原合并开票脚本 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-dingdanfapiao.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-dingdanfapiao.user.js) |
| **SOA.2.3首页排序模块** | 4.5 | 4-8列左对齐固定宽度网格 + 可调模块宽度/列间距 + 淡蓝悬浮高亮 + 网格槽位锁定拖拽 + 本地自动保存 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-shouyepaixu.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-shouyepaixu.user.js) |
| **SOA.2.4前台批量模块** | 1.2 | 批量输入预约单号并回车，实时监听Ant Design提示；异常自动记录并跳过，完成后统一汇总 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-qiantaipiliang.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-qiantaipiliang.user.js) |

共收录 **8** 个 Userscript。

<!-- AUTO-USERSCRIPTS:END -->

