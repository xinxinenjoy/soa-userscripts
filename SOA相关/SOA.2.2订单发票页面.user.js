// ==UserScript==
// @name         SOA.2.2订单发票页面
// @namespace    https://tampermonkey.net/soa-order-invoice/
// @version      1.6
// @description  SOA订单发票列表页面增强：列重排、宽度调整、文案替换、复制优化。

// @match        https://checkup-soa3.health-100.cn/*
// @grant        none

// @author       WanXin
// @publishGroup soaxg
// @publishID    soa-dingdanfapiao
// @updateURL    https://scripts.wanxinxin.dpdns.org/soaxg/soa-dingdanfapiao.user.js
// @downloadURL  https://scripts.wanxinxin.dpdns.org/soaxg/soa-dingdanfapiao.user.js
// ==/UserScript==

/*
 * 更新记录
 *
 * v1.5  -  2026-8-29
 * - 更新：测试版本
 *
 */

(function () {
  "use strict";

  /******************** 0) 路由范围 ********************/
  const TARGET_HASH_PREFIX = "#/order/invoice";
  const isTargetRoute = () =>
    location.hash.startsWith(TARGET_HASH_PREFIX);

  /******************** 1) 配置 ********************/
  /*需要隐藏的表头填在这个位置，换行用逗号隔开*/
  const HIDDEN_COLUMNS = [
    "卡类开票",
    "预开票",
    "发票类型",
  ];

const COLUMN_LAYOUT = [
    { header: "销方公司", width: 100, align: "right"  },
    { header: "开票客户", width: 530, adjustable: true },
    { header: "发票金额", width: 80, align: "right" },
    { header: "当前状态", width: 110 },
    { header: "创建人", width: 150 },
    { header: "操作", width: 260 },
    { header: "申请单", width: 230 },
    { header: "申请开票单位代码", width: 150 },
    { header: "来源", width: 80 },
  ];

  const TEXT_REPLACE = {
    "全电普通发票（电子）": "电子普票",
    "待提交审批": "❓核对后提交",
    "开票成功": "✅已开",
    "作废": "❌作废未开",
    "已退票": "❌红冲退票",
    "审批完成开票中": "开票中",
    "开票申请审批中": "开票中",
    "SOA开票": "订单开票",
    "SOA合并开票": "主页开票",
    "否": "—",
    "新乡美年大健康管理有限公司门诊部": "门诊部（宝龙）",
    "新乡美年大健康管理有限公司高新门诊部": "高新（玫瑰园）",
    "长垣美年大健康管理有限公司门诊部": "长垣（长垣店）",
  };

  const WIDTH_STEP = 60;
  const TABLE_MARKER = "data-tm-invoice-table";
  const TABLE_SELECTOR = `.ant-table[${TABLE_MARKER}="1"]`;

  /******************** 2) 状态 ********************/
  let enabled = false;
  let customerWidthDelta = 0;
  let lastPageKey = null;
  let lastHeaderSignature = "";

  let uiBtn = null;
  let styleEl = null;

  const rowSig = new WeakMap();

  let rootObserver = null;
  let tableObserver = null;
  let observedTableRoot = null;

  let scheduled = false;
  let pendingForceStyle = false;

  /******************** 3) 表格与基础工具 ********************/
  const normText = (value) => (value || "").replace(/\s+/g, " ").trim();

  function getHeaderCells(tableRoot = observedTableRoot) {
    const header = tableRoot?.querySelector(".ant-table-header");
    return header ? [...header.querySelectorAll("th")] : [];
  }

  function getBodyRows(tableRoot = observedTableRoot) {
    const tbody = tableRoot?.querySelector(".ant-table-body tbody");
    return tbody
      ? [...tbody.querySelectorAll("tr:not(.ant-table-measure-row)")]
      : [];
  }


  // 判断是否为目标发票表格，避免误处理弹窗、抽屉等其他 Ant Design 表格
  function isInvoiceTableRoot(tableRoot) {
    if (!tableRoot) return false;

    if (tableRoot.closest(".ant-modal")) return false;
    if (tableRoot.closest(".ant-drawer")) return false;

    const headers = new Set(
      getHeaderCells(tableRoot)
        .map((cell) => normText(cell.innerText))
        .filter(Boolean)
    );

    return [
      "发票类型",
      "销方公司",
      "开票客户",
      "发票金额"
    ].every((header) => headers.has(header));
  }

  function findInvoiceTableRoot() {
    const candidates = [
      ...document.querySelectorAll(".invoice_list .ant-table"),
    ];

    return candidates.find(
      (tableRoot) => isInvoiceTableRoot(tableRoot)
    ) || null;
  }

  function markTableRoot(tableRoot) {
    if (tableRoot && isInvoiceTableRoot(tableRoot)) {
      tableRoot.setAttribute(TABLE_MARKER, "1");
    }
  }

  function getHeaderIndexMap(tableRoot = observedTableRoot) {
    const map = new Map();
    getHeaderCells(tableRoot).forEach((th, index) => {
      const text = normText(th.innerText);
      if (text && !map.has(text)) map.set(text, index);
    });
    return map;
  }

  function getHeaderSignature(tableRoot = observedTableRoot) {
    return getHeaderCells(tableRoot)
      .map((th) => normText(th.innerText))
      .join("|");
  }

  function getColumnWidth(column) {
    const delta = column.adjustable ? customerWidthDelta : 0;
    return Math.max(80, column.width + delta);
  }

  function getAdjustableColumn() {
    return COLUMN_LAYOUT.find((column) => column.adjustable) || null;
  }

  function changeCustomerWidth(delta) {
    const column = getAdjustableColumn();
    if (!column) return;

    const minimumDelta = 80 - column.width;
    customerWidthDelta = Math.max(
      minimumDelta,
      customerWidthDelta + delta
    );
    scheduleWork(true);
  }

  function getCurrentPageKey() {
    const active = document.querySelector(".ant-pagination-item-active");
    const pageText = active ? normText(active.innerText) : "";
    return pageText || "unknown";
  }

  function resetTempWidthIfPageChanged() {
    const key = getCurrentPageKey();
    if (lastPageKey === null) {
      lastPageKey = key;
      return false;
    }

    if (key !== lastPageKey) {
      customerWidthDelta = 0;
      lastPageKey = key;
      return true;
    }

    return false;
  }

  /******************** 4) 文案替换 ********************/
  function normalizeForMatch(value) {
    return (value || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function replaceIgnoringWhitespace(source, key, value) {
    const sourceNormalized = normalizeForMatch(source);
    const keyNormalized = normalizeForMatch(key);
    if (!sourceNormalized.includes(keyNormalized)) return source;

    const separator = "[\\s\\u00A0\\u200B-\\u200D\\uFEFF]*";
    const pattern = [...keyNormalized]
      .map((character) => escapeRegExp(character))
      .join(separator);

    return source.replace(new RegExp(pattern, "g"), value);
  }

  function safeReplaceText(text) {
    let output = text;

    for (const [source, target] of Object.entries(TEXT_REPLACE)) {
      // 部分目标文案仍包含源文案（例如“作废”），避免重复扩写。
      if (
        target &&
        normalizeForMatch(output) === normalizeForMatch(target)
      ) {
        continue;
      }
      output = replaceIgnoringWhitespace(output, source, target);
    }

    return output;
  }

  /******************** 5) 单元格处理：保留原节点结构 ********************/
  function getCellFullText(td) {

    // 兼容 Ant Design ellipsis：
    // 例如：
    // <span>
    //   新乡美年大健康管理有限公
    //   <span title="司门诊部">...</span>
    // </span>
    // 需要拼接成完整名称。

    const ellipsisNodes = td.querySelectorAll(
      ".ant-typography-ellipsis span"
    );

    if (ellipsisNodes.length) {
      let result = "";

      ellipsisNodes.forEach(node => {
        node.childNodes.forEach(child => {

          if (child.nodeType === Node.TEXT_NODE) {
            result += child.nodeValue || "";
          }

          if (
            child.nodeType === Node.ELEMENT_NODE &&
            child.getAttribute("title")
          ) {
            result += child.getAttribute("title");
          }

        });
      });

      result = normText(result);

      if (result) return result;
    }

    return normText(td.innerText);
  }

  function getMeaningfulTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (normText(node.nodeValue)) nodes.push(node);
    }

    return nodes;
  }

  // 只改已有文本节点的 nodeValue，不使用 innerHTML/textContent 删除 React 管理的子节点。
  function setCellTextKeepStructure(td, newText) {

    const textNodes = getMeaningfulTextNodes(td);

    if (!textNodes.length) return false;

    // 只修改已有文本节点，避免破坏 React 管理的 DOM
    textNodes[0].nodeValue = newText;

    for (let i = 1; i < textNodes.length; i++) {
      textNodes[i].nodeValue = "";
    }

    return true;
  }

  // 开票客户：不重建 DOM，只用 CSS 将原有名称和税号排成一行。
  function prepareCustomerCell(td) {
    const divs = td.querySelectorAll(":scope > .ellipsis");
    if (divs.length !== 2) return;

    const name = normText(divs[0].innerText);
    const code = normText(divs[1].innerText);
    if (!name || !code) return;

    td.setAttribute("data-tm-customer", "1");
    td.setAttribute("title", `${name}，${code}`);
  }

  // 创建人：保留两个原始 div；空姓名通过 CSS 伪元素显示“手工开票”。
  function prepareCreatorCell(td) {
    const divs = td.querySelectorAll(":scope > div");
    if (divs.length < 2) return;

    const nameDiv = divs[0];
    const timeDiv = divs[1];
    const name = normText(nameDiv.innerText);
    const time = normText(timeDiv.innerText);
    if (!time) return;

    td.setAttribute("data-tm-creator", "1");
    td.setAttribute("data-tm-creator-name", name || "手工开票");
    td.setAttribute("data-tm-creator-time", time);

    if (!name) nameDiv.setAttribute("data-tm-manual-creator", "1");
    else nameDiv.removeAttribute("data-tm-manual-creator");
  }

  function removeAmountSeparators(raw) {
    const cleaned = normText(raw).replace(/,/g, "");
    return cleaned || raw;
  }

  /******************** 6) CSS：列重排 + 宽度 + 对齐 ********************/
  function buildCss(headerIndexMap) {
    const scope = TABLE_SELECTOR;
    let css = `
      ${scope} .ant-table-fixed,
      ${scope} .ant-table-fixed-right,
      ${scope} .ant-table-fixed-left { display: none !important; }

      ${scope} tr.ant-table-measure-row {
        display: none !important;
        height: 0 !important;
        min-height: 0 !important;
        padding: 0 !important;
        border: 0 !important;
      }

      ${scope} .ant-table-body {
        overflow-x: hidden !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }

      ${scope} .ant-table-header,
      ${scope} .ant-table-body {
        width: 100% !important;
      }

      ${scope} .ant-table-header tr {
        display: flex !important;
        height: 40px;
        align-items: center;
      }

      ${scope} .ant-table-body tr:not(.ant-table-measure-row) {
        display: flex !important;
        min-height: 40px;
        height: auto;
        align-items: stretch;
      }

      ${scope} .ant-table-header th {
        box-sizing: border-box;
        flex-shrink: 0;
        order: 999;
        padding: 0 12px;
        height: 40px;
        line-height: 40px;
        display: flex;
        align-items: center;
        white-space: nowrap;
        overflow: hidden;
      }

      ${scope} .ant-table-body td {
        box-sizing: border-box;
        flex-shrink: 0;
        order: 999;
        padding: 8px 12px;
        min-height: 40px;
        display: flex;
        align-items: center;
        white-space: nowrap;
        overflow: hidden;
      }

      ${scope} .ant-table-header table,
      ${scope} .ant-table-body table { min-width: max-content !important; }

      ${scope} .ant-table-cell-scrollbar { display: none !important; }
      ${scope} .ant-table-cell-fix-right,
      ${scope} .ant-table-cell-fix-left {
        position: static !important;
        left: auto !important;
        right: auto !important;
      }

      ${scope} td[data-tm-customer="1"] {
        display: block !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        line-height: 24px;
      }
      ${scope} td[data-tm-customer="1"] > .ellipsis {
        display: inline !important;
        white-space: nowrap !important;
        overflow: visible !important;
        text-overflow: clip !important;
        max-width: none !important;
      }
      ${scope} td[data-tm-customer="1"] > .ellipsis:first-child::after {
        content: "，";
      }

      ${scope} td[data-tm-creator="1"] {
        justify-content: space-between;
        gap: 12px;
      }
      ${scope} td[data-tm-creator="1"] > div:first-child {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      ${scope} td[data-tm-creator="1"] > div:last-child {
        flex: 0 0 auto;
        margin-left: auto;
        white-space: nowrap;
        text-align: right;
      }
      ${scope} [data-tm-manual-creator="1"]::before {
        content: "手工开票";
      }

      ${scope} tr.tm-row-refund,
      ${scope} tr.tm-row-refund * { color: #ff4d4f !important; }

      ${scope} tr.tm-row-fail > td { background: rgb(35,127,254) !important; }
      ${scope} tr.tm-row-fail,
      ${scope} tr.tm-row-fail * { color: #fff !important; }
    `;

    HIDDEN_COLUMNS.forEach((header) => {
      const domIndex = headerIndexMap.get(header);

      if (domIndex !== undefined) {
        css += `
          ${scope} .ant-table-header th:nth-child(${domIndex + 1}),
          ${scope} .ant-table-body td:nth-child(${domIndex + 1}) {
            display:none !important;
          }
        `;
      }
    });

    COLUMN_LAYOUT.forEach((column, visualIndex) => {
      const domIndex = headerIndexMap.get(column.header);
      if (domIndex === undefined) return;

      const width = getColumnWidth(column);
      const alignment =
        column.align === "right"
          ? "justify-content:flex-end !important;text-align:right !important;font-variant-numeric:tabular-nums;"
          : "";

      css += `
        ${scope} .ant-table-header th:nth-child(${domIndex + 1}),
        ${scope} .ant-table-body td:nth-child(${domIndex + 1}) {
          order: ${visualIndex};
          width: ${width}px;
          flex: 0 0 ${width}px;
          max-width: ${width}px;
          ${alignment}
        }
      `;
    });

    return css;
  }

  function applyOrUpdateStyle(
    headerSignature = getHeaderSignature(observedTableRoot)
  ) {
    if (!observedTableRoot) return;
    markTableRoot(observedTableRoot);

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "tm-order-invoice-style";
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = buildCss(getHeaderIndexMap(observedTableRoot));
    lastHeaderSignature = headerSignature;
    updateUiLabel();
  }

  function removeStyle() {
    const node = document.getElementById("tm-order-invoice-style");
    if (node) node.remove();
    styleEl = null;
    lastHeaderSignature = "";
  }

  /******************** 7) 行处理 ********************/
  function signatureForRow(tr, statusIdx, amountIdx) {
    const statusReady = statusIdx !== undefined ? "S1" : "S0";
    const amountReady = amountIdx !== undefined ? "A1" : "A0";
    return `${tr.innerText || ""}|${statusReady}|${amountReady}`;
  }

  function processRow(tr, columnIndexes) {
    if (!tr || tr.classList.contains("ant-table-measure-row")) return;

    const statusIdx = columnIndexes.get("当前状态");
    const amountIdx = columnIndexes.get("发票金额");
    const signature = signatureForRow(tr, statusIdx, amountIdx);
    if (rowSig.get(tr) === signature) return;
    rowSig.set(tr, signature);

    const cells = [...tr.children];
    const customerIdx = columnIndexes.get("开票客户");
    const creatorIdx = columnIndexes.get("创建人");

    if (
      customerIdx !== undefined &&
      cells[customerIdx] &&
      !cells[customerIdx].querySelector("a,button")
    ) {
      prepareCustomerCell(cells[customerIdx]);
    }


    // 跳过操作链接和按钮，避免破坏操作列。
    for (const cell of cells) {
      if (!cell || cell.querySelector("a,button")) continue;

      const rawFull = getCellFullText(cell);
      if (!rawFull) continue;

      const replaced = safeReplaceText(rawFull);
      if (replaced !== rawFull) setCellTextKeepStructure(cell, replaced);
    }

    if (
      amountIdx !== undefined &&
      cells[amountIdx] &&
      !cells[amountIdx].querySelector("a,button")
    ) {
      const rawAmount = getCellFullText(cells[amountIdx]);
      const cleanedAmount = removeAmountSeparators(rawAmount);
      if (cleanedAmount !== rawAmount) {
        setCellTextKeepStructure(cells[amountIdx], cleanedAmount);
      }
    }

    if (statusIdx === undefined || !cells[statusIdx]) return;

    tr.classList.remove("tm-row-fail", "tm-row-refund");
    const statusText = normText(cells[statusIdx].innerText);

    if (statusText.includes("失败")) {
      tr.classList.add("tm-row-fail");
    } else if (
      statusText.includes("已退") ||
      statusText.includes("红冲") ||
      statusText.includes("作废")
    ) {
      tr.classList.add("tm-row-refund");
    }
  }

  function processRowsIncremental(tableRoot = observedTableRoot) {
    if (!tableRoot) return;

    const columnIndexes = getHeaderIndexMap(tableRoot);
    getBodyRows(tableRoot).forEach((tr) => processRow(tr, columnIndexes));
  }

  /******************** 8) UI：按钮 + 快捷键 ********************/
  function ensureUiButton() {
    if (uiBtn && document.body.contains(uiBtn)) return;

    uiBtn = document.createElement("button");
    uiBtn.id = "tm-order-btn-widen-customer";
    uiBtn.type = "button";
    uiBtn.title = "左键加宽，右键缩窄；快捷键 Alt+= / Alt+-";

    Object.assign(uiBtn.style, {
      position: "fixed",
      left: "40px",
      top: "850px",
      zIndex: "999999",
      padding: "8px 10px",
      border: "1px solid rgba(0,0,0,.2)",
      borderRadius: "8px",
      background: "#237ffe",
      color: "#fff",
      boxShadow: "0 2px 10px rgba(0,0,0,.15)",
      cursor: "pointer",
      userSelect: "none",
      fontSize: "12px",
    });

    uiBtn.addEventListener("click", () => changeCustomerWidth(WIDTH_STEP));

    uiBtn.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      changeCustomerWidth(-WIDTH_STEP);
    });

    document.body.appendChild(uiBtn);
    updateUiLabel();
  }

  function removeUiButton() {
    const node = document.getElementById("tm-order-btn-widen-customer");
    if (node) node.remove();
    uiBtn = null;
  }

  function updateUiLabel() {
    if (!uiBtn) return;

    const customerColumn = getAdjustableColumn();
    const currentWidth = customerColumn ? getColumnWidth(customerColumn) : 0;
    uiBtn.textContent = `开票客户 +${WIDTH_STEP}px（当前 ${currentWidth}px）`;
  }

  window.addEventListener(
    "keydown",
    (event) => {
      if (!enabled || !event.altKey) return;

      if (event.code === "Equal") {
        event.preventDefault();
        changeCustomerWidth(WIDTH_STEP);
      } else if (event.code === "Minus") {
        event.preventDefault();
        changeCustomerWidth(-WIDTH_STEP);
      }
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!enabled) return;
      const element = event.target;
      if (element?.closest?.(".ant-pagination")) {
        customerWidthDelta = 0;
        scheduleWork(true);
      }
    },
    true
  );

  /******************** 9) 复制：按页面可视列顺序输出 ********************/
  function selectionIntersectsNode(selection, node) {
    if (!selection || !node) return false;

    for (let index = 0; index < selection.rangeCount; index += 1) {
      try {
        if (selection.getRangeAt(index).intersectsNode(node)) return true;
      } catch (error) {}
    }

    return false;
  }

  function getClipboardCellText(cell, header) {
    if (!cell) return "";

    if (header === "开票客户") {
      const parts = cell.querySelectorAll(":scope > .ellipsis");
      if (parts.length === 2) {
        return `${normText(parts[0].innerText)}，${normText(parts[1].innerText)}`;
      }
    }

    if (header === "创建人") {
      const name =
        cell.getAttribute("data-tm-creator-name") ||
        normText(cell.querySelector(":scope > div:first-child")?.innerText);
      const time =
        cell.getAttribute("data-tm-creator-time") ||
        normText(cell.querySelector(":scope > div:last-child")?.innerText);
      return [name, time].filter(Boolean).join(" ");
    }

    if (header === "操作") {
      const links = cell.querySelectorAll("a");
      if (links.length) {
        return [...links]
          .map((link) => normText(link.innerText))
          .filter(Boolean)
          .join(" ");
      }
    }

    return normText(cell.innerText)
      .replace(/\t/g, " ")
      .replace(/[\r\n]+/g, " ");
  }

  function buildClipboardTable(selection, tableRoot = observedTableRoot) {
    if (!tableRoot) return null;

    const headerCells = getHeaderCells(tableRoot);
    const bodyRows = getBodyRows(tableRoot);
    if (!headerCells.length || !bodyRows.length) return null;

    const headerIndexMap = getHeaderIndexMap(tableRoot);
    const orderedColumns = COLUMN_LAYOUT.map((column) => ({
      ...column,
      domIndex: headerIndexMap.get(column.header),
    })).filter((column) => column.domIndex !== undefined);

    if (!orderedColumns.length) return null;

    const selectedRows = bodyRows.filter((row) =>
      orderedColumns.some((column) =>
        selectionIntersectsNode(selection, row.children[column.domIndex])
      )
    );

    const selectedColumns = orderedColumns.filter((column) => {
      if (
        selectionIntersectsNode(selection, headerCells[column.domIndex])
      ) {
        return true;
      }

      return selectedRows.some((row) =>
        selectionIntersectsNode(selection, row.children[column.domIndex])
      );
    });

    if (!selectedColumns.length) return null;

    const includeHeader = selectedColumns.some((column) =>
      selectionIntersectsNode(selection, headerCells[column.domIndex])
    );

    const rows = [];
    if (includeHeader) {
      rows.push(selectedColumns.map((column) => column.header));
    }

    selectedRows.forEach((row) => {
      rows.push(
        selectedColumns.map((column) =>
          getClipboardCellText(row.children[column.domIndex], column.header)
        )
      );
    });

    return rows.length ? { rows, includeHeader } : null;
  }

  function escapeClipboardHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  document.addEventListener(
    "copy",
    (event) => {
      if (!enabled || !event.clipboardData || !observedTableRoot) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const result = buildClipboardTable(selection, observedTableRoot);
      if (!result) return;

      const plainText = result.rows
        .map((row) =>
          row
            .map((value) => String(value).replace(/\t/g, " "))
            .join("\t")
        )
        .join("\r\n");

      const htmlRows = result.rows
        .map((row, rowIndex) => {
          const tag = result.includeHeader && rowIndex === 0 ? "th" : "td";
          return `<tr>${row
            .map((value) => `<${tag}>${escapeClipboardHtml(value)}</${tag}>`)
            .join("")}</tr>`;
        })
        .join("");

      event.clipboardData.setData("text/plain", plainText);
      event.clipboardData.setData(
        "text/html",
        `<table><tbody>${htmlRows}</tbody></table>`
      );
      event.preventDefault();
    },
    true
  );

  /******************** 10) Observer ********************/
  function connectTableObserver() {
    const tableRoot = findInvoiceTableRoot();
    if (!tableRoot || !isInvoiceTableRoot(tableRoot)) return false;

    if (tableObserver && observedTableRoot === tableRoot) {
      markTableRoot(tableRoot);
      return true;
    }

    disconnectTableObserver();
    observedTableRoot = tableRoot;
    markTableRoot(tableRoot);

    tableObserver = new MutationObserver(() => {
      if (!isInvoiceTableRoot(tableRoot)) return;
      scheduleWork(false);
    });
    tableObserver.observe(tableRoot, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return true;
  }

  function disconnectTableObserver() {
    if (tableObserver) {
      try {
        tableObserver.disconnect();
      } catch (error) {}
      tableObserver = null;
    }

    if (observedTableRoot) {
      observedTableRoot.removeAttribute(TABLE_MARKER);
    }
    observedTableRoot = null;
  }

  function connectRootObserverIfNeeded() {
    if (rootObserver) return;

    rootObserver = new MutationObserver(() => {
      if (!enabled) return;

      const nextTableRoot = findInvoiceTableRoot();
      if (nextTableRoot !== observedTableRoot) {
        if (connectTableObserver()) scheduleWork(true);
      }
    });

    rootObserver.observe(document.querySelector("#root") || document.body, {
      childList: true,
      subtree: true,
    });
  }

  function disconnectRootObserver() {
    if (rootObserver) {
      try {
        rootObserver.disconnect();
      } catch (error) {}
      rootObserver = null;
    }
  }

  /******************** 11) 核心调度 ********************/
  function scheduleWork(forceStyle = false) {
    if (!enabled) return;

    pendingForceStyle = pendingForceStyle || forceStyle;
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      if (!enabled) {
        pendingForceStyle = false;
        return;
      }

      const shouldForceStyle = pendingForceStyle;
      pendingForceStyle = false;

      if (!observedTableRoot?.isConnected) connectTableObserver();
      markTableRoot(observedTableRoot);

      const pageChanged = resetTempWidthIfPageChanged();
      const headerSignature = getHeaderSignature(observedTableRoot);
      const headerChanged = headerSignature !== lastHeaderSignature;

      if (
        observedTableRoot &&
        (shouldForceStyle || pageChanged || headerChanged || !styleEl)
      ) {
        applyOrUpdateStyle(headerSignature);
      }

      ensureUiButton();
      processRowsIncremental(observedTableRoot);
    });
  }

  /******************** 12) 启用/禁用 ********************/
  function enable() {
    if (enabled) return;
    enabled = true;

    customerWidthDelta = 0;
    lastPageKey = null;
    lastHeaderSignature = "";
    pendingForceStyle = false;

    connectRootObserverIfNeeded();
    connectTableObserver();

    ensureUiButton();
    if (observedTableRoot) applyOrUpdateStyle();
    processRowsIncremental(observedTableRoot);
    scheduleWork(false);
  }

  function disable() {
    if (!enabled) return;
    enabled = false;

    disconnectTableObserver();
    disconnectRootObserver();
    removeStyle();
    removeUiButton();

    customerWidthDelta = 0;
    lastPageKey = null;
    lastHeaderSignature = "";
    pendingForceStyle = false;
  }

  function routeCheck() {
    if (isTargetRoute()) enable();
    else disable();
  }

  window.addEventListener("hashchange", routeCheck, true);
  window.addEventListener("popstate", routeCheck, true);
  window.addEventListener("tm-soa-history-change", routeCheck, true);

  // pushState/replaceState 不会自动触发 hashchange，因此派发一个脚本内部事件。
  (function patchHistoryOnce() {
    const patchKey = "__tmSoaInvoiceHistoryPatched__";
    if (history[patchKey]) return;

    const wrap = (original) =>
      function () {
        const result = original.apply(this, arguments);
        queueMicrotask(() =>
          window.dispatchEvent(new Event("tm-soa-history-change"))
        );
        return result;
      };

    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);

    try {
      Object.defineProperty(history, patchKey, {
        value: true,
        configurable: false,
        enumerable: false,
      });
    } catch (error) {
      history[patchKey] = true;
    }
  })();

  routeCheck();
})();
