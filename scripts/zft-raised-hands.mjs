console.log("[ZFT] 🚀 v1.4.1 | Initializing ZFT Raised Hands");

import {
  MODULE_ID,
  MODULE_VERSION,
  QUEUE_SETTING,
  ALERT_ENABLED_SETTING,
  ALERT_PATH_SETTING,
  ALERT_VOLUME_SETTING,
  DEFAULT_ALERT_SOUND
} from "./constants.mjs";
import { isUserRaised } from "./queue.mjs";
import { initSocket, requestSetHandState } from "./socket.mjs";
import {
  registerSidebarTab,
  registerTokenControls,
  refreshLocalUi,
  syncPlayerListIndicators,
  initializeSidebarUi,
  updateSidebarBadge
} from "./ui.mjs";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, QUEUE_SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: { entries: [] },
    restricted: true,
    onChange: () => refreshLocalUi()
  });

  game.settings.register(MODULE_ID, ALERT_ENABLED_SETTING, {
    name: "ZFT_RAISED_HANDS.Settings.AlertEnabled.Name",
    hint: "ZFT_RAISED_HANDS.Settings.AlertEnabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    restricted: true
  });

  game.settings.register(MODULE_ID, ALERT_PATH_SETTING, {
    name: "ZFT_RAISED_HANDS.Settings.AlertPath.Name",
    hint: "ZFT_RAISED_HANDS.Settings.AlertPath.Hint",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_ALERT_SOUND,
    filePicker: "audio",
    restricted: true
  });

  game.settings.register(MODULE_ID, ALERT_VOLUME_SETTING, {
    name: "ZFT_RAISED_HANDS.Settings.AlertVolume.Name",
    hint: "ZFT_RAISED_HANDS.Settings.AlertVolume.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 65,
    range: {
      min: 0,
      max: 100,
      step: 5
    },
    restricted: true
  });

  game.keybindings.register(MODULE_ID, "toggle-hand", {
    name: "ZFT_RAISED_HANDS.Keybinding",
    hint: "ZFT_RAISED_HANDS.KeybindingHint",
    editable: [{ key: "KeyH", modifiers: [] }],
    onDown: async () => {
      await requestSetHandState(!isUserRaised(game.user.id));
      return true;
    },
    reservedModifiers: []
  });

  registerSidebarTab();
  console.log(`[ZFT] ⚙️ v${MODULE_VERSION} | Settings, keybinding, and sidebar tab registered`);
});

Hooks.once("setup", registerSidebarTab);
Hooks.once("socketlib.ready", initSocket);

Hooks.once("ready", () => {
  initializeSidebarUi();
  refreshLocalUi();
  console.log(`[ZFT] ✅ v${MODULE_VERSION} | ZFT Raised Hands ready`);
});

Hooks.on("getSceneControlButtons", registerTokenControls);
Hooks.on("renderPlayers", syncPlayerListIndicators);
Hooks.on("renderSidebar", updateSidebarBadge);
