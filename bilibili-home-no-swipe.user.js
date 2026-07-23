// ==UserScript==
// @name        移除Bilibili首页活动轮播板块
// @match       https://www.bilibili.com/
// @match       https://www.bilibili.com/?*
// @run-at      document-start
// ==/UserScript==

(() => {
  "use strict";

  const SELECTOR = ".container > .recommended-swipe";

  // 提前注入样式，避免元素出现后再消失
  const style = document.createElement("style");
  style.textContent = `
    ${SELECTOR} {
      display: none !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);

  // 顺便从 DOM 中移除，保持页面结构干净
  const remove = () => {
    document.querySelector(SELECTOR)?.remove();
  };

  remove();

  new MutationObserver(remove).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();