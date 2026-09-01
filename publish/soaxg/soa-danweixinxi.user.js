// ==UserScript==
// @name         蝶美1.1-单位信息填充
// @namespace    https://dime.health-100.cn/
// @version      7.7.24
// @description  自动填充单位信息，支持地区、行业、经济类型、单位类型、社会信用代码、企业规模、职工人数、接害人数等字段。
//
// @match        https://dime.health-100.cn/*
// @run-at       document-idle
// @grant        none
// @noframes
//

// @author       WanXin
// @publishGroup soaxg
// @publishID    soa-danweixinxi
// @updateURL    https://scripts.wanxinxin.dpdns.org/soaxg/soa-danweixinxi.user.js
// @downloadURL  https://scripts.wanxinxin.dpdns.org/soaxg/soa-danweixinxi.user.js
// ==/UserScript==

/*
 * 更新记录
 *
 * v7.7.23  -  2026-8-29
 * - 更新：测试版本
 *
 */

(async function () {
  const TOOL_ID = "dime-company-auto-fill-tool-v7-7";
  const STYLE_ID = TOOL_ID + "-style";
  const LAUNCHER_ID = TOOL_ID + "-launcher";
  const LAUNCHER_POSITION_KEY = "dime-company-fill-launcher-position-v775";
  const OPEN_EVENT = "dime-floating-tool-open";
  const POSITION_KEY = TOOL_ID + "-position";
  const WIDTH_KEY = TOOL_ID + "-width";
  const COLLAPSED_KEY = TOOL_ID + "-collapsed";
  const TEXTAREA_HEIGHT_KEY = TOOL_ID + "-textarea-height";

  document.getElementById(TOOL_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  document.getElementById(LAUNCHER_ID)?.remove();

  const CONFIG = {
    shortWait: 160,
    normalWait: 450,
    searchTimeout: 8000,
    optionTimeout: 6000,
    defaults: {
      province: "河南省",
      unitType: "用工单位",
      syncBianQue: "是"
    },
    fields: {
      area: { aliases: ["地区", "区域", "所属地区", "所属区域"], panelMarkers: ["河南省", "北京市", "江苏省"] },
      industry: { aliases: ["行业类别", "行业类型", "所属行业"] },
      economy: { aliases: ["经济类型", "经济性质"] },
      unitType: { aliases: ["单位类型"] },
      socialCreditCode: { aliases: ["社会信用代码", "统一社会信用代码", "统一信用代码"] },
      companyScale: { aliases: ["企业规模", "单位规模"] },
      employeeCount: { aliases: ["职工数", "职工人数"] },
      exposedCount: { aliases: ["接害人数", "接害数"] },
      syncBianQue: { aliases: ["报告同步扁鹊", "同步扁鹊", "是否同步扁鹊"] }
    }
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const cleanText = v => String(v ?? "").trim();
  const normalizeText = v => String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .replace(/[：:*]/g, "")
    .trim();

  /*
   * 企业规模标准化
   *
   * 网页标准选项：大 / 中 / 小 / 微型
   * 常见输入：
   * 大型、大企业、大型企业、大规模 → 大
   * 中型、中企业、中型企业、中等规模 → 中
   * 小型、小企业、小型企业、小规模 → 小
   * 微、微型、微企业、微型企业、微小型 → 微型
   *
   * “中小型”等不能明确对应单一标准档位的内容保留原文，
   * 由页面正常提示找不到选项，不擅自归类。
   */
  function normalizeCompanyScale(value) {
    let text = normalizeText(value);

    if (!text) return "";

    text = text
      .replace(/^(企业规模|单位规模|规模)/, "")
      .replace(/(企业|单位|规模)$/, "");

    const aliases = {
      "大": "大",
      "大型": "大",
      "大企业": "大",
      "大型企业": "大",
      "大规模": "大",

      "中": "中",
      "中型": "中",
      "中企业": "中",
      "中型企业": "中",
      "中等": "中",
      "中等型": "中",
      "中等规模": "中",

      "小": "小",
      "小型": "小",
      "小企业": "小",
      "小型企业": "小",
      "小规模": "小",

      "微": "微型",
      "微型": "微型",
      "微企业": "微型",
      "微型企业": "微型",
      "微小": "微型",
      "微小型": "微型",
      "微规模": "微型"
    };

    return aliases[text] || text;
  }

  function normalizeOrdinaryOptionValue(
    fieldConfig,
    value
  ) {
    return fieldConfig === CONFIG.fields.companyScale
      ? normalizeCompanyScale(value)
      : normalizeText(value);
  }


  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 &&
      s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
  }


  async function waitUntil(check, timeout = 6000, interval = 60, description = "条件") {
    const startedAt = Date.now();
    let lastError = null;

    while (Date.now() - startedAt < timeout) {
      try {
        const result = check();
        if (result) return result;
      } catch (error) {
        lastError = error;
      }

      await sleep(interval);
    }

    const suffix = lastError ? `；最后错误：${lastError.message || lastError}` : "";
    throw new Error(`等待${description}超时${suffix}`);
  }

  function getElementZIndex(element) {
    let current = element;
    let highest = 0;

    while (current && current !== document.documentElement) {
      const value = Number.parseInt(getComputedStyle(current).zIndex, 10);
      if (Number.isFinite(value)) highest = Math.max(highest, value);
      current = current.parentElement;
    }

    return highest;
  }

  function getElementDistance(a, b) {
    if (!a || !b) return Number.POSITIVE_INFINITY;

    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const ax = ar.left + ar.width / 2;
    const ay = ar.top + ar.height / 2;
    const bx = br.left + br.width / 2;
    const by = br.top + br.height / 2;

    return Math.hypot(ax - bx, ay - by);
  }

  const POPUP_SELECTOR = [
    ".el-select-dropdown",
    ".el-cascader__dropdown",
    ".el-cascader__suggestion-panel",
    ".el-autocomplete-suggestion",
    ".el-popper"
  ].join(",");

  function getVisiblePopups() {
    return [...new Set(
      [...document.querySelectorAll(POPUP_SELECTOR)]
        .map(element => element.closest(".el-popper") || element)
    )].filter(isVisible);
  }

  function snapshotVisiblePopups() {
    return new Set(getVisiblePopups());
  }

  function getControlledPopup(trigger) {
    const elements = [
      trigger,
      ...trigger.querySelectorAll?.("input,[aria-controls],[aria-owns]") || []
    ];

    for (const element of elements) {
      for (const attribute of ["aria-controls", "aria-owns"]) {
        const ids = String(element.getAttribute?.(attribute) || "")
          .split(/\s+/)
          .filter(Boolean);

        for (const id of ids) {
          const controlled = document.getElementById(id);
          const popup = controlled?.closest(POPUP_SELECTOR) || controlled;

          if (popup && isVisible(popup)) {
            return popup;
          }
        }
      }
    }

    return null;
  }

  function resolvePopupForTrigger(trigger, beforePopups, itemSelector) {
    const controlled = getControlledPopup(trigger);
    if (controlled && (!itemSelector || controlled.querySelector(itemSelector))) {
      return controlled;
    }

    const candidates = getVisiblePopups()
      .filter(popup => !itemSelector || popup.querySelector(itemSelector));

    if (!candidates.length) return null;

    const newlyVisible = candidates.filter(popup => !beforePopups?.has(popup));
    const pool = newlyVisible.length ? newlyVisible : candidates;

    return pool.sort((a, b) => {
      const zDifference = getElementZIndex(b) - getElementZIndex(a);
      if (zDifference) return zDifference;
      return getElementDistance(a, trigger) - getElementDistance(b, trigger);
    })[0] || null;
  }

  function getBusinessScope() {
    const dialogs = [...document.querySelectorAll(".el-dialog__wrapper, .el-dialog")]
      .filter(isVisible)
      .filter(d => !d.closest("#" + TOOL_ID) && !d.querySelector("#" + TOOL_ID));
    if (!dialogs.length) return document;
    return dialogs.sort((a, b) =>
      (Number(getComputedStyle(b).zIndex) || 0) -
      (Number(getComputedStyle(a).zIndex) || 0)
    )[0];
  }

  function findFieldItem(fieldConfig) {
    const aliases = fieldConfig.aliases.map(normalizeText);
    const items = [...getBusinessScope().querySelectorAll(".el-form-item")];

    return items.find(item => {
      const text = normalizeText(item.querySelector(".el-form-item__label")?.innerText);
      return aliases.includes(text);
    }) || items.find(item => {
      const text = normalizeText(item.querySelector(".el-form-item__label")?.innerText);
      return aliases.some(a => text.includes(a) || a.includes(text));
    }) || null;
  }

  function getFieldInput(fieldConfig) {
    const field = findFieldItem(fieldConfig);
    if (!field) throw new Error(`找不到字段：${fieldConfig.aliases.join(" / ")}`);

    const inputs = [...field.querySelectorAll("input:not([type='hidden']), textarea")];
    const input = inputs.find(isVisible) || inputs[0];
    if (!input) throw new Error(`找不到“${fieldConfig.aliases[0]}”输入框`);
    return input;
  }

  function clickElement(el) {
    if (!el) return;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const o = { bubbles: true, cancelable: true, composed: true, view: window };
    ["mouseenter", "mouseover", "mousedown", "mouseup", "click"]
      .forEach(type => el.dispatchEvent(new MouseEvent(type, o)));
  }

  function setNativeValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

    if (setter) setter.call(input, String(value));
    else input.value = String(value);

    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  function insertTextNaturally(input, value) {
    input.focus();
    try { input.select(); } catch {}
    let ok = false;
    try { ok = document.execCommand("insertText", false, String(value)); } catch {}
    if (!ok || cleanText(input.value) !== cleanText(value)) {
      setNativeValue(input, value);
    }
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }

  async function fillTextField(fieldConfig, value) {
    if (value == null || value === "") return;

    const input = getFieldInput(fieldConfig);
    const wanted = cleanText(value);

    input.scrollIntoView({ block: "center" });
    clickElement(input);
    input.focus();
    await sleep(80);

    setNativeValue(input, "");
    await waitUntil(
      () => cleanText(input.value) === "",
      1200,
      40,
      `“${fieldConfig.aliases[0]}”清空`
    );

    insertTextNaturally(input, value);

    try {
      await waitUntil(
        () => cleanText(input.value) === wanted,
        1800,
        50,
        `“${fieldConfig.aliases[0]}”写入`
      );
    } catch {
      input.focus();
      setNativeValue(input, value);
    }

    input.blur();

    await waitUntil(
      () => cleanText(input.value) === wanted,
      1800,
      50,
      `“${fieldConfig.aliases[0]}”保存`
    );

    if (cleanText(input.value) !== wanted) {
      throw new Error(`“${fieldConfig.aliases[0]}”填写失败，当前值为“${input.value}”`);
    }
  }

  async function fillNumberField(fieldConfig, value) {
    if (value == null || value === "") return;

    const numberText = String(value).replace(/[^\d.-]/g, "");
    const input = getFieldInput(fieldConfig);

    input.scrollIntoView({ block: "center" });
    clickElement(input);
    input.focus();
    await sleep(80);

    try { input.select(); } catch {}
    setNativeValue(input, "");

    await waitUntil(
      () => String(input.value) === "",
      1200,
      40,
      `“${fieldConfig.aliases[0]}”清空`
    );

    insertTextNaturally(input, numberText);

    try {
      await waitUntil(
        () => String(input.value) === numberText,
        1800,
        50,
        `“${fieldConfig.aliases[0]}”写入`
      );
    } catch {
      input.focus();
      setNativeValue(input, numberText);
    }

    input.blur();

    await waitUntil(
      () => String(input.value) === numberText,
      1800,
      50,
      `“${fieldConfig.aliases[0]}”保存`
    );

    if (String(input.value) !== numberText) {
      throw new Error(`“${fieldConfig.aliases[0]}”填写失败，当前值为“${input.value}”`);
    }
  }

  const getNodeText = node => cleanText(
    node?.querySelector(".el-cascader-node__label")?.innerText ||
    node?.innerText || ""
  );

  let activeAreaPanel = null;

  function isAreaPanel(panel) {
    if (!panel || !isVisible(panel)) return false;

    const firstMenu = panel.querySelector(".el-cascader-menu");
    if (!firstMenu) return false;

    const names = [...firstMenu.querySelectorAll(".el-cascader-node")].map(getNodeText);
    return CONFIG.fields.area.panelMarkers.filter(name => names.includes(name)).length >= 2;
  }

  function getAreaPanel() {
    if (activeAreaPanel && isAreaPanel(activeAreaPanel)) {
      return activeAreaPanel;
    }

    activeAreaPanel = [...document.querySelectorAll(".el-cascader-panel")]
      .filter(isAreaPanel)
      .sort((a, b) => getElementZIndex(b) - getElementZIndex(a))[0] || null;

    return activeAreaPanel;
  }

  async function openAreaField() {
    const field = findFieldItem(CONFIG.fields.area);
    const trigger = field?.querySelector(".el-cascader") || getFieldInput(CONFIG.fields.area);
    const beforePopups = snapshotVisiblePopups();

    trigger.scrollIntoView({ block: "center" });
    clickElement(trigger);

    const popup = await waitUntil(() => {
      const resolved = resolvePopupForTrigger(
        trigger,
        beforePopups,
        ".el-cascader-panel"
      );

      const panel = resolved?.matches?.(".el-cascader-panel")
        ? resolved
        : resolved?.querySelector?.(".el-cascader-panel");

      if (panel && isAreaPanel(panel)) return panel;

      return [...document.querySelectorAll(".el-cascader-panel")]
        .filter(isAreaPanel)
        .sort((a, b) => getElementZIndex(b) - getElementZIndex(a))[0] || null;
    }, CONFIG.optionTimeout, 70, "地区下拉面板出现");

    activeAreaPanel = popup;
    return activeAreaPanel;
  }

  function getAreaMenus() {
    const panel = getAreaPanel();
    return panel ? [...panel.querySelectorAll(".el-cascader-menu")].filter(isVisible) : [];
  }

  function getAreaNodes(level) {
    const menu = getAreaMenus()[level];
    return menu ? [...menu.querySelectorAll(".el-cascader-node")].filter(isVisible) : [];
  }

  const getAreaNames = level => getAreaNodes(level).map(getNodeText).filter(Boolean);

  function findAreaNode(level, wantedName) {
    const wanted = normalizeText(wantedName);
    return getAreaNodes(level).find(node =>
      normalizeText(getNodeText(node)) === wanted
    ) || null;
  }

  async function expandAreaNode(node, level) {
    const nextLevel = level + 1;
    const beforeSignature = getAreaNames(nextLevel)
      .map(normalizeText)
      .join("|||");

    const nodeName = getNodeText(node);
    clickElement(node);

    return await waitUntil(() => {
      const names = getAreaNames(nextLevel);
      if (!names.length) return false;

      const afterSignature = names.map(normalizeText).join("|||");
      const refreshed = findAreaNode(level, nodeName);
      const active =
        refreshed?.classList.contains("in-active-path") ||
        refreshed?.classList.contains("is-active") ||
        refreshed?.getAttribute("aria-expanded") === "true";

      return (!beforeSignature || beforeSignature !== afterSignature || active) && true;
    }, CONFIG.optionTimeout, 70, `地区“${nodeName}”的下一级菜单加载`);
  }

  function findRepeatedAreaBridgeNode(
    level,
    previousSelectedName
  ) {
    const previousKey =
      normalizeText(previousSelectedName);

    if (!previousKey) return null;

    const matches =
      getAreaNodes(level)
        .filter(node =>
          normalizeText(
            getNodeText(node)
          ) === previousKey
        );

    // 当前层中仅有一个与上一层同名的节点时，
    // 作为网站额外的过渡层自动展开。
    return matches.length === 1
      ? matches[0]
      : null;
  }

  async function selectAreaPath(path) {
    if (!path?.length) return null;

    await openAreaField();

    let targetIndex = 0;
    let menuLevel = 0;
    let bridgeCount = 0;

    const maximumBridges = 5;
    const actualPath = [];
    const autoBridges = [];

    while (targetIndex < path.length) {
      const targetName =
        path[targetIndex];

      await waitUntil(
        () =>
          getAreaNames(menuLevel)
            .length > 0,
        CONFIG.optionTimeout,
        70,
        `地区第 ${menuLevel + 1} 级菜单出现`
      );

      const targetNode =
        findAreaNode(
          menuLevel,
          targetName
        );

      if (targetNode) {
        const selectedName =
          getNodeText(targetNode) ||
          targetName;

        actualPath.push(selectedName);

        if (
          targetIndex ===
          path.length - 1
        ) {
          clickElement(targetNode);

          await waitUntil(
            () =>
              !isVisible(activeAreaPanel) ||
              normalizeText(
                getFieldDisplayedText(
                  findFieldItem(
                    CONFIG.fields.area
                  )
                )
              ).includes(
                normalizeText(targetName)
              ),
            CONFIG.optionTimeout,
            70,
            `地区“${targetName}”选中`
          );

          activeAreaPanel = null;

          return {
            requestedPath: [...path],
            actualPath,
            autoBridges
          };
        }

        await expandAreaNode(
          targetNode,
          menuLevel
        );

        targetIndex++;
        menuLevel++;
        continue;
      }

      const previousSelectedName =
        actualPath[
          actualPath.length - 1
        ] ||
        path[targetIndex - 1] ||
        "";

      const bridgeNode =
        findRepeatedAreaBridgeNode(
          menuLevel,
          previousSelectedName
        );

      if (
        bridgeNode &&
        bridgeCount < maximumBridges
      ) {
        const bridgeName =
          getNodeText(bridgeNode);

        autoBridges.push({
          level: menuLevel + 1,
          name: bridgeName
        });

        actualPath.push(bridgeName);
        bridgeCount++;

        console.info(
          `[单位填写-地区] 自动跨越重复层级：${bridgeName}`
        );

        // 不消耗当前目标，例如仍继续寻找“蒲西街道”。
        await expandAreaNode(
          bridgeNode,
          menuLevel
        );

        menuLevel++;
        continue;
      }

      const available =
        getAreaNames(menuLevel)
          .slice(0, 15)
          .join("、");

      const selectedText =
        actualPath.length
          ? actualPath.join(" / ")
          : "尚未选择";

      throw new Error(
        `地区第 ${menuLevel + 1} 级找不到“${targetName}”。` +
        `当前可选：${available || "无"}；` +
        `已选择：${selectedText}`
      );
    }

    throw new Error(
      "地区路径处理未正常结束"
    );
  }

  const SEARCH_SELECTION_TIMING = {
    resultStableMs: 160,
    arrowStepMs: 55,
    selectionTimeout: 3200,
    maximumMoves: 32
  };

  function getSearchInput(field) {
    const active = document.activeElement;

    if (
      active instanceof HTMLInputElement &&
      field.contains(active) &&
      isVisible(active) &&
      !active.readOnly
    ) {
      return active;
    }

    const candidates = [
      ...field.querySelectorAll(
        "input.el-cascader__search-input, " +
        "input.el-select__input, " +
        ".el-cascader__tags input, " +
        "input:not([readonly]):not([type='hidden'])"
      )
    ].filter(isVisible);

    return candidates[candidates.length - 1] || null;
  }

  function getVisibleCascaderTreePanels(
    popup = null
  ) {
    const root = popup || document;

    return [
      ...root.querySelectorAll(
        ".el-cascader-panel"
      )
    ].filter(isVisible);
  }

  function getVisibleSuggestionPanels(
    popup = null
  ) {
    const root = popup || document;

    const panels = [
      ...root.querySelectorAll(
        ".el-cascader__suggestion-panel, " +
        ".el-autocomplete-suggestion"
      )
    ].filter(isVisible);

    if (
      root instanceof Element &&
      root.matches(
        ".el-cascader__suggestion-panel, " +
        ".el-autocomplete-suggestion"
      ) &&
      isVisible(root)
    ) {
      panels.unshift(root);
    }

    return [...new Set(panels)];
  }

  function isCascaderSuggestionMode(
    popup
  ) {
    if (!popup || !isVisible(popup)) {
      return false;
    }

    const suggestionPanels =
      getVisibleSuggestionPanels(popup);

    if (
      suggestionPanels.some(panel =>
        getSuggestionCandidates(panel)
          .length > 0
      )
    ) {
      return true;
    }

    return (
      getSuggestionCandidates(popup)
        .length > 0
    );
  }

  function getSuggestionModeCandidates(
    popup
  ) {
    if (!isCascaderSuggestionMode(popup)) {
      return [];
    }

    const panels =
      getVisibleSuggestionPanels(popup);

    const candidates = panels.length
      ? panels.flatMap(panel =>
        getSuggestionCandidates(panel)
      )
      : getSuggestionCandidates(popup);

    return [...new Set(candidates)];
  }

  function getSuggestionCandidates(popup = null) {
    const root = popup || document;
    const selectors = [
      ".el-cascader__suggestion-item",
      ".el-cascader__suggestion-list li",
      ".el-cascader__suggestion-panel li",
      ".el-autocomplete-suggestion li"
    ];

    return [
      ...new Set(
        selectors.flatMap(selector => [
          ...root.querySelectorAll(selector)
        ])
      )
    ]
      .filter(isVisible)
      .filter(item =>
        !item.classList.contains("is-disabled") &&
        item.getAttribute("aria-disabled") !== "true"
      );
  }

  function getSuggestionCandidateText(item) {
    return cleanText(
      item?.innerText ||
      item?.textContent ||
      getNodeText(item) ||
      ""
    );
  }

  function splitSearchPath(value) {
    return cleanText(value)
      .split(
        /\s*(?:[\/／\\>＞→➜➡、|｜]+|[\r\n]+)\s*/
      )
      .map(cleanText)
      .filter(Boolean);
  }

  function isExactSearchText(candidateText, wantedValue) {
    const candidate = normalizeText(candidateText);
    const wanted = normalizeText(wantedValue);

    if (!candidate || !wanted) return false;
    if (candidate === wanted) return true;

    const candidatePath = splitSearchPath(candidateText)
      .map(normalizeText)
      .filter(Boolean);

    const wantedPath = splitSearchPath(wantedValue)
      .map(normalizeText)
      .filter(Boolean);

    if (!candidatePath.length || !wantedPath.length) {
      return false;
    }

    // 输入本身带完整路径时，要求整条路径完全相同。
    if (wantedPath.length > 1) {
      return (
        candidatePath.length === wantedPath.length &&
        candidatePath.every(
          (part, index) => part === wantedPath[index]
        )
      );
    }

    // 通常输入最后一级标准名称，只允许候选最后一级完全相同。
    return (
      candidatePath[candidatePath.length - 1] ===
      wantedPath[0]
    );
  }

  async function waitForStableSuggestionCandidates(
    popup,
    fieldName
  ) {
    const startedAt = Date.now();
    let previousSignature = "";
    let stableSince = 0;

    while (
      Date.now() - startedAt <
      CONFIG.searchTimeout
    ) {
      const candidates =
        getSuggestionModeCandidates(
          popup
        );

      const signature = candidates
        .map(getSuggestionCandidateText)
        .filter(Boolean)
        .join("|||");

      if (signature) {
        if (
          signature ===
          previousSignature
        ) {
          if (!stableSince) {
            stableSince = Date.now();
          }

          if (
            Date.now() - stableSince >=
            SEARCH_SELECTION_TIMING.resultStableMs
          ) {
            return candidates;
          }
        } else {
          previousSignature =
            signature;
          stableSince = Date.now();
        }
      } else {
        previousSignature = "";
        stableSince = 0;
      }

      await sleep(45);
    }

    const treeVisible =
      getVisibleCascaderTreePanels(
        popup
      ).length > 0;

    throw new Error(
      treeVisible
        ? `“${fieldName}”仍停留在普通级联列表，未切换到搜索结果模式`
        : `“${fieldName}”搜索结果没有稳定显示`
    );
  }

  function createSearchKeyboardEvent(
    type,
    key,
    keyCode
  ) {
    const event = new KeyboardEvent(type, {
      key,
      code: key,
      keyCode,
      which: keyCode,
      charCode:
        type === "keypress" ? keyCode : 0,
      bubbles: true,
      cancelable: true,
      composed: true,
      repeat: false,
      location: 0
    });

    // 兼容 Vue 2 和旧版 Element UI 对 keyCode / which 的读取。
    for (const property of [
      "keyCode",
      "which",
      "charCode"
    ]) {
      try {
        Object.defineProperty(event, property, {
          configurable: true,
          get: () =>
            property === "charCode" &&
            type !== "keypress"
              ? 0
              : keyCode
        });
      } catch {}
    }

    return event;
  }

  function dispatchSearchKey(
    input,
    key,
    keyCode
  ) {
    if (!input) return;

    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }

    input.dispatchEvent(
      createSearchKeyboardEvent(
        "keydown",
        key,
        keyCode
      )
    );

    if (key === "Enter") {
      input.dispatchEvent(
        createSearchKeyboardEvent(
          "keypress",
          key,
          keyCode
        )
      );
    }

    input.dispatchEvent(
      createSearchKeyboardEvent(
        "keyup",
        key,
        keyCode
      )
    );
  }

  function getHighlightedSuggestion(popup) {
    const candidates = getSuggestionCandidates(popup);

    return candidates.find(item =>
      item.classList.contains("hover") ||
      item.classList.contains("is-hover") ||
      item.classList.contains("is-focus") ||
      item.classList.contains("is-active") ||
      item.classList.contains("is-checked") ||
      item.getAttribute("aria-selected") === "true"
    ) || null;
  }

  function getHighlightedSuggestionText(popup) {
    return getSuggestionCandidateText(
      getHighlightedSuggestion(popup)
    );
  }

  function getCommittedSearchTexts(field) {
    if (!field) return [];

    const values = [];
    const addValue = value => {
      const text = cleanText(value)
        .replace(/[×✕✖]\s*$/g, "")
        .trim();

      if (text) values.push(text);
    };

    // 已选标签。
    [
      ...field.querySelectorAll(
        ".el-cascader__tags .el-tag, " +
        ".el-select__tags .el-tag, " +
        ".el-tag__content"
      )
    ]
      .filter(isVisible)
      .forEach(element => {
        addValue(
          element.innerText ||
          element.textContent
        );
      });

    // 只读取真实显示框；搜索输入框、placeholder 和字段整体文字不参与。
    [
      ...field.querySelectorAll(
        "input:not([type='hidden']), textarea"
      )
    ]
      .filter(isVisible)
      .forEach(input => {
        const isSearchInput =
          input.classList.contains(
            "el-cascader__search-input"
          ) ||
          input.classList.contains(
            "el-select__input"
          );

        if (isSearchInput) return;
        if (!input.readOnly) return;

        addValue(input.value);
      });

    [
      ...field.querySelectorAll(
        ".el-cascader__label, " +
        ".el-select__selected-item"
      )
    ]
      .filter(isVisible)
      .forEach(element => {
        addValue(
          element.innerText ||
          element.textContent
        );
      });

    return [
      ...new Set(
        values.map(cleanText).filter(Boolean)
      )
    ];
  }

  function getConfirmedSearchText(
    field,
    wantedValue
  ) {
    return getCommittedSearchTexts(field)
      .find(text =>
        isExactSearchText(text, wantedValue)
      ) || "";
  }

  function hasHierarchyPathSeparator(
    value
  ) {
    return /[\/／\\>＞→➜➡、|｜]/.test(
      cleanText(value)
    );
  }

  function hasVisibleSelectedClearControl(
    field
  ) {
    if (!field) return false;

    const selectors = [
      ".el-cascader__clearIcon",
      ".el-input__suffix .el-icon-circle-close",
      ".el-input__suffix .el-icon-close",
      ".el-input__suffix [class*='circle-close']",
      ".el-input__suffix [class*='clear']",
      ".el-select__caret.el-icon-circle-close",
      "[class*='clearIcon']"
    ];

    return selectors.some(selector =>
      [
        ...field.querySelectorAll(
          selector
        )
      ].some(isVisible)
    );
  }

  function getClosedEditableSelectionTexts(
    field,
    wantedValue
  ) {
    if (!field) return [];

    const hasClearControl =
      hasVisibleSelectedClearControl(
        field
      );

    const values = [];

    [
      ...field.querySelectorAll(
        "input:not([type='hidden']), textarea"
      )
    ]
      .filter(isVisible)
      .forEach(input => {
        if (input.readOnly) return;

        const value =
          cleanText(input.value);

        if (!value) return;

        if (
          !isExactSearchText(
            value,
            wantedValue
          )
        ) {
          return;
        }

        /*
         * 可编辑输入框只有在具备明确“已提交”证据时才接受：
         *
         * 1. 值本身是完整级联路径；
         * 2. 或字段出现清除已选内容的 × 按钮。
         *
         * 因此单独留在搜索框中的“家具零售”等关键词，
         * 在没有勾选、没有路径、没有清除按钮时仍不会算成功。
         */
        if (
          !hasHierarchyPathSeparator(
            value
          ) &&
          !hasClearControl
        ) {
          return;
        }

        values.push(value);
      });

    return [
      ...new Set(
        values
          .map(cleanText)
          .filter(Boolean)
      )
    ];
  }

  function getConfirmedClosedSearchText(
    field,
    wantedValue
  ) {
    const committed =
      getConfirmedSearchText(
        field,
        wantedValue
      );

    if (committed) {
      return committed;
    }

    return (
      getClosedEditableSelectionTexts(
        field,
        wantedValue
      )[0] ||
      ""
    );
  }

  function isSuggestionExplicitlySelected(
    candidate
  ) {
    if (!candidate || !isVisible(candidate)) {
      return false;
    }

    if (
      candidate.classList.contains(
        "is-checked"
      ) ||
      candidate.classList.contains(
        "is-selected"
      ) ||
      candidate.getAttribute(
        "aria-selected"
      ) === "true" ||
      candidate.getAttribute(
        "aria-checked"
      ) === "true"
    ) {
      return true;
    }

    const checkedInput =
      candidate.querySelector(
        "input[type='checkbox']:checked, " +
        "input[type='radio']:checked"
      );

    if (checkedInput) return true;

    // 截图中的 Element UI 搜索候选会在右侧生成勾选图标。
    // 只接受明确的 check 图标，不把 hover / active 当作已选。
    const checkIcon =
      candidate.querySelector(
        ".el-icon-check, " +
        ".el-icon-circle-check, " +
        ".el-icon-success, " +
        "[class*='icon-check']"
      );

    return Boolean(
      checkIcon &&
      isVisible(checkIcon)
    );
  }

  function getCurrentSearchInputValue(
    field
  ) {
    if (!field) return "";

    const searchInputs = [
      ...field.querySelectorAll(
        "input.el-cascader__search-input, " +
        ".el-cascader__tags input, " +
        "input.el-select__input, " +
        "input:not([readonly]):not([type='hidden'])"
      )
    ].filter(isVisible);

    const active =
      document.activeElement;

    const input =
      searchInputs.find(item =>
        item === active
      ) ||
      searchInputs[
        searchInputs.length - 1
      ] ||
      null;

    return cleanText(
      input?.value
    );
  }

  function getConfirmedOpenSuggestionText(
    popup,
    field,
    wantedValue
  ) {
    if (
      !popup ||
      !isVisible(popup) ||
      !isCascaderSuggestionMode(popup)
    ) {
      return "";
    }

    const exactCandidates =
      getSuggestionModeCandidates(
        popup
      ).filter(candidate =>
        isExactSearchText(
          getSuggestionCandidateText(
            candidate
          ),
          wantedValue
        )
      );

    // 必须仍然只有一个精确候选。
    if (exactCandidates.length !== 1) {
      return "";
    }

    const candidate =
      exactCandidates[0];

    // 必须有明确的“已勾选”证据。
    if (
      !isSuggestionExplicitlySelected(
        candidate
      )
    ) {
      return "";
    }

    // 同时要求当前搜索框内容与目标完全一致，
    // 防止页面残留旧候选勾选状态。
    const currentInputValue =
      getCurrentSearchInputValue(field);

    if (
      !isExactSearchText(
        currentInputValue,
        wantedValue
      )
    ) {
      return "";
    }

    return getSuggestionCandidateText(
      candidate
    );
  }

  function selectUniqueExactSuggestion(
    popup,
    exactCandidate,
    fieldName,
    wantedValue
  ) {
    if (
      !exactCandidate ||
      !exactCandidate.isConnected ||
      !isVisible(exactCandidate)
    ) {
      throw new Error(
        `“${fieldName}”的精确候选在选择前已经消失`
      );
    }

    if (
      !getSuggestionModeCandidates(
        popup
      ).includes(exactCandidate)
    ) {
      throw new Error(
        `“${fieldName}”当前已退出搜索结果模式，未执行选择`
      );
    }

    const candidateText =
      getSuggestionCandidateText(
        exactCandidate
      );

    if (
      !isExactSearchText(
        candidateText,
        wantedValue
      )
    ) {
      throw new Error(
        `候选“${candidateText}”与目标“${wantedValue}”不完全一致`
      );
    }

    clickElement(exactCandidate);

    return {
      mode: "unique-exact-suggestion",
      candidateText
    };
  }

  async function fillAndChooseSearch(
    fieldConfig,
    value
  ) {
    if (!value) return "";

    const fieldName =
      fieldConfig.aliases[0];

    let field =
      findFieldItem(fieldConfig);

    if (!field) {
      throw new Error(
        `找不到字段：${fieldName}`
      );
    }

    const trigger =
      field.querySelector(
        ".el-cascader"
      ) ||
      field.querySelector(
        ".el-input"
      ) ||
      field;

    const beforePopups =
      snapshotVisiblePopups();

    trigger.scrollIntoView({
      block: "center"
    });

    // 未输入时会先显示普通级联树，这是正常状态。
    clickElement(trigger);

    let searchInput =
      await waitUntil(
        () => {
          const liveField =
            findFieldItem(fieldConfig);

          return liveField
            ? getSearchInput(liveField)
            : null;
        },
        CONFIG.optionTimeout,
        50,
        `“${fieldName}”搜索输入框出现`
      );

    clickElement(searchInput);

    try {
      searchInput.focus({
        preventScroll: true
      });
    } catch {
      searchInput.focus();
    }

    await sleep(55);

    try {
      searchInput.select();
    } catch {}

    setNativeValue(
      searchInput,
      ""
    );

    await waitUntil(
      () =>
        cleanText(
          searchInput.value
        ) === "",
      1000,
      35,
      `“${fieldName}”搜索框清空`
    );

    insertTextNaturally(
      searchInput,
      value
    );

    // 输入后必须切换到搜索结果列表。
    const popup =
      await waitUntil(
        () => {
          const liveField =
            findFieldItem(fieldConfig);

          const liveTrigger =
            liveField?.querySelector(
              ".el-cascader"
            ) ||
            liveField?.querySelector(
              ".el-input"
            ) ||
            liveField;

          if (!liveTrigger) {
            return null;
          }

          const resolved =
            resolvePopupForTrigger(
              liveTrigger,
              beforePopups,
              ".el-cascader__suggestion-item, " +
              ".el-cascader__suggestion-list li, " +
              ".el-cascader__suggestion-panel li, " +
              ".el-autocomplete-suggestion li"
            );

          return (
            resolved &&
            isCascaderSuggestionMode(
              resolved
            )
              ? resolved
              : null
          );
        },
        CONFIG.searchTimeout,
        55,
        `“${fieldName}”切换到搜索结果模式`
      );

    const candidates =
      await waitForStableSuggestionCandidates(
        popup,
        fieldName
      );

    const exactCandidates =
      candidates.filter(item =>
        isExactSearchText(
          getSuggestionCandidateText(
            item
          ),
          value
        )
      );

    if (!exactCandidates.length) {
      const preview = candidates
        .map(
          getSuggestionCandidateText
        )
        .filter(Boolean)
        .slice(0, 8)
        .join("、");

      throw new Error(
        `搜索结果中没有与“${value}”完全一致的末级选项。` +
        `当前候选：${preview || "无"}`
      );
    }

    if (
      exactCandidates.length > 1
    ) {
      const duplicatePreview =
        exactCandidates
          .map(
            getSuggestionCandidateText
          )
          .filter(Boolean)
          .slice(0, 8)
          .join("、");

      throw new Error(
        `搜索结果中存在多个完全一致的候选“${value}”，` +
        `无法安全选择：${duplicatePreview}`
      );
    }

    const selection =
      selectUniqueExactSuggestion(
        popup,
        exactCandidates[0],
        fieldName,
        value
      );

    try {
      const confirmed =
        await waitUntil(
          () => {
            const liveField =
              findFieldItem(
                fieldConfig
              );

            if (!liveField) {
              return false;
            }

            const suggestionClosed =
              Boolean(
                !popup.isConnected ||
                !isVisible(popup) ||
                !isCascaderSuggestionMode(
                  popup
                )
              );

            if (suggestionClosed) {
              return (
                getConfirmedClosedSearchText(
                  liveField,
                  value
                ) ||
                false
              );
            }

            // 部分级联控件选中后列表不会立即关闭，
            // 但唯一精确候选会出现明确勾选。
            // 只有“精确候选 + 明确勾选 + 输入值一致”
            // 三项同时满足，才视为真实选中。
            return (
              getConfirmedOpenSuggestionText(
                popup,
                liveField,
                value
              ) ||
              false
            );
          },
          SEARCH_SELECTION_TIMING
            .selectionTimeout,
          55,
          `“${fieldName}”真实选中值写入`
        );

      console.info(
        `[单位填写-双状态级联] ${fieldName}`,
        {
          wanted: value,
          mode: selection.mode,
          candidate:
            selection.candidateText,
          confirmed
        }
      );

      return confirmed;
    } catch {
      const liveField =
        findFieldItem(fieldConfig);

      const currentValues =
        getCommittedSearchTexts(
          liveField
        );

      const editableSelected =
        getClosedEditableSelectionTexts(
          liveField,
          value
        );

      const openSelected =
        getConfirmedOpenSuggestionText(
          popup,
          liveField,
          value
        );

      throw new Error(
        `已选择唯一精确候选“${selection.candidateText}”，` +
        `但没有确认到稳定的真实选中状态。` +
        `只读/标签值：${
          currentValues.join("、") ||
          "空"
        }；` +
        `可编辑正式值：${
          editableSelected.join("、") ||
          "空"
        }；` +
        `列表勾选值：${
          openSelected || "空"
        }`
      );
    }
  }

  function getVisibleSelectOptions(popup = null) {
    const root = popup || document;

    return [
      ...root.querySelectorAll(
        ".el-select-dropdown__item, .el-dropdown-menu__item"
      )
    ]
      .filter(isVisible)
      .filter(item =>
        !item.classList.contains("is-disabled") &&
        item.getAttribute("aria-disabled") !== "true"
      );
  }


  // 普通选择专用轻量点击：
  // Element UI 单选/下拉不需要完整 mouseenter/mouseover 流程，
  // 减少额外事件触发。
  function fastClick(element) {
    if (!element) return;

    try {
      element.dispatchEvent(new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        view: window
      }));

      element.dispatchEvent(new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        view: window
      }));

      element.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
      }));
    } catch (e) {
      element.click();
    }
  }

  async function chooseOrdinaryOption(fieldConfig, value) {
    if (!value) return;

    const field = findFieldItem(fieldConfig);
    if (!field) {
      throw new Error(`找不到字段：${fieldConfig.aliases[0]}`);
    }

    const wanted =
      normalizeOrdinaryOptionValue(
        fieldConfig,
        value
      );

    field.scrollIntoView({
      block: "center",
      inline: "nearest"
    });

    await sleep(100);

    // 优先处理 radio 类型
    const direct = [
      ...field.querySelectorAll(".el-radio, .el-radio-button, label")
    ]
      .filter(isVisible)
      .find(item => {
        const text =
          normalizeOrdinaryOptionValue(
            fieldConfig,
            item.querySelector(".el-radio__label")?.innerText ||
            item.querySelector(".el-radio-button__inner")?.innerText ||
            item.innerText
          );

        return text === wanted;
      });

    if (direct) {
      fastClick(
        direct.querySelector("input") ||
        direct.querySelector(".el-radio__inner") ||
        direct
      );

      await sleep(300);

      return;
    }

    // 普通下拉
    const trigger =
      field.querySelector(".el-select") ||
      field.querySelector(".el-input") ||
      field.querySelector("input");

    if (!trigger) {
      throw new Error(`找不到“${fieldConfig.aliases[0]}”选择控件`);
    }

    const beforePopups = snapshotVisiblePopups();

    fastClick(trigger);

    const popup = await waitUntil(() => {
      const resolved = resolvePopupForTrigger(
        trigger,
        beforePopups,
        ".el-select-dropdown__item, .el-dropdown-menu__item"
      );

      return resolved && getVisibleSelectOptions(resolved).length
        ? resolved
        : null;
    }, 2500, 50, `“${fieldConfig.aliases[0]}”下拉弹层出现`);

    const options =
      getVisibleSelectOptions(popup);

    const option = options.find(item =>
      normalizeOrdinaryOptionValue(
        fieldConfig,
        item.innerText
      ) === wanted
    );

    if (!option) {
      const available = options
        .map(item =>
          cleanText(item.innerText)
        )
        .filter(Boolean)
        .slice(0, 20)
        .join("、");

      const scaleInfo =
        fieldConfig ===
        CONFIG.fields.companyScale
          ? `（已按标准值“${wanted}”匹配）`
          : "";

      throw new Error(
        `找不到选项：${value}${scaleInfo}。` +
        `当前可选：${available || "无"}`
      );
    }

    fastClick(option);

    // 不等待长时间 Vue 回写，只给页面一次刷新时间
    await sleep(300);
  }


  const KEY_ALIASES = {
    area: ["地区", "区域", "地区路径", "所属地区"],
    industry: ["行业类别", "行业类型", "所属行业", "行业"],
    economy: ["经济类型", "经济性质"],
    unitType: ["单位类型"],
    socialCreditCode: ["社会信用代码", "统一社会信用代码", "统一信用代码", "信用代码"],
    companyScale: ["企业规模", "单位规模", "规模"],
    medicalCount: ["体检人数", "体检数", "人数"],
    syncBianQue: ["报告同步扁鹊", "同步扁鹊", "是否同步扁鹊"]
  };

  function resolveKey(rawKey) {
    const key = normalizeText(rawKey);
    for (const [std, aliases] of Object.entries(KEY_ALIASES)) {
      if (aliases.some(a => normalizeText(a) === key)) return std;
    }
    return null;
  }

  function parseInput(text) {
    const data = {
      area: "",
      industry: "",
      economy: "",
      unitType: CONFIG.defaults.unitType,
      socialCreditCode: "",
      companyScale: "",
      medicalCount: "",
      syncBianQue: CONFIG.defaults.syncBianQue
    };

    const lines = String(text).split(/\r?\n/).map(cleanText).filter(Boolean);
    let namedCount = 0;
    const unnamed = [];

    for (const line of lines) {
      const match = line.match(/^([^:：]+)\s*[:：]\s*(.*)$/);
      if (!match) {
        unnamed.push(line);
        continue;
      }

      const key = resolveKey(match[1]);
      if (!key) {
        unnamed.push(line);
        continue;
      }

      data[key] = cleanText(match[2]);
      namedCount++;
    }

    if (namedCount === 0 && unnamed.length >= 3) {
      data.area = unnamed[0] || "";
      data.industry = unnamed[1] || "";
      data.economy = unnamed[2] || "";
      data.socialCreditCode = unnamed[3] || "";
      data.companyScale = unnamed[4] || "";
      data.medicalCount = unnamed[5] || "";
    }

    return data;
  }

  function splitAreaPath(value) {
    const raw = cleanText(value);
    if (!raw) return [];

    const parts = raw
      .replace(/[\r\n\t]+/g, " ")
      .split(
        /\s*(?:[\/／\\>＞→➜➡、,，;；|｜]+|[-－—–―]+|\s+)\s*/
      )
      .map(cleanText)
      .filter(Boolean)
      .filter(part =>
        ![
          "中国",
          "中华人民共和国"
        ].includes(normalizeText(part))
      );

    const province =
      CONFIG.defaults.province;

    const provinceKey =
      normalizeText(province);

    const result = [];

    for (const part of parts) {
      const key = normalizeText(part);
      if (!key) continue;

      if (
        key === "河南" ||
        key === provinceKey
      ) {
        if (!result.length) {
          result.push(province);
        }
        continue;
      }

      // 输入中连续出现相同层级时去重。
      if (
        result.length &&
        normalizeText(
          result[result.length - 1]
        ) === key
      ) {
        continue;
      }

      result.push(part);
    }

    if (
      !result.length ||
      normalizeText(result[0]) !==
        provinceKey
    ) {
      result.unshift(province);
    }

    return result;
  }

  function findScrollContainer(scope) {
    return [scope, ...scope.querySelectorAll("*")].find(el => {
      if (!isVisible(el)) return false;
      const style = getComputedStyle(el);
      return el.scrollHeight > el.clientHeight + 60 &&
        ["auto", "scroll"].includes(style.overflowY);
    }) || null;
  }

  async function scrollBusinessFormTop() {
    const scope = getBusinessScope();
    const container = findScrollContainer(scope);

    if (container) container.scrollTo({ top: 0, behavior: "auto" });
    else scope.scrollIntoView({ block: "start", behavior: "auto" });

    await sleep(350);
  }

  async function processData(data, updateStatus) {
    const completed = [];
    const planned = [];

    if (data.socialCreditCode) planned.push("社会信用代码");
    if (data.medicalCount) {
      planned.push("职工数");
      planned.push("接害人数");
    }
    if (data.unitType) planned.push("单位类型");
    if (data.companyScale) planned.push("企业规模");
    if (data.syncBianQue) planned.push("报告同步扁鹊");
    if (data.area) planned.push("地区");
    if (data.industry) planned.push("行业类别");
    if (data.economy) planned.push("经济类型");

    async function runStep(name, statusText, action, successText) {
      updateStatus(statusText);

      try {
        const result = await action();
        completed.push(successText(result));
        return result;
      } catch (error) {
        error.runSummary = {
          completed: [...completed],
          failed: `${name}：${error.message || error}`,
          pending: planned.slice(completed.length + 1)
        };
        throw error;
      }
    }

    // 第一组：纯输入字段
    if (data.socialCreditCode) {
      await runStep(
        "社会信用代码",
        `第一阶段：填写数据\n\n正在填写社会信用代码：${data.socialCreditCode}`,
        () => fillTextField(CONFIG.fields.socialCreditCode, data.socialCreditCode),
        () => `社会信用代码：${data.socialCreditCode}`
      );
    }

    if (data.medicalCount) {
      await runStep(
        "职工数",
        `第一阶段：填写数据\n\n正在把体检人数 ${data.medicalCount} 填入职工数`,
        () => fillNumberField(CONFIG.fields.employeeCount, data.medicalCount),
        () => `职工数：${data.medicalCount}`
      );

      await runStep(
        "接害人数",
        `第一阶段：填写数据\n\n正在把体检人数 ${data.medicalCount} 填入接害人数`,
        () => fillNumberField(CONFIG.fields.exposedCount, data.medicalCount),
        () => `接害人数：${data.medicalCount}`
      );
    }

    await scrollBusinessFormTop();

    // 第二组：普通选择组件
    if (data.unitType) {
      await runStep(
        "单位类型",
        `第二阶段：普通选择\n\n正在选择单位类型：${data.unitType}`,
        () => chooseOrdinaryOption(CONFIG.fields.unitType, data.unitType),
        () => `单位类型：${data.unitType}`
      );
    }

    if (data.companyScale) {
      const standardScale =
        normalizeCompanyScale(
          data.companyScale
        );

      await runStep(
        "企业规模",
        `第二阶段：普通选择\n\n` +
        `输入值：${data.companyScale}\n` +
        `标准选项：${standardScale}`,
        () =>
          chooseOrdinaryOption(
            CONFIG.fields.companyScale,
            standardScale
          ),
        () =>
          `企业规模：${standardScale}`
      );
    }

    if (data.syncBianQue) {
      await runStep(
        "报告同步扁鹊",
        `第二阶段：普通选择\n\n正在选择报告同步扁鹊：${data.syncBianQue}`,
        () => chooseOrdinaryOption(CONFIG.fields.syncBianQue, data.syncBianQue),
        () => `报告同步扁鹊：${data.syncBianQue}`
      );
    }

    // 第三组：复杂组件（级联/搜索）
    if (data.area) {
      const path = splitAreaPath(data.area);

      if (path.length < 2) {
        const error = new Error(
          "地区内容不足。可输入例如：驻马店市 泌阳县 泰山庙镇；脚本会自动补上河南省。"
        );
        error.runSummary = {
          completed: [...completed],
          failed: `地区：${error.message}`,
          pending: planned.slice(completed.length + 1)
        };
        throw error;
      }

      await runStep(
        "地区",
        `第三阶段：复杂选择\n\n正在选择地区：\n${path.join(" / ")}`,
        () => selectAreaPath(path),
        result => {
          const actualPath =
            result?.actualPath?.length
              ? result.actualPath.join(
                " / "
              )
              : path.join(" / ");

          const bridgeText =
            result?.autoBridges?.length
              ? `（自动跨越：${
                result.autoBridges
                  .map(item => item.name)
                  .join("、")
              }）`
              : "";

          return (
            `地区：${actualPath}` +
            bridgeText
          );
        }
      );
    }

    if (data.industry) {
      await runStep(
        "行业类别",
        `第三阶段：搜索组件\n\n正在搜索并选择行业类别：\n${data.industry}`,
        () => fillAndChooseSearch(CONFIG.fields.industry, data.industry),
        selected => `行业类别：${selected || data.industry}`
      );
    }

    if (data.economy) {
      await runStep(
        "经济类型",
        `第三阶段：搜索组件\n\n正在搜索并选择经济类型：\n${data.economy}`,
        () => fillAndChooseSearch(CONFIG.fields.economy, data.economy),
        selected => `经济类型：${selected || data.economy}`
      );
    }

    return {
      completed,
      failed: null,
      pending: []
    };
  }


  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${TOOL_ID}{
      position:fixed;top:80px;left:calc(100vw - 485px);
      z-index:2147483647;width:465px;min-width:360px;
      max-width:calc(100vw - 8px);max-height:calc(100vh - 55px);
      box-sizing:border-box;overflow:hidden;
      border:1px solid #cfd5df;border-radius:9px;background:#fff;
      box-shadow:0 8px 32px rgba(0,0,0,.25);
      font-family:"Microsoft YaHei",sans-serif;color:#303133
    }
    #${TOOL_ID}.is-dragging,
    #${TOOL_ID}.is-resizing{user-select:none}
    #${TOOL_ID} .tool-header{
      display:flex;align-items:center;justify-content:space-between;
      padding:12px 14px;border-bottom:1px solid #ebeef5;
      background:#f5f7fa;font-size:16px;cursor:grab;user-select:none
    }
    #${TOOL_ID} .tool-header:active{cursor:grabbing}
    #${TOOL_ID} .tool-header strong{
      min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap
    }
    #${TOOL_ID} .tool-header-actions{
      display:flex;align-items:center;gap:5px;margin-left:10px;margin-right:10px
    }
    #${TOOL_ID} .tool-header-button{
      width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;
      flex:0 0 auto;border:0;border-radius:4px;padding:0;
      background:transparent;color:#606266;font-size:20px;line-height:1;cursor:pointer
    }
    #${TOOL_ID} .tool-header-button:hover{background:#e9edf3;color:#409eff}
    #${TOOL_ID} .tool-close{font-size:26px}
    #${TOOL_ID} .tool-body{
      padding:12px 14px;overflow:auto;max-height:calc(100vh - 105px);
      box-sizing:border-box
    }
    #${TOOL_ID}.is-collapsed{max-height:53px}
    #${TOOL_ID}.is-collapsed .tool-body,
    #${TOOL_ID}.is-collapsed .tool-resize-handle{display:none}
    #${TOOL_ID}.is-collapsed .tool-header{border-bottom:0}

    #${TOOL_ID} .tool-resize-handle{
      position:absolute;top:0;right:0;width:9px;height:49px;z-index:10;
      cursor:ew-resize;touch-action:none
    }
    #${TOOL_ID} .tool-resize-handle::after{
      content:"";position:absolute;right:1px;top:50%;width:3px;height:28px;
      transform:translateY(-50%);border-radius:3px;background:#c0c4cc;opacity:.42
    }
    #${TOOL_ID} .tool-resize-handle:hover::after,
    #${TOOL_ID}.is-resizing .tool-resize-handle::after{
      background:#409eff;opacity:1
    }

    #${TOOL_ID} .tool-help{
      margin-bottom:10px;border:1px solid #e4e7ed;border-radius:5px;
      background:#f5f7fa;overflow:hidden
    }
    #${TOOL_ID} .tool-help summary{
      padding:8px 10px;cursor:pointer;color:#606266;font-size:12px;
      font-weight:700;user-select:none;list-style:none
    }
    #${TOOL_ID} .tool-help summary::-webkit-details-marker{display:none}
    #${TOOL_ID} .tool-help summary::before{
      content:"▶";display:inline-block;margin-right:6px;font-size:10px;
      transition:transform .15s
    }
    #${TOOL_ID} .tool-help[open] summary::before{transform:rotate(90deg)}
    #${TOOL_ID} .tool-help[open] summary{border-bottom:1px solid #e4e7ed}
    #${TOOL_ID} .tool-tip{
      padding:8px 10px;background:#fff;color:#606266;
      font-size:12px;line-height:1.65
    }

    #${TOOL_ID} textarea{
      box-sizing:border-box;width:100%;height:225px;padding:10px;
      border:1px solid #dcdfe6;border-radius:5px;outline:none;resize:vertical;
      font-family:Consolas,"Microsoft YaHei",sans-serif;font-size:13px;line-height:1.65
    }
    #${TOOL_ID} textarea:focus{border-color:#409eff}
    #${TOOL_ID} .tool-buttons{display:flex;gap:8px;margin-top:10px}
    #${TOOL_ID} .tool-action{
      flex:1;padding:9px;border:0;border-radius:5px;color:#fff;
      font-size:14px;cursor:pointer
    }
    #${TOOL_ID} .tool-run{background:#409eff}
    #${TOOL_ID} .tool-clear{background:#909399}
    #${TOOL_ID} button:disabled{opacity:.55;cursor:not-allowed}
    #${TOOL_ID} .tool-status{
      margin-top:10px;padding:9px;border-radius:5px;
      background:#f5f7fa;color:#606266;font-size:13px;
      line-height:1.5;white-space:normal;word-break:break-word;
      max-height:155px;overflow:auto
    }
    #${TOOL_ID} .tool-log-head{
      font-weight:800;line-height:1.45
    }
    #${TOOL_ID} .tool-log-note{
      margin-top:4px;color:#909399;font-size:12px
    }
    #${TOOL_ID} .tool-log-error{
      display:block;width:100%;box-sizing:border-box;
      margin-top:7px;padding:7px 8px;
      border:1px solid #fbc4c4;border-radius:4px;
      background:#fff5f5;color:#f56c6c;text-align:left;
      font:inherit;line-height:1.4;cursor:pointer
    }
    #${TOOL_ID} .tool-log-error:hover{
      border-color:#f56c6c;background:#fef0f0
    }
    .dime-company-label-error-v7718>.el-form-item__label,
    .dime-company-label-error-v7718 .el-form-item__label{
      color:#f56c6c!important;font-weight:800!important
    }
    .dime-company-label-pending-v7718>.el-form-item__label,
    .dime-company-label-pending-v7718 .el-form-item__label{
      color:#f56c6c!important;font-weight:700!important;opacity:.82
    }

    #${LAUNCHER_ID}{
      position:fixed;bottom:82px;right:18px;z-index:2147483646;
      width:172px;height:42px;display:flex;align-items:center;justify-content:center;
      gap:9px;padding:0 16px;border:1px solid #3f8f24;
      border-radius:22px;background:#67c23a;color:#fff;
      box-shadow:0 7px 20px rgba(103,194,58,.38);
      font-family:"Microsoft YaHei",sans-serif;font-size:15px;font-weight:900;
      letter-spacing:.3px;white-space:nowrap;cursor:grab;touch-action:none;
      text-shadow:0 1px 1px rgba(0,0,0,.22);
      transition:box-shadow .16s,background .16s,filter .16s
    }
    #${LAUNCHER_ID}:hover{
      background:#529b2e;filter:brightness(1.03);
      box-shadow:0 9px 26px rgba(103,194,58,.48)
    }
    #${LAUNCHER_ID}.is-open{
      background:#3f8f24;border-color:#34791e;
      box-shadow:0 7px 22px rgba(63,143,36,.46)
    }
    #${LAUNCHER_ID}.is-open:hover{
      background:#34791e
    }
    #${LAUNCHER_ID}.is-launcher-dragging{
      cursor:grabbing;filter:brightness(.96);
      box-shadow:0 10px 28px rgba(103,194,58,.5)
    }
    #${LAUNCHER_ID} .launcher-icon{
      width:25px;height:25px;display:inline-flex;align-items:center;justify-content:center;
      flex:0 0 auto;border-radius:50%;background:#fff;
      color:#4b9f2c;font-size:13px;font-weight:900;text-shadow:none;
      box-shadow:0 1px 3px rgba(0,0,0,.16)
    }
  `;
  document.head.appendChild(style);

  const tool = document.createElement("div");
  tool.id = TOOL_ID;
  tool.innerHTML = `
    <div class="tool-header">
      <strong>单位信息自动填写工具 v7.7.22</strong>
      <div class="tool-header-actions">
        <button class="tool-header-button tool-collapse" type="button" title="折叠工具">−</button>
        <button class="tool-header-button tool-close" type="button" title="收起到快捷按钮">×</button>
      </div>
    </div>

    <div class="tool-body">
      <details class="tool-help">
        <summary>使用说明（点击展开）</summary>
        <div class="tool-tip">
          可按住标题栏拖动，位置会自动记忆。<br>
          可拖动工具右侧边缘调整宽度，宽度会自动记忆。<br>
          使用条件等待减少无效停顿，并锁定当前字段对应的下拉弹层。<br>
          地区缺少省级时自动补“河南省”，支持斜杠、反斜杠、空格、顿号、逗号、横杠、箭头等分隔；网页地区树出现连续同名层级时会自动跨越。<br>
          企业规模网页标准选项为“大、中、小、微型”；输入“大型、中型、小型、微”等常见写法会自动转换。<br>
          行业类别和经济类型会区分两种状态：未输入时的普通级联树只用于展示；输入后切换到搜索结果列表。只有唯一且末级名称完全一致的候选才会被选择。选中后支持三种确认方式：只读框或标签中的正式值、搜索列表暂未关闭但唯一精确候选已明确勾选、搜索列表关闭后可编辑主输入框中显示的正式完整路径。仅有搜索文字且没有路径或已选清除标志时仍判定失败。<br>
          遇到异常立即停止：当前异常标题深红，后续未执行字段标题浅红。点击异常日志可跳转到字段并选中粘贴框中的对应原文。<br>
          第一阶段填写信用代码和人数，第二阶段选择其他字段。<br>
          单位类型默认“用工单位”，报告同步扁鹊默认“是”。
        </div>
      </details>

      <textarea class="tool-input" placeholder="社会信用代码：ceshishuju
地区：驻马店市 泌阳县 泰山庙镇
行业类别：天然气生产和供应业
经济类型：私营有限责任公司
企业规模：大型
体检人数：11"></textarea>

      <div class="tool-buttons">
        <button class="tool-action tool-run" type="button">自动填写并选择</button>
        <button class="tool-action tool-clear" type="button">清空</button>
      </div>

      <div class="tool-status">等待粘贴数据</div>
    </div>

    <div class="tool-resize-handle" title="按住并左右拖动调整窗口宽度"></div>
  `;
  document.body.appendChild(tool);
  tool.style.display = "none";

  const launcher = document.createElement("button");
  launcher.id = LAUNCHER_ID;
  launcher.type = "button";
  launcher.title = "点击打开单位信息自动填写工具";
  launcher.innerHTML = `
    <span class="launcher-icon">填</span>
    <span class="launcher-text">打开单位填写</span>
  `;
  document.body.appendChild(launcher);

  const textBox = tool.querySelector(".tool-input");
  const runButton = tool.querySelector(".tool-run");
  const clearButton = tool.querySelector(".tool-clear");
  const collapseButton = tool.querySelector(".tool-collapse");
  const closeButton = tool.querySelector(".tool-close");
  const statusBox = tool.querySelector(".tool-status");
  const dragHandle = tool.querySelector(".tool-header");
  const resizeHandle = tool.querySelector(".tool-resize-handle");
  const MIN_TOOL_WIDTH = 360;
  const MIN_VIEWPORT_TOOL_WIDTH = 260;

  function setStatus(text, type = "normal") {
    const styles = {
      normal: ["#f5f7fa", "#606266"],
      running: ["#ecf5ff", "#409eff"],
      success: ["#f0f9eb", "#67c23a"],
      error: ["#fef0f0", "#f56c6c"]
    };
    const selected = styles[type] || styles.normal;
    statusBox.innerText = text;
    statusBox.style.background = selected[0];
    statusBox.style.color = selected[1];
  }

  const LABEL_ERROR_CLASS =
    "dime-company-label-error-v7718";

  const LABEL_PENDING_CLASS =
    "dime-company-label-pending-v7718";

  const STEP_FIELD_CONFIG_MAP = {
    "社会信用代码": CONFIG.fields.socialCreditCode,
    "职工数": CONFIG.fields.employeeCount,
    "接害人数": CONFIG.fields.exposedCount,
    "单位类型": CONFIG.fields.unitType,
    "企业规模": CONFIG.fields.companyScale,
    "报告同步扁鹊": CONFIG.fields.syncBianQue,
    "地区": CONFIG.fields.area,
    "行业类别": CONFIG.fields.industry,
    "经济类型": CONFIG.fields.economy
  };

  const STEP_INPUT_KEY_MAP = {
    "社会信用代码": "socialCreditCode",
    "职工数": "medicalCount",
    "接害人数": "medicalCount",
    "单位类型": "unitType",
    "企业规模": "companyScale",
    "报告同步扁鹊": "syncBianQue",
    "地区": "area",
    "行业类别": "industry",
    "经济类型": "economy"
  };

  const POSITIONAL_INPUT_KEYS = [
    "area",
    "industry",
    "economy",
    "socialCreditCode",
    "companyScale",
    "medicalCount"
  ];

  function compactLogText(
    value,
    maximumLength = 92
  ) {
    const text = cleanText(value)
      .replace(/\s+/g, " ");

    return text.length <= maximumLength
      ? text
      : text.slice(
        0,
        maximumLength - 1
      ) + "…";
  }

  function compactRunningStatus(message) {
    const lines = String(message ?? "")
      .split(/\n+/)
      .map(cleanText)
      .filter(Boolean);

    return "处理中｜" +
      compactLogText(
        lines[lines.length - 1] ||
        "正在处理",
        72
      );
  }

  function getFailureStepName(failedText) {
    const match = cleanText(failedText)
      .match(/^([^:：]+)[:：]/);

    return cleanText(
      match?.[1] || ""
    );
  }

  function clearFormTitleMarks() {
    document
      .querySelectorAll(
        "." + LABEL_ERROR_CLASS +
        ",." + LABEL_PENDING_CLASS
      )
      .forEach(field => {
        field.classList.remove(
          LABEL_ERROR_CLASS,
          LABEL_PENDING_CLASS
        );
      });
  }

  function markFieldTitle(
    stepName,
    type
  ) {
    const fieldConfig =
      STEP_FIELD_CONFIG_MAP[stepName];

    if (!fieldConfig) return null;

    const field =
      findFieldItem(fieldConfig);

    if (!field) return null;

    field.classList.remove(
      LABEL_ERROR_CLASS,
      LABEL_PENDING_CLASS
    );

    field.classList.add(
      type === "error"
        ? LABEL_ERROR_CLASS
        : LABEL_PENDING_CLASS
    );

    return field;
  }

  function markStoppedTitles(summary) {
    clearFormTitleMarks();

    const failedStep =
      getFailureStepName(
        summary?.failed
      );

    if (failedStep) {
      markFieldTitle(
        failedStep,
        "error"
      );
    }

    const pending =
      Array.isArray(summary?.pending)
        ? summary.pending
        : [];

    pending.forEach(stepName => {
      markFieldTitle(
        cleanText(stepName),
        "pending"
      );
    });
  }

  function getInputLineRanges() {
    const source =
      String(textBox.value ?? "");

    const ranges = new Map();
    const unnamedRanges = [];

    const pattern =
      /[^\r\n]*(?:\r\n|\n|\r|$)/g;

    let match;
    let lineIndex = 0;

    while ((match = pattern.exec(source))) {
      const full = match[0];

      if (
        !full &&
        match.index >= source.length
      ) {
        break;
      }

      const line = full.replace(
        /(?:\r\n|\n|\r)$/,
        ""
      );

      const lineStart = match.index;
      const lineEnd =
        lineStart + line.length;

      if (cleanText(line)) {
        const named = line.match(
          /^([^:：]+)\s*[:：]\s*(.*)$/
        );

        if (named) {
          const key =
            resolveKey(named[1]);

          if (key && !ranges.has(key)) {
            const delimiterIndex =
              line.search(/[:：]/);

            const valuePart =
              line.slice(
                delimiterIndex + 1
              );

            const leadingSpaces =
              valuePart.length -
              valuePart.replace(
                /^\s+/,
                ""
              ).length;

            const valueStart =
              lineStart +
              delimiterIndex +
              1 +
              leadingSpaces;

            ranges.set(key, {
              start:
                valueStart < lineEnd
                  ? valueStart
                  : lineStart,
              end:
                valueStart < lineEnd
                  ? lineEnd
                  : Math.max(
                    lineStart + 1,
                    lineEnd
                  ),
              lineIndex
            });
          }
        } else {
          unnamedRanges.push({
            start: lineStart,
            end: Math.max(
              lineStart + 1,
              lineEnd
            ),
            lineIndex
          });
        }
      }

      lineIndex++;

      if (
        pattern.lastIndex ===
        match.index
      ) {
        pattern.lastIndex++;
      }
    }

    if (!ranges.size) {
      POSITIONAL_INPUT_KEYS.forEach(
        (key, index) => {
          if (unnamedRanges[index]) {
            ranges.set(
              key,
              unnamedRanges[index]
            );
          }
        }
      );
    }

    return ranges;
  }

  function locateFailure(
    stepName
  ) {
    const fieldConfig =
      STEP_FIELD_CONFIG_MAP[stepName];

    const field =
      fieldConfig
        ? findFieldItem(fieldConfig)
        : null;

    field?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    const inputKey =
      STEP_INPUT_KEY_MAP[stepName];

    if (!inputKey) return false;

    const range =
      getInputLineRanges().get(
        inputKey
      );

    if (!range) return false;

    textBox.focus({
      preventScroll: true
    });

    try {
      textBox.setSelectionRange(
        range.start,
        Math.max(
          range.start + 1,
          range.end
        )
      );
    } catch {
      return false;
    }

    const lineHeight =
      Number.parseFloat(
        getComputedStyle(textBox)
          .lineHeight
      ) || 21;

    textBox.scrollTop = Math.max(
      0,
      range.lineIndex *
        lineHeight -
        textBox.clientHeight / 3
    );

    return true;
  }

  function renderCompactErrorSummary(
    summary
  ) {
    markStoppedTitles(summary);

    const successCount =
      summary.completed?.length || 0;

    const pendingCount =
      summary.pending?.length || 0;

    const failedText =
      cleanText(summary.failed) ||
      "未知错误";

    const failedStep =
      getFailureStepName(failedText);

    statusBox.replaceChildren();
    statusBox.style.background =
      "#fef0f0";
    statusBox.style.color =
      "#f56c6c";

    const head =
      document.createElement("div");

    head.className =
      "tool-log-head";

    head.textContent =
      `已停止｜成功 ${successCount}` +
      `｜失败 1` +
      (
        pendingCount
          ? `｜未执行 ${pendingCount}`
          : ""
      );

    statusBox.appendChild(head);

    const errorButton =
      document.createElement("button");

    errorButton.type = "button";
    errorButton.className =
      "tool-log-error";

    errorButton.textContent =
      "✗ " +
      compactLogText(failedText);

    errorButton.title =
      failedText +
      (
        failedStep
          ? "\n点击跳转到字段并选中对应原文"
          : ""
      );

    errorButton.addEventListener(
      "click",
      event => {
        event.stopPropagation();

        const located =
          locateFailure(failedStep);

        if (!located) {
          const note =
            statusBox.querySelector(
              ".tool-log-note"
            );

          if (note) {
            note.textContent =
              "已跳转到异常字段，但没有找到对应的粘贴原文。";
          }
        }
      }
    );

    statusBox.appendChild(
      errorButton
    );

    const note =
      document.createElement("div");

    note.className =
      "tool-log-note";

    note.textContent =
      pendingCount
        ? "后续未执行字段标题已标红；点击异常项定位字段和原文。"
        : "点击异常项定位字段和原文。";

    statusBox.appendChild(note);
  }


  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function getMinimumToolWidth() {
    return Math.min(
      MIN_TOOL_WIDTH,
      Math.max(MIN_VIEWPORT_TOOL_WIDTH, window.innerWidth - 8)
    );
  }

  function getMaximumToolWidth(left = tool.getBoundingClientRect().left) {
    return Math.max(getMinimumToolWidth(), window.innerWidth - Math.max(0, left) - 4);
  }


  function updateLauncherState(isOpen) {
    const text = launcher.querySelector(".launcher-text");
    launcher.classList.toggle("is-open", isOpen);
    launcher.setAttribute("aria-expanded", String(isOpen));

    if (text) {
      text.textContent = isOpen ? "关闭单位填写" : "打开单位填写";
    }

    launcher.title = isOpen
      ? "点击关闭单位信息自动填写工具"
      : "点击打开单位信息自动填写工具";
  }

  function hideToolPanel() {
    if (!tool.isConnected || !launcher.isConnected) return;
    tool.style.display = "none";
    launcher.style.display = "flex";
    updateLauncherState(false);
  }

  function showToolPanel() {
    if (!tool.isConnected || !launcher.isConnected) return;

    tool.style.display = "block";
    launcher.style.display = "flex";
    updateLauncherState(true);

    requestAnimationFrame(() => {
      applySavedState();
      keepToolInsideViewport();
    });
  }

  function toggleToolPanel() {
    const isOpen = tool.style.display !== "none";
    if (isOpen) hideToolPanel();
    else showToolPanel();
  }


  function updateCollapseButton() {
    const collapsed = tool.classList.contains("is-collapsed");
    collapseButton.textContent = collapsed ? "＋" : "−";
    collapseButton.title = collapsed ? "展开工具" : "折叠工具";
  }

  function savePosition() {
    const rect = tool.getBoundingClientRect();
    localStorage.setItem(POSITION_KEY, JSON.stringify({
      left: Math.round(rect.left),
      top: Math.round(rect.top)
    }));
  }

  function saveWidth() {
    localStorage.setItem(
      WIDTH_KEY,
      String(Math.round(tool.getBoundingClientRect().width))
    );
  }

  function saveCollapsedState() {
    localStorage.setItem(
      COLLAPSED_KEY,
      tool.classList.contains("is-collapsed") ? "1" : "0"
    );
  }

  function getMinimumTextAreaHeight() {
    return 120;
  }

  function getMaximumTextAreaHeight() {
    return Math.max(getMinimumTextAreaHeight(), window.innerHeight - 260);
  }

  function saveTextAreaHeight() {
    const height = Math.round(textBox.getBoundingClientRect().height);
    if (Number.isFinite(height) && height > 0) {
      localStorage.setItem(TEXTAREA_HEIGHT_KEY, String(height));
    }
  }

  function applySavedTextAreaHeight() {
    const savedHeight = Number(localStorage.getItem(TEXTAREA_HEIGHT_KEY));
    if (!Number.isFinite(savedHeight) || savedHeight <= 0) return;

    textBox.style.height = clamp(
      savedHeight,
      getMinimumTextAreaHeight(),
      getMaximumTextAreaHeight()
    ) + "px";
  }

  function keepToolInsideViewport() {
    const rect = tool.getBoundingClientRect();
    const minimumWidth = getMinimumToolWidth();
    const maximumWidth = Math.max(minimumWidth, window.innerWidth - 4);
    const width = clamp(rect.width, minimumWidth, maximumWidth);

    tool.style.width = width + "px";

    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - tool.offsetHeight);

    tool.style.left = clamp(rect.left, 0, maxLeft) + "px";
    tool.style.top = clamp(rect.top, 0, maxTop) + "px";
    tool.style.right = "auto";
  }

  function applySavedState() {
    try {
      const savedWidth = Number(localStorage.getItem(WIDTH_KEY));
      if (Number.isFinite(savedWidth) && savedWidth > 0) {
        const minimumWidth = getMinimumToolWidth();
        const maximumWidth = Math.max(minimumWidth, window.innerWidth - 4);
        tool.style.width = clamp(savedWidth, minimumWidth, maximumWidth) + "px";
      }

      applySavedTextAreaHeight();

      const collapsed = localStorage.getItem(COLLAPSED_KEY) === "1";
      tool.classList.toggle("is-collapsed", collapsed);
      updateCollapseButton();

      const savedPosition = JSON.parse(
        localStorage.getItem(POSITION_KEY) || "null"
      );

      if (
        savedPosition &&
        Number.isFinite(savedPosition.left) &&
        Number.isFinite(savedPosition.top)
      ) {
        tool.style.left = savedPosition.left + "px";
        tool.style.top = savedPosition.top + "px";
        tool.style.right = "auto";
      }

      keepToolInsideViewport();
    } catch (error) {
      console.warn("读取工具界面状态失败：", error);
      updateCollapseButton();
      keepToolInsideViewport();
    }
  }

  let dragging = false;
  let resizing = false;
  let startMouseX = 0;
  let startMouseY = 0;
  let startLeft = 0;
  let startTop = 0;
  let startWidth = 0;

  dragHandle.addEventListener("mousedown", event => {
    if (event.button !== 0) return;
    if (event.target.closest(".tool-header-button")) return;

    dragging = true;

    const rect = tool.getBoundingClientRect();
    startMouseX = event.clientX;
    startMouseY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;

    tool.style.left = rect.left + "px";
    tool.style.top = rect.top + "px";
    tool.style.right = "auto";
    tool.classList.add("is-dragging");

    event.preventDefault();
  });

  resizeHandle.addEventListener("mousedown", event => {
    if (event.button !== 0 || tool.classList.contains("is-collapsed")) return;

    resizing = true;

    const rect = tool.getBoundingClientRect();
    startMouseX = event.clientX;
    startWidth = rect.width;

    tool.style.left = rect.left + "px";
    tool.style.right = "auto";
    tool.classList.add("is-resizing");

    event.preventDefault();
    event.stopPropagation();
  });

  document.addEventListener("mousemove", event => {
    if (dragging) {
      const maxLeft = Math.max(0, window.innerWidth - tool.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - tool.offsetHeight);

      tool.style.left =
        clamp(startLeft + event.clientX - startMouseX, 0, maxLeft) + "px";
      tool.style.top =
        clamp(startTop + event.clientY - startMouseY, 0, maxTop) + "px";
      return;
    }

    if (resizing) {
      const left = tool.getBoundingClientRect().left;
      const minimumWidth = getMinimumToolWidth();
      const maximumWidth = getMaximumToolWidth(left);
      const nextWidth = clamp(
        startWidth + event.clientX - startMouseX,
        minimumWidth,
        maximumWidth
      );

      tool.style.width = nextWidth + "px";
    }
  });

  document.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      tool.classList.remove("is-dragging");
      savePosition();
    }

    if (resizing) {
      resizing = false;
      tool.classList.remove("is-resizing");
      saveWidth();
      savePosition();
    }
  });

  collapseButton.addEventListener("click", event => {
    event.stopPropagation();

    tool.classList.toggle("is-collapsed");
    updateCollapseButton();
    keepToolInsideViewport();
    saveCollapsedState();
    savePosition();
  });

  window.addEventListener("resize", () => {
    keepLauncherInsideViewport();
    const currentHeight = textBox.getBoundingClientRect().height;
    textBox.style.height = clamp(
      currentHeight,
      getMinimumTextAreaHeight(),
      getMaximumTextAreaHeight()
    ) + "px";

    keepToolInsideViewport();
    saveTextAreaHeight();
    saveWidth();
    savePosition();
  });

  let textAreaSaveTimer = null;

  if (typeof ResizeObserver === "function") {
    const textAreaResizeObserver = new ResizeObserver(() => {
      clearTimeout(textAreaSaveTimer);
      textAreaSaveTimer = setTimeout(saveTextAreaHeight, 120);
    });
    textAreaResizeObserver.observe(textBox);
  } else {
    textBox.addEventListener("mouseup", saveTextAreaHeight);
    textBox.addEventListener("touchend", saveTextAreaHeight);
  }


  function saveLauncherPosition() {
    const rect = launcher.getBoundingClientRect();
    localStorage.setItem(LAUNCHER_POSITION_KEY, JSON.stringify({
      left: Math.round(rect.left),
      top: Math.round(rect.top)
    }));
  }

  function keepLauncherInsideViewport() {
    const rect = launcher.getBoundingClientRect();
    const maxLeft = Math.max(0, innerWidth - rect.width);
    const maxTop = Math.max(0, innerHeight - rect.height);

    launcher.style.left = Math.min(Math.max(rect.left, 0), maxLeft) + "px";
    launcher.style.top = Math.min(Math.max(rect.top, 0), maxTop) + "px";
    launcher.style.right = "auto";
    launcher.style.bottom = "auto";
  }

  function applySavedLauncherPosition() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(LAUNCHER_POSITION_KEY) || "null"
      );

      if (
        saved &&
        Number.isFinite(saved.left) &&
        Number.isFinite(saved.top)
      ) {
        launcher.style.left = saved.left + "px";
        launcher.style.top = saved.top + "px";
        launcher.style.right = "auto";
        launcher.style.bottom = "auto";
      }
    } catch (_) {}

    keepLauncherInsideViewport();
  }

  let launcherDragging = false;
  let launcherMoved = false;
  let launcherStartX = 0;
  let launcherStartY = 0;
  let launcherStartLeft = 0;
  let launcherStartTop = 0;

  launcher.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;

    const rect = launcher.getBoundingClientRect();
    launcherDragging = true;
    launcherMoved = false;
    launcherStartX = event.clientX;
    launcherStartY = event.clientY;
    launcherStartLeft = rect.left;
    launcherStartTop = rect.top;

    launcher.style.left = rect.left + "px";
    launcher.style.top = rect.top + "px";
    launcher.style.right = "auto";
    launcher.style.bottom = "auto";
    launcher.classList.add("is-launcher-dragging");

    try { launcher.setPointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
  });

  launcher.addEventListener("pointermove", event => {
    if (!launcherDragging) return;

    const deltaX = event.clientX - launcherStartX;
    const deltaY = event.clientY - launcherStartY;

    if (!launcherMoved && Math.hypot(deltaX, deltaY) >= 4) {
      launcherMoved = true;
    }

    if (!launcherMoved) return;

    const maxLeft = Math.max(0, innerWidth - launcher.offsetWidth);
    const maxTop = Math.max(0, innerHeight - launcher.offsetHeight);

    launcher.style.left = Math.min(
      Math.max(launcherStartLeft + deltaX, 0),
      maxLeft
    ) + "px";

    launcher.style.top = Math.min(
      Math.max(launcherStartTop + deltaY, 0),
      maxTop
    ) + "px";
  });

  function endLauncherDrag(event) {
    if (!launcherDragging) return;

    launcherDragging = false;
    launcher.classList.remove("is-launcher-dragging");

    try { launcher.releasePointerCapture(event.pointerId); } catch (_) {}

    if (launcherMoved) {
      saveLauncherPosition();
      setTimeout(() => {
        launcherMoved = false;
      }, 0);
    }
  }

  launcher.addEventListener("pointerup", endLauncherDrag);
  launcher.addEventListener("pointercancel", endLauncherDrag);

  launcher.addEventListener("click", event => {
    if (launcherMoved) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    toggleToolPanel();
  });

  requestAnimationFrame(() => {
    applySavedLauncherPosition();
    hideToolPanel();
  });

  closeButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    hideToolPanel();
  });

  clearButton.addEventListener("click", event => {
    event.stopPropagation();
    textBox.value = "";
    clearFormTitleMarks();
    setStatus("已清空，等待粘贴数据");
    textBox.focus();
  });

  runButton.addEventListener("click", async event => {
    event.stopPropagation();

    if (!textBox.value.trim()) {
      setStatus("请先粘贴需要填写的数据", "error");
      return;
    }

    const data = parseInput(textBox.value);

    if (
      !data.area &&
      !data.industry &&
      !data.economy &&
      !data.socialCreditCode &&
      !data.companyScale &&
      !data.medicalCount
    ) {
      setStatus("没有识别到可处理的数据，请检查格式", "error");
      return;
    }

    clearFormTitleMarks();

    runButton.disabled = true;
    clearButton.disabled = true;

    try {
      const summary = await processData(
        data,
        message =>
          setStatus(
            compactRunningStatus(
              message
            ),
            "running"
          )
      );

      clearFormTitleMarks();

      setStatus(
        `填写完成｜成功 ${summary.completed.length}｜失败 0`,
        "success"
      );
    } catch (error) {
      console.error(
        "自动填写失败：",
        error
      );

      const summary =
        error.runSummary || {
          completed: [],
          failed:
            `未知步骤：${
              error.message ||
              error
            }`,
          pending: []
        };

      renderCompactErrorSummary(
        summary
      );
    } finally {
      runButton.disabled = false;
      clearButton.disabled = false;
    }
  });

  textBox.focus();
  console.log("单位信息自动填写工具 v7.7.22 可编辑完整路径确认版 已加载。");
})();
