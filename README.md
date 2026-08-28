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

> 暂无自动生成的脚本清单。运行发布 Workflow 后会自动更新。

<!-- AUTO-USERSCRIPTS:END -->

## 说明

- `publish/` 中的文件是正式安装与自动更新入口，请不要手工修改。
- 实际开发请修改仓库中的源 `.user.js` 文件。
- `@publishGroup` 和 `@publishID` 决定脚本的永久发布地址，正式发布后请尽量不要修改。
- 部分脚本仅适用于特定网站或内部业务页面，请根据脚本说明使用。
