// ==UserScript==
// @name        图片预览功能扩展
// @match       https://github.com/*
// @match       https://www.v2ex.com/*
// @run-at      document-idle
// ==/UserScript==

/**
 * 站点匹配规则，按顺序匹配，首个命中即停止
 * match：与 @match 相同的通配符语法，* 匹配任意字符串
 * selectors：需接管图片点击的 CSS 选择器列表
 * 新增站点时在数组头部追加即可
 */
const SITE_RULES = [
  {
    match: "https://github.com/*",
    selectors: [".markdown-body img", ".Box-body img", ".repository-content img"],
  },
  {
    match: "https://www.v2ex.com/*",
    selectors: [".topic_content img", ".reply_content img"],
  },
];

(() => {
  "use strict";

  /** 最小缩放倍率 */
  const MIN_SCALE = 0.2;
  /** 最大缩放倍率 */
  const MAX_SCALE = 8;
  /** 滚轮每档的缩放倍率 */
  const WHEEL_FACTOR = 1.15;
  /** 双击放大时的目标倍率 */
  const DBLCLICK_SCALE = 2.5;
  /** 双击与复位的补间动画时长（毫秒） */
  const TWEEN_DURATION_MS = 200;
  /** 惯性滑动的摩擦时间常数（毫秒），越小停止越快 */
  const INERTIA_TAU_MS = 180;
  /** 估算拖拽速度的回看采样窗口（毫秒） */
  const VELOCITY_WINDOW_MS = 120;
  /** 触发惯性滑动的最小速度（px/ms） */
  const MIN_INERTIA_SPEED = 0.05;
  /** 惯性滑动停止的速度阈值（px/ms） */
  const INERTIA_STOP_SPEED = 0.02;
  /** 区分拖拽与点击的最小位移（px） */
  const DRAG_THRESHOLD_PX = 3;
  /** 允许图片边缘拖出视口外的额外距离（px），避免拖拽正好卡在边缘的"没拖完"感 */
  const OVERDRAG_MARGIN_PX = 120;

  /** 全屏预览遮罩层元素 */
  let viewerOverlay = null;
  /** 全屏预览图片元素 */
  let previewImage = null;

  /** 当前缩放倍率 */
  let currentScale = 1;
  /** 当前水平平移量（px） */
  let translateX = 0;
  /** 当前垂直平移量（px） */
  let translateY = 0;

  /** 是否正在拖拽 */
  let isDragging = false;
  /** 本次按压是否已产生有效拖拽位移 */
  let hasDragMoved = false;
  /** 拖拽起点相对当前平移量的水平偏移 */
  let dragStartX = 0;
  /** 拖拽起点相对当前平移量的垂直偏移 */
  let dragStartY = 0;
  /** 拖拽过程中的光标采样点列表（时间戳 + 坐标），用于释放时估算初速度 */
  let dragSamples = [];

  /** 当前惯性滑动的水平速度（px/ms） */
  let velocityX = 0;
  /** 当前惯性滑动的垂直速度（px/ms） */
  let velocityY = 0;
  /** 惯性动画的 requestAnimationFrame 句柄，0 表示未运行 */
  let inertiaRafId = 0;
  /** 补间动画的 requestAnimationFrame 句柄，0 表示未运行 */
  let tweenRafId = 0;
  /** 是否需要抑制拖拽结束后误触发的遮罩层点击关闭 */
  let shouldSuppressClick = false;

  /**
   * 获取视口（遮罩层）中心点坐标，即世界坐标变换中的基准点 C
   * @returns {{ centerX: number, centerY: number }} 中心点坐标
   */
  function getViewportCenter() {
    return {
      centerX: viewerOverlay.clientWidth / 2,
      centerY: viewerOverlay.clientHeight / 2,
    };
  }

  /**
   * 计算指定缩放倍率下平移量的合法边界，并将给定平移量收敛到边界内
   * 规则：
   * - 图片缩放后超出视口的轴：边缘允许拖出视口外 OVERDRAG_MARGIN_PX 距离后撞墙，
   *   既能看到边缘之外"确实没有内容了"，图片也永远不会被拖丢
   * - 未超出视口的轴：强制居中，缩放回到适配状态时平移量精确归零、不漂移
   * @param {number} targetScale 目标缩放倍率
   * @param {number} offsetX 待收敛的水平平移量
   * @param {number} offsetY 待收敛的垂直平移量
   * @returns {{ offsetX: number, offsetY: number }} 收敛后的平移量
   */
  function getBoundedOffset(targetScale, offsetX, offsetY) {
    const scaledWidth = previewImage.offsetWidth * targetScale;
    const scaledHeight = previewImage.offsetHeight * targetScale;

    const viewportWidth = viewerOverlay.clientWidth;
    const viewportHeight = viewerOverlay.clientHeight;

    // 仅对超出视口的轴外扩超拖边距，未超出的轴保持居中（边界为 0）
    const maxOffsetX =
      scaledWidth > viewportWidth
        ? (scaledWidth - viewportWidth) / 2 + OVERDRAG_MARGIN_PX
        : 0;
    const maxOffsetY =
      scaledHeight > viewportHeight
        ? (scaledHeight - viewportHeight) / 2 + OVERDRAG_MARGIN_PX
        : 0;

    return {
      offsetX: Math.min(maxOffsetX, Math.max(-maxOffsetX, offsetX)),
      offsetY: Math.min(maxOffsetY, Math.max(-maxOffsetY, offsetY)),
    };
  }

  /**
   * 将当前平移量收敛到合法边界内
   * @returns {{ hitAxisX: boolean, hitAxisY: boolean }} 各轴是否触达边界（供惯性滑动清零速度）
   */
  function clampTranslate() {
    const boundedOffset = getBoundedOffset(currentScale, translateX, translateY);

    const hitAxisX = boundedOffset.offsetX !== translateX;
    const hitAxisY = boundedOffset.offsetY !== translateY;

    translateX = boundedOffset.offsetX;
    translateY = boundedOffset.offsetY;

    return { hitAxisX, hitAxisY };
  }

  /**
   * 将当前变换状态写入图片样式
   * 所有运动均由 JS 逐帧驱动，不使用 CSS transition，避免拖拽/滚轮时的滞后抖动
   */
  function updateTransform() {
    previewImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
  }

  /**
   * 根据当前缩放倍率与拖拽状态同步图片的鼠标指针样式
   */
  function syncCursorStyle() {
    if (isDragging) {
      previewImage.style.cursor = "grabbing";
      return;
    }

    previewImage.style.cursor = currentScale > 1 ? "grab" : "zoom-in";
  }

  /**
   * 停止正在进行的惯性滑动
   */
  function cancelInertia() {
    if (!inertiaRafId) return;

    cancelAnimationFrame(inertiaRafId);
    inertiaRafId = 0;
  }

  /**
   * 停止正在进行的补间动画
   */
  function cancelTween() {
    if (!tweenRafId) return;

    cancelAnimationFrame(tweenRafId);
    tweenRafId = 0;
  }

  /**
   * 以屏幕上某点为锚点进行缩放（滚轮缩放的核心）
   * 世界坐标变换模型：屏幕点 P = 视口中心 C + 平移 t + 缩放 s × 图片局部坐标 x
   * 缩放前后保持锚点处的图片内容不动，即 P 与 x 均不变，解得：
   *   t' = k × t + (1 − k) × (P − C)，其中 k = 新倍率 / 旧倍率
   * 该变换是精确可逆的：不触边界时，同一锚点放大再缩小后平移量严格还原
   * @param {number} pointX 锚点屏幕横坐标
   * @param {number} pointY 锚点屏幕纵坐标
   * @param {number} targetScale 目标缩放倍率
   */
  function zoomAtPoint(pointX, pointY, targetScale) {
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, targetScale));
    if (nextScale === currentScale) return;

    const { centerX, centerY } = getViewportCenter();
    const scaleRatio = nextScale / currentScale;

    translateX = scaleRatio * translateX + (1 - scaleRatio) * (pointX - centerX);
    translateY = scaleRatio * translateY + (1 - scaleRatio) * (pointY - centerY);
    currentScale = nextScale;

    clampTranslate();
    updateTransform();
    syncCursorStyle();
  }

  /**
   * 以 easeOutCubic 缓动补间到目标变换状态（用于双击缩放与复位）
   * 补间由 JS 逐帧驱动，状态始终唯一权威，可随时被滚轮/拖拽打断而不跳变
   * @param {number} targetScale 目标缩放倍率
   * @param {number} targetX 目标水平平移量
   * @param {number} targetY 目标垂直平移量
   */
  function tweenToTransform(targetScale, targetX, targetY) {
    cancelTween();
    cancelInertia();

    const fromScale = currentScale;
    const fromX = translateX;
    const fromY = translateY;
    const startTime = performance.now();

    /**
     * 补间动画的逐帧回调
     * @param {number} now 当前帧时间戳
     */
    const stepTween = (now) => {
      const progress = Math.min(1, (now - startTime) / TWEEN_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);

      currentScale = fromScale + (targetScale - fromScale) * eased;
      translateX = fromX + (targetX - fromX) * eased;
      translateY = fromY + (targetY - fromY) * eased;

      clampTranslate();
      updateTransform();

      if (progress < 1) {
        tweenRafId = requestAnimationFrame(stepTween);
        return;
      }

      tweenRafId = 0;
      syncCursorStyle();
    };

    tweenRafId = requestAnimationFrame(stepTween);
  }

  /**
   * 以当前速度启动惯性滑动：每帧按指数衰减摩擦减速，触达边界时清零对应轴速度
   */
  function startInertia() {
    cancelInertia();

    let lastFrameTime = performance.now();

    /**
     * 惯性滑动的逐帧回调
     * @param {number} now 当前帧时间戳
     */
    const stepInertia = (now) => {
      const deltaMs = Math.min(64, now - lastFrameTime);
      lastFrameTime = now;

      translateX += velocityX * deltaMs;
      translateY += velocityY * deltaMs;

      const frictionDecay = Math.exp(-deltaMs / INERTIA_TAU_MS);
      velocityX *= frictionDecay;
      velocityY *= frictionDecay;

      const { hitAxisX, hitAxisY } = clampTranslate();
      if (hitAxisX) velocityX = 0;
      if (hitAxisY) velocityY = 0;

      updateTransform();

      if (Math.hypot(velocityX, velocityY) > INERTIA_STOP_SPEED) {
        inertiaRafId = requestAnimationFrame(stepInertia);
        return;
      }

      inertiaRafId = 0;
    };

    inertiaRafId = requestAnimationFrame(stepInertia);
  }

  /**
   * 立即复位到初始变换状态（适配居中），并停止所有进行中的动画
   */
  function resetTransform() {
    cancelTween();
    cancelInertia();

    currentScale = 1;
    translateX = 0;
    translateY = 0;

    updateTransform();
    syncCursorStyle();
  }

  /**
   * 处理遮罩层滚轮缩放：光标在图片上时以光标位置为锚点，否则以视口中心为锚点
   * @param {WheelEvent} event 滚轮事件
   */
  function handleOverlayWheel(event) {
    event.preventDefault();

    cancelTween();
    cancelInertia();

    const imageRect = previewImage.getBoundingClientRect();
    const isCursorOnImage =
      event.clientX >= imageRect.left &&
      event.clientX <= imageRect.right &&
      event.clientY >= imageRect.top &&
      event.clientY <= imageRect.bottom;

    const { centerX, centerY } = getViewportCenter();
    const anchorX = isCursorOnImage ? event.clientX : centerX;
    const anchorY = isCursorOnImage ? event.clientY : centerY;

    const zoomFactor = event.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR;
    zoomAtPoint(anchorX, anchorY, currentScale * zoomFactor);
  }

  /**
   * 处理图片双击：未放大时以双击点为锚点放大，已放大时补间复位到适配状态
   * @param {MouseEvent} event 鼠标事件
   */
  function handleImageDblclick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (currentScale > 1) {
      tweenToTransform(1, 0, 0);
      return;
    }

    const { centerX, centerY } = getViewportCenter();
    const scaleRatio = DBLCLICK_SCALE / currentScale;

    // 与滚轮缩放使用同一锚点公式算出目标平移量，再收敛到合法边界后作为补间终点
    const rawTargetX = scaleRatio * translateX + (1 - scaleRatio) * (event.clientX - centerX);
    const rawTargetY = scaleRatio * translateY + (1 - scaleRatio) * (event.clientY - centerY);
    const boundedTarget = getBoundedOffset(DBLCLICK_SCALE, rawTargetX, rawTargetY);

    tweenToTransform(DBLCLICK_SCALE, boundedTarget.offsetX, boundedTarget.offsetY);
  }

  /**
   * 处理图片按下：仅在已放大时允许拖拽，并初始化拖拽与速度采样状态
   * @param {MouseEvent} event 鼠标事件
   */
  function handleImageMousedown(event) {
    if (event.button !== 0 || currentScale <= 1) return;

    cancelTween();
    cancelInertia();

    isDragging = true;
    hasDragMoved = false;
    dragStartX = event.clientX - translateX;
    dragStartY = event.clientY - translateY;
    dragSamples = [{ time: event.timeStamp, x: event.clientX, y: event.clientY }];

    syncCursorStyle();

    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * 处理拖拽移动：逐帧直接更新平移量并收敛边界，同时记录速度采样点
   * @param {MouseEvent} event 鼠标事件
   */
  function handleWindowMousemove(event) {
    if (!isDragging) return;

    const nextX = event.clientX - dragStartX;
    const nextY = event.clientY - dragStartY;

    // 小于阈值的位移视为点击抖动，忽略以避免误拖拽
    if (!hasDragMoved) {
      const movedDistance = Math.hypot(nextX - translateX, nextY - translateY);
      if (movedDistance < DRAG_THRESHOLD_PX) return;

      hasDragMoved = true;
    }

    translateX = nextX;
    translateY = nextY;

    clampTranslate();

    // 钳制后重新锚定拖拽起点：把被边界吃掉的位移回吐给锚点，
    // 否则撞边界后继续拖动的距离会被记录为偏差，反向拖动时要先走完这段"死区"图片才会动
    dragStartX = event.clientX - translateX;
    dragStartY = event.clientY - translateY;

    updateTransform();

    // 记录采样点并裁剪到速度窗口内，供释放时估算惯性初速度
    dragSamples.push({ time: event.timeStamp, x: event.clientX, y: event.clientY });
    while (dragSamples.length > 2 && event.timeStamp - dragSamples[0].time > VELOCITY_WINDOW_MS) {
      dragSamples.shift();
    }
  }

  /**
   * 处理拖拽释放：由速度窗口内的采样点估算初速度，满足阈值则启动惯性滑动
   * @param {MouseEvent} event 鼠标事件
   */
  function handleWindowMouseup(event) {
    if (!isDragging) return;

    isDragging = false;
    syncCursorStyle();

    if (!hasDragMoved) {
      dragSamples = [];
      return;
    }

    // 拖拽后释放会在遮罩层上补发一次 click，需要抑制以免误关闭预览
    shouldSuppressClick = true;

    const recentSamples = dragSamples.filter(
      (sample) => event.timeStamp - sample.time <= VELOCITY_WINDOW_MS
    );
    dragSamples = [];

    if (recentSamples.length < 2) return;

    const firstSample = recentSamples[0];
    const lastSample = recentSamples[recentSamples.length - 1];
    const deltaMs = lastSample.time - firstSample.time;

    if (deltaMs <= 0) return;

    velocityX = (lastSample.x - firstSample.x) / deltaMs;
    velocityY = (lastSample.y - firstSample.y) / deltaMs;

    if (Math.hypot(velocityX, velocityY) < MIN_INERTIA_SPEED) return;

    startInertia();
  }

  /**
   * 处理遮罩层点击：点击空白处关闭预览，拖拽结束后的残余点击直接吞掉
   * @param {MouseEvent} event 鼠标事件
   */
  function handleOverlayClick(event) {
    if (shouldSuppressClick) {
      shouldSuppressClick = false;
      return;
    }

    if (event.target === viewerOverlay) {
      hideViewer();
    }
  }

  /**
   * 处理键盘按键：Escape 关闭预览，0 补间复位到适配状态
   * @param {KeyboardEvent} event 键盘事件
   */
  function handleDocumentKeydown(event) {
    if (viewerOverlay.style.display === "none") return;

    if (event.key === "Escape") {
      hideViewer();
      return;
    }

    if (event.key === "0") {
      tweenToTransform(1, 0, 0);
    }
  }

  /**
   * 处理窗口尺寸变化：重新收敛平移量，保证图片仍处于可见区域内
   */
  function handleWindowResize() {
    if (viewerOverlay.style.display === "none") return;

    clampTranslate();
    updateTransform();
  }

  /**
   * 创建全屏预览的遮罩层与图片元素，并挂载全部交互事件（仅创建一次）
   */
  function createViewer() {
    if (viewerOverlay) return;

    viewerOverlay = document.createElement("div");
    viewerOverlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: none;
      justify-content: center;
      align-items: center;
      background: rgba(0,0,0,.9);
      backdrop-filter: blur(2px);
      cursor: zoom-out;
      overflow: hidden;
      user-select: none;
    `;

    previewImage = document.createElement("img");
    previewImage.draggable = false;
    previewImage.style.cssText = `
      max-width: 90vw;
      max-height: 90vh;
      transform-origin: center center;
      will-change: transform;
      cursor: zoom-in;
    `;

    viewerOverlay.appendChild(previewImage);
    document.body.appendChild(viewerOverlay);

    viewerOverlay.addEventListener("click", handleOverlayClick);
    viewerOverlay.addEventListener("wheel", handleOverlayWheel, { passive: false });
    previewImage.addEventListener("dblclick", handleImageDblclick);
    previewImage.addEventListener("mousedown", handleImageMousedown);
    window.addEventListener("mousemove", handleWindowMousemove);
    window.addEventListener("mouseup", handleWindowMouseup);
    window.addEventListener("resize", handleWindowResize);
    document.addEventListener("keydown", handleDocumentKeydown);
  }

  /**
   * 打开全屏预览并加载指定图片
   * @param {string} imageSrc 图片地址
   */
  function showViewer(imageSrc) {
    createViewer();

    previewImage.src = imageSrc;
    resetTransform();

    viewerOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  /**
   * 关闭全屏预览并复位变换状态
   */
  function hideViewer() {
    if (!viewerOverlay) return;

    viewerOverlay.style.display = "none";
    document.body.style.overflow = "";

    resetTransform();
  }

  /**
   * 获取当前页面匹配的站点规则，按 SITE_RULES 顺序返回首个命中
   * match 字段使用 @match 风格通配符（* 匹配任意字符串）
   * @returns {{ match: string, selectors: string[] } | null}
   */
  function getCurrentRule() {
    for (const rule of SITE_RULES) {
      const escaped = rule.match.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      const regexStr = escaped.replace(/\*/g, ".*");
      if (new RegExp("^" + regexStr + "$").test(location.href)) {
        return rule;
      }
    }
    return null;
  }

  /**
   * 接管页面图片点击：根据站点规则匹配目标图片，普通左键点击全屏预览
   * 修饰键或非左键按下时不拦截，走浏览器默认行为
   * @param {MouseEvent} event 鼠标事件
   */
  function handleDocumentClick(event) {
    const rule = getCurrentRule();
    if (!rule) return;

    const selectorStr = rule.selectors.join(",");
    const targetImage = event.target.closest(selectorStr);
    if (!targetImage) return;

    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const imageSrc = targetImage.currentSrc || targetImage.src || targetImage.getAttribute("src");

    if (!imageSrc) return;

    showViewer(imageSrc);
  }

  document.addEventListener("click", handleDocumentClick, true);
})();
