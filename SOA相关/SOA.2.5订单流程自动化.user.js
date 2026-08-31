// ==UserScript==
// @name         SOA.2.5订单流程自动化
// @namespace    https://tampermonkey.net/
// @version      1.31
// @description  SOA订单流程自动化：内勤复核、合同补充、发起落单、落单审核、落单完成及数据提取；支持文件绑定、异常等待、流程状态判定及卡池数量查询。

// @match        https://checkup-soa3.health-100.cn/*
// @grant        none

// @author       WanXin
// @publishGroup soaxg
// @publishID    soa-dingdanauto
// @updateURL    https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-dingdanauto.user.js
// @downloadURL  https://raw.gitcode.com/gcw_7DpHPfUr/wanxin-userscripts/raw/main/publish/soaxg/soa-dingdanauto.user.js
// ==/UserScript==

/*
 * SOA.2.5订单流程自动化
 *
 * 功能：
 * - 覆盖订单详情各业务页签，识别流程阶段并执行已支持的自动处理。
 * - 支持审批备注、签单主体、合同/授权书共用文件配置。
 * - 支持体检时间异常检测与报价确认阶段时间修正。
 * - 提供按需落单数据、体检汇总/卡池数据及网页提示记录。
 * - 面板支持显示开关、拖动、折叠、位置记忆和流程停止。
 *
 * 更新记录
 *
 * v1.31  -  2026-9-1
 * - 优化：点击卡数量改为新建标签页打开卡池查询，不影响当前订单页面。
 * - 修复：卡池页自动查询增加页签激活、输入完成和按钮可用等待，避免跳转后操作过快导致查询未触发。
 * - UI：数量大于0时可点击并显示颜色+下划线；数量为0时显示黑色普通文字且不可交互。
 *
 * v1.30  -  2026-9-1
 * - 新增点击卡数量自动打开对应卡池并查询。
 *
 * v1.29  -  2026-9-1
 * - 精简 UI 使用说明及脚本更新记录。
 *
 * v1.0  -  2026-8-30
 * - 首个 Tampermonkey 正式版。
 */

(function () {
  "use strict";

  /*
   * 订单详情是一个 SPA 工作区。
   * 点击“基本信息 / 套餐与加项包 / 营销 / 合同 / 体检名单 / 开票”等页签时，
   * Hash 会在 #/order/info、#/order/package、#/order/cost、
   * #/order/contract 等子路由之间切换。
   *
   * 只要仍属于 #/order/... 且带有 orderCode，就视为同一个订单详情工作区，
   * 不再因为切换页签而销毁工具。
   */
  const ORDER_ROUTE_PREFIX =
    "#/order/";

  const CARD_GROUP_ROUTE =
    "#/card/group";

  const CARD_GROUP_PENDING_KEY =
    "__soa_order_flow_card_group_pending_v131";

  const isTargetRoute =
    () => {
      const hash =
        String(
          location.hash || ""
        );

      if (
        !hash.startsWith(
          ORDER_ROUTE_PREFIX
        )
      ) {
        return false;
      }

      return /[?&]orderCode=SOA[A-Za-z0-9-]+/i
        .test(hash);
    };

  const CONFIG = {
    SWITCH_ORDER_DESC_SELECTOR:
      ".tabs-wrap > .tabs > .order-desc",

    EDIT_SPAN_SELECTOR:
      "#root > div > div > div > div > section > section:nth-of-type(2) > div:nth-of-type(4) > div > div > div:nth-of-type(2) > button > span",

    CONTRACT_COMPANY_SELECTOR:
      "#contractCompanyCode",

    CONTRACT_BEGIN_SELECTOR:
      "#contractBeginDate",

    CONTRACT_END_SELECTOR:
      "#contractEndDate",

    INSPECTION_DAY_SELECTOR:
      "#inspectionPeopleDay",

    PICKER_TIMEOUT: 3500,
    UPLOAD_CONFIRM_TIMEOUT: 8000,
    POLL_INTERVAL: 100,

    REACTIVE_POLL_INTERVAL:
      400,
    STALL_NOTICE_INTERVAL:
      12000,

    PROCESS_LOG_API:
      "/soa/api/v1/order/processlogs",

    PACKAGE_CARD_POOL_API:
      "/soa-card/api/v1/card/business/pool/display",

    STORED_VALUE_CARD_POOL_API:
      "/soa-card/api/v1/bqcard/page/pool",

    EXTRACT_ORDER_NAME_SELECTOR:
      "#register > div",
    EXTRACT_ORDER_CODE_SELECTOR:
      "#register > div:nth-of-type(2) > div:nth-of-type(8) > div:nth-of-type(2) > div > div",
    EXTRACT_OPPORTUNITY_CODE_SELECTOR:
      "#register > div:nth-of-type(2) > div:nth-of-type(5) > div > div:nth-of-type(2) > div > div",
    EXTRACT_SALESMAN_SELECTOR:
      "#register > div:nth-of-type(2) > div > div:nth-of-type(2) > div > div > span",

    REGISTER_BEGIN_DATE_SELECTOR:
      "#register_begin_date",
    REGISTER_END_DATE_SELECTOR:
      "#register_end_date",

    REGISTER_EDIT_BUTTON_SELECTOR:
      "#root > div > div > div > div > div:nth-of-type(2) > div > div:nth-of-type(2) > button:nth-of-type(3)",

    PHYSICAL_TOTAL_PEOPLE_SELECTOR:
      "#root > div > div > div > div > section > section:nth-of-type(2) > div:nth-of-type(5) > div > div:nth-of-type(2) > div > div > div > div > div > div > table > tbody > tr:nth-of-type(5) > td:nth-of-type(3) > div",
    PHYSICAL_CHECKED_PEOPLE_SELECTOR:
      "#root > div > div > div > div > section > section:nth-of-type(2) > div:nth-of-type(5) > div > div:nth-of-type(2) > div > div > div > div > div > div > table > tbody > tr:nth-of-type(5) > td:nth-of-type(6)",
    PHYSICAL_UNCHECKED_PEOPLE_SELECTOR:
      "#root > div > div > div > div > section > section:nth-of-type(2) > div:nth-of-type(5) > div > div:nth-of-type(2) > div > div > div > div > div > div > table > tbody > tr:nth-of-type(5) > td:nth-of-type(7)",
    PHYSICAL_CHECKED_AMOUNT_SELECTOR:
      "#root > div > div > div > div > section > section:nth-of-type(2) > div:nth-of-type(5) > div > div:nth-of-type(4) > div > div > div > div > div > div > table > tbody > tr:nth-of-type(5) > td:nth-of-type(3)",
    PHYSICAL_ACCOUNT_AMOUNT_SELECTOR:
      "#root > div > div > div > div > section > section:nth-of-type(2) > div:nth-of-type(5) > div > div:nth-of-type(4) > div > div > div > div > div > div > table > tbody > tr:nth-of-type(5) > td:nth-of-type(4)",
    PHYSICAL_SELF_PAY_SELECTOR:
      "#root > div > div > div > div > section > section:nth-of-type(2) > div:nth-of-type(5) > div > div:nth-of-type(4) > div > div > div > div > div > div > table > tbody > tr:nth-of-type(5) > td:nth-of-type(5)"
  };

  const DEFAULTS = {
    REVIEW_REMARK:
      "套餐复核系统要求，提交到合同补充阶段。",
    ORDER_REMARK:
      "已落单，请及时上传原版合同、授权书扫描件。",
    SIGNING_COMPANY_MODE:
      "first",
    SIGNING_COMPANY_TEXT:
      ""
  };

  const FILE_BINDING = {
    DB_NAME:
      "__SOA_CONTRACT_FILE_BINDING_DB__",
    DB_VERSION: 1,
    STORE_NAME: "handles",
    HANDLE_KEY:
      "sharedContractFile"
  };

  const UI = {
    PANEL_ID:
      "__soa_contract_console_panel_v04",
    STATUS_ID:
      "__soa_contract_console_status_v04",
    BIND_BUTTON_ID:
      "__soa_contract_console_bind_v04",
    COLLAPSE_BUTTON_ID:
      "__soa_flow_panel_collapse_v10",
    PANEL_BODY_ID:
      "__soa_flow_panel_body_v10",
    PANEL_COLLAPSED_KEY:
      "__soa_flow_panel_collapsed_v10",
    AUTO_SWITCH_ID:
      "__soa_flow_page_switch_v10",
    DRAG_HANDLE_ID:
      "__soa_contract_console_drag_handle_v06",
    POSITION_KEY:
      "__soa_contract_console_panel_position_v06",
    REVIEW_REMARK_ID:
      "__soa_flow_review_remark_v07",
    ORDER_REMARK_ID:
      "__soa_flow_order_remark_v07",
    FLOW_RUN_BUTTON_ID:
      "__soa_flow_run_v07",
    REVIEW_REMARK_KEY:
      "__soa_flow_review_remark_text_v07",
    ORDER_REMARK_KEY:
      "__soa_flow_order_remark_text_v07",
    EXTRACT_OPTIONS_ID:
      "__soa_flow_extract_options_v09",
    EXTRACT_PREVIEW_ID:
      "__soa_flow_extract_preview_v09",

    DATA_PANEL_ID:
      "__soa_flow_data_panel_v116",
    DATA_PANEL_TITLE_ID:
      "__soa_flow_data_panel_title_v116",
    LANDING_DATA_BUTTON_ID:
      "__soa_flow_landing_data_button_v116",
    PHYSICAL_DATA_BUTTON_ID:
      "__soa_flow_physical_data_button_v116",
    PHYSICAL_DATA_GRID_ID:
      "__soa_flow_physical_data_grid_v116",

    CARD_POOL_DATA_GRID_ID:
      "__soa_flow_card_pool_data_grid_v126",

    HELP_BUTTON_ID:
      "__soa_flow_help_button_v14",
    HELP_PANEL_ID:
      "__soa_flow_help_panel_v14",

    REMARK_BUTTON_ID:
      "__soa_flow_remark_button_v14",
    REMARK_PANEL_ID:
      "__soa_flow_remark_panel_v14",
    REMARK_DEFAULT_BUTTON_ID:
      "__soa_flow_remark_default_v118",

    SIGNING_BUTTON_ID:
      "__soa_flow_signing_button_v118",
    SIGNING_PANEL_ID:
      "__soa_flow_signing_panel_v118",
    SIGNING_FIRST_ID:
      "__soa_flow_signing_first_v118",
    SIGNING_TEXT_MODE_ID:
      "__soa_flow_signing_text_mode_v118",
    SIGNING_TEXT_ID:
      "__soa_flow_signing_text_v118",
    SIGNING_MODE_KEY:
      "__soa_flow_signing_mode_v118",
    SIGNING_TEXT_KEY:
      "__soa_flow_signing_text_key_v118",

    WEB_NOTICE_ID:
      "__soa_flow_web_notice_v14",
    WEB_NOTICE_LIST_ID:
      "__soa_flow_web_notice_list_v14",
    WEB_NOTICE_CLEAR_ID:
      "__soa_flow_web_notice_clear_v114",

    FLOW_STAGE_LABEL_ID:
      "__soa_flow_stage_label_v16",
    FLOW_STAGE_VALUE_ID:
      "__soa_flow_stage_value_v16",
    FLOW_STAGE_HINT_ID:
      "__soa_flow_stage_hint_v16",

    EXAM_DATE_SUMMARY_ID:
      "__soa_flow_exam_date_summary_v18",
    EXAM_BEGIN_DATE_ID:
      "__soa_flow_exam_begin_date_v110",
    EXAM_END_DATE_ID:
      "__soa_flow_exam_end_date_v110",
    EXAM_DURATION_ID:
      "__soa_flow_exam_duration_v113",
    EXAM_DATE_FIX_BUTTON_ID:
      "__soa_flow_exam_date_fix_button_v110"
  };

  let boundFileHandle = null;
  let processRunning = false;
  let activeFlowToken = null;

  let panelVisible = false;

  let routeObserver = null;

  let cardGroupPendingRunning =
    false;
  let uiEnsureScheduled = false;
  let boundFileInitialized = false;

  let webNoticeObserver = null;
  let webNoticeScanScheduled = false;
  let webNoticeHistory = [];
  let webNoticeSeen = new WeakMap();
  let lastWebNoticeSignature = "";
  let lastWebNoticeAt = 0;
  let lastWebNoticeOrderCode = "";

  let lastDisplayedFlowStage = "";

  let activeDataPanelMode = "";
  let lastDataPanelOrderCode = "";

  let panelStatusHideTimer = null;

  const CARD_POOL_CACHE_MS =
    15000;

  let physicalDataQueryRunning =
    false;

  let cardPoolQueryCache = {
    orderCode: "",
    cardCorpCode: "",
    timestamp: 0,
    data: null
  };

  const cardCorpCodeMemory =
    new Map();

  function hidePanelStatus() {
    const status =
      document.getElementById(
        UI.STATUS_ID
      );

    if (!status) {
      return;
    }

    status.style.display =
      "none";

    status.textContent =
      "";
  }

  function updatePanelStatus(
    message,
    type = "normal",
    {
      persistent =
        type === "error"
    } = {}
  ) {
    const status =
      document.getElementById(
        UI.STATUS_ID
      );

    if (!status) {
      return;
    }

    if (panelStatusHideTimer) {
      clearTimeout(
        panelStatusHideTimer
      );

      panelStatusHideTimer =
        null;
    }

    const text =
      String(message || "")
        .trim();

    if (!text) {
      hidePanelStatus();
      return;
    }

    status.style.display =
      "block";

    status.textContent =
      text;

    status.style.color =
      type === "error"
        ? "#cf1322"
        : type === "success"
          ? "#389e0d"
          : "#555";

    status.style.borderColor =
      type === "error"
        ? "#ffccc7"
        : type === "success"
          ? "#b7eb8f"
          : "#eee";

    status.style.background =
      type === "error"
        ? "#fff2f0"
        : type === "success"
          ? "#f6ffed"
          : "#fcfcfc";

    /*
     * 顶部状态区只承担“当前动作/异常”提示。
     * 普通和成功信息自动收起，错误保留供人工观察。
     */
    if (!persistent) {
      const delay =
        type === "success"
          ? 5000
          : 4000;

      panelStatusHideTimer =
        setTimeout(
          () => {
            hidePanelStatus();
            panelStatusHideTimer =
              null;
          },
          delay
        );
    }
  }

  function log(message, data) {
    updatePanelStatus(
      message
    );

    if (data !== undefined) {
      console.log(
        `[SOA流程自动化] ${message}`,
        data
      );
    } else {
      console.log(
        `[SOA流程自动化] ${message}`
      );
    }
  }

  function warn(message, data) {
    updatePanelStatus(
      message,
      "error"
    );

    if (data !== undefined) {
      console.warn(
        `[SOA流程自动化] ${message}`,
        data
      );
    } else {
      console.warn(
        `[SOA流程自动化] ${message}`
      );
    }
  }

  function renderWebNoticeHistory() {
    const wrapper =
      document.getElementById(
        UI.WEB_NOTICE_ID
      );

    const list =
      document.getElementById(
        UI.WEB_NOTICE_LIST_ID
      );

    if (
      !wrapper ||
      !list
    ) {
      return;
    }

    if (
      !webNoticeHistory.length
    ) {
      wrapper.style.display =
        "none";

      list.textContent =
        "";

      return;
    }

    wrapper.style.display =
      "block";

    list.textContent =
      webNoticeHistory
        .map(item =>
          `[${item.time}] ${item.type}：${item.text}`
        )
        .join("\n");

    list.scrollTop =
      list.scrollHeight;
  }

  function syncWebNoticeOrderContext() {
    const orderCode =
      getCurrentOrderCode();

    if (!orderCode) {
      return;
    }

    if (
      lastWebNoticeOrderCode &&
      lastWebNoticeOrderCode !==
        orderCode
    ) {
      resetWebNoticeHistory();
    }

    lastWebNoticeOrderCode =
      orderCode;
  }

  function pushWebNotice(
    text,
    type = "提示"
  ) {
    syncWebNoticeOrderContext();

    const normalized =
      cleanText(
        text
      ).slice(
        0,
        180
      );

    if (!normalized) {
      return;
    }

    const signature =
      `${type}|${normalized}`;

    const now =
      Date.now();

    if (
      signature ===
        lastWebNoticeSignature &&
      now -
        lastWebNoticeAt <
        1500
    ) {
      return;
    }

    lastWebNoticeSignature =
      signature;

    lastWebNoticeAt =
      now;

    webNoticeHistory.push({
      type,
      text:
        normalized,
      time:
        new Date()
          .toLocaleTimeString(
            "zh-CN",
            {
              hour12: false
            }
          )
    });

    if (
      webNoticeHistory.length >
      5
    ) {
      webNoticeHistory =
        webNoticeHistory.slice(
          -5
        );
    }

    renderWebNoticeHistory();
  }

  function getWebNoticeNodeText(
    node,
    type
  ) {
    if (!node) {
      return "";
    }

    if (
      node.closest?.(
        `#${UI.PANEL_ID}`
      )
    ) {
      return "";
    }

    if (
      type === "弹窗"
    ) {
      const title =
        cleanText(
          node.querySelector(
            ".ant-modal-title"
          )?.textContent
        );

      if (
        title ===
        "流程进度"
      ) {
        return "";
      }

      return title;
    }

    return cleanText(
      node.innerText ||
      node.textContent
    );
  }

  function scanWebNotices() {
    if (
      !isTargetRoute()
    ) {
      return;
    }

    syncWebNoticeOrderContext();

    const groups = [
      {
        selector:
          ".ant-message-notice-content",
        type:
          "消息"
      },
      {
        selector:
          ".ant-notification-notice",
        type:
          "通知"
      },
      {
        selector:
          ".ant-popconfirm",
        type:
          "确认提示"
      },
      {
        selector:
          ".ant-modal-confirm",
        type:
          "确认弹窗"
      },
      {
        selector:
          ".ant-modal",
        type:
          "弹窗"
      }
    ];

    groups.forEach(group => {
      document
        .querySelectorAll(
          group.selector
        )
        .forEach(node => {
          if (
            !isVisible(node)
          ) {
            return;
          }

          const text =
            getWebNoticeNodeText(
              node,
              group.type
            );

          if (!text) {
            return;
          }

          const previous =
            webNoticeSeen.get(
              node
            );

          if (
            previous === text
          ) {
            return;
          }

          webNoticeSeen.set(
            node,
            text
          );

          pushWebNotice(
            text,
            group.type
          );
        });
    });
  }

  function scheduleWebNoticeScan() {
    if (
      webNoticeScanScheduled
    ) {
      return;
    }

    webNoticeScanScheduled =
      true;

    requestAnimationFrame(
      () => {
        webNoticeScanScheduled =
          false;

        scanWebNotices();
      }
    );
  }

  function connectWebNoticeObserver() {
    if (
      webNoticeObserver ||
      !document.body
    ) {
      return;
    }

    webNoticeObserver =
      new MutationObserver(
        () => {
          scheduleWebNoticeScan();
        }
      );

    webNoticeObserver.observe(
      document.body,
      {
        childList: true,
        subtree: true,
        characterData: true
      }
    );

    scheduleWebNoticeScan();
  }

  function disconnectWebNoticeObserver() {
    if (
      webNoticeObserver
    ) {
      webNoticeObserver.disconnect();
      webNoticeObserver =
        null;
    }

    webNoticeScanScheduled =
      false;
  }

  function resetWebNoticeHistory() {
    webNoticeHistory = [];
    webNoticeSeen =
      new WeakMap();

    lastWebNoticeSignature =
      "";

    lastWebNoticeAt =
      0;

    renderWebNoticeHistory();
  }

  function sleep(ms) {
    return new Promise(
      resolve => setTimeout(resolve, ms)
    );
  }

  function cleanText(value) {
    return String(
      value ?? ""
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactText(value) {
    return cleanText(value)
      .replace(/\s+/g, "");
  }

  function isVisible(element) {
    if (!element) {
      return false;
    }

    const style =
      getComputedStyle(element);

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    const rect =
      element.getBoundingClientRect();

    return (
      rect.width > 0 &&
      rect.height > 0
    );
  }

  async function waitFor(
    getter,
    timeout,
    interval = CONFIG.POLL_INTERVAL
  ) {
    const startedAt =
      Date.now();

    while (
      Date.now() - startedAt < timeout
    ) {
      const result =
        getter();

      if (result) {
        return result;
      }

      await sleep(interval);
    }

    return null;
  }

  class FlowBlockedError extends Error {
    constructor(message) {
      super(message);
      this.name =
        "FlowBlockedError";
    }
  }

  class FlowCancelledError extends Error {
    constructor(
      message =
        "自动流程已由用户停止"
    ) {
      super(message);
      this.name =
        "FlowCancelledError";
    }
  }

  function createFlowToken() {
    return {
      cancelled: false
    };
  }

  function throwIfFlowCancelled(
    token
  ) {
    if (
      token &&
      token.cancelled
    ) {
      throw new FlowCancelledError();
    }
  }

  function requestFlowStop() {
    if (
      !processRunning ||
      !activeFlowToken
    ) {
      return false;
    }

    activeFlowToken.cancelled =
      true;

    const button =
      document.getElementById(
        UI.FLOW_RUN_BUTTON_ID
      );

    if (button) {
      button.disabled =
        true;

      button.textContent =
        "停止中...";

      button.style.background =
        "#ff7875";

      button.style.color =
        "#fff";
    }

    updatePanelStatus(
      "正在停止自动流程，将在当前安全等待节点终止后续操作..."
    );

    return true;
  }

  function nextPaint(
    count = 2
  ) {
    return new Promise(resolve => {
      const step =
        remaining => {
          if (
            remaining <= 0
          ) {
            resolve();
            return;
          }

          requestAnimationFrame(
            () =>
              step(
                remaining - 1
              )
          );
        };

      step(count);
    });
  }

  function getVisibleErrorFeedback() {
    const selectors = [
      ".ant-message-notice-content",
      ".ant-notification-notice",
      ".ant-form-item-explain-error",
      ".ant-alert-error",
      ".ant-modal-confirm-error"
    ];

    const keywords = [
      "失败",
      "错误",
      "异常",
      "网络",
      "超时",
      "重试",
      "不能为空",
      "必填",
      "校验",
      "无权限",
      "未成功",
      "系统繁忙",
      "请求失败"
    ];

    for (
      const selector of selectors
    ) {
      const nodes =
        Array.from(
          document.querySelectorAll(
            selector
          )
        ).filter(isVisible);

      for (const node of nodes) {
        const text =
          cleanText(
            node.textContent
          );

        if (
          text &&
          keywords.some(
            word =>
              text.includes(word)
          )
        ) {
          return text;
        }
      }
    }

    return "";
  }

  function getUnexpectedModalText() {
    const modals =
      Array.from(
        document.querySelectorAll(
          ".ant-modal"
        )
      ).filter(isVisible);

    for (const modal of modals) {
      if (
        modal ===
        getVisibleApprovalModal()
      ) {
        continue;
      }

      const title =
        cleanText(
          modal.querySelector(
            ".ant-modal-title"
          )?.textContent
        );

      const text =
        cleanText(
          modal.textContent
        );

      if (
        title === "流程进度"
      ) {
        continue;
      }

      if (
        title ||
        text
      ) {
        return (
          title ||
          text.slice(0, 120)
        );
      }
    }

    return "";
  }

  function getPageBlocker(
    {
      allowApprovalModal = true,
      allowLandingPopconfirm = true
    } = {}
  ) {
    const errorText =
      getVisibleErrorFeedback();

    if (errorText) {
      return errorText;
    }

    if (
      !allowApprovalModal
    ) {
      const approval =
        getVisibleApprovalModal();

      if (approval) {
        return "页面存在未处理的审批弹窗";
      }
    }

    if (
      !allowLandingPopconfirm &&
      getVisibleLandingPopconfirm()
    ) {
      return "页面存在未处理的发起落单确认框";
    }

    const unexpected =
      getUnexpectedModalText();

    if (unexpected) {
      return `检测到非预期弹窗：${unexpected}`;
    }

    return "";
  }

  function waitForReactiveCondition(
    test,
    {
      label = "页面状态",
      token = null,
      blockerCheck = null
    } = {}
  ) {
    return new Promise(
      (resolve, reject) => {
        let finished = false;
        let observer = null;
        let pollTimer = null;
        let noticeTimer = null;

        const waitingMessage =
          `仍在等待：${label}。页面较慢时会继续等待，不会重复提交。`;

        const clearOwnWaitingStatus =
          () => {
            const status =
              document.getElementById(
                UI.STATUS_ID
              );

            if (
              status &&
              status.style.display !==
                "none" &&
              status.textContent ===
                waitingMessage
            ) {
              hidePanelStatus();
            }
          };

        const cleanup =
          () => {
            if (observer) {
              observer.disconnect();
              observer = null;
            }

            if (pollTimer) {
              clearInterval(
                pollTimer
              );
              pollTimer = null;
            }

            if (noticeTimer) {
              clearTimeout(
                noticeTimer
              );
              noticeTimer = null;
            }
          };

        const finishResolve =
          value => {
            if (finished) {
              return;
            }

            finished = true;
            cleanup();
            clearOwnWaitingStatus();
            resolve(value);
          };

        const finishReject =
          error => {
            if (finished) {
              return;
            }

            finished = true;
            cleanup();
            clearOwnWaitingStatus();
            reject(error);
          };

        const check =
          () => {
            if (
              token &&
              token.cancelled
            ) {
              finishReject(
                new FlowCancelledError()
              );
              return;
            }

            if (blockerCheck) {
              const blocker =
                blockerCheck();

              if (blocker) {
                finishReject(
                  new FlowBlockedError(
                    blocker
                  )
                );
                return;
              }
            }

            try {
              const result =
                test();

              if (result) {
                finishResolve(
                  result
                );
              }
            } catch (error) {
              finishReject(error);
            }
          };

        observer =
          new MutationObserver(
            check
          );

        observer.observe(
          document.documentElement,
          {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
          }
        );

        /*
         * MutationObserver 是主触发方式；
         * 轮询只用于 React/样式变化未产生合适 mutation 时的兜底。
         */
        pollTimer =
          setInterval(
            check,
            CONFIG.REACTIVE_POLL_INTERVAL
          );

        /*
         * 等待提示只出现一次并保持稳定，不再周期性“显示 -> 自动隐藏 -> 再显示”。
         * 条件满足或等待失败后，由本等待实例主动清除自己的提示。
         */
        noticeTimer =
          setTimeout(
            () => {
              if (
                token &&
                token.cancelled
              ) {
                check();
                return;
              }

              updatePanelStatus(
                waitingMessage,
                "normal",
                {
                  persistent: true
                }
              );
            },
            CONFIG.STALL_NOTICE_INTERVAL
          );

        check();
      }
    );
  }

  async function waitForStableControlledValue(
    element,
    expected,
    token = null
  ) {
    const expectedText =
      String(expected);

    for (
      let attempt = 0;
      attempt < 4;
      attempt++
    ) {
      throwIfFlowCancelled(
        token
      );

      if (
        String(
          element.value
        ) !== expectedText
      ) {
        setNativeInputValue(
          element,
          expectedText
        );
      }

      /*
       * 等 React 完成一次或多次绘制，而不是固定 sleep。
       */
      await nextPaint(2);

      throwIfFlowCancelled(
        token
      );

      if (
        String(
          element.value
        ) === expectedText
      ) {
        await nextPaint(2);

        throwIfFlowCancelled(
          token
        );

        if (
          String(
            element.value
          ) === expectedText
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function formatDate(date) {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function parseYmdDate(
    value
  ) {
    const text =
      cleanText(value);

    const match =
      text.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/
      );

    if (!match) {
      return null;
    }

    const year =
      Number(match[1]);

    const month =
      Number(match[2]);

    const day =
      Number(match[3]);

    const date =
      new Date(
        year,
        month - 1,
        day
      );

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return {
      date,
      text:
        formatDate(date),
      key:
        year * 10000 +
        month * 100 +
        day
    };
  }

  function addCalendarMonths(
    date,
    months
  ) {
    const source =
      new Date(date);

    const firstOfTarget =
      new Date(
        source.getFullYear(),
        source.getMonth() +
          Number(months || 0),
        1
      );

    const targetYear =
      firstOfTarget.getFullYear();

    const targetMonth =
      firstOfTarget.getMonth();

    const lastDay =
      new Date(
        targetYear,
        targetMonth + 1,
        0
      ).getDate();

    return new Date(
      targetYear,
      targetMonth,
      Math.min(
        source.getDate(),
        lastDay
      )
    );
  }

  function dateDiffDays(
    beginDate,
    endDate
  ) {
    const beginUtc =
      Date.UTC(
        beginDate.getFullYear(),
        beginDate.getMonth(),
        beginDate.getDate()
      );

    const endUtc =
      Date.UTC(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
      );

    return Math.max(
      0,
      Math.floor(
        (
          endUtc -
          beginUtc
        ) /
        86400000
      )
    );
  }

  function getExamRemainingInfo(
    beginDate,
    endDate
  ) {
    if (
      !(beginDate instanceof Date) ||
      !(endDate instanceof Date) ||
      endDate <
        beginDate
    ) {
      return {
        text: "",
        title: ""
      };
    }

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const begin =
      new Date(
        beginDate.getFullYear(),
        beginDate.getMonth(),
        beginDate.getDate()
      );

    const end =
      new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
      );

    /*
     * 正常状态下 end 不会早于今天。
     * 此处仍保留保护，避免页面切换瞬间产生错误显示。
     */
    if (
      end <
      today
    ) {
      return {
        text: "",
        title: ""
      };
    }

    const totalDays =
      dateDiffDays(
        begin,
        end
      );

    const remainingDays =
      dateDiffDays(
        today,
        end
      );

    if (
      end.getTime() ===
      today.getTime()
    ) {
      return {
        text:
          "今日到期",
        title:
          `订单总周期：${totalDays}天；剩余周期：0天`
      };
    }

    let remainingMonths =
      (
        end.getFullYear() -
        today.getFullYear()
      ) * 12 +
      (
        end.getMonth() -
        today.getMonth()
      );

    let anchor =
      addCalendarMonths(
        today,
        remainingMonths
      );

    if (
      anchor >
      end
    ) {
      remainingMonths -= 1;

      anchor =
        addCalendarMonths(
          today,
          remainingMonths
        );
    }

    let text = "";

    if (
      remainingMonths >= 12
    ) {
      const years =
        Math.floor(
          remainingMonths / 12
        );

      text =
        `剩${years}年`;
    } else if (
      remainingMonths >= 1
    ) {
      text =
        `剩${remainingMonths}个月`;
    } else {
      text =
        `剩${remainingDays}天`;
    }

    return {
      text,
      title:
        `订单总周期：${totalDays}天；剩余周期：${remainingDays}天`
    };
  }

  function readDateInputText(
    selector
  ) {
    const element =
      document.querySelector(
        selector
      );

    if (!element) {
      return "";
    }

    return cleanText(
      element.value ||
      element.getAttribute(
        "title"
      ) ||
      element.textContent ||
      ""
    );
  }

  function shouldCheckExamDates(
    stage
  ) {
    const sequence = [
      "报价单设计",
      "授权审批",
      "报价确认",
      "内勤复核",
      "合同补充",
      "落单审核",
      "落单中",
      "已落单"
    ];

    const threshold =
      sequence.indexOf(
        "报价确认"
      );

    const current =
      sequence.indexOf(
        stage
      );

    return (
      current >= threshold &&
      threshold >= 0
    );
  }

  function getExamDateState(
    stage =
      getCurrentFlowStage()
  ) {
    const beginElement =
      document.querySelector(
        CONFIG.REGISTER_BEGIN_DATE_SELECTOR
      );

    const endElement =
      document.querySelector(
        CONFIG.REGISTER_END_DATE_SELECTOR
      );

    if (
      !shouldCheckExamDates(stage) ||
      !beginElement ||
      !endElement
    ) {
      return {
        stage,
        applicable: false,
        abnormal: false,
        beginAbnormal: false,
        endAbnormal: false,
        reason:
          "not-applicable"
      };
    }

    const beginText =
      readDateInputText(
        CONFIG.REGISTER_BEGIN_DATE_SELECTOR
      );

    const endText =
      readDateInputText(
        CONFIG.REGISTER_END_DATE_SELECTOR
      );

    const begin =
      parseYmdDate(
        beginText
      );

    const end =
      parseYmdDate(
        endText
      );

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const todayInfo =
      parseYmdDate(
        formatDate(today)
      );

    const beginInvalid =
      !begin ||
      !todayInfo;

    const endInvalid =
      !end ||
      !todayInfo;

    const startsAfterToday =
      Boolean(
        begin &&
        todayInfo &&
        begin.key >
          todayInfo.key
      );

    const endsBeforeToday =
      Boolean(
        end &&
        todayInfo &&
        end.key <
          todayInfo.key
      );

    /*
     * 若结束日期早于开始日期，将异常归到结束日期，
     * 避免两个日期一起标红。
     */
    const endBeforeBegin =
      Boolean(
        begin &&
        end &&
        end.key <
          begin.key
      );

    const beginAbnormal =
      beginInvalid ||
      startsAfterToday;

    const endAbnormal =
      endInvalid ||
      endsBeforeToday ||
      endBeforeBegin;

    const abnormal =
      beginAbnormal ||
      endAbnormal;

    const reasons = [];

    if (beginInvalid) {
      reasons.push(
        "begin-invalid"
      );
    } else if (startsAfterToday) {
      reasons.push(
        "start-after-today"
      );
    }

    if (endInvalid) {
      reasons.push(
        "end-invalid"
      );
    } else if (endsBeforeToday) {
      reasons.push(
        "end-before-today"
      );
    } else if (endBeforeBegin) {
      reasons.push(
        "end-before-begin"
      );
    }

    return {
      stage,
      applicable: true,
      valid:
        !beginInvalid &&
        !endInvalid &&
        !endBeforeBegin,
      abnormal,
      beginAbnormal,
      endAbnormal,
      startsAfterToday,
      endsBeforeToday,
      endBeforeBegin,
      reason:
        reasons.join(",") ||
        "normal",
      beginText:
        begin?.text ||
        beginText ||
        "未读取",
      endText:
        end?.text ||
        endText ||
        "未读取",
      beginDate:
        begin?.date ||
        null,
      endDate:
        end?.date ||
        null
    };
  }

  function updateExamDateFixButton(
    state =
      getExamDateState()
  ) {
    const button =
      document.getElementById(
        UI.EXAM_DATE_FIX_BUTTON_ID
      );

    if (!button) {
      return;
    }

    const shouldShow =
      state.applicable &&
      state.stage ===
        "报价确认" &&
      state.abnormal;

    button.style.display =
      shouldShow
        ? "inline-flex"
        : "none";

    if (!button.disabled) {
      button.textContent =
        "修改时间";
    }
  }

  function refreshExamDateInfo(
    stage =
      getCurrentFlowStage()
  ) {
    const summary =
      document.getElementById(
        UI.EXAM_DATE_SUMMARY_ID
      );

    const beginSpan =
      document.getElementById(
        UI.EXAM_BEGIN_DATE_ID
      );

    const endSpan =
      document.getElementById(
        UI.EXAM_END_DATE_ID
      );

    const durationSpan =
      document.getElementById(
        UI.EXAM_DURATION_ID
      );

    const state =
      getExamDateState(
        stage
      );

    if (
      !summary ||
      !beginSpan ||
      !endSpan ||
      !durationSpan
    ) {
      updateExamDateFixButton(
        state
      );

      return state;
    }

    if (!state.applicable) {
      summary.style.display =
        "none";

      beginSpan.textContent =
        "";

      endSpan.textContent =
        "";

      durationSpan.textContent =
        "";

      durationSpan.style.display =
        "none";

      updateExamDateFixButton(
        state
      );

      return state;
    }

    /*
     * 从报价确认开始统一显示在“当前阶段”右侧。
     * 开始/结束日期分别着色，互不连带。
     */
    summary.style.display =
      "inline-flex";

    beginSpan.textContent =
      state.beginText;

    endSpan.textContent =
      state.endText;

    beginSpan.style.color =
      state.beginAbnormal
        ? "#cf1322"
        : "#262626";

    beginSpan.style.fontWeight =
      state.beginAbnormal
        ? "700"
        : "400";

    endSpan.style.color =
      state.endAbnormal
        ? "#cf1322"
        : "#262626";

    endSpan.style.fontWeight =
      state.endAbnormal
        ? "700"
        : "400";

    beginSpan.title =
      state.beginAbnormal
        ? "体检开始日期异常"
        : "体检开始日期";

    endSpan.title =
      state.endAbnormal
        ? "体检结束日期异常"
        : "体检结束日期";

    /*
     * 剩余有效期只针对完全正常的日期计算。
     * 任一日期异常时隐藏，避免异常日期产生误导。
     */
    if (
      !state.abnormal &&
      state.beginDate &&
      state.endDate
    ) {
      const remainingInfo =
        getExamRemainingInfo(
          state.beginDate,
          state.endDate
        );

      durationSpan.textContent =
        remainingInfo.text
          ? `· ${remainingInfo.text}`
          : "";

      durationSpan.title =
        remainingInfo.title ||
        "";

      durationSpan.style.display =
        remainingInfo.text
          ? "inline"
          : "none";
    } else {
      durationSpan.textContent =
        "";

      durationSpan.title =
        "";

      durationSpan.style.display =
        "none";
    }

    updateExamDateFixButton(
      state
    );

    return state;
  }

  function registerDatesEditable() {
    const begin =
      document.querySelector(
        CONFIG.REGISTER_BEGIN_DATE_SELECTOR
      );

    const end =
      document.querySelector(
        CONFIG.REGISTER_END_DATE_SELECTOR
      );

    if (
      !begin ||
      !end
    ) {
      return false;
    }

    const beginPicker =
      begin.closest(
        ".ant-picker"
      );

    const endPicker =
      end.closest(
        ".ant-picker"
      );

    return Boolean(
      !begin.disabled &&
      !end.disabled &&
      !beginPicker
        ?.classList.contains(
          "ant-picker-disabled"
        ) &&
      !endPicker
        ?.classList.contains(
          "ant-picker-disabled"
        )
    );
  }

  function getRegisterEditButton() {
    const exact =
      document.querySelector(
        CONFIG.REGISTER_EDIT_BUTTON_SELECTOR
      );

    if (
      exact &&
      isVisible(exact) &&
      !exact.disabled &&
      compactText(
        exact.textContent
      ) === "编辑"
    ) {
      return exact;
    }

    const candidates =
      Array.from(
        document.querySelectorAll(
          "button"
        )
      ).filter(button => {
        return (
          isVisible(button) &&
          !button.disabled &&
          compactText(
            button.textContent
          ) === "编辑"
        );
      });

    return (
      candidates.reverse()[0] ||
      null
    );
  }

  async function enterRegisterEditMode() {
    if (
      registerDatesEditable()
    ) {
      return true;
    }

    const button =
      await waitForReactiveCondition(
        () =>
          getRegisterEditButton() ||
          null,
        {
          label:
            "报价确认页面编辑按钮",
          blockerCheck:
            () =>
              getVisibleErrorFeedback()
        }
      );

    updatePanelStatus(
      "正在进入编辑状态..."
    );

    button.click();

    await waitForReactiveCondition(
      () =>
        registerDatesEditable() ||
        null,
      {
        label:
          "基本信息进入编辑状态",
        blockerCheck:
          () =>
            getVisibleErrorFeedback()
      }
    );

    return true;
  }

  async function setRegisterExamDates() {
    const stage =
      getCurrentFlowStage();

    if (
      stage !==
      "报价确认"
    ) {
      throw new Error(
        `当前阶段为“${stage || "未知"}”，仅报价确认阶段允许修改体检时间`
      );
    }

    const currentState =
      getExamDateState(
        stage
      );

    if (!currentState.applicable) {
      throw new Error(
        "当前未能读取体检开始/结束日期"
      );
    }

    if (!currentState.abnormal) {
      refreshExamDateInfo(
        stage
      );

      updatePanelStatus(
        "体检时间当前正常，无需修改。",
        "success"
      );

      return;
    }

    const actionButton =
      document.getElementById(
        UI.EXAM_DATE_FIX_BUTTON_ID
      );

    if (actionButton) {
      actionButton.disabled =
        true;

      actionButton.textContent =
        "修改中...";
    }

    try {
      await enterRegisterEditMode();

      const begin =
        document.querySelector(
          CONFIG.REGISTER_BEGIN_DATE_SELECTOR
        );

      const end =
        document.querySelector(
          CONFIG.REGISTER_END_DATE_SELECTOR
        );

      if (
        !begin ||
        !end
      ) {
        throw new Error(
          "进入编辑后未找到体检开始/结束日期"
        );
      }

      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      const threeYearsLater =
        addYearsClamped(
          today,
          3
        );

      const beginText =
        formatDate(
          today
        );

      const endText =
        formatDate(
          threeYearsLater
        );

      updatePanelStatus(
        `正在修改体检时间：${beginText} ～ ${endText}`
      );

      let beginOk =
        await chooseDateByPicker(
          begin,
          today
        );

      if (!beginOk) {
        beginOk =
          await setDateFallback(
            begin,
            today
          );
      }

      if (!beginOk) {
        throw new Error(
          `体检开始日期未能修改为 ${beginText}`
        );
      }

      let endOk =
        await chooseDateByPicker(
          end,
          threeYearsLater
        );

      if (!endOk) {
        endOk =
          await setDateFallback(
            end,
            threeYearsLater
          );
      }

      if (!endOk) {
        throw new Error(
          `体检结束日期未能修改为 ${endText}`
        );
      }

      refreshExamDateInfo(
        stage
      );

      updatePanelStatus(
        `✓ 已修改体检时间：${beginText} ～ ${endText}。请核对页面后按原流程保存。`,
        "success"
      );
    } finally {
      const latest =
        getExamDateState(
          getCurrentFlowStage()
        );

      if (actionButton) {
        actionButton.disabled =
          false;

        actionButton.textContent =
          "修改时间";

        actionButton.style.display =
          (
            latest.stage ===
              "报价确认" &&
            latest.abnormal
          )
            ? "inline-flex"
            : "none";
      }
    }
  }

  function setNativeInputValue(
    element,
    value
  ) {
    if (!element) {
      throw new Error(
        "setNativeInputValue: element 为空"
      );
    }

    let prototype = null;

    if (
      element instanceof
        HTMLTextAreaElement
    ) {
      prototype =
        HTMLTextAreaElement
          .prototype;
    } else if (
      element instanceof
        HTMLInputElement
    ) {
      prototype =
        HTMLInputElement
          .prototype;
    } else {
      prototype =
        Object.getPrototypeOf(
          element
        );
    }

    const descriptor =
      prototype
        ? Object
            .getOwnPropertyDescriptor(
              prototype,
              "value"
            )
        : null;

    if (
      descriptor &&
      typeof descriptor.set ===
        "function"
    ) {
      descriptor.set.call(
        element,
        String(value)
      );
    } else {
      element.value =
        String(value);
    }

    element.dispatchEvent(
      new Event(
        "input",
        {
          bubbles: true
        }
      )
    );

    element.dispatchEvent(
      new Event(
        "change",
        {
          bubbles: true
        }
      )
    );
  }

  function fireMouseSequence(
    element
  ) {
    if (!element) {
      return;
    }

    [
      "mousedown",
      "mouseup",
      "click"
    ].forEach(type => {
      element.dispatchEvent(
        new MouseEvent(
          type,
          {
            bubbles: true,
            cancelable: true,
            view: window
          }
        )
      );
    });
  }

  function getContractContainer() {
    const nodes =
      Array.from(
        document.querySelectorAll(
          ".contractcontainer"
        )
      );

    return (
      nodes.find(isVisible) ||
      nodes[0] ||
      null
    );
  }

  function contractPageVisible() {
    const container =
      getContractContainer();

    return Boolean(
      container &&
      isVisible(container)
    );
  }

  function getEditButton() {
    const preferredSpan =
      document.querySelector(
        CONFIG.EDIT_SPAN_SELECTOR
      );

    const preferredButton =
      preferredSpan?.closest(
        "button"
      );

    if (
      preferredButton &&
      isVisible(preferredButton) &&
      compactText(
        preferredButton.textContent
      ) === "编辑"
    ) {
      return preferredButton;
    }

    const container =
      getContractContainer();

    if (!container) {
      return null;
    }

    return (
      Array.from(
        container.querySelectorAll(
          "button"
        )
      ).find(button => {
        return (
          isVisible(button) &&
          compactText(
            button.textContent
          ) === "编辑"
        );
      }) ||
      null
    );
  }

  function formLooksEditable() {
    const company =
      document.querySelector(
        CONFIG.CONTRACT_COMPANY_SELECTOR
      );

    const begin =
      document.querySelector(
        CONFIG.CONTRACT_BEGIN_SELECTOR
      );

    const end =
      document.querySelector(
        CONFIG.CONTRACT_END_SELECTOR
      );

    return Boolean(
      company &&
      begin &&
      end &&
      !company.disabled &&
      !begin.disabled &&
      !end.disabled &&
      !company
        .closest(
          ".ant-select"
        )
        ?.classList.contains(
          "ant-select-disabled"
        ) &&
      !begin
        .closest(
          ".ant-picker"
        )
        ?.classList.contains(
          "ant-picker-disabled"
        ) &&
      !end
        .closest(
          ".ant-picker"
        )
        ?.classList.contains(
          "ant-picker-disabled"
        )
    );
  }

  async function enterEditMode(
    token = null
  ) {
    if (
      formLooksEditable()
    ) {
      log(
        "表单已处于编辑状态，跳过编辑按钮。"
      );
      return;
    }

    const editButton =
      await waitForReactiveCondition(
        () =>
          getEditButton() ||
          null,
        {
          label:
            "合同页编辑按钮",
          token,
          blockerCheck:
            () =>
              getVisibleErrorFeedback()
        }
      );

    log(
      "合同补充：点击“编辑”，等待表单真正进入可编辑状态..."
    );

    editButton.click();

    await waitForReactiveCondition(
      () =>
        formLooksEditable() ||
        null,
      {
        label:
          "合同表单进入编辑状态",
        token,
        blockerCheck:
          () =>
            getVisibleErrorFeedback()
      }
    );

    log(
      "✓ 已进入编辑状态"
    );
  }

  function getSelectVisibleText(input) {
    const select =
      input?.closest(
        ".ant-select"
      );

    return cleanText(
      select
        ?.querySelector(
          ".ant-select-selection-item"
        )
        ?.textContent
    );
  }

  function getVisibleContractCompanyOptions(
    input
  ) {
    const options = [];

    const controlsId =
      input?.getAttribute(
        "aria-controls"
      );

    if (controlsId) {
      const list =
        document.getElementById(
          controlsId
        );

      if (list) {
        options.push(
          ...Array.from(
            list.querySelectorAll(
              ".ant-select-item-option:not(.ant-select-item-option-disabled)"
            )
          ).filter(isVisible)
        );
      }
    }

    if (!options.length) {
      const dropdowns =
        Array.from(
          document.querySelectorAll(
            ".ant-select-dropdown"
          )
        )
          .filter(isVisible)
          .reverse();

      for (
        const dropdown
        of dropdowns
      ) {
        const found =
          Array.from(
            dropdown.querySelectorAll(
              ".ant-select-item-option:not(.ant-select-item-option-disabled)"
            )
          ).filter(isVisible);

        if (found.length) {
          options.push(
            ...found
          );

          break;
        }
      }
    }

    return options;
  }

  async function selectConfiguredContractCompany(
    token = null
  ) {
    const input =
      document.querySelector(
        CONFIG.CONTRACT_COMPANY_SELECTOR
      );

    if (
      !input ||
      input.disabled
    ) {
      throw new Error(
        "己方签单主体（乙方）当前不可编辑"
      );
    }

    const selector =
      input
        .closest(
          ".ant-select"
        )
        ?.querySelector(
          ".ant-select-selector"
        );

    if (!selector) {
      throw new Error(
        "未找到己方签单主体下拉框"
      );
    }

    const config =
      getSigningCompanyConfig();

    if (
      config.mode === "text" &&
      !config.text
    ) {
      throw new Error(
        "签单主体已设置为“按名称匹配”，但尚未填写主体名称"
      );
    }

    log(
      config.mode === "first"
        ? "2/5 选择己方签单主体：第一个可用选项..."
        : `2/5 选择己方签单主体：${config.text}...`
    );

    fireMouseSequence(
      selector
    );

    const options =
      await waitForReactiveCondition(
        () => {
          const found =
            getVisibleContractCompanyOptions(
              input
            );

          return found.length
            ? found
            : null;
        },
        {
          label:
            "己方签单主体下拉选项",
          token,
          blockerCheck:
            () =>
              getVisibleErrorFeedback()
        }
      );

    throwIfFlowCancelled(
      token
    );

    let option = null;

    if (
      config.mode === "first"
    ) {
      option =
        options[0] ||
        null;
    } else {
      option =
        options.find(item => {
          return (
            cleanText(
              item.textContent
            ) ===
            config.text
          );
        }) ||
        null;

      if (!option) {
        const available =
          options
            .map(item =>
              cleanText(
                item.textContent
              )
            )
            .filter(Boolean)
            .join("、");

        throw new Error(
          `未找到配置的己方签单主体“${config.text}”。当前可选：${available || "未读取到选项"}`
        );
      }
    }

    if (!option) {
      throw new Error(
        "未找到可选择的己方签单主体"
      );
    }

    const expectedText =
      cleanText(
        option.textContent
      );

    fireMouseSequence(
      option
    );

    const selected =
      await waitFor(
        () =>
          getSelectVisibleText(
            input
          ) || null,
        2500,
        80
      );

    if (!selected) {
      throw new Error(
        "已点击己方签单主体，但页面未确认选中结果"
      );
    }

    if (
      config.mode === "text" &&
      selected !==
        config.text
    ) {
      throw new Error(
        `己方签单主体选中结果异常：预期“${config.text}”，实际“${selected}”`
      );
    }

    log(
      `✓ 己方签单主体：${selected || expectedText}`
    );
  }

  function getVisiblePickerDropdown() {
    return (
      Array.from(
        document.querySelectorAll(
          ".ant-picker-dropdown"
        )
      )
        .filter(isVisible)
        .reverse()[0] ||
      null
    );
  }

  function getPickerDateCell(
    dropdown,
    dateText
  ) {
    if (!dropdown) {
      return null;
    }

    return (
      Array.from(
        dropdown.querySelectorAll(
          ".ant-picker-cell[title]"
        )
      ).find(cell => {
        return (
          cell.getAttribute(
            "title"
          ) === dateText &&
          !cell.classList.contains(
            "ant-picker-cell-disabled"
          )
        );
      }) ||
      null
    );
  }

  async function chooseDateByPicker(
    input,
    targetDate
  ) {
    const targetText =
      formatDate(
        targetDate
      );

    fireMouseSequence(
      input.closest(
        ".ant-picker"
      ) || input
    );

    let dropdown =
      await waitFor(
        getVisiblePickerDropdown,
        CONFIG.PICKER_TIMEOUT,
        80
      );

    if (!dropdown) {
      return false;
    }

    let cell =
      getPickerDateCell(
        dropdown,
        targetText
      );

    if (!cell) {
      const targetYear =
        targetDate.getFullYear();

      const targetMonth =
        targetDate.getMonth();

      let safety = 30;

      while (
        !cell &&
        safety-- > 0
      ) {
        const headerText =
          compactText(
            dropdown
              .querySelector(
                ".ant-picker-header-view"
              )
              ?.textContent
          );

        const yearMatch =
          headerText.match(
            /(\d{4})年/
          );

        const monthMatch =
          headerText.match(
            /(\d{1,2})月/
          );

        const currentYear =
          yearMatch
            ? Number(
                yearMatch[1]
              )
            : NaN;

        const currentMonth =
          monthMatch
            ? Number(
                monthMatch[1]
              ) - 1
            : NaN;

        if (
          Number.isFinite(
            currentYear
          ) &&
          currentYear !==
            targetYear
        ) {
          const button =
            dropdown.querySelector(
              currentYear <
                targetYear
                ? ".ant-picker-header-super-next-btn"
                : ".ant-picker-header-super-prev-btn"
            );

          if (!button) {
            break;
          }

          button.click();
          await sleep(120);
        } else if (
          Number.isFinite(
            currentMonth
          ) &&
          currentMonth !==
            targetMonth
        ) {
          const button =
            dropdown.querySelector(
              currentMonth <
                targetMonth
                ? ".ant-picker-header-next-btn"
                : ".ant-picker-header-prev-btn"
            );

          if (!button) {
            break;
          }

          button.click();
          await sleep(120);
        } else {
          break;
        }

        dropdown =
          getVisiblePickerDropdown() ||
          dropdown;

        cell =
          getPickerDateCell(
            dropdown,
            targetText
          );
      }
    }

    if (!cell) {
      return false;
    }

    fireMouseSequence(
      cell.querySelector(
        ".ant-picker-cell-inner"
      ) || cell
    );

    const confirmed =
      await waitFor(
        () =>
          input.value ===
            targetText,
        2200,
        80
      );

    return Boolean(
      confirmed
    );
  }

  async function setDateFallback(
    input,
    targetDate
  ) {
    const targetText =
      formatDate(
        targetDate
      );

    const wasReadonly =
      input.hasAttribute(
        "readonly"
      );

    if (wasReadonly) {
      input.removeAttribute(
        "readonly"
      );
    }

    try {
      input.focus();

      setNativeInputValue(
        input,
        targetText
      );

      input.dispatchEvent(
        new KeyboardEvent(
          "keydown",
          {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true
          }
        )
      );

      input.blur();

      await sleep(250);

      return (
        input.value ===
        targetText
      );
    } finally {
      if (wasReadonly) {
        input.setAttribute(
          "readonly",
          ""
        );
      }
    }
  }

  async function setContractDates() {
    const begin =
      document.querySelector(
        CONFIG.CONTRACT_BEGIN_SELECTOR
      );

    const end =
      document.querySelector(
        CONFIG.CONTRACT_END_SELECTOR
      );

    if (!begin || !end) {
      throw new Error(
        "未找到合同开始/结束日期"
      );
    }

    const today =
      new Date();

    const oneYearLater =
      addYearsClamped(
        today,
        1
      );

    const beginText =
      formatDate(
        today
      );

    const endText =
      formatDate(
        oneYearLater
      );

    log(
      `3/5 填写合同日期：${beginText} → ${endText}`
    );

    let beginOk =
      await chooseDateByPicker(
        begin,
        today
      );

    if (!beginOk) {
      beginOk =
        await setDateFallback(
          begin,
          today
        );
    }

    if (!beginOk) {
      throw new Error(
        `合同开始日期未能写入 ${beginText}`
      );
    }

    await sleep(180);

    let endOk =
      await chooseDateByPicker(
        end,
        oneYearLater
      );

    if (!endOk) {
      endOk =
        await setDateFallback(
          end,
          oneYearLater
        );
    }

    if (!endOk) {
      throw new Error(
        `合同结束日期未能写入 ${endText}`
      );
    }

    log(
      `✓ 合同日期：${begin.value} → ${end.value}`
    );
  }

  async function fillInspectionPeopleDay() {
    const input =
      document.querySelector(
        CONFIG.INSPECTION_DAY_SELECTOR
      );

    if (!input) {
      log(
        "4/5 当前不存在 #inspectionPeopleDay，跳过。"
      );
      return;
    }

    if (
      input.disabled ||
      input.readOnly
    ) {
      warn(
        "4/5 #inspectionPeopleDay 存在但不可编辑，跳过。"
      );
      return;
    }

    setNativeInputValue(
      input,
      "1"
    );

    input.focus();
    input.blur();

    await sleep(150);

    log(
      `✓ 提交名单时限：${input.value}`
    );
  }

  function getContractSaveButton() {
    const container =
      getContractContainer();

    if (!container) {
      return null;
    }

    return (
      Array.from(
        container.querySelectorAll(
          "button"
        )
      ).find(button => {
        return (
          isVisible(button) &&
          compactText(
            button.textContent
          ) === "合同保存"
        );
      }) ||
      null
    );
  }

  async function saveContractForm(
    token = null
  ) {
    const saveButton =
      await waitForReactiveCondition(
        () =>
          getContractSaveButton() ||
          (
            !formLooksEditable()
              ? true
              : null
          ),
        {
          label:
            "合同保存按钮",
          token,
          blockerCheck:
            () =>
              getVisibleErrorFeedback()
        }
      );

    if (
      saveButton === true
    ) {
      log(
        "合同表单当前已经退出编辑状态，视为已保存。"
      );
      return;
    }

    log(
      "合同补充：点击“合同保存”，等待页面确认保存完成..."
    );

    saveButton.click();

    await waitForReactiveCondition(
      () => {
        const currentButton =
          getContractSaveButton();

        if (
          !currentButton ||
          !isVisible(
            currentButton
          ) ||
          !formLooksEditable()
        ) {
          return true;
        }

        return null;
      },
      {
        label:
          "合同保存完成",
        token,
        blockerCheck:
          () =>
            getVisibleErrorFeedback()
      }
    );

    log(
      "✓ 合同保存动作已完成"
    );
  }

  function getUploaderTitle(
    uploader
  ) {
    return cleanText(
      uploader
        ?.querySelector(
          ".custom-uploader-header-title"
        )
        ?.textContent
    );
  }

  function findUploader(kind) {
    const uploaders =
      Array.from(
        document.querySelectorAll(
          ".contractfiles-uploader"
        )
      );

    if (kind === "contract") {
      return (
        uploaders.find(
          uploader =>
            [
              "合同文件",
              "已盖章合同文件回传",
              "已盖章合同文件"
            ].includes(
              getUploaderTitle(
                uploader
              )
            )
        ) ||
        uploaders.find(
          uploader => {
            const text =
              compactText(
                uploader.textContent
              );

            return (
              text.includes(
                "上传合同"
              ) &&
              !text.includes(
                "上传证明文件"
              )
            );
          }
        ) ||
        null
      );
    }

    if (kind === "auth") {
      return (
        uploaders.find(
          uploader =>
            getUploaderTitle(
              uploader
            ).includes(
              "企业查看员工体检报告补充授权书"
            )
        ) ||
        uploaders.find(
          uploader =>
            compactText(
              uploader.textContent
            ).includes(
              "上传授权书"
            )
        ) ||
        null
      );
    }

    return null;
  }

  function openBindingDb() {
    return new Promise(
      (resolve, reject) => {
        const request =
          indexedDB.open(
            FILE_BINDING.DB_NAME,
            FILE_BINDING.DB_VERSION
          );

        request.onupgradeneeded =
          () => {
            const db =
              request.result;

            if (
              !db.objectStoreNames
                .contains(
                  FILE_BINDING.STORE_NAME
                )
            ) {
              db.createObjectStore(
                FILE_BINDING.STORE_NAME
              );
            }
          };

        request.onsuccess =
          () => {
            resolve(
              request.result
            );
          };

        request.onerror =
          () => {
            reject(
              request.error ||
              new Error(
                "打开文件绑定数据库失败"
              )
            );
          };
      }
    );
  }

  async function saveBoundFileHandle(
    handle
  ) {
    const db =
      await openBindingDb();

    try {
      await new Promise(
        (resolve, reject) => {
          const transaction =
            db.transaction(
              FILE_BINDING.STORE_NAME,
              "readwrite"
            );

          const store =
            transaction.objectStore(
              FILE_BINDING.STORE_NAME
            );

          store.put(
            handle,
            FILE_BINDING.HANDLE_KEY
          );

          transaction.oncomplete =
            () => resolve();

          transaction.onerror =
            () => {
              reject(
                transaction.error ||
                new Error(
                  "保存文件绑定失败"
                )
              );
            };

          transaction.onabort =
            () => {
              reject(
                transaction.error ||
                new Error(
                  "保存文件绑定已中止"
                )
              );
            };
        }
      );
    } finally {
      db.close();
    }
  }

  async function loadBoundFileHandle() {
    const db =
      await openBindingDb();

    try {
      return await new Promise(
        (resolve, reject) => {
          const transaction =
            db.transaction(
              FILE_BINDING.STORE_NAME,
              "readonly"
            );

          const store =
            transaction.objectStore(
              FILE_BINDING.STORE_NAME
            );

          const request =
            store.get(
              FILE_BINDING.HANDLE_KEY
            );

          request.onsuccess =
            () => {
              resolve(
                request.result ||
                null
              );
            };

          request.onerror =
            () => {
              reject(
                request.error ||
                new Error(
                  "读取文件绑定失败"
                )
              );
            };
        }
      );
    } finally {
      db.close();
    }
  }

  function updateBoundFileDisplay() {
    const button =
      document.getElementById(
        UI.BIND_BUTTON_ID
      );

    if (!button) {
      return;
    }

    if (boundFileHandle) {
      const name =
        boundFileHandle.name ||
        "已绑定文件";

      button.textContent =
        "文件已选择";

      button.title =
        `当前文件：${name}。点击重新选择`;

      button.style.color =
        "#389e0d";

      button.style.borderColor =
        "#b7eb8f";

      button.style.background =
        "#f6ffed";
    } else {
      button.textContent =
        "待选择文件";

      button.title =
        "尚未选择共用合同/授权书文件，点击选择";

      button.style.color =
        "#cf1322";

      button.style.borderColor =
        "#ffccc7";

      button.style.background =
        "#fff2f0";
    }
  }

  async function bindSharedFile() {
    if (
      typeof window
        .showOpenFilePicker !==
      "function"
    ) {
      throw new Error(
        "当前浏览器不支持 File System Access API，请使用新版 Chrome/Edge 并确保页面为 HTTPS"
      );
    }

    /*
     * showOpenFilePicker 必须直接由真实用户点击触发。
     * 本函数在“文件绑定”按钮事件中第一时间调用。
     */
    const handles =
      await window
        .showOpenFilePicker({
          multiple: false
        });

    const handle =
      handles?.[0] ||
      null;

    if (!handle) {
      return false;
    }

    boundFileHandle =
      handle;

    await saveBoundFileHandle(
      handle
    );

    updateBoundFileDisplay();

    log(
      `✓ 已选择共用文件：${handle.name}`
    );

    return true;
  }


  async function ensureBoundFilePermissionFromUserGesture() {
    if (!boundFileHandle) {
      throw new Error(
        "尚未选择共用文件，请先点击文件按钮完成绑定"
      );
    }

    let permission =
      "granted";

    /*
     * 该函数必须直接由真实用户点击触发。
     * requestPermission 在调用瞬间即可利用当前 user activation；
     * 已经授权时会直接返回 granted，不会重复弹窗。
     */
    if (
      typeof boundFileHandle
        .requestPermission ===
      "function"
    ) {
      permission =
        await boundFileHandle
          .requestPermission({
            mode: "read"
          });
    } else if (
      typeof boundFileHandle
        .queryPermission ===
      "function"
    ) {
      permission =
        await boundFileHandle
          .queryPermission({
            mode: "read"
          });
    }

    if (
      permission !==
      "granted"
    ) {
      throw new Error(
        "已绑定文件尚未获得读取权限，请重新授权或重新绑定文件"
      );
    }

    try {
      const file =
        await boundFileHandle
          .getFile();

      if (!file) {
        throw new Error(
          "读取文件失败"
        );
      }

      return file;
    } catch (error) {
      throw new Error(
        "已绑定文件可能被移动、删除或权限失效，请重新绑定文件"
      );
    }
  }

  async function getBoundFileForRun() {
    if (!boundFileHandle) {
      throw new Error(
        "尚未选择共用文件，请先点击“待选择文件”"
      );
    }

    let permission =
      "granted";

    if (
      typeof boundFileHandle
        .queryPermission ===
      "function"
    ) {
      permission =
        await boundFileHandle
          .queryPermission({
            mode: "read"
          });
    }

    if (
      permission !==
      "granted"
    ) {
      throw new Error(
        "文件读取权限已失效，请点击“文件已选择”重新授权或重新选择文件"
      );
    }

    try {
      const file =
        await boundFileHandle
          .getFile();

      if (!file) {
        throw new Error(
          "读取文件失败"
        );
      }

      return file;
    } catch (error) {
      throw new Error(
        "已选择文件可能被移动、删除或权限失效，请重新选择文件"
      );
    }
  }

  function assignFileToInput(
    input,
    file
  ) {
    const transfer =
      new DataTransfer();

    transfer.items.add(
      file
    );

    try {
      input.files =
        transfer.files;
    } catch {
      Object.defineProperty(
        input,
        "files",
        {
          configurable: true,
          value:
            transfer.files
        }
      );
    }

    input.dispatchEvent(
      new Event(
        "input",
        {
          bubbles: true
        }
      )
    );

    input.dispatchEvent(
      new Event(
        "change",
        {
          bubbles: true
        }
      )
    );
  }

  async function waitUploadVisible(
    kind,
    file,
    token = null
  ) {
    const uploader =
      findUploader(kind);

    if (!uploader) {
      return false;
    }

    const fileName =
      cleanText(
        file.name
      );

    const startedAt =
      Date.now();

    while (
      Date.now() -
        startedAt <
      CONFIG.UPLOAD_CONFIRM_TIMEOUT
    ) {
      throwIfFlowCancelled(
        token
      );

      const text =
        cleanText(
          uploader.textContent
        );

      if (
        fileName &&
        text.includes(
          fileName
        )
      ) {
        return true;
      }

      const list =
        uploader.querySelector(
          ".contract-list"
        );

      if (
        list &&
        !compactText(
          list.textContent
        ).includes(
          "暂无数据"
        )
      ) {
        return true;
      }

      await sleep(200);
    }

    return false;
  }

  async function uploadOne(
    kind,
    file,
    label,
    token = null
  ) {
    if (!file) {
      warn(
        `未选择${label}，本次跳过。`
      );
      return;
    }

    const uploader =
      findUploader(kind);

    if (!uploader) {
      log(
        `当前页面不存在${label}上传模块，已跳过。`
      );

      return {
        skipped: true,
        reason: "module-missing"
      };
    }

    const input =
      uploader.querySelector(
        'input[type="file"]'
      );

    if (!input) {
      log(
        `${label}上传模块存在，但未发现文件选择控件，已跳过。`
      );

      return {
        skipped: true,
        reason: "input-missing"
      };
    }

    log(
      `6/6 发送${label}到网页上传控件：${file.name}`
    );

    assignFileToInput(
      input,
      file
    );

    const confirmed =
      await waitUploadVisible(
        kind,
        file,
        token
      );

    if (confirmed) {
      log(
        `✓ ${label}已进入上传列表：${file.name}`
      );

      return {
        skipped: false,
        confirmed: true
      };
    }

    warn(
      `${label}已触发 change，但 8 秒内未从上传列表确认；请人工检查。`
    );

    return {
      skipped: false,
      confirmed: false
    };
  }

  function findTabByText(
    text
  ) {
    return (
      Array.from(
        document.querySelectorAll(
          ".tabs-wrap .tabs .tab"
        )
      ).find(tab => {
        return (
          isVisible(tab) &&
          compactText(
            tab.textContent
          ) === compactText(text)
        );
      }) ||
      null
    );
  }

  async function ensureContractTabVisible(
    token = null
  ) {
    if (
      contractPageVisible()
    ) {
      return true;
    }

    const contractTab =
      await waitForReactiveCondition(
        () =>
          findTabByText(
            "合同"
          ) ||
          null,
        {
          label:
            "合同页签",
          token,
          blockerCheck:
            () =>
              getVisibleErrorFeedback()
        }
      );

    log(
      "合同补充：自动切换到“合同”页签..."
    );

    contractTab.click();

    await waitForReactiveCondition(
      () =>
        contractPageVisible() ||
        null,
      {
        label:
          "合同模块加载",
        token,
        blockerCheck:
          () =>
            getVisibleErrorFeedback()
      }
    );

    log(
      "✓ 已进入合同页签"
    );

    return true;
  }

  function findBottomActionByText(
    text
  ) {
    const bottom =
      document.querySelector(
        ".bottom .actions"
      );

    if (!bottom) {
      return null;
    }

    return (
      Array.from(
        bottom.querySelectorAll(
          "button"
        )
      ).find(button => {
        return (
          isVisible(button) &&
          !button.disabled &&
          compactText(
            button.textContent
          ) === compactText(text)
        );
      }) ||
      null
    );
  }

  function getVisibleLandingPopconfirm() {
    const popovers =
      Array.from(
        document.querySelectorAll(
          ".ant-popover.ant-popconfirm, .ant-popconfirm"
        )
      ).filter(isVisible);

    return (
      popovers.find(popover => {
        return compactText(
          popover.textContent
        ).includes(
          "确认已补充完整订单相关的资料，发起落单吗？"
        );
      }) ||
      null
    );
  }

  function findLandingPopoverConfirmButton(
    popover
  ) {
    if (!popover) {
      return null;
    }

    return (
      Array.from(
        popover.querySelectorAll(
          ".ant-popover-buttons button"
        )
      ).find(button => {
        return (
          isVisible(button) &&
          !button.disabled &&
          compactText(
            button.textContent
          ) === "确定"
        );
      }) ||
      null
    );
  }

  function cleanCellText(
    value
  ) {
    return String(
      value ?? ""
    )
      .replace(
        /[\t\r\n]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function queryText(
    selector
  ) {
    const element =
      document.querySelector(
        selector
      );

    if (!element) {
      return "";
    }

    return cleanCellText(
      element.innerText ||
      element.textContent
    );
  }

  function getFormItemTextByFor(
    forId
  ) {
    const label =
      document.querySelector(
        `#register label[for="${forId}"]`
      );

    const item =
      label?.closest(
        ".ant-form-item"
      );

    const content =
      item?.querySelector(
        ".ant-form-item-control-input-content"
      );

    return cleanCellText(
      content?.innerText ||
      content?.textContent
    );
  }

  function getExtractOrderName() {
    const direct =
      document.querySelector(
        CONFIG.EXTRACT_ORDER_NAME_SELECTOR
      );

    if (!direct) {
      return "";
    }

    const titledLabel =
      direct.querySelector(
        "label[title]"
      );

    const title =
      cleanCellText(
        titledLabel?.getAttribute(
          "title"
        )
      );

    if (title) {
      return title;
    }

    return cleanCellText(
      direct.innerText ||
      direct.textContent
    );
  }

  function getExtractOrderCode() {
    return (
      queryText(
        CONFIG.EXTRACT_ORDER_CODE_SELECTOR
      ) ||
      getFormItemTextByFor(
        "register_main_order_code"
      )
    );
  }

  function getExtractOpportunityCode() {
    const raw =
      (
        queryText(
          CONFIG.EXTRACT_OPPORTUNITY_CODE_SELECTOR
        ) ||
        getFormItemTextByFor(
          "register_opportunity_id"
        )
      )
        .replace(
          /^'+/,
          ""
        )
        .trim();

    return raw
      ? `'${raw}`
      : "";
  }

  function getExtractSalesmanName() {
    const raw =
      (
        queryText(
          CONFIG.EXTRACT_SALESMAN_SELECTOR
        ) ||
        getFormItemTextByFor(
          "register_salesman"
        )
      );

    return cleanCellText(
      raw
        .split(
          /[（(]/
        )[0]
    );
  }

  function extractDateTimeFromText(
    value
  ) {
    const text =
      cleanCellText(
        value
      );

    if (!text) {
      return "";
    }

    const patterns = [
      /\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?/,
      /\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?/,
      /\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}(?::\d{2})?/,
      /\d{4}-\d{1,2}-\d{1,2}/,
      /\d{4}\/\d{1,2}\/\d{1,2}/,
      /\d{4}年\d{1,2}月\d{1,2}日/
    ];

    for (
      const pattern of patterns
    ) {
      const match =
        text.match(pattern);

      if (match) {
        return cleanCellText(
          match[0]
        );
      }
    }

    return "";
  }

  function addYearsClamped(
    date,
    years
  ) {
    const source =
      new Date(date);

    const targetYear =
      source.getFullYear() +
      Number(years || 0);

    const month =
      source.getMonth();

    const day =
      source.getDate();

    const lastDay =
      new Date(
        targetYear,
        month + 1,
        0
      ).getDate();

    return new Date(
      targetYear,
      month,
      Math.min(
        day,
        lastDay
      )
    );
  }

  function getCurrentOrderCode() {
    const registerText =
      getFormItemTextByFor(
        "register_main_order_code"
      );

    const registerMatch =
      registerText.match(
        /SOA[A-Za-z0-9-]+/
      );

    if (registerMatch) {
      return registerMatch[0];
    }

    const orderDescText =
      cleanCellText(
        document.querySelector(
          ".order-desc"
        )?.textContent
      );

    const orderDescMatch =
      orderDescText.match(
        /SOA[A-Za-z0-9-]+/
      );

    if (orderDescMatch) {
      return orderDescMatch[0];
    }

    const urlMatch =
      String(
        location.href
      ).match(
        /[?&#]orderCode=(SOA[A-Za-z0-9-]+)/
      );

    return (
      urlMatch?.[1] ||
      ""
    );
  }

  async function fetchProcessLogs() {
    const orderCode =
      getCurrentOrderCode();

    if (!orderCode) {
      throw new Error(
        "未识别到当前订单编号，无法读取流程日志"
      );
    }

    const response =
      await fetch(
        CONFIG.PROCESS_LOG_API,
        {
          method:
            "POST",
          headers: {
            "accept":
              "application/json, text/plain, */*",
            "content-type":
              "application/json;charset=UTF-8",
            "mnclientid":
              "MN_SOA3"
          },
          body:
            JSON.stringify({
              order_code:
                orderCode,
              type:
                "ALL"
            }),
          credentials:
            "include"
        }
      );

    if (!response.ok) {
      throw new Error(
        `流程日志接口请求失败：HTTP ${response.status}`
      );
    }

    const payload =
      await response.json();

    return {
      orderCode,
      payload
    };
  }

  function collectObjects(
    value,
    output = []
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return output;
    }

    if (
      Array.isArray(value)
    ) {
      value.forEach(item => {
        collectObjects(
          item,
          output
        );
      });

      return output;
    }

    if (
      typeof value ===
      "object"
    ) {
      output.push(value);

      Object.values(
        value
      ).forEach(child => {
        if (
          child &&
          typeof child ===
            "object"
        ) {
          collectObjects(
            child,
            output
          );
        }
      });
    }

    return output;
  }

  function getPrimitiveEntries(
    object
  ) {
    return Object.entries(
      object || {}
    )
      .filter(([, value]) => {
        return (
          typeof value ===
            "string" ||
          typeof value ===
            "number"
        );
      })
      .map(([key, value]) => ({
        key,
        value:
          String(value)
      }));
  }

  function normalizeTransitionText(
    value
  ) {
    return cleanCellText(
      value
    )
      .replace(
        /\s*-\s*>\s*/g,
        " -> "
      )
      .replace(
        /\s*→\s*/g,
        " -> "
      );
  }

  function objectIsLandingRecord(
    object
  ) {
    const entries =
      getPrimitiveEntries(
        object
      );

    for (const entry of entries) {
      const value =
        normalizeTransitionText(
          entry.value
        );

      if (
        value ===
          "已落单" ||
        /->\s*已落单$/.test(
          value
        )
      ) {
        return true;
      }
    }

    /*
     * 兼容接口将“目标状态”和“来源状态”拆字段返回。
     */
    for (const entry of entries) {
      const key =
        entry.key
          .toLowerCase();

      const value =
        cleanCellText(
          entry.value
        );

      if (
        /(to|target|next|after|status|state)/.test(
          key
        ) &&
        value ===
          "已落单"
      ) {
        return true;
      }
    }

    return false;
  }

  function getObjectDateTime(
    object
  ) {
    const entries =
      getPrimitiveEntries(
        object
      );

    const candidates = [];

    entries.forEach(
      ({ key, value }, index) => {
        const time =
          extractDateTimeFromText(
            value
          );

        if (!time) {
          return;
        }

        const normalizedKey =
          key.toLowerCase();

        let priority = 50;

        if (
          /create.*time|created.*time/.test(
            normalizedKey
          )
        ) {
          priority = 1;
        } else if (
          /operate.*time|operation.*time/.test(
            normalizedKey
          )
        ) {
          priority = 2;
        } else if (
          /process.*time|handle.*time/.test(
            normalizedKey
          )
        ) {
          priority = 3;
        } else if (
          /time|date/.test(
            normalizedKey
          )
        ) {
          priority = 10;
        }

        candidates.push({
          time,
          priority,
          index
        });
      }
    );

    candidates.sort(
      (a, b) =>
        a.priority -
          b.priority ||
        a.index -
          b.index
    );

    return (
      candidates[0]?.time ||
      ""
    );
  }

  function dateTimeToNumber(
    value
  ) {
    const text =
      String(
        value || ""
      )
        .replace(
          /年|月/g,
          "-"
        )
        .replace(
          /日/g,
          ""
        )
        .replace(
          /\//g,
          "-"
        )
        .trim();

    const match =
      text.match(
        /(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
      );

    if (!match) {
      return Number.NaN;
    }

    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0)
    ).getTime();
  }

  function parseLandingRecordsFromProcessLogs(
    payload
  ) {
    const objects =
      collectObjects(
        payload
      );

    const matched = [];

    objects.forEach(
      (object, index) => {
        if (
          !objectIsLandingRecord(
            object
          )
        ) {
          return;
        }

        const time =
          getObjectDateTime(
            object
          );

        if (!time) {
          return;
        }

        matched.push({
          index,
          time,
          object
        });
      }
    );

    /*
     * 嵌套 JSON 可能让同一条记录被重复扫到，
     * 这里按时间去重。
     */
    const unique =
      new Map();

    matched.forEach(record => {
      if (
        !unique.has(
          record.time
        )
      ) {
        unique.set(
          record.time,
          record
        );
      }
    });

    const records =
      Array.from(
        unique.values()
      );

    records.sort(
      (a, b) => {
        const at =
          dateTimeToNumber(
            a.time
          );

        const bt =
          dateTimeToNumber(
            b.time
          );

        if (
          Number.isFinite(at) &&
          Number.isFinite(bt)
        ) {
          return at - bt;
        }

        return (
          a.index -
          b.index
        );
      }
    );

    return records;
  }

  function buildLandingTimeOptions(
    records
  ) {
    if (
      !Array.isArray(records) ||
      !records.length
    ) {
      return [];
    }

    const first =
      records[0];

    const last =
      records[
        records.length - 1
      ];

    const options = [
      {
        type: "first",
        label: "首次落单",
        time: first.time
      }
    ];

    if (
      records.length > 1
    ) {
      const modifiedCount =
        records.length - 1;

      options.push({
        type: "modified",
        label:
          `修改${modifiedCount}次`,
        time: last.time,
        count:
          modifiedCount
      });
    }

    return options;
  }

  let cachedLandingTimeOptions = [];

  async function refreshLandingTimeOptions() {
    cachedLandingTimeOptions = [];

    const stage =
      getCurrentFlowStage();

    if (
      stage !==
      "已落单"
    ) {
      renderLandingExtractOptions(
        []
      );

      return [];
    }

    const result =
      await fetchProcessLogs();

    const records =
      parseLandingRecordsFromProcessLogs(
        result.payload
      );

    if (!records.length) {
      console.warn(
        "[SOA流程自动化] processlogs 未识别到已落单记录，原始响应：",
        result.payload
      );

      renderLandingExtractOptions(
        []
      );

      return [];
    }

    console.log(
      "[SOA流程自动化] processlogs 已识别落单记录：",
      records.map(record => ({
        time:
          record.time,
        object:
          record.object
      }))
    );

    const options =
      buildLandingTimeOptions(
        records
      );

    cachedLandingTimeOptions =
      options;

    renderLandingExtractOptions(
      options
    );

    return options;
  }

  function getLandingTimeOptions() {
    return [
      ...cachedLandingTimeOptions
    ];
  }

  function buildSpreadsheetLine(
    landingTime
  ) {
    const values = [
      getExtractOrderName(),
      getExtractOrderCode(),
      getExtractOpportunityCode(),
      getExtractSalesmanName(),
      landingTime
    ].map(
      cleanCellText
    );

    const missing = [];

    if (!values[0]) {
      missing.push(
        "订单名称"
      );
    }

    if (!values[1]) {
      missing.push(
        "订单编号"
      );
    }

    if (!values[2]) {
      missing.push(
        "商机代码"
      );
    }

    if (!values[3]) {
      missing.push(
        "健管顾问姓名"
      );
    }

    if (!values[4]) {
      missing.push(
        "落单时间"
      );
    }

    if (missing.length) {
      throw new Error(
        "提取数据不完整：" +
        missing.join("、")
      );
    }

    return values.join(
      "\t"
    );
  }

  async function copyTextToClipboard(
    text
  ) {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      try {
        await navigator.clipboard
          .writeText(text);

        return true;
      } catch (_) {
        // 继续走兼容方案。
      }
    }

    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value =
      text;

    textarea.style.position =
      "fixed";

    textarea.style.left =
      "-9999px";

    textarea.style.top =
      "-9999px";

    document.body.appendChild(
      textarea
    );

    textarea.focus();
    textarea.select();

    const ok =
      document.execCommand(
        "copy"
      );

    textarea.remove();

    if (!ok) {
      throw new Error(
        "浏览器未允许自动复制，请从下方预览框手动复制"
      );
    }

    return true;
  }

  function showExtractPreview(
    text
  ) {
    const preview =
      document.getElementById(
        UI.EXTRACT_PREVIEW_ID
      );

    if (!preview) {
      return;
    }

    preview.style.display =
      "block";

    preview.textContent =
      text;
  }

  async function copyLandingOption(
    option
  ) {
    const line =
      buildSpreadsheetLine(
        option.time
      );

    showExtractPreview(
      line
    );

    await copyTextToClipboard(
      line
    );

    updatePanelStatus(
      `✓ 已复制“${option.label}”数据，可直接粘贴到表格。`,
      "success"
    );

    log(
      `已复制${option.label}数据：${line}`
    );
  }

  function renderLandingExtractOptions(
    suppliedOptions = null
  ) {
    const container =
      document.getElementById(
        UI.EXTRACT_OPTIONS_ID
      );

    if (!container) {
      return [];
    }

    container.innerHTML =
      "";

    container.style.display =
      "none";

    const options =
      Array.isArray(
        suppliedOptions
      )
        ? suppliedOptions
        : getLandingTimeOptions();

    if (!options.length) {
      return options;
    }

    container.style.display =
      "grid";

    container.style.gridTemplateColumns =
      options.length > 1
        ? "1fr 1fr"
        : "1fr";

    container.style.gap =
      "8px";

    container.style.marginTop =
      "0";

    options.forEach(option => {
      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.textContent =
        `${option.label}｜${option.time}`;

      button.style.cssText = [
        "min-height:34px",
        "padding:5px 7px",
        "border:1px solid #1677ff",
        "border-radius:6px",
        "background:#fff",
        "color:#1677ff",
        "cursor:pointer",
        "font-size:12px",
        "line-height:1.35"
      ].join(";");

      button.addEventListener(
        "click",
        () => {
          copyLandingOption(
            option
          ).catch(error => {
            warn(
              error?.message ||
              String(error)
            );
          });
        }
      );

      container.appendChild(
        button
      );
    });

    return options;
  }


  function getVisibleTables() {
    return Array.from(
      document.querySelectorAll(
        "table"
      )
    ).filter(isVisible);
  }

  function getTableHeaderTexts(
    table
  ) {
    if (!table) {
      return [];
    }

    const headerRow =
      Array.from(
        table.querySelectorAll(
          "thead tr"
        )
      ).reverse()[0];

    if (!headerRow) {
      return [];
    }

    return Array.from(
      headerRow.querySelectorAll(
        "th"
      )
    ).map(cell =>
      compactText(
        cell.textContent
      )
    );
  }

  function findTableByHeaders(
    requiredHeaders
  ) {
    return (
      getVisibleTables()
        .find(table => {
          const headers =
            getTableHeaderTexts(
              table
            );

          return requiredHeaders
            .every(required =>
              headers.includes(
                compactText(required)
              )
            );
        }) ||
      null
    );
  }

  function findSummaryRow(
    table
  ) {
    if (!table) {
      return null;
    }

    const rows =
      Array.from(
        table.querySelectorAll(
          "tbody tr"
        )
      ).filter(isVisible);

    return (
      rows.find(row => {
        return Array.from(
          row.querySelectorAll(
            "td"
          )
        ).some(cell =>
          compactText(
            cell.textContent
          ) === "合计"
        );
      }) ||
      rows[
        rows.length - 1
      ] ||
      null
    );
  }

  function getSummaryCellByHeader(
    table,
    row,
    headerCandidates
  ) {
    if (
      !table ||
      !row
    ) {
      return "";
    }

    const headers =
      getTableHeaderTexts(
        table
      );

    const normalizedCandidates =
      headerCandidates.map(
        compactText
      );

    const index =
      headers.findIndex(header =>
        normalizedCandidates
          .includes(header)
      );

    if (index < 0) {
      return "";
    }

    const cells =
      Array.from(
        row.querySelectorAll(
          "td"
        )
      );

    return cleanCellText(
      cells[index]
        ?.innerText ||
      cells[index]
        ?.textContent ||
      ""
    );
  }

  function queryPhysicalFallback(
    selector
  ) {
    return cleanCellText(
      document.querySelector(
        selector
      )?.innerText ||
      document.querySelector(
        selector
      )?.textContent ||
      ""
    );
  }

  function extractPhysicalExamSummary() {
    const peopleTable =
      findTableByHeaders([
        "人数",
        "已检人数",
        "未检人数"
      ]);

    const amountTable =
      findTableByHeaders([
        "已检总额",
        "挂账金额",
        "自费支付"
      ]) ||
      findTableByHeaders([
        "到检总额",
        "挂账金额",
        "自费金额"
      ]);

    const peopleRow =
      findSummaryRow(
        peopleTable
      );

    const amountRow =
      findSummaryRow(
        amountTable
      );

    const result = {
      totalPeople:
        getSummaryCellByHeader(
          peopleTable,
          peopleRow,
          ["人数"]
        ) ||
        queryPhysicalFallback(
          CONFIG.PHYSICAL_TOTAL_PEOPLE_SELECTOR
        ),

      checkedPeople:
        getSummaryCellByHeader(
          peopleTable,
          peopleRow,
          ["已检人数"]
        ) ||
        queryPhysicalFallback(
          CONFIG.PHYSICAL_CHECKED_PEOPLE_SELECTOR
        ),

      uncheckedPeople:
        getSummaryCellByHeader(
          peopleTable,
          peopleRow,
          ["未检人数"]
        ) ||
        queryPhysicalFallback(
          CONFIG.PHYSICAL_UNCHECKED_PEOPLE_SELECTOR
        ),

      checkedAmount:
        getSummaryCellByHeader(
          amountTable,
          amountRow,
          [
            "已检总额",
            "到检总额"
          ]
        ) ||
        queryPhysicalFallback(
          CONFIG.PHYSICAL_CHECKED_AMOUNT_SELECTOR
        ),

      accountAmount:
        getSummaryCellByHeader(
          amountTable,
          amountRow,
          ["挂账金额"]
        ) ||
        queryPhysicalFallback(
          CONFIG.PHYSICAL_ACCOUNT_AMOUNT_SELECTOR
        ),

      selfPayAmount:
        getSummaryCellByHeader(
          amountTable,
          amountRow,
          [
            "自费支付",
            "自费金额"
          ]
        ) ||
        queryPhysicalFallback(
          CONFIG.PHYSICAL_SELF_PAY_SELECTOR
        )
    };

    const missing = [];

    [
      ["总人数", "totalPeople"],
      ["已检人数", "checkedPeople"],
      ["未检人数", "uncheckedPeople"],
      ["到检总额", "checkedAmount"],
      ["挂账金额", "accountAmount"],
      ["自费金额", "selfPayAmount"]
    ].forEach(
      ([label, key]) => {
        if (!result[key]) {
          missing.push(label);
        }
      }
    );

    if (missing.length) {
      throw new Error(
        "体检名单数据读取不完整：" +
        missing.join("、")
      );
    }

    return result;
  }

  function tryExtractPhysicalExamSummary() {
    try {
      return extractPhysicalExamSummary();
    } catch (_) {
      return null;
    }
  }

  async function ensurePhysicalExamSummaryAvailable(
    token = null
  ) {
    /*
     * 第一优先级：直接读取当前 DOM。
     * 如果用户此前访问过体检名单、真实汇总数据仍保留在隐藏 DOM 中，
     * 则无需切换页签。
     */
    const existing =
      tryExtractPhysicalExamSummary();

    if (existing) {
      return {
        data:
          existing,
        navigated:
          false
      };
    }

    /*
     * 当前页面只有体检名单的空壳 / placeholder 时，
     * 说明真实汇总尚未加载，此时再自动切换到体检名单。
     */
    const tab =
      await waitForReactiveCondition(
        () =>
          findTabByText(
            "体检名单"
          ) ||
          null,
        {
          label:
            "体检名单页签",
          token,
          blockerCheck:
            () =>
              getVisibleErrorFeedback()
        }
      );

    updatePanelStatus(
      "当前页尚未加载体检汇总，正在切换到体检名单读取..."
    );

    tab.click();

    const data =
      await waitForReactiveCondition(
        () =>
          tryExtractPhysicalExamSummary() ||
          null,
        {
          label:
            "体检名单汇总数据",
          token,
          blockerCheck:
            () =>
              getVisibleErrorFeedback()
        }
      );

    return {
      data,
      navigated:
        true
    };
  }

  function renderPhysicalExamSummary(
    data
  ) {
    const grid =
      document.getElementById(
        UI.PHYSICAL_DATA_GRID_ID
      );

    if (!grid) {
      return;
    }

    const items = [
      ["总人数", data.totalPeople],
      ["已检人数", data.checkedPeople],
      ["未检人数", data.uncheckedPeople],
      ["到检总额", data.checkedAmount],
      ["挂账金额", data.accountAmount],
      ["自费金额", data.selfPayAmount]
    ];

    grid.innerHTML =
      items
        .map(
          ([label, value]) => `
            <div style="
              min-width:0;
              padding:6px 4px;
              border:1px solid #f0f0f0;
              border-radius:5px;
              background:#fafafa;
              text-align:center;
              user-select:text;
            ">
              <div style="
                margin-bottom:2px;
                color:#999;
                font-size:10px;
                line-height:1.2;
              ">${label}</div>
              <div style="
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
                color:#262626;
                font-size:13px;
                font-weight:700;
                line-height:1.3;
              " title="${value}">${value}</div>
            </div>
          `
        )
        .join("");

    grid.style.display =
      "grid";
  }

  function getCurrentCardCorpCode() {
    const raw =
      (
        queryText(
          CONFIG.EXTRACT_OPPORTUNITY_CODE_SELECTOR
        ) ||
        getFormItemTextByFor(
          "register_opportunity_id"
        )
      )
        .replace(
          /^'+/,
          ""
        )
        .trim();

    const match =
      raw.match(
        /\d{8,}/
      );

    const current =
      match?.[0] ||
      "";

    const orderCode =
      getCurrentOrderCode();

    if (
      current &&
      orderCode
    ) {
      cardCorpCodeMemory.set(
        orderCode,
        current
      );
    }

    if (current) {
      return current;
    }

    if (
      orderCode &&
      cardCorpCodeMemory.has(
        orderCode
      )
    ) {
      return (
        cardCorpCodeMemory.get(
          orderCode
        ) ||
        ""
      );
    }

    return "";
  }

  function getCardPoolBackendError(
    payload
  ) {
    if (
      !payload ||
      typeof payload !==
        "object"
    ) {
      return "";
    }

    const resultCode =
      cleanText(
        payload.result_code
      ).toUpperCase();

    const errorCode =
      cleanText(
        payload.error_code
      );

    const errorDesc =
      cleanText(
        payload.error_desc
      );

    const message =
      cleanText(
        payload.msg
      );

    if (
      resultCode === "FAIL" ||
      errorCode ||
      errorDesc
    ) {
      return (
        errorDesc ||
        message ||
        errorCode ||
        "接口返回失败"
      );
    }

    return "";
  }

  function extractCardPoolTotalNum(
    payload
  ) {
    const value =
      Number(
        payload?.data?.total_num
      );

    return Number.isFinite(
      value
    )
      ? value
      : null;
  }

  async function fetchCardPoolTotalNum(
    api,
    cardCorpCode
  ) {
    const response =
      await fetch(
        api,
        {
          method:
            "POST",
          headers: {
            "accept":
              "application/json, text/plain, */*",
            "content-type":
              "application/json;charset=UTF-8",
            "mnclientid":
              "MN_SOA3"
          },
          body:
            JSON.stringify({
              region_code:
                "XX",
              page_index:
                1,
              page_size:
                20,
              cardCorpCode
            }),
          credentials:
            "include"
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const payload =
      await response.json();

    const backendError =
      getCardPoolBackendError(
        payload
      );

    if (backendError) {
      throw new Error(
        backendError
      );
    }

    const totalNum =
      extractCardPoolTotalNum(
        payload
      );

    if (
      totalNum === null
    ) {
      console.warn(
        "[SOA流程自动化] 卡池接口未返回 data.total_num：",
        {
          api,
          payload
        }
      );

      throw new Error(
        "接口成功，但未返回 total_num"
      );
    }

    return totalNum;
  }

  async function safeFetchCardPoolTotal(
    api,
    cardCorpCode
  ) {
    try {
      return {
        ok:
          true,
        totalNum:
          await fetchCardPoolTotalNum(
            api,
            cardCorpCode
          )
      };
    } catch (error) {
      return {
        ok:
          false,
        error:
          error?.message ||
          String(error)
      };
    }
  }

  async function fetchBothCardPoolTotals(
    cardCorpCode
  ) {
    const packageCard =
      await safeFetchCardPoolTotal(
        CONFIG.PACKAGE_CARD_POOL_API,
        cardCorpCode
      );

    await sleep(
      150
    );

    const storedValueCard =
      await safeFetchCardPoolTotal(
        CONFIG.STORED_VALUE_CARD_POOL_API,
        cardCorpCode
      );

    return {
      packageCard,
      storedValueCard
    };
  }

  function savePendingCardGroupQuery(
    cardType,
    cardCorpCode
  ) {
    const type =
      cardType ===
      "storage"
        ? "storage"
        : "general";

    const code =
      cleanText(
        cardCorpCode
      );

    if (!code) {
      throw new Error(
        "单位代码为空，无法打开卡池"
      );
    }

    localStorage.setItem(
      CARD_GROUP_PENDING_KEY,
      JSON.stringify({
        cardType:
          type,
        cardCorpCode:
          code,
        createdAt:
          Date.now()
      })
    );
  }

  function readPendingCardGroupQuery() {
    const raw =
      localStorage.getItem(
        CARD_GROUP_PENDING_KEY
      );

    if (!raw) {
      return null;
    }

    try {
      const data =
        JSON.parse(
          raw
        );

      if (
        !data ||
        !data.cardCorpCode ||
        ![
          "general",
          "storage"
        ].includes(
          data.cardType
        )
      ) {
        return null;
      }

      /*
       * 超过 2 分钟的任务视为过期，
       * 防止用户很久之后重新进入卡池页时误自动查询。
       */
      if (
        Number.isFinite(
          Number(
            data.createdAt
          )
        ) &&
        Date.now() -
          Number(
            data.createdAt
          ) >
          120000
      ) {
        localStorage.removeItem(
          CARD_GROUP_PENDING_KEY
        );

        return null;
      }

      return data;
    } catch {
      localStorage.removeItem(
        CARD_GROUP_PENDING_KEY
      );

      return null;
    }
  }

  function clearPendingCardGroupQuery() {
    localStorage.removeItem(
      CARD_GROUP_PENDING_KEY
    );
  }

  function openCardGroupForQuery(
    cardType,
    cardCorpCode
  ) {
    savePendingCardGroupQuery(
      cardType,
      cardCorpCode
    );

    const url =
      `${location.origin}/${CARD_GROUP_ROUTE}`;

    const newTab =
      window.open(
        url,
        "_blank"
      );

    if (!newTab) {
      clearPendingCardGroupQuery();

      throw new Error(
        "浏览器阻止了新标签页，请允许当前网站打开弹出窗口"
      );
    }
  }

  function waitForCardGroupElement(
    finder,
    {
      timeout =
        12000,
      interval =
        100,
      label =
        "页面元素"
    } = {}
  ) {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const start =
          Date.now();

        const check =
          () => {
            let value = null;

            try {
              value =
                typeof finder ===
                  "function"
                  ? finder()
                  : document.querySelector(
                      finder
                    );
            } catch (_) {
              value = null;
            }

            if (value) {
              resolve(
                value
              );
              return;
            }

            if (
              Date.now() -
                start >=
              timeout
            ) {
              reject(
                new Error(
                  `等待${label}超时`
                )
              );

              return;
            }

            setTimeout(
              check,
              interval
            );
          };

        check();
      }
    );
  }

  function isElementVisible(
    element
  ) {
    if (!element) {
      return false;
    }

    const style =
      getComputedStyle(
        element
      );

    if (
      style.display === "none" ||
      style.visibility === "hidden"
    ) {
      return false;
    }

    const rect =
      element.getBoundingClientRect();

    return (
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function isCardGroupTabActive(
    tab
  ) {
    if (!tab) {
      return false;
    }

    return (
      tab.getAttribute(
        "aria-selected"
      ) === "true" ||
      tab.classList.contains(
        "ant-tabs-tab-active"
      ) ||
      tab.parentElement
        ?.classList
        ?.contains(
          "ant-tabs-tab-active"
        )
    );
  }

  function getCardGroupTab(
    cardType
  ) {
    const suffix =
      cardType ===
      "storage"
        ? "storageCard"
        : "generalCard";

    return (
      document.getElementById(
        `rc-tabs-0-tab-${suffix}`
      ) ||
      document.querySelector(
        `[id$="-tab-${suffix}"]`
      )
    );
  }

  function getCardGroupPanel(
    cardType
  ) {
    const suffix =
      cardType ===
      "storage"
        ? "storageCard"
        : "generalCard";

    return (
      document.getElementById(
        `rc-tabs-0-panel-${suffix}`
      ) ||
      document.querySelector(
        `[id$="-panel-${suffix}"]`
      )
    );
  }

  function findCardGroupQueryButton(
    cardType
  ) {
    const suffix =
      cardType ===
      "storage"
        ? "storageCard"
        : "generalCard";

    /*
     * 第一优先级：用户提供的精确 DOM 路径。
     * storageCard 按同样结构自动替换 panel id。
     */
    const exact =
      document.querySelector(
        `#rc-tabs-0-panel-${suffix} > div > div > div > form > div > div:nth-of-type(9) > div > div:nth-of-type(2) > div > div > div > div > div > div > button`
      );

    if (exact) {
      return exact;
    }

    const panel =
      getCardGroupPanel(
        cardType
      );

    if (!panel) {
      return null;
    }

    const buttons =
      Array.from(
        panel.querySelectorAll(
          "form button"
        )
      );

    return (
      buttons.find(
        button =>
          /查询|搜索/.test(
            cleanText(
              button.textContent
            )
          )
      ) ||
      null
    );
  }

  async function processPendingCardGroupQuery() {
    if (
      cardGroupPendingRunning ||
      !location.hash.startsWith(
        CARD_GROUP_ROUTE
      )
    ) {
      return;
    }

    const pending =
      readPendingCardGroupQuery();

    if (!pending) {
      return;
    }

    cardGroupPendingRunning =
      true;

    try {
      const tab =
        await waitForCardGroupElement(
          () =>
            getCardGroupTab(
              pending.cardType
            ),
          {
            timeout:
              15000,
            label:
              pending.cardType ===
                "storage"
                ? "储值卡页签"
                : "套餐卡页签"
          }
        );

      if (
        !isCardGroupTabActive(
          tab
        )
      ) {
        tab.click();
      }

      /*
       * 等待目标页签真正激活。
       * 不能只在 click 后马上继续，否则 Ant Tabs 的内容还未挂载完成。
       */
      await waitForCardGroupElement(
        () =>
          isCardGroupTabActive(
            getCardGroupTab(
              pending.cardType
            )
          )
            ? true
            : null,
        {
          timeout:
            8000,
          label:
            "卡池页签激活"
        }
      );

      /*
       * 再等待目标 panel 可见。
       */
      const panel =
        await waitForCardGroupElement(
          () => {
            const current =
              getCardGroupPanel(
                pending.cardType
              );

            return (
              current &&
              isElementVisible(
                current
              )
            )
              ? current
              : null;
          },
          {
            timeout:
              10000,
            label:
              "卡池查询区域"
          }
        );

      const input =
        await waitForCardGroupElement(
          () => {
            const scoped =
              panel.querySelector(
                "#cardCorpCode, input[id='cardCorpCode']"
              );

            const fallback =
              document.querySelector(
                "#cardCorpCode"
              );

            const candidate =
              scoped ||
              fallback;

            return (
              candidate &&
              !candidate.disabled &&
              isElementVisible(
                candidate
              )
            )
              ? candidate
              : null;
          },
          {
            timeout:
              10000,
            label:
              "单位代码输入框"
          }
        );

      input.focus();

      setNativeInputValue(
        input,
        pending.cardCorpCode
      );

      /*
       * 补齐框架常见受控输入事件，
       * 确保 React/Ant Design 的表单状态同步。
       */
      input.dispatchEvent(
        new Event(
          "input",
          {
            bubbles:
              true
          }
        )
      );

      input.dispatchEvent(
        new Event(
          "change",
          {
            bubbles:
              true
          }
        )
      );

      /*
       * 等待页面确认输入值已经写入。
       */
      await waitForCardGroupElement(
        () =>
          cleanText(
            input.value
          ) ===
          pending.cardCorpCode
            ? true
            : null,
        {
          timeout:
            5000,
          interval:
            80,
          label:
            "单位代码写入"
        }
      );

      input.blur();

      /*
       * 给 Ant Form 留出状态提交时间。
       * v1.30 的问题主要就是此处操作过快。
       */
      await sleep(
        650
      );

      let queryButton =
        findCardGroupQueryButton(
          pending.cardType
        );

      if (
        !queryButton ||
        queryButton.disabled ||
        !isElementVisible(
          queryButton
        )
      ) {
        queryButton =
          await waitForCardGroupElement(
            () => {
              const button =
                findCardGroupQueryButton(
                  pending.cardType
                );

              return (
                button &&
                !button.disabled &&
                isElementVisible(
                  button
                )
              )
                ? button
                : null;
            },
            {
              timeout:
                8000,
              interval:
                120,
              label:
                "卡池查询按钮"
            }
          );
      }

      /*
       * 优先真实点击查询按钮。
       */
      queryButton.focus();

      await sleep(
        180
      );

      queryButton.click();

      /*
       * 点击后不立即清任务，稍等一下，
       * 避免页面状态尚未接收点击。
       */
      await sleep(
        500
      );

      clearPendingCardGroupQuery();

      console.log(
        "[SOA流程自动化] 已打开新标签页并查询卡池：",
        {
          cardType:
            pending.cardType,
          cardCorpCode:
            pending.cardCorpCode
        }
      );
    } catch (error) {
      console.warn(
        "[SOA流程自动化] 卡池自动查询失败：",
        error
      );

      /*
       * 失败时保留任务一小段时间，便于路由重新触发时再试；
       * 任务本身仍有2分钟过期保护。
       */
      throw error;
    } finally {
      cardGroupPendingRunning =
        false;
    }
  }

  function renderCardPoolSummary(
    data,
    cardCorpCode
  ) {
    const grid =
      document.getElementById(
        UI.CARD_POOL_DATA_GRID_ID
      );

    if (!grid) {
      return;
    }

    const items = [
      [
        "套餐卡",
        data.packageCard
      ],
      [
        "储值卡",
        data.storedValueCard
      ]
    ];

    grid.innerHTML =
      items
        .map(
          ([label, result]) => {
            const success =
              Boolean(
                result?.ok
              );

            const numericValue =
              success
                ? Number(
                    result.totalNum
                  )
                : null;

            const clickable =
              success &&
              Number.isFinite(
                numericValue
              ) &&
              numericValue > 0;

            const value =
              success
                ? result.totalNum
                : (
                    result?.error ||
                    "查询失败"
                  );

            const safeValue =
              cleanCellText(
                value
              )
                .replace(
                  /&/g,
                  "&amp;"
                )
                .replace(
                  /</g,
                  "&lt;"
                )
                .replace(
                  />/g,
                  "&gt;"
                )
                .replace(
                  /"/g,
                  "&quot;"
                );

            const cardType =
              label ===
              "储值卡"
                ? "storage"
                : "general";

            const clickAttrs =
              clickable
                ? `data-soa-card-type="${cardType}" data-soa-card-code="${cardCorpCode}"`
                : "";

            return `
              <div style="
                min-width:0;
                padding:8px 6px;
                border:1px solid ${
                  success
                    ? "#d9f7be"
                    : "#ffccc7"
                };
                border-radius:5px;
                background:${
                  success
                    ? "#f6ffed"
                    : "#fff2f0"
                };
                text-align:center;
              ">
                <div style="
                  margin-bottom:3px;
                  color:#999;
                  font-size:10px;
                  line-height:1.2;
                ">${label}</div>

                <div
                  ${clickAttrs}
                  style="
                    overflow:hidden;
                    text-overflow:ellipsis;
                    white-space:nowrap;
                    color:${
                      !success
                        ? "#cf1322"
                        : clickable
                          ? "#389e0d"
                          : "#222"
                    };
                    font-size:${
                      success
                        ? "16px"
                        : "10px"
                    };
                    font-weight:700;
                    line-height:1.35;
                    cursor:${
                      clickable
                        ? "pointer"
                        : "default"
                    };
                    text-decoration:${
                      clickable
                        ? "underline"
                        : "none"
                    };
                    text-underline-offset:2px;
                  "
                  title="${
                    clickable
                      ? `点击新建标签页打开${label}卡池并查询单位代码 ${cardCorpCode}`
                      : safeValue
                  }"
                >${safeValue}</div>
              </div>
            `;
          }
        )
        .join("");

    grid.style.display =
      "grid";

    grid.title =
      `cardCorpCode：${cardCorpCode}`;

    grid
      .querySelectorAll(
        "[data-soa-card-type][data-soa-card-code]"
      )
      .forEach(
        element => {
          element.addEventListener(
            "click",
            () => {
              const cardType =
                element.getAttribute(
                  "data-soa-card-type"
                );

              const code =
                element.getAttribute(
                  "data-soa-card-code"
                );

              try {
                openCardGroupForQuery(
                  cardType,
                  code
                );
              } catch (error) {
                updatePanelStatus(
                  error?.message ||
                  String(error),
                  "error"
                );
              }
            }
          );
        }
      );
  }

  function getCurrentFlowStage() {
    const active =
      document.querySelector(
        ".ant-steps-item-process .ant-steps-item-title, " +
        ".ant-steps-item-active .ant-steps-item-title"
      );

    return cleanText(
      active?.textContent
    );
  }


  function getFlowStepTitles() {
    return Array.from(
      document.querySelectorAll(
        ".ant-steps-item-title"
      )
    )
      .map(element =>
        cleanText(
          element.textContent
        )
      )
      .filter(Boolean);
  }

  function isStageBeforeInternalReview(
    stage
  ) {
    if (!stage) {
      return false;
    }

    const titles =
      getFlowStepTitles();

    const currentIndex =
      titles.indexOf(stage);

    const reviewIndex =
      titles.indexOf(
        "内勤复核"
      );

    if (
      currentIndex >= 0 &&
      reviewIndex >= 0
    ) {
      return (
        currentIndex <
        reviewIndex
      );
    }

    /*
     * DOM 顺序无法判断时使用已知早期阶段兜底。
     * “制单”用于兼容部分订单页面对报价单设计阶段的不同命名。
     */
    return [
      "制单",
      "报价单设计",
      "授权审批",
      "报价确认"
    ].includes(stage);
  }

  function isSupportedAutoProcessStage(
    stage
  ) {
    return [
      "内勤复核",
      "合同补充",
      "落单审核",
      "落单中",
      "已落单"
    ].includes(stage);
  }

  function getAutomationStageIssue(
    stage
  ) {
    if (!stage) {
      return "阶段异常：暂未识别当前流程阶段";
    }

    if (
      isStageBeforeInternalReview(
        stage
      )
    ) {
      return `阶段异常：当前“${stage}”尚未进入内勤复核`;
    }

    if (
      !isSupportedAutoProcessStage(
        stage
      )
    ) {
      return `阶段异常：当前“${stage}”暂未配置自动处理动作`;
    }

    return "";
  }

  function updateFlowRunButtonState(
    stage =
      getCurrentFlowStage()
  ) {
    const button =
      document.getElementById(
        UI.FLOW_RUN_BUTTON_ID
      );

    if (!button) {
      return;
    }

    if (processRunning) {
      if (
        activeFlowToken &&
        activeFlowToken.cancelled
      ) {
        button.disabled =
          true;

        button.textContent =
          "停止中...";

        button.style.background =
          "#ff7875";

        button.style.color =
          "#fff";

        button.style.cursor =
          "wait";

        return;
      }

      button.disabled =
        false;

      button.textContent =
        "点击停止";

      button.style.background =
        "#ff4d4f";

      button.style.color =
        "#fff";

      button.style.cursor =
        "pointer";

      return;
    }

    if (
      stage ===
      "已落单"
    ) {
      button.disabled =
        true;

      button.textContent =
        "订单已完成";

      button.style.background =
        "#52c41a";

      button.style.color =
        "#fff";

      button.style.cursor =
        "default";

      button.title =
        "当前订单流程已完成；如需查看数据，请使用下方落单数据或体检数据。";

      return;
    }

    const issue =
      getAutomationStageIssue(
        stage
      );

    if (issue) {
      button.disabled =
        true;

      button.textContent =
        "阶段异常：暂不可处理";

      button.style.background =
        "#ff4d4f";

      button.style.color =
        "#fff";

      button.style.cursor =
        "not-allowed";

      button.title =
        issue;

      return;
    }

    button.disabled =
      false;

    button.textContent =
      "立即处理订单";

    button.style.background =
      "#1677ff";

    button.style.color =
      "#fff";

    button.style.cursor =
      "pointer";

    button.title =
      "点击开始处理当前订单";
  }

  function getFlowStagePresentation(
    stage
  ) {
    const presentations = {
      "报价单设计": {
        color: "#595959",
        size: "13px",
        weight: "600",
        hint:
          "当前处于报价单设计阶段，暂不执行自动审批。"
      },

      "授权审批": {
        color: "#1677ff",
        size: "14px",
        weight: "600",
        hint:
          "当前处于授权审批阶段，等待流程进入报价确认。"
      },

      "报价确认": {
        color: "#08979c",
        size: "14px",
        weight: "700",
        hint:
          "当前处于报价确认阶段，等待流程进入内勤复核。"
      },

      "内勤复核": {
        color: "#d46b08",
        size: "15px",
        weight: "700",
        hint:
          "点击“立即处理订单”可自动填写内勤复核备注并继续流程。"
      },

      "合同补充": {
        color: "#722ed1",
        size: "15px",
        weight: "700",
        hint:
          "点击“立即处理订单”可自动完成合同补充、上传文件并发起落单。"
      },

      "落单审核": {
        color: "#cf1322",
        size: "15px",
        weight: "700",
        hint:
          "点击“立即处理订单”可自动填写落单审核备注并确认落单。"
      },

      "落单中": {
        color: "#d48806",
        size: "15px",
        weight: "700",
        hint:
          "订单正在落单，等待页面进入“已落单”状态。"
      },

      "已落单": {
        color: "#389e0d",
        size: "16px",
        weight: "700",
        hint:
          "流程已完成，下方数据工具可按需使用。"
      }
    };

    return (
      presentations[stage] ||
      {
        color: "#595959",
        size: "14px",
        weight: "600",
        hint:
          stage
            ? "当前阶段尚未配置专用提示，请以页面流程进度为准。"
            : "正在读取页面流程状态..."
      }
    );
  }

  function updateFlowStageDisplay(
    {
      refreshOnLanding =
        false
    } = {}
  ) {
    const labelElement =
      document.getElementById(
        UI.FLOW_STAGE_LABEL_ID
      );

    const valueElement =
      document.getElementById(
        UI.FLOW_STAGE_VALUE_ID
      );

    const hintElement =
      document.getElementById(
        UI.FLOW_STAGE_HINT_ID
      );

    if (
      !labelElement ||
      !valueElement ||
      !hintElement
    ) {
      return "";
    }

    const stage =
      getCurrentFlowStage();

    const presentation =
      getFlowStagePresentation(
        stage
      );

    const stageIssue =
      getAutomationStageIssue(
        stage
      );

    labelElement.textContent =
      "当前阶段：";

    valueElement.textContent =
      stage || "识别中";

    valueElement.style.color =
      stageIssue
        ? "#cf1322"
        : presentation.color;

    valueElement.style.fontSize =
      stageIssue
        ? "14px"
        : presentation.size;

    valueElement.style.fontWeight =
      stageIssue
        ? "700"
        : presentation.weight;

    hintElement.textContent =
      stageIssue ||
      presentation.hint;

    hintElement.style.color =
      stageIssue
        ? "#cf1322"
        : "#999";

    hintElement.style.fontWeight =
      stageIssue
        ? "600"
        : "400";

    if (
      stage !== "已落单"
    ) {
      cachedLandingTimeOptions = [];

      const extractContainer =
        document.getElementById(
          UI.EXTRACT_OPTIONS_ID
        );

      if (extractContainer) {
        extractContainer.innerHTML =
          "";

        extractContainer.style.display =
          "none";
      }
    }

    const changed =
      stage !==
      lastDisplayedFlowStage;

    lastDisplayedFlowStage =
      stage;

    if (changed) {
      closeDataPanel();
    }

    updateDataActionButtons(
      stage
    );

    updateFlowRunButtonState(
      stage
    );

    /*
     * 落单数据改为按需读取：
     * 只有用户点击“落单数据”后才请求 processlogs。
     *
     * 日期检测只在“实际阶段发生变化”时触发；
     * 另外还会在页面初始化、打开面板和执行订单时主动刷新。
     */
    if (changed) {
      refreshExamDateInfo(
        stage
      );
    }

    return stage;
  }


  function setDataButtonActive(
    mode
  ) {
    const landing =
      document.getElementById(
        UI.LANDING_DATA_BUTTON_ID
      );

    const physical =
      document.getElementById(
        UI.PHYSICAL_DATA_BUTTON_ID
      );

    [
      [landing, "landing"],
      [physical, "physical"]
    ].forEach(
      ([button, buttonMode]) => {
        if (!button) {
          return;
        }

        const active =
          mode === buttonMode;

        button.style.background =
          active
            ? "#e6f4ff"
            : "#fff";

        button.style.borderColor =
          active
            ? "#1677ff"
            : "#d9d9d9";

        button.style.color =
          active
            ? "#1677ff"
            : "#555";
      }
    );
  }

  function resetDataPanelContent() {
    const landingOptions =
      document.getElementById(
        UI.EXTRACT_OPTIONS_ID
      );

    const physicalGrid =
      document.getElementById(
        UI.PHYSICAL_DATA_GRID_ID
      );

    const cardPoolGrid =
      document.getElementById(
        UI.CARD_POOL_DATA_GRID_ID
      );

    const preview =
      document.getElementById(
        UI.EXTRACT_PREVIEW_ID
      );

    if (landingOptions) {
      landingOptions.innerHTML =
        "";

      landingOptions.style.display =
        "none";
    }

    if (physicalGrid) {
      physicalGrid.innerHTML =
        "";

      physicalGrid.style.display =
        "none";
    }

    if (cardPoolGrid) {
      cardPoolGrid.innerHTML =
        "";

      cardPoolGrid.style.display =
        "none";

      cardPoolGrid.title =
        "";
    }

    if (preview) {
      preview.style.display =
        "none";

      preview.textContent =
        "";
    }
  }

  function closeDataPanel() {
    const panel =
      document.getElementById(
        UI.DATA_PANEL_ID
      );

    if (panel) {
      panel.style.display =
        "none";
    }

    activeDataPanelMode =
      "";

    setDataButtonActive(
      ""
    );

    resetDataPanelContent();
  }

  function openDataPanelShell(
    mode,
    title
  ) {
    const panel =
      document.getElementById(
        UI.DATA_PANEL_ID
      );

    const titleElement =
      document.getElementById(
        UI.DATA_PANEL_TITLE_ID
      );

    if (
      !panel ||
      !titleElement
    ) {
      return false;
    }

    resetDataPanelContent();

    activeDataPanelMode =
      mode;

    titleElement.textContent =
      title;

    panel.style.display =
      "block";

    setDataButtonActive(
      mode
    );

    return true;
  }

  function syncDataOrderContext() {
    const orderCode =
      getCurrentOrderCode();

    if (!orderCode) {
      return;
    }

    if (
      lastDataPanelOrderCode &&
      lastDataPanelOrderCode !==
        orderCode
    ) {
      cachedLandingTimeOptions = [];

      cardPoolQueryCache = {
        orderCode: "",
        cardCorpCode: "",
        timestamp: 0,
        data: null
      };

      closeDataPanel();
    }

    lastDataPanelOrderCode =
      orderCode;
  }

  async function toggleLandingDataPanel() {
    syncDataOrderContext();

    if (
      activeDataPanelMode ===
      "landing"
    ) {
      closeDataPanel();
      return;
    }

    if (
      getCurrentFlowStage() !==
      "已落单"
    ) {
      updatePanelStatus(
        "当前订单尚未进入“已落单”，暂无落单数据。",
        "error"
      );

      return;
    }

    if (
      !openDataPanelShell(
        "landing",
        "落单数据"
      )
    ) {
      return;
    }

    const title =
      document.getElementById(
        UI.DATA_PANEL_TITLE_ID
      );

    if (title) {
      title.textContent =
        "落单数据 · 读取中...";
    }

    try {
      const options =
        await refreshLandingTimeOptions();

      if (title) {
        title.textContent =
          options.length
            ? "落单数据 · 点击复制"
            : "落单数据 · 未识别到记录";
      }
    } catch (error) {
      if (title) {
        title.textContent =
          "落单数据 · 读取失败";
      }

      throw error;
    }
  }

  async function togglePhysicalDataPanel() {
    syncDataOrderContext();

    if (
      activeDataPanelMode ===
      "physical"
    ) {
      if (
        physicalDataQueryRunning
      ) {
        updatePanelStatus(
          "数据正在查询中，请稍候..."
        );

        return;
      }

      closeDataPanel();
      return;
    }

    if (
      physicalDataQueryRunning
    ) {
      updatePanelStatus(
        "数据正在查询中，请稍候..."
      );

      return;
    }

    if (
      !openDataPanelShell(
        "physical",
        "体检数据 · 读取中..."
      )
    ) {
      return;
    }

    physicalDataQueryRunning =
      true;

    const button =
      document.getElementById(
        UI.PHYSICAL_DATA_BUTTON_ID
      );

    if (button) {
      button.disabled =
        true;

      button.textContent =
        "读取中...";
    }

    try {
      /*
       * 当前 DOM 有完整汇总则直接读取；
       * 没有真实数据时才自动切换到体检名单。
       */
      const physicalResult =
        await ensurePhysicalExamSummaryAvailable();

      const physical =
        physicalResult.data;

      renderPhysicalExamSummary(
        physical
      );

      const orderCode =
        getCurrentOrderCode();

      const cardCorpCode =
        getCurrentCardCorpCode();

      let cardPool =
        null;

      if (!cardCorpCode) {
        renderCardPoolCodeUnavailable();
      } else {
        cardPool =
          getCachedCardPoolData(
            orderCode,
            cardCorpCode
          );

        if (!cardPool) {
          const grid =
            document.getElementById(
              UI.CARD_POOL_DATA_GRID_ID
            );

          if (grid) {
            grid.innerHTML = `
              <div style="
                grid-column:1 / -1;
                padding:8px;
                border:1px solid #e5e7eb;
                border-radius:5px;
                background:#fafafa;
                color:#999;
                font-size:11px;
                text-align:center;
              ">
                正在查询套餐卡、储值卡...
              </div>
            `;

            grid.style.display =
              "grid";
          }

          cardPool =
            await fetchBothCardPoolTotals(
              cardCorpCode
            );

          saveCachedCardPoolData(
            orderCode,
            cardCorpCode,
            cardPool
          );
        }

        renderCardPoolSummary(
          cardPool,
          cardCorpCode
        );
      }

      const title =
        document.getElementById(
          UI.DATA_PANEL_TITLE_ID
        );

      if (title) {
        title.textContent =
          "体检数据 · 汇总";
      }

      const cardSuccessCount =
        cardPool
          ? [
              cardPool.packageCard,
              cardPool.storedValueCard
            ].filter(
              item =>
                item?.ok
            ).length
          : 0;

      if (
        physical &&
        cardSuccessCount === 2
      ) {
        updatePanelStatus(
          physicalResult.navigated
            ? "✓ 已切换体检名单并读取体检汇总及卡池数量。"
            : "✓ 已直接读取当前页体检汇总及卡池数量。",
          "success"
        );
      } else if (
        physical ||
        cardSuccessCount > 0
      ) {
        updatePanelStatus(
          "数据已部分读取，请查看结果。"
        );
      } else {
        updatePanelStatus(
          "未读取到可用数据。",
          "error"
        );
      }
    } finally {
      physicalDataQueryRunning =
        false;

      if (button) {
        button.disabled =
          false;

        button.textContent =
          "体检数据";
      }
    }
  }

  function getCachedCardPoolData(
    orderCode,
    cardCorpCode
  ) {
    if (
      !orderCode ||
      !cardCorpCode ||
      cardPoolQueryCache.orderCode !==
        orderCode ||
      cardPoolQueryCache.cardCorpCode !==
        cardCorpCode ||
      !cardPoolQueryCache.data
    ) {
      return null;
    }

    if (
      Date.now() -
        cardPoolQueryCache.timestamp >
      CARD_POOL_CACHE_MS
    ) {
      return null;
    }

    return cardPoolQueryCache.data;
  }

  function saveCachedCardPoolData(
    orderCode,
    cardCorpCode,
    data
  ) {
    cardPoolQueryCache = {
      orderCode,
      cardCorpCode,
      timestamp:
        Date.now(),
      data:
        data || null
    };
  }

  function renderCardPoolCodeUnavailable() {
    const grid =
      document.getElementById(
        UI.CARD_POOL_DATA_GRID_ID
      );

    if (!grid) {
      return;
    }

    grid.innerHTML = `
      <div style="
        grid-column:1 / -1;
        padding:8px;
        border:1px solid #ffccc7;
        border-radius:5px;
        background:#fff2f0;
        color:#cf1322;
        font-size:11px;
        line-height:1.45;
        text-align:center;
      ">
        当前页面未读取到商机代码，暂无法查询套餐卡、储值卡。
      </div>
    `;

    grid.style.display =
      "grid";
  }

  function updateDataActionButtons(
    stage =
      getCurrentFlowStage()
  ) {
    const landing =
      document.getElementById(
        UI.LANDING_DATA_BUTTON_ID
      );

    if (landing) {
      const enabled =
        stage ===
        "已落单";

      landing.disabled =
        !enabled;

      landing.style.opacity =
        enabled
          ? "1"
          : "0.45";

      landing.style.cursor =
        enabled
          ? "pointer"
          : "not-allowed";

      landing.title =
        enabled
          ? "点击读取当前订单落单数据"
          : "订单进入已落单后可使用";
    }
  }


  function ensureDefaultSettings() {
    const review =
      cleanText(
        getStoredText(
          UI.REVIEW_REMARK_KEY
        )
      );

    const order =
      cleanText(
        getStoredText(
          UI.ORDER_REMARK_KEY
        )
      );

    if (!review) {
      saveStoredText(
        UI.REVIEW_REMARK_KEY,
        DEFAULTS.REVIEW_REMARK
      );
    }

    if (!order) {
      saveStoredText(
        UI.ORDER_REMARK_KEY,
        DEFAULTS.ORDER_REMARK
      );
    }

    const mode =
      getStoredText(
        UI.SIGNING_MODE_KEY,
        DEFAULTS.SIGNING_COMPANY_MODE
      );

    if (
      mode !== "first" &&
      mode !== "text"
    ) {
      saveStoredText(
        UI.SIGNING_MODE_KEY,
        DEFAULTS.SIGNING_COMPANY_MODE
      );
    }
  }

  function restoreDefaultRemarks() {
    saveStoredText(
      UI.REVIEW_REMARK_KEY,
      DEFAULTS.REVIEW_REMARK
    );

    saveStoredText(
      UI.ORDER_REMARK_KEY,
      DEFAULTS.ORDER_REMARK
    );

    const reviewInput =
      document.getElementById(
        UI.REVIEW_REMARK_ID
      );

    const orderInput =
      document.getElementById(
        UI.ORDER_REMARK_ID
      );

    if (reviewInput) {
      reviewInput.value =
        DEFAULTS.REVIEW_REMARK;
    }

    if (orderInput) {
      orderInput.value =
        DEFAULTS.ORDER_REMARK;
    }

    updateRemarkStatus();

    updatePanelStatus(
      "✓ 已恢复默认审批备注。",
      "success"
    );
  }

  function getSigningCompanyConfig() {
    const storedMode =
      getStoredText(
        UI.SIGNING_MODE_KEY,
        DEFAULTS.SIGNING_COMPANY_MODE
      );

    const mode =
      storedMode === "text"
        ? "text"
        : "first";

    const text =
      cleanText(
        getStoredText(
          UI.SIGNING_TEXT_KEY,
          DEFAULTS.SIGNING_COMPANY_TEXT
        )
      );

    return {
      mode,
      text
    };
  }

  function saveSigningCompanyConfig(
    mode,
    text = ""
  ) {
    const normalizedMode =
      mode === "text"
        ? "text"
        : "first";

    saveStoredText(
      UI.SIGNING_MODE_KEY,
      normalizedMode
    );

    saveStoredText(
      UI.SIGNING_TEXT_KEY,
      cleanText(text)
    );

    updateSigningCompanyUi();
  }

  function updateSigningCompanyUi() {
    const button =
      document.getElementById(
        UI.SIGNING_BUTTON_ID
      );

    const firstRadio =
      document.getElementById(
        UI.SIGNING_FIRST_ID
      );

    const textRadio =
      document.getElementById(
        UI.SIGNING_TEXT_MODE_ID
      );

    const textInput =
      document.getElementById(
        UI.SIGNING_TEXT_ID
      );

    const config =
      getSigningCompanyConfig();

    if (button) {
      button.textContent =
        "签单主体";

      if (
        config.mode === "first"
      ) {
        button.style.color =
          "#389e0d";

        button.style.borderColor =
          "#b7eb8f";

        button.style.background =
          "#f6ffed";

        button.title =
          "当前：按下拉顺序选择第一个可用选项";
      } else if (
        config.text
      ) {
        button.style.color =
          "#389e0d";

        button.style.borderColor =
          "#b7eb8f";

        button.style.background =
          "#f6ffed";

        button.title =
          `当前：按名称精确匹配“${config.text}”`;
      } else {
        button.style.color =
          "#cf1322";

        button.style.borderColor =
          "#ffccc7";

        button.style.background =
          "#fff2f0";

        button.title =
          "已选择按名称匹配，但尚未填写签单主体名称";
      }
    }

    if (firstRadio) {
      firstRadio.checked =
        config.mode === "first";
    }

    if (textRadio) {
      textRadio.checked =
        config.mode === "text";
    }

    if (textInput) {
      textInput.value =
        config.text;

      textInput.disabled =
        config.mode !== "text";

      textInput.style.opacity =
        config.mode === "text"
          ? "1"
          : "0.55";
    }
  }

  function toggleSigningPanel() {
    const panel =
      document.getElementById(
        UI.SIGNING_PANEL_ID
      );

    if (!panel) {
      return;
    }

    const opening =
      panel.style.display ===
      "none";

    panel.style.display =
      opening
        ? "block"
        : "none";

    if (opening) {
      const remarkPanel =
        document.getElementById(
          UI.REMARK_PANEL_ID
        );

      if (remarkPanel) {
        remarkPanel.style.display =
          "none";
      }

      updateSigningCompanyUi();
    }
  }

  function getStoredText(
    key,
    fallback = ""
  ) {
    try {
      return (
        localStorage.getItem(
          key
        ) ?? fallback
      );
    } catch (_) {
      return fallback;
    }
  }

  function saveStoredText(
    key,
    value
  ) {
    try {
      localStorage.setItem(
        key,
        String(value || "")
      );
    } catch (_) {
      // 保存失败不影响当前执行。
    }
  }

  function getReviewRemark() {
    return cleanText(
      document.getElementById(
        UI.REVIEW_REMARK_ID
      )?.value ||
      getStoredText(
        UI.REVIEW_REMARK_KEY,
        DEFAULTS.REVIEW_REMARK
      )
    );
  }

  function getOrderRemark() {
    return cleanText(
      document.getElementById(
        UI.ORDER_REMARK_ID
      )?.value ||
      getStoredText(
        UI.ORDER_REMARK_KEY,
        DEFAULTS.ORDER_REMARK
      )
    );
  }

  function updateRemarkStatus() {
    const button =
      document.getElementById(
        UI.REMARK_BUTTON_ID
      );

    if (!button) {
      return;
    }

    const review =
      getReviewRemark();

    const order =
      getOrderRemark();

    if (
      !review ||
      !order
    ) {
      button.textContent =
        "备注待设置";

      button.style.color =
        "#cf1322";

      button.style.borderColor =
        "#ffccc7";

      button.style.background =
        "#fff2f0";

      button.title =
        "审批备注不完整，点击设置";

      return;
    }

    const usingDefault =
      review ===
        DEFAULTS.REVIEW_REMARK &&
      order ===
        DEFAULTS.ORDER_REMARK;

    button.textContent =
      usingDefault
        ? "默认备注"
        : "自定义备注";

    button.style.color =
      "#389e0d";

    button.style.borderColor =
      "#b7eb8f";

    button.style.background =
      "#f6ffed";

    button.title =
      usingDefault
        ? "当前使用脚本默认备注，点击可修改"
        : "当前使用自定义备注，点击可修改或恢复默认";
  }

  function toggleHelpPanel() {
    const panel =
      document.getElementById(
        UI.HELP_PANEL_ID
      );

    const button =
      document.getElementById(
        UI.HELP_BUTTON_ID
      );

    if (
      !panel ||
      !button
    ) {
      return;
    }

    const opening =
      panel.style.display ===
      "none";

    panel.style.display =
      opening
        ? "block"
        : "none";

    button.textContent =
      opening
        ? "收起说明"
        : "查看说明";
  }

  function toggleRemarkPanel() {
    const panel =
      document.getElementById(
        UI.REMARK_PANEL_ID
      );

    const button =
      document.getElementById(
        UI.REMARK_BUTTON_ID
      );

    if (
      !panel ||
      !button
    ) {
      return;
    }

    const opening =
      panel.style.display ===
      "none";

    panel.style.display =
      opening
        ? "block"
        : "none";

    if (opening) {
      const signingPanel =
        document.getElementById(
          UI.SIGNING_PANEL_ID
        );

      if (signingPanel) {
        signingPanel.style.display =
          "none";
      }
    }

    button.setAttribute(
      "aria-expanded",
      opening
        ? "true"
        : "false"
    );

    updateRemarkStatus();
  }

  function getVisibleApprovalModal() {
    const modals =
      Array.from(
        document.querySelectorAll(
          ".ant-modal"
        )
      ).filter(isVisible);

    return (
      modals.find(modal => {
        const title =
          compactText(
            modal.querySelector(
              ".ant-modal-title"
            )?.textContent
          );

        const remark =
          modal.querySelector(
            "#remark"
          );

        return (
          remark &&
          (
            title.includes(
              "审批"
            ) ||
            title.includes(
              "审核"
            )
          )
        );
      }) ||
      null
    );
  }

  function findModalConfirmButton(
    modal
  ) {
    if (!modal) {
      return null;
    }

    return (
      Array.from(
        modal.querySelectorAll(
          ".ant-modal-footer button"
        )
      ).find(button => {
        return (
          isVisible(button) &&
          compactText(
            button.textContent
          ) === "确认"
        );
      }) ||
      null
    );
  }

  function findBottomPrimaryAction() {
    const bottom =
      document.querySelector(
        ".bottom .actions"
      );

    if (!bottom) {
      return null;
    }

    const buttons =
      Array.from(
        bottom.querySelectorAll(
          "button"
        )
      ).filter(button => {
        return (
          isVisible(button) &&
          !button.disabled &&
          button.classList.contains(
            "ant-btn-primary"
          )
        );
      });

    return buttons[0] || null;
  }

  async function waitForStageChange(
    oldStage,
    token = null
  ) {
    return await waitForReactiveCondition(
      () => {
        const stage =
          getCurrentFlowStage();

        if (
          stage &&
          stage !== oldStage
        ) {
          return stage;
        }

        return null;
      },
      {
        label:
          `流程从“${oldStage}”进入下一阶段`,
        token,
        blockerCheck:
          () =>
            getVisibleErrorFeedback()
      }
    );
  }

  async function fillAndConfirmApproval(
    stage,
    remarkText,
    preferredActionText = "",
    token = null
  ) {
    if (!remarkText) {
      throw new Error(
        `“${stage}”备注尚未维护，请先在工具面板填写`
      );
    }

    let modal =
      getVisibleApprovalModal();

    if (!modal) {
      const action =
        await waitForReactiveCondition(
          () => {
            const found =
              (
                preferredActionText
                  ? findBottomActionByText(
                      preferredActionText
                    )
                  : null
              ) ||
              findBottomPrimaryAction();

            return (
              found ||
              null
            );
          },
          {
            label:
              `“${stage}”主操作按钮`,
            token,
            blockerCheck:
              () =>
                getVisibleErrorFeedback()
          }
        );

      log(
        `“${stage}”：点击“${cleanText(action.textContent)}”，等待审批弹窗准备完成...`
      );

      action.click();

      const outcome =
        await waitForReactiveCondition(
          () => {
            const currentModal =
              getVisibleApprovalModal();

            if (currentModal) {
              return {
                type:
                  "modal",
                modal:
                  currentModal
              };
            }

            const currentStage =
              getCurrentFlowStage();

            if (
              currentStage &&
              currentStage !== stage
            ) {
              return {
                type:
                  "stage",
                stage:
                  currentStage
              };
            }

            return null;
          },
          {
            label:
              `“${stage}”审批弹窗`,
            token,
            blockerCheck:
              () =>
                getVisibleErrorFeedback()
          }
        );

      if (
        outcome.type ===
        "stage"
      ) {
        log(
          `“${stage}”已直接推进到“${outcome.stage}”。`
        );
        return outcome.stage;
      }

      modal =
        outcome.modal;
    }

    const controls =
      await waitForReactiveCondition(
        () => {
          if (
            !modal ||
            !modal.isConnected ||
            !isVisible(modal)
          ) {
            return null;
          }

          const remark =
            modal.querySelector(
              "#remark"
            );

          const confirm =
            findModalConfirmButton(
              modal
            );

          if (
            remark &&
            !remark.disabled &&
            !remark.readOnly &&
            confirm &&
            !confirm.disabled &&
            !confirm.classList.contains(
              "ant-btn-loading"
            )
          ) {
            return {
              remark,
              confirm
            };
          }

          return null;
        },
        {
          label:
            `“${stage}”审批表单可填写`,
          token,
          blockerCheck:
            () =>
              getVisibleErrorFeedback()
        }
      );

    const stable =
      await waitForStableControlledValue(
        controls.remark,
        remarkText,
        token
      );

    if (!stable) {
      throw new Error(
        `“${stage}”备注写入后被页面回退，已停止自动确认`
      );
    }

    /*
     * 再次确认按钮仍然有效，避免输入过程中弹窗状态变化。
     */
    const confirm =
      await waitForReactiveCondition(
        () => {
          const button =
            findModalConfirmButton(
              modal
            );

          if (
            button &&
            !button.disabled &&
            !button.classList.contains(
              "ant-btn-loading"
            ) &&
            String(
              controls.remark.value
            ) === String(
              remarkText
            )
          ) {
            return button;
          }

          return null;
        },
        {
          label:
            `“${stage}”确认按钮可提交`,
          token,
          blockerCheck:
            () =>
              getVisibleErrorFeedback()
        }
      );

    log(
      `“${stage}”：备注已稳定写入，点击确认并等待流程实际推进...`
    );

    confirm.click();

    /*
     * 不以“弹窗关闭”作为完成标准。
     * 真正完成标准是顶部流程阶段发生变化。
     */
    const nextStage =
      await waitForStageChange(
        stage,
        token
      );

    log(
      `✓ “${stage}”已进入“${nextStage}”`
    );

    return nextStage;
  }

  async function submitContractStage(
    token = null
  ) {
    const stage =
      getCurrentFlowStage();

    if (
      stage !==
      "合同补充"
    ) {
      throw new Error(
        `当前阶段为“${stage || "未知"}”，不是合同补充`
      );
    }

    let popconfirm =
      getVisibleLandingPopconfirm();

    if (!popconfirm) {
      const action =
        await waitForReactiveCondition(
          () =>
            findBottomActionByText(
              "发起落单"
            ) ||
            findBottomPrimaryAction() ||
            null,
          {
            label:
              "合同补充阶段“发起落单”按钮",
            token,
            blockerCheck:
              () =>
                getVisibleErrorFeedback()
          }
        );

      log(
        `合同补充：点击“${cleanText(action.textContent)}”，等待确认框...`
      );

      action.click();

      popconfirm =
        await waitForReactiveCondition(
          () =>
            getVisibleLandingPopconfirm() ||
            null,
          {
            label:
              "发起落单确认框",
            token,
            blockerCheck:
              () =>
                getVisibleErrorFeedback()
          }
        );
    }

    const confirmButton =
      await waitForReactiveCondition(
        () => {
          const button =
            findLandingPopoverConfirmButton(
              popconfirm
            );

          if (
            button &&
            !button.disabled &&
            !button.classList.contains(
              "ant-btn-loading"
            )
          ) {
            return button;
          }

          return null;
        },
        {
          label:
            "发起落单“确定”按钮",
          token,
          blockerCheck:
            () =>
              getVisibleErrorFeedback()
        }
      );

    log(
      "合同补充：点击“确定”，等待流程真实进入下一阶段..."
    );

    confirmButton.click();

    const nextStage =
      await waitForStageChange(
        "合同补充",
        token
      );

    log(
      `✓ 已进入：${nextStage}`
    );

    return nextStage;
  }

  async function runFullFlow(
    {
      token = null
    } = {}
  ) {
    if (processRunning) {
      requestFlowStop();
      return;
    }

    token =
      token ||
      createFlowToken();

    activeFlowToken =
      token;

    processRunning = true;

    updateFlowRunButtonState(
      getCurrentFlowStage()
    );

    try {
      while (
        isTargetRoute()
      ) {
        throwIfFlowCancelled(
          token
        );

        const blocker =
          getPageBlocker({
            allowApprovalModal:
              true,
            allowLandingPopconfirm:
              true
          });

        if (blocker) {
          throw new FlowBlockedError(
            blocker
          );
        }

        let stage =
          getCurrentFlowStage();

        if (!stage) {
          stage =
            await waitForReactiveCondition(
              () =>
                getCurrentFlowStage() ||
                null,
              {
                label:
                  "当前流程阶段",
                token,
                blockerCheck:
                  () =>
                    getVisibleErrorFeedback()
              }
            );
        }

        throwIfFlowCancelled(
          token
        );

        log(
          `当前流程阶段：${stage}`
        );

        refreshExamDateInfo(
          stage
        );

        updateFlowRunButtonState(
          stage
        );

        const stageIssue =
          getAutomationStageIssue(
            stage
          );

        if (stageIssue) {
          updatePanelStatus(
            stageIssue +
            "。本次不会等待阶段变化，也不会自动继续。",
            "error"
          );

          return;
        }

        if (
          stage ===
          "内勤复核"
        ) {
          await fillAndConfirmApproval(
            "内勤复核",
            getReviewRemark(),
            "",
            token
          );

          continue;
        }

        if (
          stage ===
          "合同补充"
        ) {
          await ensureContractTabVisible(
            token
          );

          throwIfFlowCancelled(
            token
          );

          await runContractProcess({
            token
          });

          throwIfFlowCancelled(
            token
          );

          /*
           * runContractProcess 只处理合同内容/保存/上传，
           * 流程仍在合同补充时再发起落单。
           */
          if (
            getCurrentFlowStage() ===
            "合同补充"
          ) {
            await submitContractStage(
              token
            );
          }

          continue;
        }

        if (
          stage ===
          "落单审核"
        ) {
          await fillAndConfirmApproval(
            "落单审核",
            getOrderRemark(),
            "确认落单",
            token
          );

          continue;
        }

        if (
          stage ===
          "落单中"
        ) {
          updatePanelStatus(
            "流程处于“落单中”，等待网页实际完成落单..."
          );

          await waitForStageChange(
            "落单中",
            token
          );

          continue;
        }

        if (
          stage ===
          "已落单"
        ) {
          updatePanelStatus(
            "✓ 当前订单流程已完成。",
            "success"
          );

          updateDataActionButtons(
            stage
          );

          return;
        }

        /*
         * 理论上所有未支持阶段都会在 stageIssue 中被拦截。
         * 保留此处作为最终安全兜底：绝不等待未知阶段自动变化。
         */
        updatePanelStatus(
          `阶段异常：当前“${stage || "未知"}”不可自动处理。`,
          "error"
        );

        return;
      }
    } catch (error) {
      if (
        error instanceof
          FlowCancelledError ||
        token.cancelled
      ) {
        updatePanelStatus(
          "■ 自动流程已停止。"
        );

        return;
      }

      throw error;
    } finally {
      processRunning = false;

      if (
        activeFlowToken ===
        token
      ) {
        activeFlowToken =
          null;
      }

      updateFlowRunButtonState(
        getCurrentFlowStage()
      );
    }
  }

  async function runContractProcess(
    {
      token = null
    } = {}
  ) {
    if (!contractPageVisible()) {
      throw new Error(
        "当前没有显示合同页"
      );
    }

    const sharedFile =
      await getBoundFileForRun();

    log(
      `合同补充：使用已选择文件 ${sharedFile.name}`
    );

    await enterEditMode(
      token
    );

    await selectConfiguredContractCompany(
      token
    );

    await setContractDates();

    await fillInspectionPeopleDay();

    await saveContractForm(
      token
    );

    const contractUploadResult =
      await uploadOne(
        "contract",
        sharedFile,
        "已盖章合同",
        token
      );

    const authUploadResult =
      await uploadOne(
        "auth",
        sharedFile,
        "授权书",
        token
      );

    const uploadResults = [
      contractUploadResult,
      authUploadResult
    ];

    const handledUploads =
      uploadResults.filter(
        result =>
          result &&
          !result.skipped
      ).length;

    const skippedUploads =
      uploadResults.filter(
        result =>
          result &&
          result.skipped
      ).length;

    updatePanelStatus(
      `✓ 合同补充完成：已处理上传模块 ${handledUploads} 个，跳过不存在模块 ${skippedUploads} 个。`,
      "success"
    );
  }

  function clamp(
    value,
    min,
    max
  ) {
    return Math.min(
      Math.max(
        value,
        min
      ),
      max
    );
  }

  function savePanelPosition(
    left,
    top
  ) {
    try {
      localStorage.setItem(
        UI.POSITION_KEY,
        JSON.stringify({
          left,
          top
        })
      );
    } catch (_) {
      // 位置保存失败不影响工具使用。
    }
  }

  function loadPanelPosition() {
    try {
      const raw =
        localStorage.getItem(
          UI.POSITION_KEY
        );

      if (!raw) {
        return null;
      }

      const parsed =
        JSON.parse(raw);

      if (
        !Number.isFinite(
          parsed?.left
        ) ||
        !Number.isFinite(
          parsed?.top
        )
      ) {
        return null;
      }

      return {
        left:
          parsed.left,
        top:
          parsed.top
      };
    } catch (_) {
      return null;
    }
  }

  function applySavedPanelPosition(
    panel
  ) {
    const saved =
      loadPanelPosition();

    if (!saved) {
      return;
    }

    const rect =
      panel.getBoundingClientRect();

    const maxLeft =
      Math.max(
        0,
        window.innerWidth -
          rect.width
      );

    const maxTop =
      Math.max(
        0,
        window.innerHeight -
          rect.height
      );

    panel.style.right =
      "auto";

    panel.style.bottom =
      "auto";

    panel.style.left =
      `${clamp(
        saved.left,
        0,
        maxLeft
      )}px`;

    panel.style.top =
      `${clamp(
        saved.top,
        0,
        maxTop
      )}px`;
  }

  function enablePanelDragging(
    panel
  ) {
    const handle =
      document.getElementById(
        UI.DRAG_HANDLE_ID
      );

    if (!handle) {
      return;
    }

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.style.cursor =
      "move";

    handle.style.userSelect =
      "none";

    handle.addEventListener(
      "mousedown",
      event => {
        if (
          event.button !== 0
        ) {
          return;
        }

        /*
         * 标题栏中的按钮/输入控件只执行自身功能，
         * 不允许同时触发窗口拖动。
         */
        if (
          event.target.closest(
            "button,input,textarea,select,label,a,[role='button']"
          )
        ) {
          return;
        }

        const rect =
          panel
            .getBoundingClientRect();

        dragging = true;

        offsetX =
          event.clientX -
          rect.left;

        offsetY =
          event.clientY -
          rect.top;

        panel.style.right =
          "auto";

        panel.style.bottom =
          "auto";

        panel.style.left =
          `${rect.left}px`;

        panel.style.top =
          `${rect.top}px`;

        event.preventDefault();
      }
    );

    document.addEventListener(
      "mousemove",
      event => {
        if (!dragging) {
          return;
        }

        const rect =
          panel
            .getBoundingClientRect();

        const maxLeft =
          Math.max(
            0,
            window.innerWidth -
              rect.width
          );

        const maxTop =
          Math.max(
            0,
            window.innerHeight -
              rect.height
          );

        const left =
          clamp(
            event.clientX -
              offsetX,
            0,
            maxLeft
          );

        const top =
          clamp(
            event.clientY -
              offsetY,
            0,
            maxTop
          );

        panel.style.left =
          `${left}px`;

        panel.style.top =
          `${top}px`;

        event.preventDefault();
      }
    );

    document.addEventListener(
      "mouseup",
      () => {
        if (!dragging) {
          return;
        }

        dragging = false;

        const rect =
          panel
            .getBoundingClientRect();

        savePanelPosition(
          rect.left,
          rect.top
        );
      }
    );

    window.addEventListener(
      "resize",
      () => {
        if (
          !document.body
            .contains(panel)
        ) {
          return;
        }

        const rect =
          panel
            .getBoundingClientRect();

        const maxLeft =
          Math.max(
            0,
            window.innerWidth -
              rect.width
          );

        const maxTop =
          Math.max(
            0,
            window.innerHeight -
              rect.height
          );

        const left =
          clamp(
            rect.left,
            0,
            maxLeft
          );

        const top =
          clamp(
            rect.top,
            0,
            maxTop
          );

        panel.style.right =
          "auto";

        panel.style.bottom =
          "auto";

        panel.style.left =
          `${left}px`;

        panel.style.top =
          `${top}px`;

        savePanelPosition(
          left,
          top
        );
      }
    );
  }


  function getPanelCollapsed() {
    try {
      return (
        localStorage.getItem(
          UI.PANEL_COLLAPSED_KEY
        ) === "1"
      );
    } catch (_) {
      return false;
    }
  }

  function setPanelCollapsed(
    collapsed
  ) {
    const body =
      document.getElementById(
        UI.PANEL_BODY_ID
      );

    const button =
      document.getElementById(
        UI.COLLAPSE_BUTTON_ID
      );

    if (body) {
      body.style.display =
        collapsed
          ? "none"
          : "block";
    }

    if (button) {
      button.textContent =
        collapsed
          ? "+"
          : "−";

      button.title =
        collapsed
          ? "展开"
          : "折叠";
    }

    try {
      localStorage.setItem(
        UI.PANEL_COLLAPSED_KEY,
        collapsed
          ? "1"
          : "0"
      );
    } catch (_) {}
  }

  function togglePanelCollapsed() {
    setPanelCollapsed(
      !getPanelCollapsed()
    );
  }

  function createTestPanel() {
    ensureDefaultSettings();

    const existing =
      document.getElementById(
        UI.PANEL_ID
      );

    if (existing) {
      updateBoundFileDisplay();
      updateRemarkStatus();
      updateSigningCompanyUi();
      renderWebNoticeHistory();
      updateFlowStageDisplay();
      refreshExamDateInfo(
        getCurrentFlowStage()
      );
      return existing;
    }

    const panel =
      document.createElement(
        "div"
      );

    panel.id =
      UI.PANEL_ID;

    panel.style.cssText = [
      "position:fixed",
      "display:none",
      "right:22px",
      "bottom:28px",
      "z-index:99999",
      "width:340px",
      "box-sizing:border-box",
      "padding:10px 14px 14px",
      "border:1px solid #e5e7eb",
      "border-radius:10px",
      "background:#fff",
      "box-shadow:0 8px 28px rgba(0,0,0,.20)",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif",
      "font-size:13px",
      "color:#333"
    ].join(";");

    panel.innerHTML = `
      <div
        id="${UI.DRAG_HANDLE_ID}"
        style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          min-height:28px;
          margin:-2px -4px 6px -4px;
          padding:2px 4px;
          border-radius:6px;
        "
        title="按住标题栏可拖动窗口"
      >
        <strong style="
          flex:1 1 auto;
          min-width:0;
          font-size:15px;
        ">
          SOA订单流程自动化 v1.31
        </strong>

        <button
          id="${UI.HELP_BUTTON_ID}"
          type="button"
          style="
            flex:0 0 auto;
            height:26px;
            padding:0 8px;
            border:1px solid #d9d9d9;
            border-radius:5px;
            background:#fff;
            color:#666;
            font-size:12px;
            cursor:pointer;
            white-space:nowrap;
          "
          title="查看工具使用说明"
        >查看说明</button>

        <button
          id="${UI.COLLAPSE_BUTTON_ID}"
          type="button"
          style="
            flex:0 0 auto;
            width:26px;
            height:26px;
            padding:0;
            border:0;
            border-radius:5px;
            background:#f5f5f5;
            color:#666;
            font-size:20px;
            line-height:24px;
            cursor:pointer;
            font-weight:600;
          "
          title="折叠"
        >−</button>
      </div>

      <div id="${UI.PANEL_BODY_ID}">
        <div
          id="${UI.HELP_PANEL_ID}"
          style="
            display:none;
            margin-bottom:8px;
            padding:8px 10px;
            border:1px solid #d9d9d9;
            border-radius:6px;
            background:#fafafa;
            color:#555;
            font-size:10.5px;
            line-height:1.45;
          "
        >
          <div style="
            margin-bottom:5px;
            font-weight:700;
            color:#333;
          ">
            使用说明
          </div>

          <div style="margin-bottom:3px;">
            <strong style="color:#444;">配置：</strong>
            顶部设置备注、签单主体和共用文件；绿色表示已就绪。
          </div>

          <div style="margin-bottom:3px;">
            <strong style="color:#444;">流程：</strong>
            内勤复核及后续阶段可执行；运行中可停止；已落单仅保留数据查询。
          </div>

          <div style="margin-bottom:3px;">
            <strong style="color:#444;">日期：</strong>
            报价确认起检测体检时间，异常日期单独标红；“修改时间”仅改为今天至3年后，不自动保存。
          </div>

          <div style="margin-bottom:3px;">
            <strong style="color:#444;">数据：</strong>
            落单数据可复制；体检数据同时读取体检汇总、套餐卡和储值卡；卡数量大于0时可点击并在新标签页自动查询对应卡池。
          </div>

          <div>
            <strong style="color:#444;">窗口：</strong>
            拖动标题栏移动，右上角“−”折叠；提示最多5条可清空，文件权限失效时再重新授权。
          </div>
        </div>

        <div style="
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:6px;
          margin-bottom:6px;
        ">
          <button
            id="${UI.REMARK_BUTTON_ID}"
            type="button"
            aria-expanded="false"
            style="
              min-width:0;
              height:28px;
              padding:0 6px;
              overflow:hidden;
              text-overflow:ellipsis;
              white-space:nowrap;
              border:1px solid #d9d9d9;
              border-radius:6px;
              background:#fff;
              color:#999;
              font-size:11px;
              font-weight:600;
              cursor:pointer;
            "
            title="修改审批备注"
          >
            修改备注
          </button>

          <button
            id="${UI.SIGNING_BUTTON_ID}"
            type="button"
            style="
              min-width:0;
              height:28px;
              padding:0 6px;
              overflow:hidden;
              text-overflow:ellipsis;
              white-space:nowrap;
              border:1px solid #d9d9d9;
              border-radius:6px;
              background:#fff;
              color:#999;
              font-size:11px;
              font-weight:600;
              cursor:pointer;
            "
            title="配置己方签单主体"
          >
            签单主体
          </button>

          <button
            id="${UI.BIND_BUTTON_ID}"
            type="button"
            style="
              min-width:0;
              height:28px;
              padding:0 6px;
              overflow:hidden;
              text-overflow:ellipsis;
              white-space:nowrap;
              border:1px solid #d9d9d9;
              border-radius:6px;
              background:#fff;
              color:#999;
              font-size:11px;
              font-weight:600;
              cursor:pointer;
            "
            title="文件绑定"
          >
            文件绑定
          </button>
        </div>

        <div
          id="${UI.REMARK_PANEL_ID}"
          style="
            display:none;
            margin-bottom:6px;
            padding:7px;
            border:1px solid #d9d9d9;
            border-radius:6px;
            background:#fafafa;
          "
        >
          <div style="
            display:flex;
            justify-content:flex-end;
            margin-bottom:6px;
          ">
            <button
              id="${UI.REMARK_DEFAULT_BUTTON_ID}"
              type="button"
              style="
                height:22px;
                padding:0 7px;
                border:1px solid #d9d9d9;
                border-radius:5px;
                background:#fff;
                color:#666;
                font-size:10px;
                cursor:pointer;
              "
            >
              恢复默认备注
            </button>
          </div>

          <div style="margin-bottom:8px;">
            <div style="
              margin-bottom:4px;
              font-weight:600;
              font-size:12px;
            ">
              内勤复核备注
            </div>
            <textarea
              id="${UI.REVIEW_REMARK_ID}"
              placeholder="请输入内勤复核审批备注"
              style="
                width:100%;
                height:48px;
                max-height:90px;
                box-sizing:border-box;
                padding:6px 8px;
                border:1px solid #d9d9d9;
                border-radius:5px;
                resize:vertical;
                overflow:auto;
                font-family:inherit;
                font-size:12px;
              "
            ></textarea>
          </div>

          <div>
            <div style="
              margin-bottom:4px;
              font-weight:600;
              font-size:12px;
            ">
              落单审核备注
            </div>
            <textarea
              id="${UI.ORDER_REMARK_ID}"
              placeholder="请输入落单审核审批备注"
              style="
                width:100%;
                height:48px;
                max-height:90px;
                box-sizing:border-box;
                padding:6px 8px;
                border:1px solid #d9d9d9;
                border-radius:5px;
                resize:vertical;
                overflow:auto;
                font-family:inherit;
                font-size:12px;
              "
            ></textarea>
          </div>
        </div>

        <div
          id="${UI.SIGNING_PANEL_ID}"
          style="
            display:none;
            margin-bottom:6px;
            padding:8px;
            border:1px solid #d9d9d9;
            border-radius:6px;
            background:#fafafa;
            font-size:11px;
          "
        >
          <div style="
            margin-bottom:7px;
            color:#555;
            font-weight:600;
          ">
            己方签单主体选择方式
          </div>

          <label style="
            display:flex;
            align-items:center;
            gap:5px;
            margin-bottom:6px;
            cursor:pointer;
          ">
            <input
              id="${UI.SIGNING_FIRST_ID}"
              type="radio"
              name="__soa_signing_mode_v118"
              value="first"
            >
            <span>第一个可用选项（当前默认）</span>
          </label>

          <label style="
            display:flex;
            align-items:center;
            gap:5px;
            margin-bottom:6px;
            cursor:pointer;
          ">
            <input
              id="${UI.SIGNING_TEXT_MODE_ID}"
              type="radio"
              name="__soa_signing_mode_v118"
              value="text"
            >
            <span>按名称精确匹配</span>
          </label>

          <input
            id="${UI.SIGNING_TEXT_ID}"
            type="text"
            placeholder="请输入下拉框中的完整主体名称"
            style="
              width:100%;
              height:30px;
              box-sizing:border-box;
              padding:0 8px;
              border:1px solid #d9d9d9;
              border-radius:5px;
              font-size:11px;
              outline:none;
            "
          >

          <div style="
            margin-top:6px;
            color:#999;
            font-size:10px;
            line-height:1.5;
          ">
            按名称模式采用精确匹配；找不到配置主体时会停止合同处理，不会改选第一项。
          </div>
        </div>

        <button
          id="${UI.FLOW_RUN_BUTTON_ID}"
          type="button"
          style="
            width:100%;
            height:38px;
            margin-bottom:8px;
            border:0;
            border-radius:6px;
            background:#1677ff;
            color:#fff;
            cursor:pointer;
            font-weight:600;
            font-size:14px;
          "
        >
          立即处理订单
        </button>

        <div style="
          padding-top:9px;
          border-top:1px solid #eee;
        ">
          <div style="
            display:flex;
            align-items:baseline;
            justify-content:flex-start;
            gap:4px;
            margin-bottom:3px;
            padding-left:1px;
            text-align:left;
          ">
            <span
              id="${UI.FLOW_STAGE_LABEL_ID}"
              style="
                flex:0 0 auto;
                color:#999;
                font-size:11px;
                font-weight:400;
              "
            >
              当前阶段：
            </span>

            <strong
              id="${UI.FLOW_STAGE_VALUE_ID}"
              style="
                min-width:0;
                color:#595959;
                font-size:14px;
                font-weight:600;
              "
            >
              识别中
            </strong>

            <span
              id="${UI.EXAM_DATE_SUMMARY_ID}"
              style="
                display:none;
                margin-left:auto;
                padding-left:8px;
                align-items:center;
                gap:3px;
                color:#262626;
                font-size:11px;
                white-space:nowrap;
              "
              title="体检时间"
            >
              <span
                id="${UI.EXAM_BEGIN_DATE_ID}"
                style="
                  color:#262626;
                  font-size:11px;
                  font-weight:400;
                "
              ></span>
              <span style="
                color:#737373;
                font-weight:500;
              ">～</span>
              <span
                id="${UI.EXAM_END_DATE_ID}"
                style="
                  color:#262626;
                  font-size:11px;
                  font-weight:400;
                "
              ></span>

              <span
                id="${UI.EXAM_DURATION_ID}"
                style="
                  display:none;
                  margin-left:4px;
                  color:#595959;
                  font-size:11px;
                  font-weight:600;
                  white-space:nowrap;
                "
                title="剩余有效期"
              ></span>
            </span>
          </div>

          <div style="
            display:flex;
            align-items:center;
            gap:6px;
            margin-bottom:6px;
            padding-left:1px;
          ">
            <div
              id="${UI.FLOW_STAGE_HINT_ID}"
              style="
                flex:1 1 auto;
                min-width:0;
                color:#999;
                font-size:11px;
                line-height:1.5;
                text-align:left;
              "
            >
              正在读取页面流程状态...
            </div>

            <button
              id="${UI.EXAM_DATE_FIX_BUTTON_ID}"
              type="button"
              style="
                display:none;
                flex:0 0 auto;
                align-items:center;
                justify-content:center;
                height:24px;
                padding:0 8px;
                border:1px solid #cf1322;
                border-radius:5px;
                background:#fff;
                color:#cf1322;
                font-size:11px;
                font-weight:600;
                cursor:pointer;
                white-space:nowrap;
              "
            >
              修改时间
            </button>
          </div>

          <div style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:6px;
            margin-top:7px;
          ">
            <button
              id="${UI.LANDING_DATA_BUTTON_ID}"
              type="button"
              style="
                height:30px;
                padding:0 8px;
                border:1px solid #d9d9d9;
                border-radius:6px;
                background:#fff;
                color:#555;
                font-size:11px;
                font-weight:600;
                cursor:pointer;
              "
            >
              落单数据
            </button>

            <button
              id="${UI.PHYSICAL_DATA_BUTTON_ID}"
              type="button"
              style="
                height:30px;
                padding:0 8px;
                border:1px solid #d9d9d9;
                border-radius:6px;
                background:#fff;
                color:#555;
                font-size:11px;
                font-weight:600;
                cursor:pointer;
              "
              title="优先直接读取当前页体检汇总；尚未加载时自动切换体检名单，并同时查询套餐卡、储值卡"
            >
              体检数据
            </button>

          </div>

          <div
            id="${UI.DATA_PANEL_ID}"
            style="
              display:none;
              margin-top:7px;
              padding:7px;
              border:1px solid #e5e7eb;
              border-radius:6px;
              background:#fff;
            "
          >
            <div
              id="${UI.DATA_PANEL_TITLE_ID}"
              style="
                margin-bottom:6px;
                color:#555;
                font-size:11px;
                font-weight:600;
                text-align:center;
              "
            ></div>

            <div
              id="${UI.EXTRACT_OPTIONS_ID}"
              style="display:none;"
            ></div>

            <div
              id="${UI.PHYSICAL_DATA_GRID_ID}"
              style="
                display:none;
                grid-template-columns:repeat(3,1fr);
                gap:5px;
              "
            ></div>

            <div
              id="${UI.CARD_POOL_DATA_GRID_ID}"
              style="
                display:none;
                grid-template-columns:1fr 1fr;
                gap:6px;
                margin-top:6px;
                padding-top:6px;
                border-top:1px dashed #eee;
              "
            ></div>

            <div
              id="${UI.EXTRACT_PREVIEW_ID}"
              style="
                display:none;
                margin-top:6px;
                padding:6px 7px;
                border:1px solid #d9f7be;
                border-radius:5px;
                background:#fcfff8;
                color:#555;
                font-size:10px;
                line-height:1.4;
                white-space:pre-wrap;
                word-break:break-all;
                user-select:text;
              "
              title="复制后的 Tab 分隔内容，可在这里查看"
            ></div>
          </div>
        </div>

        <div style="
          margin-top:8px;
          padding-top:1px;
          border-top:1px dashed #f0f0f0;
        ">
        <div
          id="${UI.STATUS_ID}"
          style="
            display:none;
            min-height:30px;
            margin-top:8px;
            padding:7px 9px;
            border:1px solid #eee;
            border-radius:6px;
            background:#fcfcfc;
            color:#555;
            line-height:1.45;
            font-size:12px;
            word-break:break-all;
          "
        ></div>

        <div
          id="${UI.WEB_NOTICE_ID}"
          style="
            display:none;
            margin-top:8px;
            padding:7px 9px;
            border:1px solid #bae7ff;
            border-radius:6px;
            background:#f0faff;
          "
        >
          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:8px;
            margin-bottom:3px;
          ">
            <span style="
              color:#096dd9;
              font-size:12px;
              font-weight:600;
            ">
              网页提示
            </span>

            <button
              id="${UI.WEB_NOTICE_CLEAR_ID}"
              type="button"
              style="
                flex:0 0 auto;
                height:20px;
                padding:0 6px;
                border:1px solid #ffccc7;
                border-radius:4px;
                background:#fff;
                color:#cf1322;
                font-size:10px;
                line-height:18px;
                cursor:pointer;
              "
              title="清空当前订单的网页提示记录"
            >
              清空
            </button>
          </div>

          <div
            id="${UI.WEB_NOTICE_LIST_ID}"
            style="
              max-height:62px;
              overflow:auto;
              color:#555;
              font-size:11px;
              line-height:1.45;
              white-space:pre-wrap;
              word-break:break-all;
            "
          ></div>
        </div>

        </div>
      </div>    `;

    document.body.appendChild(
      panel
    );

    applySavedPanelPosition(
      panel
    );

    enablePanelDragging(
      panel
    );

    document
      .getElementById(
        UI.WEB_NOTICE_CLEAR_ID
      )
      ?.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          resetWebNoticeHistory();
        }
      );

    document
      .getElementById(
        UI.HELP_BUTTON_ID
      )
      ?.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          toggleHelpPanel();
        }
      );

    document
      .getElementById(
        UI.COLLAPSE_BUTTON_ID
      )
      ?.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          togglePanelCollapsed();
        }
      );

    document
      .getElementById(
        UI.REMARK_BUTTON_ID
      )
      ?.addEventListener(
        "click",
        () => {
          toggleRemarkPanel();
        }
      );

    document
      .getElementById(
        UI.SIGNING_BUTTON_ID
      )
      ?.addEventListener(
        "click",
        () => {
          toggleSigningPanel();
        }
      );

    document
      .getElementById(
        UI.REMARK_DEFAULT_BUTTON_ID
      )
      ?.addEventListener(
        "click",
        () => {
          restoreDefaultRemarks();
        }
      );

    document
      .getElementById(
        UI.SIGNING_FIRST_ID
      )
      ?.addEventListener(
        "change",
        event => {
          if (
            event.currentTarget
              ?.checked
          ) {
            saveSigningCompanyConfig(
              "first",
              document.getElementById(
                UI.SIGNING_TEXT_ID
              )?.value || ""
            );
          }
        }
      );

    document
      .getElementById(
        UI.SIGNING_TEXT_MODE_ID
      )
      ?.addEventListener(
        "change",
        event => {
          if (
            event.currentTarget
              ?.checked
          ) {
            saveSigningCompanyConfig(
              "text",
              document.getElementById(
                UI.SIGNING_TEXT_ID
              )?.value || ""
            );

            document.getElementById(
              UI.SIGNING_TEXT_ID
            )?.focus();
          }
        }
      );

    document
      .getElementById(
        UI.SIGNING_TEXT_ID
      )
      ?.addEventListener(
        "input",
        event => {
          const text =
            event.currentTarget
              ?.value || "";

          const textRadio =
            document.getElementById(
              UI.SIGNING_TEXT_MODE_ID
            );

          if (
            textRadio &&
            textRadio.checked
          ) {
            saveSigningCompanyConfig(
              "text",
              text
            );
          } else {
            saveStoredText(
              UI.SIGNING_TEXT_KEY,
              text
            );
          }
        }
      );

    setPanelCollapsed(
      getPanelCollapsed()
    );

    const reviewRemarkInput =
      document.getElementById(
        UI.REVIEW_REMARK_ID
      );

    const orderRemarkInput =
      document.getElementById(
        UI.ORDER_REMARK_ID
      );

    if (reviewRemarkInput) {
      reviewRemarkInput.value =
        getStoredText(
          UI.REVIEW_REMARK_KEY,
          DEFAULTS.REVIEW_REMARK
        );

      reviewRemarkInput.addEventListener(
        "input",
        () => {
          saveStoredText(
            UI.REVIEW_REMARK_KEY,
            reviewRemarkInput.value
          );

          updateRemarkStatus();
        }
      );
    }

    if (orderRemarkInput) {
      orderRemarkInput.value =
        getStoredText(
          UI.ORDER_REMARK_KEY,
          DEFAULTS.ORDER_REMARK
        );

      orderRemarkInput.addEventListener(
        "input",
        () => {
          saveStoredText(
            UI.ORDER_REMARK_KEY,
            orderRemarkInput.value
          );

          updateRemarkStatus();
        }
      );
    }

    document
      .getElementById(
        UI.BIND_BUTTON_ID
      )
      ?.addEventListener(
        "click",
        () => {
          bindSharedFile()
            .catch(error => {
              if (
                error?.name ===
                "AbortError"
              ) {
                updatePanelStatus(
                  "已取消文件选择。"
                );
                return;
              }

              warn(
                error?.message ||
                String(error)
              );
            });
        }
      );

    document
      .getElementById(
        UI.LANDING_DATA_BUTTON_ID
      )
      ?.addEventListener(
        "click",
        () => {
          toggleLandingDataPanel()
            .catch(error => {
              warn(
                error?.message ||
                String(error)
              );
            });
        }
      );

    document
      .getElementById(
        UI.PHYSICAL_DATA_BUTTON_ID
      )
      ?.addEventListener(
        "click",
        () => {
          togglePhysicalDataPanel()
            .catch(error => {
              warn(
                error?.message ||
                String(error)
              );
            });
        }
      );

    document
      .getElementById(
        UI.EXAM_DATE_FIX_BUTTON_ID
      )
      ?.addEventListener(
        "click",
        () => {
          setRegisterExamDates()
            .catch(error => {
              warn(
                error?.message ||
                String(error)
              );

              console.error(
                "[SOA流程自动化] 修改体检时间失败：",
                error
              );
            });
        }
      );

    document
      .getElementById(
        UI.FLOW_RUN_BUTTON_ID
      )
      ?.addEventListener(
        "click",
        async () => {
          if (processRunning) {
            requestFlowStop();
            return;
          }

          const stage =
            getCurrentFlowStage();

          const stageIssue =
            getAutomationStageIssue(
              stage
            );

          if (stageIssue) {
            updatePanelStatus(
              stageIssue +
              "。请先在网页中将流程推进到内勤复核或后续支持阶段。",
              "error"
            );

            updateFlowRunButtonState(
              stage
            );

            return;
          }

          try {
            /*
             * 内勤复核继续执行后通常会进入合同补充；
             * 合同补充则会立即使用绑定文件。
             *
             * 在真实用户点击的当前瞬间先申请读取权限，
             * 避免稍后跑到合同阶段时 user activation 已失效，
             * 浏览器无法再弹出权限授权。
             */
            if (
              stage ===
                "内勤复核" ||
              stage ===
                "合同补充"
            ) {
              await ensureBoundFilePermissionFromUserGesture();
            }

            const token =
              createFlowToken();

            runFullFlow({
              token
            }).catch(error => {
              warn(
                error?.message ||
                String(error)
              );

              console.error(
                "[SOA流程自动化]",
                error
              );
            });
          } catch (error) {
            warn(
              error?.message ||
              String(error)
            );

            console.error(
              "[SOA流程自动化] 启动前检查失败：",
              error
            );
          }
        }
      );

    updateBoundFileDisplay();
    updateRemarkStatus();
    updateSigningCompanyUi();
    renderWebNoticeHistory();

    syncDataOrderContext();
    updateFlowStageDisplay();
    updateDataActionButtons(
      getCurrentFlowStage()
    );

    updateFlowRunButtonState(
      getCurrentFlowStage()
    );

    refreshExamDateInfo(
      getCurrentFlowStage()
    );

    panel.style.display =
      panelVisible
        ? "block"
        : "none";

    return panel;
  }

  async function initBoundFile() {
    try {
      boundFileHandle =
        await loadBoundFileHandle();

      updateBoundFileDisplay();

      if (boundFileHandle) {
        console.log(
          `[SOA流程自动化] 已恢复绑定文件：${boundFileHandle.name}`
        );
      }
    } catch (error) {
      boundFileHandle = null;

      updateBoundFileDisplay();

      warn(
        `读取已绑定文件失败：${error?.message || error}`
      );
    }
  }

  function updateAutomationSwitch() {
    const button =
      document.getElementById(
        UI.AUTO_SWITCH_ID
      );

    if (!button) {
      return;
    }

    button.textContent =
      panelVisible
        ? "智能审批：点击关闭"
        : "智能审批：点击打开";

    button.title =
      panelVisible
        ? "点击隐藏工具面板"
        : "点击显示工具面板";

    button.style.background =
      "#1677ff";

    button.style.opacity =
      panelVisible
        ? "1"
        : "0.9";
  }

  function setPanelVisible(
    visible
  ) {
    panelVisible =
      Boolean(visible);

    const panel =
      document.getElementById(
        UI.PANEL_ID
      ) ||
      createTestPanel();

    if (panel) {
      panel.style.display =
        panelVisible
          ? "block"
          : "none";
    }

    updateAutomationSwitch();

    /*
     * 打开工具面板时只刷新状态和日期。
     * 落单数据 / 体检数据均由对应按钮按需触发。
     */
    if (panelVisible) {
      syncDataOrderContext();

      updateFlowStageDisplay();
      refreshExamDateInfo(
        getCurrentFlowStage()
      );
    }
  }

  function togglePanelVisible() {
    setPanelVisible(
      !panelVisible
    );
  }

  function ensureAutomationSwitch() {
    if (
      !isTargetRoute()
    ) {
      return null;
    }

    const orderDesc =
      document.querySelector(
        CONFIG.SWITCH_ORDER_DESC_SELECTOR
      );

    if (!orderDesc) {
      return null;
    }

    const tabs =
      orderDesc.parentElement;

    if (!tabs) {
      return null;
    }

    let button =
      document.getElementById(
        UI.AUTO_SWITCH_ID
      );

    if (!button) {
      button =
        document.createElement(
          "button"
        );

      button.id =
        UI.AUTO_SWITCH_ID;

      button.type =
        "button";

      button.style.cssText = [
        "display:inline-flex",
        "flex:0 0 auto",
        "align-items:center",
        "justify-content:center",
        "height:32px",
        "margin-left:10px",
        "padding:0 12px",
        "border:1px solid #1677ff",
        "border-radius:6px",
        "background:#1677ff",
        "color:#fff",
        "font-size:13px",
        "font-weight:600",
        "line-height:30px",
        "cursor:pointer",
        "white-space:nowrap",
        "vertical-align:middle",
        "box-sizing:border-box"
      ].join(";");

      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          /*
           * 页面蓝色按钮只控制工具 UI 的显示/隐藏。
           * 不启动、不停止任何业务流程。
           */
          togglePanelVisible();
        }
      );
    }

    /*
     * 永远放到订单信息 .order-desc 前面，也就是全部原有页签之后。
     * 页面增加“修改记录”等额外页签时，不会再插入原有 tab 中间。
     */
    if (
      button.nextElementSibling !==
      orderDesc
    ) {
      tabs.insertBefore(
        button,
        orderDesc
      );
    }

    updateAutomationSwitch();

    return button;
  }

  function removeAutomationSwitch() {
    document
      .getElementById(
        UI.AUTO_SWITCH_ID
      )
      ?.remove();
  }

  function scheduleEnsureRouteUi() {
    if (
      uiEnsureScheduled
    ) {
      return;
    }

    uiEnsureScheduled =
      true;

    requestAnimationFrame(
      () => {
        uiEnsureScheduled =
          false;

        if (
          !isTargetRoute()
        ) {
          return;
        }

        createTestPanel();
        ensureAutomationSwitch();

        if (
          !boundFileInitialized
        ) {
          boundFileInitialized =
            true;

          initBoundFile()
            .catch(error => {
              console.warn(
                "[SOA流程自动化] 初始化绑定文件失败：",
                error
              );
            });
        }
      }
    );
  }

  function connectRouteObserver() {
    connectWebNoticeObserver();

    if (
      routeObserver
    ) {
      return;
    }

    routeObserver =
      new MutationObserver(
        () => {
          if (
            !isTargetRoute()
          ) {
            return;
          }

          syncDataOrderContext();
          updateFlowStageDisplay();

          scheduleEnsureRouteUi();
        }
      );

    routeObserver.observe(
      document.querySelector(
        "#root"
      ) ||
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  function disconnectRouteObserver() {
    if (
      routeObserver
    ) {
      routeObserver.disconnect();
      routeObserver =
        null;
    }

    disconnectWebNoticeObserver();
  }

  function teardownRouteUi() {
    panelVisible =
      false;

    lastDisplayedFlowStage =
      "";

    lastWebNoticeOrderCode =
      "";

    lastDataPanelOrderCode =
      "";

    activeDataPanelMode =
      "";

    cachedLandingTimeOptions = [];

    physicalDataQueryRunning =
      false;

    cardPoolQueryCache = {
      orderCode: "",
      cardCorpCode: "",
      timestamp: 0,
      data: null
    };

    cardCorpCodeMemory.clear();

    resetWebNoticeHistory();

    removeAutomationSwitch();

    document
      .getElementById(
        UI.PANEL_ID
      )
      ?.remove();

    disconnectRouteObserver();

    boundFileInitialized =
      false;
  }

  function routeCheck() {
    if (
      location.hash.startsWith(
        CARD_GROUP_ROUTE
      )
    ) {
      teardownRouteUi();

      processPendingCardGroupQuery()
        .catch(error => {
          console.warn(
            "[SOA流程自动化] 卡池自动查询失败：",
            error
          );
        });

      return;
    }

    if (
      isTargetRoute()
    ) {
      /*
       * 首次进入订单详情工作区时，工具 UI 默认保持关闭；同一订单各业务页签之间切换不会关闭工具。
       * 只有用户点击页面蓝色按钮后才显示。
       */
      if (
        !document.getElementById(
          UI.PANEL_ID
        )
      ) {
        panelVisible =
          false;
      }

      connectRouteObserver();
      scheduleEnsureRouteUi();
      return;
    }

    teardownRouteUi();
  }

  window.addEventListener(
    "hashchange",
    routeCheck,
    true
  );

  window.addEventListener(
    "popstate",
    routeCheck,
    true
  );

  window.addEventListener(
    "tm-soa-order-flow-history-change",
    routeCheck,
    true
  );

  /*
   * 与同站点现有 SOA 脚本一致：
   * pushState/replaceState 不一定触发 hashchange，
   * 因此补一个脚本内部事件。
   */
  (function patchHistoryOnce() {
    const patchKey =
      "__tmSoaOrderFlowHistoryPatched__";

    if (
      history[patchKey]
    ) {
      return;
    }

    const wrap =
      original =>
        function () {
          const result =
            original.apply(
              this,
              arguments
            );

          queueMicrotask(
            () =>
              window.dispatchEvent(
                new Event(
                  "tm-soa-order-flow-history-change"
                )
              )
          );

          return result;
        };

    history.pushState =
      wrap(
        history.pushState
      );

    history.replaceState =
      wrap(
        history.replaceState
      );

    try {
      Object.defineProperty(
        history,
        patchKey,
        {
          value: true,
          configurable: false,
          enumerable: false
        }
      );
    } catch (_) {
      history[patchKey] =
        true;
    }
  })();

  routeCheck();

  console.log(
    "[SOA流程自动化] v1.31 已加载"
  );
})();
