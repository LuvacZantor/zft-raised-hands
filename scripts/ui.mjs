import { MODULE_ID, MODULE_VERSION } from "./constants.mjs";
import { getQueueEntries, isUserRaised } from "./queue.mjs";
import {
  requestSetHandState,
  requestClearUser,
  requestClearNext,
  requestClearAll
} from "./socket.mjs";

export const SIDEBAR_TAB_NAME = "zftRaisedHands";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab, Sidebar } = foundry.applications.sidebar;

export class RaisedHandsSidebarTab extends HandlebarsApplicationMixin(AbstractSidebarTab) {
  static tabName = SIDEBAR_TAB_NAME;

  static DEFAULT_OPTIONS = {
    window: {
      title: "ZFT_RAISED_HANDS.QueueTitle"
    },
    actions: {
      clearUser: RaisedHandsSidebarTab.#onClearUser,
      clearNext: RaisedHandsSidebarTab.#onClearNext,
      clearAll: RaisedHandsSidebarTab.#onClearAll
    }
  };

  static PARTS = {
    tab: {
      root: true,
      template: `modules/${MODULE_ID}/templates/sidebar.hbs`,
      scrollable: [".zft-rh-list"]
    }
  };

  #elapsedTimer = null;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const entries = getQueueEntries().map((entry, index) => {
      const user = game.users.get(entry.userId);
      return {
        userId: entry.userId,
        raisedAt: entry.raisedAt,
        order: index + 1,
        name: user?.name ?? `Unknown User (${entry.userId})`,
        avatar: user?.avatar || "icons/svg/mystery-man.svg",
        online: Boolean(user?.active),
        status: game.i18n.localize(user?.active ? "ZFT_RAISED_HANDS.Online" : "ZFT_RAISED_HANDS.Offline"),
        statusClass: user?.active ? "zft-rh-online" : "zft-rh-offline",
        elapsed: formatElapsed(entry.raisedAt)
      };
    });

    return Object.assign(context, {
      isGM: game.user.isGM,
      entries,
      count: entries.length,
      hasEntries: entries.length > 0,
      summary: entries.length === 1
        ? game.i18n.localize("ZFT_RAISED_HANDS.OneWaiting")
        : game.i18n.format("ZFT_RAISED_HANDS.ManyWaiting", { count: entries.length })
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.classList.add("zft-rh-tab-app");
    this.element.classList.toggle("zft-rh-gm", game.user.isGM);
    this.#startElapsedTimer();
  }

  _onClose(options) {
    this.#stopElapsedTimer();
    return super._onClose(options);
  }

  #startElapsedTimer() {
    if (this.#elapsedTimer) return;
    this.#elapsedTimer = window.setInterval(() => this.#updateElapsedLabels(), 5000);
  }

  #stopElapsedTimer() {
    if (!this.#elapsedTimer) return;
    window.clearInterval(this.#elapsedTimer);
    this.#elapsedTimer = null;
  }

  #updateElapsedLabels() {
    if (!this.rendered) return;
    this.element.querySelectorAll(".zft-rh-elapsed[data-raised-at]").forEach(element => {
      element.textContent = formatElapsed(Number(element.dataset.raisedAt));
    });
  }

  static async #onClearUser(_event, target) {
    const userId = target.dataset.userId;
    if (!userId || !game.user.isGM) return;
    await withDisabledButton(target, () => requestClearUser(userId));
  }

  static async #onClearNext(_event, target) {
    if (!game.user.isGM) return;
    await withDisabledButton(target, requestClearNext);
  }

  static async #onClearAll(_event, target) {
    if (!game.user.isGM) return;
    await withDisabledButton(target, requestClearAll);
  }
}

export function registerSidebarTab() {
  CONFIG.ui[SIDEBAR_TAB_NAME] = RaisedHandsSidebarTab;

  const tabs = Sidebar?.TABS;
  if (!tabs) {
    console.error(`[ZFT] ❌ v${MODULE_VERSION} | Foundry V13 Sidebar.TABS is unavailable; Raised Hands sidebar registration failed`);
    return false;
  }

  const descriptor = {
    tooltip: "ZFT_RAISED_HANDS.QueueTitle",
    icon: "fa-solid fa-hand-point-up zft-rh-tab-icon",
  };

  const ordered = {};
  let inserted = false;

  for (const [key, value] of Object.entries(tabs)) {
    if (key === SIDEBAR_TAB_NAME) continue;
    ordered[key] = value;

    if (key === "chat") {
      ordered[SIDEBAR_TAB_NAME] = descriptor;
      inserted = true;
    }
  }

  if (!inserted) ordered[SIDEBAR_TAB_NAME] = descriptor;

  for (const key of Object.keys(tabs)) delete tabs[key];
  Object.assign(tabs, ordered);

  console.log(`[ZFT] ✅ v${MODULE_VERSION} | Native V13 Raised Hands sidebar tab registered`);
  return true;
}

export function registerTokenControls(controls) {
  const tokenControls = controls?.tokens;
  if (!tokenControls?.tools) return;

  const raised = isUserRaised(game.user.id);

  tokenControls.tools["zft-raised-hand"] = {
    name: "zft-raised-hand",
    title: raised ? "ZFT_RAISED_HANDS.ControlLower" : "ZFT_RAISED_HANDS.ControlRaise",
    icon: "fas fa-hand-paper zft-rh-control-icon",
    order: Object.keys(tokenControls.tools).length,
    button: false,
    toggle: true,
    active: raised,
    visible: true,
    onChange: async (_event, active) => {
      await requestSetHandState(Boolean(active));
    }
  };
}

export function refreshLocalUi() {
  try {
    ui.controls?.render?.({ reset: true });
  } catch (error) {
    console.warn(`[ZFT] ⚠️ v${MODULE_VERSION} | Failed to refresh Scene Controls`, error);
  }

  syncPlayerListIndicators();

  updateSidebarBadge();
  const tab = ui[SIDEBAR_TAB_NAME];
  if (tab?.rendered) tab.render();
}

export function syncPlayerListIndicators() {
  document.querySelectorAll(".zft-raised-hands-indicator").forEach(icon => icon.remove());

  for (const entry of getQueueEntries()) {
    const userId = cssEscape(entry.userId);
    const row = document.querySelector(`[data-user-id="${userId}"]`);
    if (!row) continue;

    const nameElement = row.querySelector(".player-name") ?? row;
    if (nameElement.querySelector(".zft-raised-hands-indicator")) continue;

    const icon = document.createElement("span");
    icon.className = "zft-raised-hands-indicator fas fa-hand-paper";
    icon.title = game.i18n.localize("ZFT_RAISED_HANDS.ControlRaise");
    nameElement.appendChild(icon);
  }
}

export function initializeSidebarUi() {
  updateSidebarBadge();
}

export async function openGmQueue() {

  try {
    ui.sidebar?.expand?.();

    const tab = ui[SIDEBAR_TAB_NAME];
    if (tab) {
      await tab.render();
      ui.sidebar?.changeTab?.(SIDEBAR_TAB_NAME, "primary", { force: true });
      updateSidebarBadge();
      return;
    }

    console.warn(`[ZFT] ⚠️ v${MODULE_VERSION} | Native sidebar instance unavailable; opening fallback window`);
    const fallback = new RaisedHandsSidebarTab({
      window: {
        frame: true,
        positioned: true,
        title: "ZFT_RAISED_HANDS.QueueTitle"
      }
    });
    await fallback.render({ force: true });
  } catch (error) {
    console.error(`[ZFT] ❌ v${MODULE_VERSION} | Failed to open Raised Hands manager`, error);
  }
}

export function updateSidebarBadge() {
  const button = document.querySelector(`[data-tab="${SIDEBAR_TAB_NAME}"]`);
  if (!button) return;

  const count = getQueueEntries().length;
  let badge = button.querySelector(".zft-rh-tab-badge");

  if (!count) {
    badge?.remove();
    button.classList.remove("zft-rh-has-hands");
    return;
  }

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "zft-rh-tab-badge";
    button.appendChild(badge);
  }

  badge.textContent = String(count);
  button.classList.add("zft-rh-has-hands");
}


async function withDisabledButton(button, action) {
  button.disabled = true;
  try {
    return await action();
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

function formatElapsed(raisedAt) {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - Number(raisedAt)) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return CSS.escape(String(value));
  return String(value).replace(/(["\\])/g, "\\$1");
}
