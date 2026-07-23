# Awesome Browser User Scripts

**English** | [简体中文](./README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/davidchen27/awesome-browser-user-scripts)](https://github.com/davidchen27/awesome-browser-user-scripts/commits)

A curated collection of practical browser user scripts, designed to work with [page-tattoo](https://github.com/davidchen27/page-tattoo) — a Tampermonkey-style browser extension for managing and injecting user scripts.

## Scripts

| Script | Description | Applies to |
| --- | --- | --- |
| [back-to-top.user.js](./back-to-top.user.js) | Floating "back to top" button with smooth scrolling | V2EX, YouTube, GitHub |
| [github-readme-image-viewer.user.js](./github-readme-image-viewer.user.js) | Fullscreen preview for images in GitHub README/markdown areas | GitHub |

### back-to-top.user.js — Back to Top (Optimized)

- Floating circular button that fades in after scrolling down 300px
- One-click smooth scroll back to the top
- Frosted-glass style with subtle hover feedback
- Scroll listener throttled via `requestAnimationFrame` for better performance

### github-readme-image-viewer.user.js — GitHub README Image Viewer

- Click any image in README / markdown areas to open a fullscreen viewer
- Mouse wheel zoom (0.2x – 8x) anchored precisely at the cursor position
- Double-click to zoom in; double-click again (or press `0`) to reset
- Drag to pan when zoomed in, with inertia and soft edge boundaries
- `Esc` or clicking the backdrop closes the viewer
- `Ctrl/Cmd + Click` opens the original image URL in the current tab

## Installation

1. Install the [page-tattoo](https://github.com/davidchen27/page-tattoo) browser extension, and add the `.user.js` files from this repository to it (see the extension's documentation for how to add scripts).
2. Visit a site matched by a script's `@match` rules — the script runs automatically.

> These scripts follow the standard `.user.js` format, so they should also work with other user script managers such as Tampermonkey or Violentmonkey.

## Contributing

Issues and pull requests are welcome. If you have an idea for a new script, feel free to open an issue to discuss it first.

## Disclaimer

- All scripts in this repository are for **learning and technical research purposes only**. Do not use them for any commercial or unlawful purpose.
- The scripts are not affiliated with, sponsored by, or officially endorsed by the websites they run on; all site names and trademarks belong to their respective owners.
- If any content in this repository infringes your rights, please [open an issue](https://github.com/davidchen27/awesome-browser-user-scripts/issues) to contact the author, and it will be removed as soon as possible once verified.
- Use the scripts at your own risk; the author assumes no liability for any consequences arising from their use.

## License

[MIT License](./LICENSE) © [davidchen27](https://github.com/davidchen27)
