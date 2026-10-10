console.log("[ZFT] 🚀 v1.4.3 | Initializing ZFT Raised Hands");

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
import {
  initializePartyHudIntegration,
  syncPartyHudFromQueue
} from "./party-hud.mjs";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, QUEUE_SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: { entries: [] },
    restricted: true,
    onChange: () => {
      refreshLocalUi();
      void syncPartyHudFromQueue();
    }
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

Hooks.once("ready", async () => {
  initializeSidebarUi();
  await initializePartyHudIntegration();
  refreshLocalUi();
  console.log(`[ZFT] ✅ v${MODULE_VERSION} | ZFT Raised Hands ready`);
});

// Preserve the v1.4.2 Party HUD bridge and original raise/lower action.
// Only relocate its canvas shortcut from Token Controls into ZFT Tools.
Hooks.on("zft-tools.collectTools", tools => {
  if (!game.user) return;
  // Reuse the existing V13 toggle registration so its state and socket
  // callback remain identical to the original Raised Hands implementation.
  const proxy = { tokens: { tools: {} } };
  registerTokenControls(proxy);
  const raisedHand = proxy.tokens.tools["zft-raised-hand"];
  if (!raisedHand) return;
  tools[raisedHand.name] = {
    ...raisedHand,
    gmOnly: false,
    icon: "fas fa-hand-paper",
    order: 30
  };
});
Hooks.on("renderPlayers", syncPlayerListIndicators);
Hooks.on("renderSidebar", updateSidebarBadge);
