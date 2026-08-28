# WanXin Userscripts

个人维护的浏览器 Userscript 脚本合集，主要用于网页功能增强和日常操作自动化。

## 使用方法

1. 先安装 **Tampermonkey（篡改猴）**。
2. 在下方“脚本列表”中找到需要的脚本。
3. 点击 **GitCode 安装**；如果 GitCode 无法正常打开，可使用 **GitHub 备用**。
4. 浏览器会跳转到 Tampermonkey 安装页面，点击 **安装** 即可。
5. 已安装脚本会根据脚本内的更新地址自动检查新版。

### Tampermonkey 下载

- [Tampermonkey 官方网站](https://www.tampermonkey.net/)
- [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
- [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/)

> 建议优先通过浏览器官方扩展商店安装 Tampermonkey。Tampermonkey 官方提供 Chrome、Edge、Firefox、Safari、Opera 等浏览器版本。

## 脚本列表

下面的列表由 GitHub Actions 根据 `publish/` 中的正式发布脚本自动生成。

<!-- AUTO-USERSCRIPTS:START -->

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

共收录 **8** 个脚本。

<!-- AUTO-USERSCRIPTS:END -->

## 说明

- `publish/` 中的文件是正式安装与自动更新入口，请不要手工修改。
- 实际开发请修改仓库中的源 `.user.js` 文件。
- `@publishGroup` 和 `@publishID` 决定脚本的永久发布地址，正式发布后请尽量不要修改。
- 部分脚本仅适用于特定网站或内部业务页面，请根据脚本说明使用。
