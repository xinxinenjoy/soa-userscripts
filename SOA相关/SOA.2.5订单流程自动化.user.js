// ==UserScript==
// @name         SOA.2.5订单流程自动化
// @namespace    https://tampermonkey.net/
// @version      1.5
// @description  SOA订单流程自动化：内勤复核、合同补充、发起落单、落单审核、落单完成及数据提取；支持文件绑定、异常等待和流程状态判定。

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
 * - 自动识别订单当前流程阶段并按页面真实状态推进。
 * - 内勤复核、落单审核分别维护独立审批备注。
 * - 合同补充自动填写、合同保存及按实际存在模块上传文件。
 * - 文件仅需绑定一次，后续复用已绑定文件。
 * - 落单完成后直接请求 processlogs 接口提取首次/修改后落单数据。
 * - 页面提供工具 UI 显示开关；工具面板支持拖动与 +/- 折叠。
 *
 * 更新记录
 *
 * v1.5  -  2026-8-30
 * - UI：落单数据区域标题改为居中显示“已落单：点击提取数据”，下方提取按钮保持不变。
 *
 * v1.4  -  2026-8-30
 * - UI：新增“查看说明”；审批备注改为隐藏式设置，仅显示“已配置 / 需要补充”状态。
 * - UI：新增“网页提示”区域，捕获页面消息、通知、确认框及弹窗标题，便于观察自动处理过程。
 * - 优化：进一步压缩常驻面板内容，备注配置默认不展开。
 *
 * v1.3  -  2026-8-30
 * - 优化：页面/面板打开时自动刷新落单数据；状态提示上移；文件绑定与当前文件合并为一行。
 * - 调整：统一使用“立即处理订单”作为业务处理入口。
 *
 * v1.0  -  2026-8-30
 * - 首个 Tampermonkey 正式版：支持状态驱动审批、合同补充、发起落单、落单审核、文件绑定及 processlogs 落单数据提取。
 */

(function () {
    "use strict";
  
    const TARGET_HASH_PREFIX =
      "#/order/info";
  
    const isTargetRoute =
      () =>
        location.hash.startsWith(
          TARGET_HASH_PREFIX
        );
  
    const CONFIG = {
      SWITCH_ANCHOR_SELECTOR:
        "#root > div > div > div > div > section > section > div:nth-of-type(6)",
  
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
  
      EDIT_TIMEOUT: 6000,
      OPTION_TIMEOUT: 5000,
      PICKER_TIMEOUT: 3500,
      SAVE_TIMEOUT: 6000,
      UPLOAD_CONFIRM_TIMEOUT: 8000,
      POLL_INTERVAL: 100,
  
      REACTIVE_POLL_INTERVAL:
        400,
      STALL_NOTICE_INTERVAL:
        12000,
  
      PROCESS_LOG_API:
        "/soa/api/v1/order/processlogs",
  
      EXTRACT_ORDER_NAME_SELECTOR:
        "#register > div",
      EXTRACT_ORDER_CODE_SELECTOR:
        "#register > div:nth-of-type(2) > div:nth-of-type(8) > div:nth-of-type(2) > div > div",
      EXTRACT_OPPORTUNITY_CODE_SELECTOR:
        "#register > div:nth-of-type(2) > div:nth-of-type(5) > div > div:nth-of-type(2) > div > div",
      EXTRACT_SALESMAN_SELECTOR:
        "#register > div:nth-of-type(2) > div > div:nth-of-type(2) > div > div > span"
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
      FILE_NAME_ID:
        "__soa_contract_console_filename_v04",
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
  
      HELP_BUTTON_ID:
        "__soa_flow_help_button_v14",
      HELP_PANEL_ID:
        "__soa_flow_help_panel_v14",
  
      REMARK_BUTTON_ID:
        "__soa_flow_remark_button_v14",
      REMARK_PANEL_ID:
        "__soa_flow_remark_panel_v14",
      REMARK_STATUS_ID:
        "__soa_flow_remark_status_v14",
  
      WEB_NOTICE_ID:
        "__soa_flow_web_notice_v14",
      WEB_NOTICE_LIST_ID:
        "__soa_flow_web_notice_list_v14"
    };
  
    let boundFileHandle = null;
    let processRunning = false;
  
    let panelVisible = false;
  
    let routeObserver = null;
    let uiEnsureScheduled = false;
    let boundFileInitialized = false;
  
    let webNoticeObserver = null;
    let webNoticeScanScheduled = false;
    let webNoticeHistory = [];
    let webNoticeSeen = new WeakMap();
    let lastWebNoticeSignature = "";
    let lastWebNoticeAt = 0;
  
    function updatePanelStatus(
      message,
      type = "normal"
    ) {
      const status =
        document.getElementById(
          UI.STATUS_ID
        );
  
      if (!status) {
        return;
      }
  
      status.textContent =
        String(message || "");
  
      status.style.color =
        type === "error"
          ? "#cf1322"
          : type === "success"
            ? "#389e0d"
            : "#555";
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
  
    function pushWebNotice(
      text,
      type = "提示"
    ) {
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
  
    function isAutomationTokenActive(
      token
    ) {
      return isTargetRoute();
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
                clearInterval(
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
              resolve(value);
            };
  
          const finishReject =
            error => {
              if (finished) {
                return;
              }
  
              finished = true;
              cleanup();
              reject(error);
            };
  
          const check =
            () => {
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
           * 这里只提示“仍在等待”，不会因为时间到了就自动点下一步。
           */
          noticeTimer =
            setInterval(
              () => {
                updatePanelStatus(
                  `仍在等待：${label}。页面较慢时会继续等待，不会重复提交。`
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
      expected
    ) {
      const expectedText =
        String(expected);
  
      for (
        let attempt = 0;
        attempt < 4;
        attempt++
      ) {
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
  
        if (
          String(
            element.value
          ) === expectedText
        ) {
          await nextPaint(2);
  
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
  
    function addOneYear(date) {
      const source =
        new Date(date);
  
      const targetYear =
        source.getFullYear() + 1;
  
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
  
    function findFirstVisibleOption(
      input
    ) {
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
          const option =
            Array.from(
              list.querySelectorAll(
                ".ant-select-item-option:not(.ant-select-item-option-disabled)"
              )
            ).find(isVisible);
  
          if (option) {
            return option;
          }
        }
      }
  
      const dropdowns =
        Array.from(
          document.querySelectorAll(
            ".ant-select-dropdown"
          )
        )
          .filter(isVisible)
          .reverse();
  
      for (const dropdown of dropdowns) {
        const option =
          Array.from(
            dropdown.querySelectorAll(
              ".ant-select-item-option:not(.ant-select-item-option-disabled)"
            )
          ).find(isVisible);
  
        if (option) {
          return option;
        }
      }
  
      return null;
    }
  
    async function selectFirstContractCompany(
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
  
      log(
        "2/5 选择己方签单主体第一个选项..."
      );
  
      fireMouseSequence(
        selector
      );
  
      const option =
        await waitForReactiveCondition(
          () =>
            findFirstVisibleOption(
              input
            ) ||
            null,
          {
            label:
              "己方签单主体下拉选项",
            token,
            blockerCheck:
              () =>
                getVisibleErrorFeedback()
          }
        );
  
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
          "已点击乙方第一项，但页面未确认选中结果"
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
        addOneYear(
          today
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
  
    function getUploaderInput(
      kind
    ) {
      return (
        findUploader(kind)
          ?.querySelector(
            'input[type="file"]'
          ) ||
        null
      );
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
      const element =
        document.getElementById(
          UI.FILE_NAME_ID
        );
  
      if (!element) {
        return;
      }
  
      if (boundFileHandle) {
        const name =
          boundFileHandle.name ||
          "已绑定文件";
  
        element.textContent =
          name;
  
        element.title =
          name;
  
        element.style.color =
          "#1677ff";
      } else {
        element.textContent =
          "尚未绑定";
  
        element.title =
          "";
  
        element.style.color =
          "#999";
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
       * 本函数在“绑定/更换共用文件”按钮事件中第一时间调用。
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
        `✓ 已绑定共用文件：${handle.name}`
      );
  
      return true;
    }
  
    async function getBoundFileForRun(
      {
        allowPermissionPrompt =
          false
      } = {}
    ) {
      if (!boundFileHandle) {
        throw new Error(
          "尚未绑定共用文件，请先点击“绑定/更换共用文件”"
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
        if (
          allowPermissionPrompt &&
          typeof boundFileHandle
            .requestPermission ===
            "function" &&
          (
            navigator.userActivation
              ?.isActive ??
            true
          )
        ) {
          permission =
            await boundFileHandle
              .requestPermission({
                mode: "read"
              });
        }
      }
  
      if (
        permission !==
        "granted"
      ) {
        throw new Error(
          "已绑定文件的读取权限需要重新授权。请点击“绑定/更换共用文件”后再开启自动流程。"
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
      file
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
  
      const confirmed =
        await waitFor(
          () => {
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
  
            return false;
          },
          CONFIG.UPLOAD_CONFIRM_TIMEOUT,
          200
        );
  
      return Boolean(
        confirmed
      );
    }
  
    async function uploadOne(
      kind,
      file,
      label
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
          file
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
        options.push({
          type: "modified",
          label: "修改后落单",
          time: last.time,
          count: records.length
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
  
      const waiting =
        document.getElementById(
          "__soa_flow_extract_waiting_v010"
        );
  
      container.innerHTML =
        "";
  
      container.style.display =
        "none";
  
      if (waiting) {
        waiting.style.display =
          "block";
      }
  
      const options =
        Array.isArray(
          suppliedOptions
        )
          ? suppliedOptions
          : getLandingTimeOptions();
  
      if (!options.length) {
        return options;
      }
  
      if (waiting) {
        waiting.style.display =
          "none";
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
          UI.REVIEW_REMARK_KEY
        )
      );
    }
  
    function getOrderRemark() {
      return cleanText(
        document.getElementById(
          UI.ORDER_REMARK_ID
        )?.value ||
        getStoredText(
          UI.ORDER_REMARK_KEY
        )
      );
    }
  
    function getRemarkStatusInfo() {
      const review =
        getReviewRemark();
  
      const order =
        getOrderRemark();
  
      const missing = [];
  
      if (!review) {
        missing.push(
          "内勤复核"
        );
      }
  
      if (!order) {
        missing.push(
          "落单审核"
        );
      }
  
      return {
        ready:
          missing.length === 0,
        missing
      };
    }
  
    function updateRemarkStatus() {
      const element =
        document.getElementById(
          UI.REMARK_STATUS_ID
        );
  
      if (!element) {
        return;
      }
  
      const info =
        getRemarkStatusInfo();
  
      if (info.ready) {
        element.textContent =
          "已配置";
  
        element.style.color =
          "#389e0d";
  
        element.style.background =
          "#f6ffed";
  
        element.style.borderColor =
          "#b7eb8f";
  
        return;
      }
  
      element.textContent =
        `需要补充：${info.missing.join("、")}`;
  
      element.style.color =
        "#d46b08";
  
      element.style.background =
        "#fff7e6";
  
      element.style.borderColor =
        "#ffd591";
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
  
      button.textContent =
        opening
          ? "收起备注"
          : "设置备注";
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
          remarkText
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
  
    async function waitUntilFinalStage(
      token = null
    ) {
      while (true) {
        const stage =
          getCurrentFlowStage();
  
        if (
          stage ===
          "已落单"
        ) {
          return stage;
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
            "流程已进入“落单中”，正在等待页面实际变为“已落单”..."
          );
  
          await waitForStageChange(
            "落单中",
            token
          );
  
          continue;
        }
  
        if (stage) {
          await waitForStageChange(
            stage,
            token
          );
          continue;
        }
  
        await waitForReactiveCondition(
          () =>
            getCurrentFlowStage() ||
            null,
          {
            label:
              "页面流程阶段",
            token
          }
        );
      }
    }
  
    async function runFullFlow(
      {
        token = null,
        allowPermissionPrompt =
          false
      } = {}
    ) {
      if (processRunning) {
        log(
          "当前已有流程正在执行，忽略重复启动。"
        );
        return;
      }
  
      processRunning = true;
  
      const flowButton =
        document.getElementById(
          UI.FLOW_RUN_BUTTON_ID
        );
  
      if (flowButton) {
        flowButton.disabled =
          true;
        flowButton.textContent =
          "流程处理中...";
      }
  
      try {
        while (
          isTargetRoute()
        ) {
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
  
          log(
            `当前流程阶段：${stage}`
          );
  
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
  
            await runContractProcess({
              nested:
                true,
              token,
              allowPermissionPrompt
            });
  
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
            await refreshLandingTimeOptions();
  
            updatePanelStatus(
              "✓ 当前订单已落单，落单数据按钮已刷新。",
              "success"
            );
  
            return;
          }
  
          /*
           * 未配置自动动作的早期阶段不乱点，
           * 只观察流程发生真实变化。
           */
          updatePanelStatus(
            `当前为“${stage}”，该阶段不执行自动点击，等待页面进入已支持阶段。`
          );
  
          await waitForStageChange(
            stage,
            token
          );
        }
      } finally {
        processRunning = false;
  
        if (flowButton) {
          flowButton.disabled =
            false;
          flowButton.textContent =
            "立即处理订单";
        }
      }
    }
  
    async function runContractProcess(
      {
        nested = false,
        token = null,
        allowPermissionPrompt =
          false
      } = {}
    ) {
      if (
        !nested &&
        processRunning
      ) {
        log(
          "当前流程正在执行，请等待完成。"
        );
        return;
      }
  
      if (!contractPageVisible()) {
        throw new Error(
          "当前没有显示合同页"
        );
      }
  
      if (!nested) {
        processRunning = true;
      }
  
      try {
        const sharedFile =
          await getBoundFileForRun({
            allowPermissionPrompt
          });
  
        log(
          `合同补充：使用已绑定文件 ${sharedFile.name}`
        );
  
        await enterEditMode(
          token
        );
  
        await selectFirstContractCompany(
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
            "已盖章合同"
          );
  
        const authUploadResult =
          await uploadOne(
            "auth",
            sharedFile,
            "授权书"
          );
  
        const handledUploads =
          [
            contractUploadResult,
            authUploadResult
          ].filter(
            result =>
              result &&
              !result.skipped
          ).length;
  
        const skippedUploads =
          [
            contractUploadResult,
            authUploadResult
          ].filter(
            result =>
              result &&
              result.skipped
          ).length;
  
        updatePanelStatus(
          `✓ 合同补充完成：已处理上传模块 ${handledUploads} 个，跳过不存在模块 ${skippedUploads} 个。`,
          "success"
        );
      } finally {
        if (!nested) {
          processRunning =
            false;
        }
  
      }
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
  
          if (
            event.target.closest(
              `#${UI.COLLAPSE_BUTTON_ID}`
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
      const existing =
        document.getElementById(
          UI.PANEL_ID
        );
  
      if (existing) {
        updateBoundFileDisplay();
        updateRemarkStatus();
        renderWebNoticeHistory();
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
            SOA订单流程自动化 v1.5
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
            id="${UI.STATUS_ID}"
            style="
              min-height:30px;
              margin-bottom:8px;
              padding:7px 9px;
              border:1px solid #eee;
              border-radius:6px;
              background:#fcfcfc;
              color:#555;
              line-height:1.45;
              font-size:12px;
              word-break:break-all;
            "
          >
            等待页面状态...
          </div>
  
          <div
            id="${UI.WEB_NOTICE_ID}"
            style="
              display:none;
              margin-bottom:8px;
              padding:7px 9px;
              border:1px solid #bae7ff;
              border-radius:6px;
              background:#f0faff;
            "
          >
            <div style="
              margin-bottom:3px;
              color:#096dd9;
              font-size:12px;
              font-weight:600;
            ">
              网页提示
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
              font-size:12px;
              line-height:1.6;
            "
          >
            <div style="
              margin-bottom:4px;
              font-weight:600;
              color:#333;
            ">
              使用说明
            </div>
            <ol style="
              margin:0;
              padding-left:18px;
            ">
              <li>
                页面“智能审批”按钮只负责显示/隐藏本工具，不会自动执行订单。
              </li>
              <li>
                首次使用请绑定共用文件；后续会复用已绑定文件。
              </li>
              <li>
                点击“设置备注”分别维护内勤复核、落单审核备注；缺少时会提示需要补充。
              </li>
              <li>
                点击“立即处理订单”，脚本根据当前流程阶段自动审批、合同补充、发起落单并等待状态变化。
              </li>
              <li>
                订单已落单后，下方会自动显示首次/修改后落单数据按钮，点击即可按 Tab 格式复制。
              </li>
              <li>
                网页出现消息、通知或确认提示时，会同步显示在“网页提示”区域，便于观察处理过程。
              </li>
            </ol>
          </div>
  
          <div style="
            display:flex;
            align-items:center;
            gap:8px;
            margin-bottom:8px;
          ">
            <div style="
              flex:1 1 auto;
              min-width:0;
              display:flex;
              align-items:center;
              gap:6px;
            ">
              <strong style="
                flex:0 0 auto;
                font-size:13px;
              ">
                审批备注
              </strong>
  
              <span
                id="${UI.REMARK_STATUS_ID}"
                style="
                  min-width:0;
                  overflow:hidden;
                  text-overflow:ellipsis;
                  white-space:nowrap;
                  padding:2px 7px;
                  border:1px solid #d9d9d9;
                  border-radius:10px;
                  color:#999;
                  background:#fafafa;
                  font-size:11px;
                "
              >
                检查中
              </span>
            </div>
  
            <button
              id="${UI.REMARK_BUTTON_ID}"
              type="button"
              style="
                flex:0 0 auto;
                height:28px;
                padding:0 9px;
                border:1px solid #1677ff;
                border-radius:5px;
                background:#fff;
                color:#1677ff;
                font-size:12px;
                cursor:pointer;
              "
            >
              设置备注
            </button>
          </div>
  
          <div
            id="${UI.REMARK_PANEL_ID}"
            style="
              display:none;
              margin-bottom:8px;
              padding:9px;
              border:1px solid #d9d9d9;
              border-radius:6px;
              background:#fafafa;
            "
          >
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
            display:flex;
            align-items:center;
            gap:8px;
            margin-bottom:8px;
          ">
            <button
              id="${UI.BIND_BUTTON_ID}"
              type="button"
              style="
                flex:0 0 auto;
                height:32px;
                padding:0 10px;
                border:1px solid #1677ff;
                border-radius:6px;
                background:#fff;
                color:#1677ff;
                cursor:pointer;
                white-space:nowrap;
                font-size:12px;
              "
            >
              绑定/更换文件
            </button>
  
            <div style="
              flex:1 1 auto;
              min-width:0;
              height:32px;
              box-sizing:border-box;
              display:flex;
              align-items:center;
              padding:0 9px;
              border-radius:6px;
              background:#f6f8fa;
              color:#777;
              font-size:12px;
              overflow:hidden;
              white-space:nowrap;
            ">
              <span style="flex:0 0 auto;">
                当前：
              </span>
              <strong
                id="${UI.FILE_NAME_ID}"
                style="
                  min-width:0;
                  overflow:hidden;
                  text-overflow:ellipsis;
                  white-space:nowrap;
                  color:#1677ff;
                "
              >读取中...</strong>
            </div>
          </div>
  
          <div style="
            padding-top:9px;
            border-top:1px solid #eee;
          ">
            <div style="
              margin-bottom:6px;
              text-align:center;
              color:#333;
              font-size:13px;
              font-weight:600;
            ">
              已落单：点击提取数据
            </div>
  
            <div
              id="${UI.EXTRACT_OPTIONS_ID}"
              style="display:none;"
            ></div>
  
            <div
              id="__soa_flow_extract_waiting_v010"
              style="
                color:#999;
                font-size:11px;
                line-height:1.5;
              "
            >
              订单进入“已落单”后自动读取流程日志并显示复制按钮
            </div>
  
            <div
              id="${UI.EXTRACT_PREVIEW_ID}"
              style="
                display:none;
                margin-top:8px;
                padding:7px 8px;
                border:1px solid #d9f7be;
                border-radius:6px;
                background:#fcfff8;
                color:#555;
                font-size:11px;
                line-height:1.45;
                white-space:pre-wrap;
                word-break:break-all;
                user-select:text;
              "
              title="复制失败时可在这里手动复制"
            ></div>
          </div>
        </div>
      `;
  
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
            UI.REVIEW_REMARK_KEY
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
            UI.ORDER_REMARK_KEY
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
          UI.FLOW_RUN_BUTTON_ID
        )
        ?.addEventListener(
          "click",
          () => {
            runFullFlow({
              allowPermissionPrompt:
                true
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
          }
        );
  
      /*
       * 页面刷新或重新进入订单详情时，面板首次创建即后台刷新一次。
       */
      refreshLandingTimeOptions()
        .catch(error => {
          console.warn(
            "[SOA流程自动化] 页面初始化刷新落单数据失败：",
            error
          );
        });
  
      updateBoundFileDisplay();
      updateRemarkStatus();
      renderWebNoticeHistory();
  
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
          updatePanelStatus(
            `已恢复绑定：${boundFileHandle.name}`
          );
  
          log(
            `已恢复绑定文件：${boundFileHandle.name}`
          );
        } else {
          updatePanelStatus(
            "尚未绑定文件，请先点击“绑定/更换共用文件”。"
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
       * 每次打开工具面板，都重新获取一次当前订单落单数据。
       */
      if (panelVisible) {
        refreshLandingTimeOptions()
          .catch(error => {
            console.warn(
              "[SOA流程自动化] 打开面板刷新落单数据失败：",
              error
            );
          });
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
  
      const anchor =
        document.querySelector(
          CONFIG.SWITCH_ANCHOR_SELECTOR
        );
  
      if (!anchor) {
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
       * 直接作为目标元素的相邻兄弟插入，不使用 fixed/absolute，
       * 因此不会浮在其他业务数据上方。
       */
      if (
        button.previousElementSibling !==
        anchor
      ) {
        anchor.insertAdjacentElement(
          "afterend",
          button
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
        isTargetRoute()
      ) {
        /*
         * 每次进入订单详情路由，工具 UI 默认保持关闭。
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
      "[SOA流程自动化] v1.5 已加载"
    );
  })();
  