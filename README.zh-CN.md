# Awesome Browser User Scripts

[English](./README.md) | **简体中文**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/davidchen27/awesome-browser-user-scripts)](https://github.com/davidchen27/awesome-browser-user-scripts/commits)

一组实用的浏览器用户脚本合集，配合 [oh-my-browser-script](https://github.com/davidchen27/oh-my-browser-script) 使用 —— 这是一个类油猴（Tampermonkey）的用户脚本管理与注入浏览器扩展。

## 脚本列表

| 脚本 | 功能 | 生效站点 |
| --- | --- | --- |
| [back-to-top.user.js](./back-to-top.user.js) | 悬浮"回到顶部"按钮，平滑滚动 | V2EX、YouTube、GitHub |
| [github-readme-image-viewer.user.js](./github-readme-image-viewer.user.js) | GitHub README / Markdown 区域图片全屏预览 | GitHub |

### back-to-top.user.js —— 一键回到顶部（优化版）

- 页面向下滚动超过 300px 后，悬浮圆形按钮淡入显示
- 点击平滑滚动回页面顶部
- 毛玻璃质感样式，带悬停反馈动效
- 滚动监听经 `requestAnimationFrame` 节流，性能更优

### github-readme-image-viewer.user.js —— GitHub README 图片全屏预览

- 点击 README / Markdown 区域内的任意图片，打开全屏预览
- 滚轮缩放（0.2x – 8x），以光标位置为锚点精确缩放
- 双击放大，再次双击（或按 `0`）复位
- 放大后可拖拽平移，带惯性滑动与柔和边界约束
- 按 `Esc` 或点击遮罩空白处关闭预览
- `Ctrl/Cmd + 点击` 在当前标签页打开原始图片地址

## 安装使用

1. 安装 [oh-my-browser-script](https://github.com/davidchen27/oh-my-browser-script) 浏览器扩展，并将本仓库中的 `.user.js` 脚本添加到扩展中（具体添加方式见扩展的文档）。
2. 访问脚本 `@match` 规则匹配的站点，脚本会自动运行。

> 这些脚本遵循标准 `.user.js` 格式，因此理论上也可在 Tampermonkey、Violentmonkey 等其他用户脚本管理器中使用。

## 贡献

欢迎提交 Issue 和 Pull Request。如果有新脚本的想法，建议先开 Issue 讨论。

## 许可证

[MIT License](./LICENSE) © [davidchen27](https://github.com/davidchen27)
