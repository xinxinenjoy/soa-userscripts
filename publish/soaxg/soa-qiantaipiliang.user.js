// ==UserScript==
// @name         SOA.2.4前台批量模块
// @namespace    https://tampermonkey.net/
// @version      1.3
// @description  批量预约单号，自动提交并等待结果，支持异常记录和跳过。

// @match        *://checkup-register.health-100.cn/group/register*
// @grant        none
// @run-at       document-idle

// @author       WanXin
// @publishGroup soaxg
// @publishID    soa-qiantaipiliang
// @updateURL    https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-qiantaipiliang.user.js
// @downloadURL  https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-qiantaipiliang.user.js
// ==/UserScript==

/*
 * 更新记录
 *
 * v1.2  -  2026-8-29
 * - 更新：测试版本
 *
 */

(function () {
  "use strict";

  /* =========================================================
   * 1. 配置
   * ========================================================= */

  const CONFIG = {
    INPUT_SELECTOR: "#vid",
    LIST_SELECTOR: ".appointment-card .ant-table-tbody",
    BUTTON_POS_KEY: "__soa_batch_booking_button_pos_v11",

    // 单次提交后等待预约号出现在“预约列表”的最长时间
    RESULT_TIMEOUT: 4000,

    // 轮询列表间隔
    POLL_INTERVAL: 150,

    // 第一次未确认成功时，自动再尝试 1 次
    MAX_ATTEMPTS: 2,

    // 一条确认成功后，处理下一条前的短暂间隔
    BETWEEN_ITEMS: 300,

    // 重试前等待
    RETRY_DELAY: 300
  };

  const IDS = {
    button: "__soa_batch_fill_btn",
    mask: "__soa_batch_fill_mask",
    panel: "__soa_batch_fill_panel",
    textarea: "__soa_batch_fill_textarea",
    count: "__soa_batch_fill_count",
    progress: "__soa_batch_fill_progress",
    status: "__soa_batch_fill_status",
    log: "__soa_batch_fill_log",
    summaryWrap: "__soa_batch_fill_summary_wrap",
    summary: "__soa_batch_fill_summary",
    start: "__soa_batch_fill_start",
    pause: "__soa_batch_fill_pause",
    stop: "__soa_batch_fill_stop",
    skip: "__soa_batch_fill_skip",
    close: "__soa_batch_fill_close",
    style: "__soa_batch_fill_style"
  };

  /* =========================================================
   * 2. 运行状态
   * ========================================================= */

  const state = {
    running: false,
    paused: false,

    token: 0,

    codes: [],
    index: 0,

    success: 0,
    skipped: 0,
    errors: 0,

    currentCode: "",
    lastError: "",

    // 异常汇总：[{ code, message }]
    anomalies: [],

    // Ant Design 顶部消息实时缓存
    messageSeq: 0,
    messageHistory: []
  };

  /* =========================================================
   * 3. 基础工具
   * ========================================================= */

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/\s+/g, "")
      .trim()
      .toUpperCase();
  }

  function isVisible(el) {
    if (!el) return false;

    const style = getComputedStyle(el);

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    const rect = el.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  }

  function getInput() {
    return document.querySelector(CONFIG.INPUT_SELECTOR);
  }

  function inputUsable() {
    const input = getInput();

    return Boolean(
      input &&
      !input.disabled &&
      !input.readOnly &&
      isVisible(input)
    );
  }

  function setNativeInputValue(input, value) {
    if (!input) return;

    const setter =
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;

    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );

    input.dispatchEvent(
      new Event("change", {
        bubbles: true
      })
    );
  }

  function dispatchEnter(input) {
    if (!input) return;

    const options = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      charCode: 13,
      bubbles: true,
      cancelable: true
    };

    input.dispatchEvent(
      new KeyboardEvent("keydown", options)
    );

    input.dispatchEvent(
      new KeyboardEvent("keypress", options)
    );

    input.dispatchEvent(
      new KeyboardEvent("keyup", options)
    );
  }

  /* =========================================================
   * 4. 预约列表检查
   * ========================================================= */

  function getAppointmentRows() {
    const body =
      document.querySelector(
        CONFIG.LIST_SELECTOR
      );

    if (!body) return [];

    return Array.from(
      body.querySelectorAll("tr")
    ).filter(row => {
      if (
        row.classList.contains(
          "ant-table-measure-row"
        )
      ) {
        return false;
      }

      if (
        row.classList.contains(
          "ant-table-placeholder"
        )
      ) {
        return false;
      }

      return row.querySelectorAll("td").length > 0;
    });
  }

  function getAppointmentRowCount() {
    return getAppointmentRows().length;
  }

  function codeExistsInList(code) {
    const target = normalizeText(code);

    if (!target) return false;

    const rows = getAppointmentRows();

    return rows.some(row => {
      const cells =
        Array.from(
          row.querySelectorAll("td")
        );

      // 优先逐单元格精确匹配
      const exactMatch =
        cells.some(cell =>
          normalizeText(
            cell.textContent
          ) === target
        );

      if (exactMatch) {
        return true;
      }

      // 兼容表格内部存在额外标签或空格
      const rowText =
        normalizeText(
          row.textContent
        );

      return rowText.includes(target);
    });
  }

  /* =========================================================
   * 5. 页面错误 / 网络状态检查
   * ========================================================= */

  function cleanMessageText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isSuccessMessage(text) {
    return /成功|已加入|添加完成|操作完成|处理完成/i.test(
      cleanMessageText(text)
    );
  }

  function recordAntMessage(text) {
    const clean =
      cleanMessageText(text);

    if (!clean) return;

    // 同一条提示被 MutationObserver 多次触发时去重
    const last =
      state.messageHistory[
        state.messageHistory.length - 1
      ];

    if (
      last &&
      last.text === clean &&
      Date.now() - last.time < 1200
    ) {
      return;
    }

    state.messageSeq++;

    state.messageHistory.push({
      seq: state.messageSeq,
      text: clean,
      time: Date.now()
    });

    // 避免长期使用后无限增长
    if (
      state.messageHistory.length > 200
    ) {
      state.messageHistory.splice(
        0,
        state.messageHistory.length - 200
      );
    }

    console.log(
      "[SOA批量预约] 捕获页面提示：",
      clean
    );
  }

  function scanAntMessageContainer() {
    const root =
      document.querySelector(
        ".ant-message"
      );

    if (!root) return;

    const selectors = [
      ".ant-message-notice-content",
      ".ant-message-custom-content",
      ".ant-message-notice"
    ];

    const nodes =
      root.querySelectorAll(
        selectors.join(",")
      );

    nodes.forEach(node => {
      const text =
        cleanMessageText(
          node.textContent
        );

      if (text) {
        recordAntMessage(text);
      }
    });

    // 兼容某些版本只在 .ant-message > div 内直接写文本
    if (!nodes.length) {
      Array.from(root.children).forEach(child => {
        const text =
          cleanMessageText(
            child.textContent
          );

        if (text) {
          recordAntMessage(text);
        }
      });
    }
  }

  function initAntMessageObserver() {
    // 页面消息容器有时在脚本加载后才生成，所以直接观察 body
    const observer =
      new MutationObserver(mutations => {
        let related = false;

        for (const mutation of mutations) {
          const target =
            mutation.target;

          if (
            target instanceof Element &&
            (
              target.matches?.(".ant-message") ||
              target.closest?.(".ant-message")
            )
          ) {
            related = true;
            break;
          }

          for (
            const node of mutation.addedNodes
          ) {
            if (
              node instanceof Element &&
              (
                node.matches?.(".ant-message") ||
                node.closest?.(".ant-message") ||
                node.querySelector?.(".ant-message")
              )
            ) {
              related = true;
              break;
            }
          }

          if (related) break;
        }

        if (related) {
          scanAntMessageContainer();
        }
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
        characterData: true
      }
    );

    // 如果当前已经存在提示，也先扫一次
    scanAntMessageContainer();
  }

  function getMessageSeq() {
    return state.messageSeq;
  }

  function getNewAntMessageSince(seq) {
    const items =
      state.messageHistory.filter(
        item => item.seq > seq
      );

    if (!items.length) {
      return "";
    }

    // 成功提示不作为异常。
    // 其余新出现的页面提示都优先返回，
    // 不再依赖固定“错误关键词”，避免漏掉业务提示。
    for (const item of items) {
      if (!isSuccessMessage(item.text)) {
        return item.text;
      }
    }

    return "";
  }

  function networkLooksOffline() {
    return navigator.onLine === false;
  }

  /* =========================================================
   * 6. 提交后的结果等待
   * ========================================================= */

  async function waitForResult(
    code,
    baselineSeq,
    token
  ) {
    const start = Date.now();

    while (
      Date.now() - start <
      CONFIG.RESULT_TIMEOUT
    ) {
      if (
        token !== state.token ||
        !state.running
      ) {
        return {
          type: "aborted"
        };
      }

      if (codeExistsInList(code)) {
        return {
          type: "success"
        };
      }

      const antMessage =
        getNewAntMessageSince(
          baselineSeq
        );

      if (antMessage) {
        // 页面已经明确给出业务提示时，
        // 直接记录该提示，不再傻等完整超时时间。
        return {
          type: "page_error",
          message: antMessage
        };
      }

      if (networkLooksOffline()) {
        return {
          type: "network_error",
          message: "浏览器当前处于离线状态"
        };
      }

      // 页面结构突然变化，例如跳转、刷新失败
      if (!document.querySelector(CONFIG.INPUT_SELECTOR)) {
        return {
          type: "page_error",
          message: "预约单号输入框已不存在，页面状态可能发生变化"
        };
      }

      await sleep(
        CONFIG.POLL_INTERVAL
      );
    }

    // 最后再确认一次
    if (codeExistsInList(code)) {
      return {
        type: "success"
      };
    }

    return {
      type: "timeout",
      message:
        `等待 ${CONFIG.RESULT_TIMEOUT / 1000} 秒后，` +
        "仍未在预约列表中确认到该号码"
    };
  }

  /* =========================================================
   * 7. 单号码提交
   * ========================================================= */

  async function submitOneCode(
    code,
    token
  ) {
    // 已经存在时不再重复发送
    if (codeExistsInList(code)) {
      return {
        type: "existing"
      };
    }

    for (
      let attempt = 1;
      attempt <= CONFIG.MAX_ATTEMPTS;
      attempt++
    ) {
      if (
        token !== state.token ||
        !state.running
      ) {
        return {
          type: "aborted"
        };
      }

      if (networkLooksOffline()) {
        return {
          type: "network_error",
          message: "浏览器当前处于离线状态"
        };
      }

      const input = getInput();

      if (!inputUsable()) {
        return {
          type: "page_error",
          message:
            "未找到可用的预约单号输入框 #vid"
        };
      }

      // 重试前再次确认，防止第一次其实已经成功，只是列表刷新稍慢
      if (codeExistsInList(code)) {
        return {
          type: "success"
        };
      }

      const baselineSeq =
        getMessageSeq();

      setNativeInputValue(
        input,
        ""
      );

      await sleep(60);

      setNativeInputValue(
        input,
        code
      );

      input.focus();

      await sleep(80);

      appendLog(
        "info",
        `${code}：发送回车` +
        (
          attempt > 1
            ? `（第 ${attempt} 次尝试）`
            : ""
        )
      );

      dispatchEnter(input);

      const result =
        await waitForResult(
          code,
          baselineSeq,
          token
        );

      if (
        result.type === "success"
      ) {
        return result;
      }

      if (
        result.type === "aborted"
      ) {
        return result;
      }

      // 页面明确报错时不立即重复轰炸。
      // 交给主循环暂停，让用户决定重试或跳过。
      if (
        result.type === "page_error" &&
        result.message
      ) {
        return result;
      }

      if (
        attempt <
        CONFIG.MAX_ATTEMPTS
      ) {
        appendLog(
          "warn",
          `${code}：本次未确认成功，${CONFIG.RETRY_DELAY / 1000} 秒后自动重试`
        );

        await sleep(
          CONFIG.RETRY_DELAY
        );
      } else {
        return result;
      }
    }

    return {
      type: "timeout",
      message: "未能确认操作结果"
    };
  }

  /* =========================================================
   * 8. 批量运行主循环
   * ========================================================= */

  async function waitWhilePaused(
    token
  ) {
    while (
      state.running &&
      state.paused &&
      token === state.token
    ) {
      await sleep(120);
    }
  }

  async function runBatch() {
    const token = ++state.token;

    updateUI();

    appendLog(
      "info",
      `开始处理，共 ${state.codes.length} 个预约单号`
    );

    while (
      state.running &&
      state.index < state.codes.length &&
      token === state.token
    ) {
      await waitWhilePaused(token);

      if (
        !state.running ||
        token !== state.token
      ) {
        break;
      }

      const code =
        state.codes[state.index];

      state.currentCode = code;
      state.lastError = "";
      state.awaitingDecision = false;
      state.skipRequested = false;

      updateUI();

      if (codeExistsInList(code)) {
        state.skipped++;

        appendLog(
          "skip",
          `${code}：预约列表中已存在，自动跳过`
        );

        state.index++;
        updateUI();

        await sleep(
          CONFIG.BETWEEN_ITEMS
        );

        continue;
      }

      const result =
        await submitOneCode(
          code,
          token
        );

      if (
        result.type === "aborted"
      ) {
        break;
      }

      if (
        result.type === "success"
      ) {
        state.success++;

        appendLog(
          "success",
          `${code}：已确认加入预约列表`
        );

        state.index++;
        state.currentCode = "";

        updateUI();

        await sleep(
          CONFIG.BETWEEN_ITEMS
        );

        continue;
      }

      if (
        result.type === "existing"
      ) {
        state.skipped++;

        appendLog(
          "skip",
          `${code}：预约列表中已存在，自动跳过`
        );

        state.index++;
        state.currentCode = "";

        updateUI();

        continue;
      }

      /* ---------- 异常：记录并继续下一条 ---------- */

      state.errors++;

      state.lastError =
        String(
          result.message ||
          "未能确认操作是否生效"
        ).trim();

      state.anomalies.push({
        code,
        message: state.lastError
      });

      appendLog(
        "error",
        `${code}：${state.lastError}。已记录异常并继续下一条`
      );

      state.index++;
      state.currentCode = "";

      updateUI();

      await sleep(
        CONFIG.BETWEEN_ITEMS
      );

      continue;
    }

    if (
      token !== state.token
    ) {
      return;
    }

    if (
      state.index >=
      state.codes.length
    ) {
      state.running = false;
      state.paused = false;
      state.currentCode = "";
      state.awaitingDecision = false;

      appendLog(
        "success",
        `全部处理完成：成功 ${state.success}，跳过 ${state.skipped}，异常 ${state.errors}`
      );

      renderAnomalySummary();

      setStatus(
        state.errors
          ? `完成，存在 ${state.errors} 条异常`
          : "完成",
        state.errors
          ? "warn"
          : "success"
      );
    } else if (!state.running) {
      setStatus(
        "已停止",
        "warn"
      );
    }

    updateUI();
  }

  /* =========================================================
   * 9. 输入解析
   * ========================================================= */

  function parseCodes(text) {
    const raw =
      String(text || "")
        .split(/\r?\n/)
        .map(v => v.trim())
        .filter(Boolean);

    // 保持原顺序去重
    const seen = new Set();
    const result = [];

    for (const code of raw) {
      if (seen.has(code)) {
        continue;
      }

      seen.add(code);
      result.push(code);
    }

    return result;
  }

  function renderAnomalySummary() {
    const wrap =
      document.getElementById(
        IDS.summaryWrap
      );

    const textarea =
      document.getElementById(
        IDS.summary
      );

    if (!wrap || !textarea) {
      return;
    }

    if (!state.anomalies.length) {
      wrap.style.display = "none";
      textarea.value = "";
      return;
    }

    const lines =
      state.anomalies.map(item => {
        const message =
          String(item.message || "")
            .replace(/\s+/g, " ")
            .trim();

        return `${item.code} ${message}`;
      });

    textarea.value =
      lines.join("\n");

    wrap.style.display =
      "block";
  }

  /* =========================================================
   * 10. UI 日志与状态
   * ========================================================= */

  function appendLog(
    type,
    text
  ) {
    const log =
      document.getElementById(
        IDS.log
      );

    if (!log) return;

    const line =
      document.createElement("div");

    line.className =
      `__soa_log_line __soa_log_${type}`;

    const time =
      new Date().toLocaleTimeString(
        "zh-CN",
        {
          hour12: false
        }
      );

    line.textContent =
      `[${time}] ${text}`;

    log.appendChild(line);
    log.scrollTop =
      log.scrollHeight;
  }

  function setStatus(
    text,
    type = "normal"
  ) {
    const el =
      document.getElementById(
        IDS.status
      );

    if (!el) return;

    el.textContent = text;
    el.dataset.type = type;
  }

  function updateCountPreview() {
    const textarea =
      document.getElementById(
        IDS.textarea
      );

    const count =
      document.getElementById(
        IDS.count
      );

    if (!textarea || !count) {
      return;
    }

    const codes =
      parseCodes(
        textarea.value
      );

    count.textContent =
      `识别 ${codes.length} 个预约单号`;
  }

  function updateUI() {
    const progress =
      document.getElementById(
        IDS.progress
      );

    const startBtn =
      document.getElementById(
        IDS.start
      );

    const pauseBtn =
      document.getElementById(
        IDS.pause
      );

    const stopBtn =
      document.getElementById(
        IDS.stop
      );

    const skipBtn =
      document.getElementById(
        IDS.skip
      );

    const textarea =
      document.getElementById(
        IDS.textarea
      );

    if (progress) {
      const total =
        state.codes.length;

      const displayIndex =
        state.running &&
        state.currentCode
          ? Math.min(
              state.index + 1,
              total
            )
          : Math.min(
              state.index,
              total
            );

      progress.innerHTML = `
        <span>进度：${displayIndex}/${total || 0}</span>
        <span class="__soa_ok">成功 ${state.success}</span>
        <span class="__soa_skip">跳过 ${state.skipped}</span>
        <span class="__soa_err">异常 ${state.errors}</span>
      `;
    }

    if (startBtn) {
      startBtn.disabled =
        state.running;
    }

    if (pauseBtn) {
      pauseBtn.disabled =
        !state.running;

      pauseBtn.textContent =
        state.paused
          ? "继续"
          : "暂停";
    }

    if (stopBtn) {
      stopBtn.disabled =
        !state.running;
    }

    if (skipBtn) {
      skipBtn.style.display =
        "none";
    }

    if (textarea) {
      textarea.disabled =
        state.running;
    }

    if (state.running) {
      if (state.paused) {
        setStatus(
          "已暂停",
          "warn"
        );
      } else {
        setStatus(
          state.currentCode
            ? `正在处理：${state.currentCode}`
            : "运行中",
          "running"
        );
      }
    }
  }

  /* =========================================================
   * 11. UI 事件
   * ========================================================= */

  function startBatch() {
    if (state.running) {
      return;
    }

    const input = getInput();

    if (!input) {
      setStatus(
        "未找到预约单号输入框 #vid，请确认当前页面正确",
        "error"
      );

      return;
    }

    const textarea =
      document.getElementById(
        IDS.textarea
      );

    const codes =
      parseCodes(
        textarea?.value || ""
      );

    if (!codes.length) {
      setStatus(
        "请先填写预约单号，每行一个",
        "warn"
      );

      textarea?.focus();

      return;
    }

    state.running = true;
    state.paused = false;

    state.codes = codes;
    state.index = 0;

    state.success = 0;
    state.skipped = 0;
    state.errors = 0;

    state.currentCode = "";
    state.lastError = "";
    state.anomalies = [];

    renderAnomalySummary();

    const log =
      document.getElementById(
        IDS.log
      );

    if (log) {
      log.innerHTML = "";
    }

    runBatch();
  }

  function togglePause() {
    if (!state.running) {
      return;
    }

    state.paused =
      !state.paused;

    updateUI();
  }

  function stopBatch() {
    if (!state.running) {
      return;
    }

    state.running = false;
    state.paused = false;
    state.currentCode = "";

    state.token++;

    appendLog(
      "warn",
      "用户停止了本次任务"
    );

    setStatus(
      "已停止",
      "warn"
    );

    updateUI();
  }

  function skipCurrent() {
    // v1.1 起异常会自动记录并继续，此按钮保留兼容但不再显示。
  }

  /* =========================================================
   * 12. UI 样式
   * ========================================================= */

  function createStyle() {
    if (
      document.getElementById(
        IDS.style
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id = IDS.style;

    style.textContent = `
      #${IDS.button} {
        position: fixed;
        left: 18px;
        top: 120px;
        z-index: 100000;
        min-width: 128px;
        height: 44px;
        padding: 0 18px;
        border: 0;
        border-radius: 9px;
        background: #1890ff;
        color: #fff;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: .5px;
        cursor: grab;
        user-select: none;
        box-shadow: 0 6px 20px rgba(24,144,255,.30);
      }

      #${IDS.button}.__soa_dragging {
        cursor: grabbing;
      }

      #${IDS.button}:hover {
        background: #40a9ff;
      }

      #${IDS.mask} {
        position: fixed;
        inset: 0;
        z-index: 100001;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.28);
      }

      #${IDS.panel} {
        width: 560px;
        max-width: calc(100vw - 40px);
        max-height: calc(100vh - 60px);
        overflow: hidden;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 16px 44px rgba(0,0,0,.22);
        color: rgba(0,0,0,.85);
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          "Microsoft YaHei",
          sans-serif;
      }

      #${IDS.panel} .__soa_header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 48px;
        padding: 0 16px;
        border-bottom: 1px solid #f0f0f0;
        font-size: 15px;
        font-weight: 700;
      }

      #${IDS.close} {
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #8c8c8c;
        font-size: 20px;
        cursor: pointer;
      }

      #${IDS.close}:hover {
        background: #f5f5f5;
        color: #333;
      }

      #${IDS.panel} .__soa_body {
        padding: 15px 16px 10px;
      }

      #${IDS.panel} .__soa_hint {
        margin-bottom: 8px;
        color: #777;
        font-size: 12px;
        line-height: 1.6;
      }

      #${IDS.textarea} {
        display: block;
        width: 100%;
        height: 160px;
        resize: vertical;
        box-sizing: border-box;
        padding: 9px 10px;
        border: 1px solid #d9d9d9;
        border-radius: 6px;
        outline: none;
        color: #222;
        background: #fff;
        font-size: 13px;
        line-height: 1.55;
        font-family: Consolas, "Microsoft YaHei", monospace;
      }

      #${IDS.textarea}:focus {
        border-color: #40a9ff;
        box-shadow: 0 0 0 2px rgba(24,144,255,.12);
      }

      #${IDS.textarea}:disabled {
        background: #fafafa;
        color: #777;
      }

      #${IDS.panel} .__soa_meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-top: 7px;
        color: #777;
        font-size: 12px;
      }

      #${IDS.status}[data-type="running"] {
        color: #1890ff;
      }

      #${IDS.status}[data-type="success"] {
        color: #52c41a;
      }

      #${IDS.status}[data-type="warn"] {
        color: #fa8c16;
      }

      #${IDS.status}[data-type="error"] {
        color: #ff4d4f;
      }

      #${IDS.progress} {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 10px;
        padding: 8px 10px;
        border-radius: 6px;
        background: #f7f9fb;
        color: #555;
        font-size: 12px;
      }

      #${IDS.progress} .__soa_ok {
        color: #389e0d;
      }

      #${IDS.progress} .__soa_skip {
        color: #8c8c8c;
      }

      #${IDS.progress} .__soa_err {
        color: #cf1322;
      }

      #${IDS.log} {
        height: 145px;
        margin-top: 10px;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid #f0f0f0;
        border-radius: 6px;
        background: #fcfcfc;
        font-size: 12px;
        line-height: 1.65;
        font-family: Consolas, "Microsoft YaHei", monospace;
      }

      #${IDS.log}:empty::before {
        content: "运行日志会显示在这里";
        color: #bfbfbf;
      }


      #${IDS.summaryWrap} {
        display: none;
        margin-top: 10px;
      }

      #${IDS.summaryWrap} .__soa_summary_title {
        margin-bottom: 6px;
        color: #cf1322;
        font-size: 12px;
        font-weight: 700;
      }

      #${IDS.summary} {
        width: 100%;
        height: 110px;
        resize: vertical;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid #ffccc7;
        border-radius: 6px;
        background: #fff2f0;
        color: #a8071a;
        font-size: 12px;
        line-height: 1.6;
        font-family: Consolas, "Microsoft YaHei", monospace;
        outline: none;
      }

      .__soa_log_line {
        word-break: break-all;
      }

      .__soa_log_success {
        color: #389e0d;
      }

      .__soa_log_warn {
        color: #d48806;
      }

      .__soa_log_error {
        color: #cf1322;
        font-weight: 600;
      }

      .__soa_log_skip {
        color: #777;
      }

      .__soa_log_info {
        color: #555;
      }

      #${IDS.panel} .__soa_footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 10px 16px 14px;
      }

      #${IDS.panel} .__soa_action {
        min-width: 76px;
        height: 34px;
        padding: 0 12px;
        border: 1px solid #d9d9d9;
        border-radius: 6px;
        background: #fff;
        color: #444;
        cursor: pointer;
      }

      #${IDS.panel} .__soa_action:hover:not(:disabled) {
        border-color: #40a9ff;
        color: #1890ff;
      }

      #${IDS.panel} .__soa_action:disabled {
        cursor: not-allowed;
        opacity: .45;
      }

      #${IDS.start} {
        border-color: #1890ff !important;
        background: #1890ff !important;
        color: #fff !important;
      }

      #${IDS.start}:hover:not(:disabled) {
        background: #40a9ff !important;
      }

      #${IDS.stop} {
        color: #ff4d4f !important;
      }

      #${IDS.skip}:not(:disabled) {
        color: #fa8c16 !important;
        border-color: #ffc069 !important;
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function loadButtonPosition(button) {
    try {
      const raw =
        localStorage.getItem(
          CONFIG.BUTTON_POS_KEY
        );

      if (!raw) return;

      const pos = JSON.parse(raw);

      if (
        Number.isFinite(pos.left) &&
        Number.isFinite(pos.top)
      ) {
        button.style.left =
          `${pos.left}px`;
        button.style.top =
          `${pos.top}px`;
      }
    } catch {
      // 保持默认位置
    }
  }

  function saveButtonPosition(button) {
    try {
      const rect =
        button.getBoundingClientRect();

      localStorage.setItem(
        CONFIG.BUTTON_POS_KEY,
        JSON.stringify({
          left: Math.round(rect.left),
          top: Math.round(rect.top)
        })
      );
    } catch {
      // 忽略存储失败
    }
  }

  function clampButton(button) {
    const rect =
      button.getBoundingClientRect();

    const margin = 6;

    const left =
      Math.min(
        Math.max(rect.left, margin),
        Math.max(
          margin,
          window.innerWidth -
          rect.width -
          margin
        )
      );

    const top =
      Math.min(
        Math.max(rect.top, margin),
        Math.max(
          margin,
          window.innerHeight -
          rect.height -
          margin
        )
      );

    button.style.left =
      `${left}px`;

    button.style.top =
      `${top}px`;
  }

  function initDraggableButton(
    button,
    openHandler
  ) {
    let dragging = false;
    let moved = false;

    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    button.addEventListener(
      "pointerdown",
      e => {
        if (e.button !== 0) return;

        dragging = true;
        moved = false;

        const rect =
          button.getBoundingClientRect();

        startX = e.clientX;
        startY = e.clientY;

        startLeft = rect.left;
        startTop = rect.top;

        button.classList.add(
          "__soa_dragging"
        );

        try {
          button.setPointerCapture?.(
            e.pointerId
          );
        } catch {
          // 忽略
        }

        e.preventDefault();
      }
    );

    button.addEventListener(
      "pointermove",
      e => {
        if (!dragging) return;

        const dx =
          e.clientX - startX;

        const dy =
          e.clientY - startY;

        if (
          Math.abs(dx) > 4 ||
          Math.abs(dy) > 4
        ) {
          moved = true;
        }

        if (!moved) return;

        button.style.left =
          `${startLeft + dx}px`;

        button.style.top =
          `${startTop + dy}px`;

        clampButton(button);
      }
    );

    button.addEventListener(
      "pointerup",
      e => {
        if (!dragging) return;

        dragging = false;

        button.classList.remove(
          "__soa_dragging"
        );

        try {
          button.releasePointerCapture?.(
            e.pointerId
          );
        } catch {
          // 忽略
        }

        if (moved) {
          saveButtonPosition(
            button
          );
        } else {
          openHandler();
        }
      }
    );

    button.addEventListener(
      "pointercancel",
      () => {
        dragging = false;

        button.classList.remove(
          "__soa_dragging"
        );
      }
    );

    window.addEventListener(
      "resize",
      () => {
        clampButton(button);
        saveButtonPosition(button);
      }
    );
  }

  /* =========================================================
   * 13. 创建 UI
   * ========================================================= */

  function createUI() {
    if (
      document.getElementById(
        IDS.button
      )
    ) {
      return;
    }

    createStyle();

    const button =
      document.createElement(
        "button"
      );

    button.id = IDS.button;
    button.type = "button";
    button.textContent =
      "⚡ 批量预约";

    const mask =
      document.createElement(
        "div"
      );

    mask.id = IDS.mask;

    mask.innerHTML = `
      <div id="${IDS.panel}">
        <div class="__soa_header">
          <span>预约单号批量填充</span>
          <button
            id="${IDS.close}"
            type="button"
            title="关闭"
          >×</button>
        </div>

        <div class="__soa_body">
          <div class="__soa_hint">
            每行填写一个预约单号。脚本会逐条写入页面输入框并模拟回车，
            只有在左侧预约列表中确认到该号码后，才继续处理下一条。
            页面顶部的 Ant Design 提示会被实时监听并记录。等待约 4 秒仍未确认时自动重试一次；
            最终失败则按“预约单号 + 页面提示”记录异常并继续下一条。
          </div>

          <textarea
            id="${IDS.textarea}"
            placeholder="例如：
123456789
123456790
123456791"
          ></textarea>

          <div class="__soa_meta">
            <span id="${IDS.count}">
              识别 0 个预约单号
            </span>
            <span
              id="${IDS.status}"
              data-type="normal"
            >
              等待运行
            </span>
          </div>

          <div id="${IDS.progress}">
            <span>进度：0/0</span>
            <span class="__soa_ok">成功 0</span>
            <span class="__soa_skip">跳过 0</span>
            <span class="__soa_err">异常 0</span>
          </div>

          <div id="${IDS.log}"></div>

          <div id="${IDS.summaryWrap}">
            <div class="__soa_summary_title">
              异常汇总（预约单号 提示）
            </div>
            <textarea
              id="${IDS.summary}"
              readonly
            ></textarea>
          </div>
        </div>

        <div class="__soa_footer">
          <button
            id="${IDS.skip}"
            class="__soa_action"
            type="button"
            disabled
          >
            跳过当前
          </button>

          <button
            id="${IDS.pause}"
            class="__soa_action"
            type="button"
            disabled
          >
            暂停
          </button>

          <button
            id="${IDS.stop}"
            class="__soa_action"
            type="button"
            disabled
          >
            停止
          </button>

          <button
            id="${IDS.start}"
            class="__soa_action"
            type="button"
          >
            开始运行
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(
      button
    );

    document.body.appendChild(
      mask
    );

    const textarea =
      document.getElementById(
        IDS.textarea
      );

    textarea.addEventListener(
      "input",
      updateCountPreview
    );

    document
      .getElementById(
        IDS.start
      )
      .addEventListener(
        "click",
        startBatch
      );

    document
      .getElementById(
        IDS.pause
      )
      .addEventListener(
        "click",
        togglePause
      );

    document
      .getElementById(
        IDS.stop
      )
      .addEventListener(
        "click",
        stopBatch
      );

    document
      .getElementById(
        IDS.skip
      )
      .addEventListener(
        "click",
        skipCurrent
      );

    const openPanel = () => {
      mask.style.display =
        "flex";

      updateCountPreview();
      updateUI();
      renderAnomalySummary();

      if (!state.running) {
        setStatus(
          state.errors
            ? `上次任务存在 ${state.errors} 条异常`
            : "等待运行",
          state.errors
            ? "warn"
            : "normal"
        );
      }

      setTimeout(() => {
        textarea.focus();
      }, 50);
    };

    loadButtonPosition(button);
    requestAnimationFrame(() => {
      clampButton(button);
    });

    initDraggableButton(
      button,
      openPanel
    );

    document
      .getElementById(
        IDS.close
      )
      .addEventListener(
        "click",
        () => {
          mask.style.display =
            "none";
        }
      );

    // 点击遮罩空白处关闭。
    // 运行中的任务不会停止，只是隐藏窗口。
    mask.addEventListener(
      "mousedown",
      e => {
        if (e.target === mask) {
          mask.style.display =
            "none";
        }
      }
    );
  }

  /* =========================================================
   * 14. 初始化
   * ========================================================= */

  function init() {
    createUI();
    initAntMessageObserver();

    console.log(
      "[SOA批量预约] v1.2 已加载。预约单号输入框：#vid，已启用 .ant-message 实时监听"
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();
