# WanXin Userscripts

个人维护的浏览器 Userscript 脚本合集，主要用于网页功能增强和日常操作自动化。

## 使用方法

1. 先安装 **Tampermonkey（篡改猴）**。
2. 在下方“脚本列表”中找到需要的脚本。
3. 点击 **GitCode 安装**；如果 GitCode 无法正常打开，可使用 **GitHub 备用**。
4. 浏览器会进入 Tampermonkey 安装页面，点击 **安装** 即可。
5. 已安装脚本会根据脚本内的更新地址自动检查新版。

### Tampermonkey 下载

- [Tampermonkey 官方网站](https://www.tampermonkey.net/)
- [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
- [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/)

> 建议优先通过浏览器官方扩展商店安装 Tampermonkey。

## 脚本列表

下面的列表由 GitHub Actions 根据正式发布脚本自动生成。

<!-- AUTO-USERSCRIPTS:START -->

### SOA相关

| 脚本 | 版本 | 说明 | GitCode 安装 | GitHub 备用 |
|---|---:|---|---|---|
| **SOA.1.1蝶美-单位信息填充** | 7.7.24 | 自动填充单位信息，支持地区、行业、经济类型、单位类型、社会信用代码、企业规模、职工人数、接害人数等字段。 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-danweixinxi.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-danweixinxi.user.js) |
| **SOA.1.2蝶美-套餐危害核对** | 4.2.15 | 增强“套餐危害核对”功能，提供自动化核对、批量处理、用户自定义别名和忽略列表等功能。 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-weihaihedui.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-weihaihedui.user.js) |
| **SOA.2.1全局发票页面** | 6.14 | 优化SOA发票页面的表格布局、文案显示和复制功能，支持动态加载内容的处理。 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-quanjufapiao.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-quanjufapiao.user.js) |
| **SOA.2.2订单发票页面** | 1.6 | SOA订单发票列表页面增强：列重排、宽度调整、文案替换、复制优化。 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-dingdanfapiao.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-dingdanfapiao.user.js) |
| **SOA.2.3首页排序模块** | 4.6 | SOA首页模块排序，支持拖拽排序、保存顺序、恢复默认顺序、设置每行显示列数、设置模块宽度、设置列间距。 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-shouyepaixu.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-shouyepaixu.user.js) |
| **SOA.2.4前台批量模块** | 1.12 | 批量预约单号；支持SPA常驻、14位预约单号智能提取、可调宽度窗口及自动避让定位。 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-qiantaipiliang.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/soaxg/soa-qiantaipiliang.user.js) |

### 红领巾的游戏脚本

| 脚本 | 版本 | 说明 | GitCode 安装 | GitHub 备用 |
|---|---:|---|---|---|
| **CurseForge增强** | 4.2 | 增强CurseForge网站的中文显示，翻译部分英文为中文，支持动态加载内容的翻译。 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/hljdyxjb/game-curseforge.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/hljdyxjb/game-curseforge.user.js) |
| **GOW底下尖塔** | 4.2.25 | GOW底下尖塔火把管理与节点同步工具 | [安装](https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/hljdyxjb/game-gowdxjt.user.js) | [备用](https://raw.githubusercontent.com/xinxinenjoy/wanxin-userscripts/main/publish/hljdyxjb/game-gowdxjt.user.js) |

共收录 **8** 个脚本。

<!-- AUTO-USERSCRIPTS:END -->

## 说明

- 实际开发请修改业务目录中的源 `.user.js` 文件。
- `publish/` 是 Workflow 自动生成的正式发布目录，请不要手工修改。
- `@publishGroup` 只用于稳定发布路径。
- `@publishID` 是脚本的唯一身份标识，正式发布后请尽量不要修改。
- README 中的分类名称使用源脚本所在的原始一级目录名称。
