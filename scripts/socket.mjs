import {
  MODULE_ID,
  MODULE_VERSION,
  ALERT_ENABLED_SETTING,
  ALERT_PATH_SETTING,
  ALERT_VOLUME_SETTING,
  DEFAULT_ALERT_SOUND
} from "./constants.mjs";
import {
  setUserRaisedAuthoritative,
  clearNextAuthoritative,
  clearAllAuthoritative
} from "./queue.mjs";

let socket = null;

export function initSocket() {
  socket = socketlib.registerModule(MODULE_ID);
  socket.register("setHandState", setHandStateHandler);
  socket.register("clearNext", clearNextHandler);
  socket.register("clearAll", clearAllHandler);
  socket.register("notifyRaised", notifyRaisedHandler);

  console.log(`[ZFT] 🔌 v${MODULE_VERSION} | SocketLib handlers registered`);
}

function requireSocket() {
  if (socket) return true;
  ui.notifications?.warn("ZFT Raised Hands: SocketLib is not ready.");
  console.warn(`[ZFT] ⚠️ v${MODULE_VERSION} | SocketLib is not ready`);
  return false;
}

async function setHandStateHandler(userId, raised) {
  if (!game.user.isGM) return false;

  const result = await setUserRaisedAuthoritative(userId, Boolean(raised));
  if (result.changed && result.raised) {
    await socket?.executeForAllGMs("notifyRaised", userId);
  }

  return result.changed;
}

async function clearNextHandler() {
  if (!game.user.isGM) return false;
  return clearNextAuthoritative();
}

async function clearAllHandler() {
  if (!game.user.isGM) return false;
  return clearAllAuthoritative();
}

function notifyRaisedHandler(userId) {
  if (!game.user.isGM) return;

  const user = game.users.get(userId);
  if (!user) return;

  ui.notifications?.info(
    game.i18n.format("ZFT_RAISED_HANDS.RaisedNotification", { name: user.name })
  );

  playRaiseAlert();
}

function playRaiseAlert() {
  if (!game.settings.get(MODULE_ID, ALERT_ENABLED_SETTING)) return;

  const configuredPath = String(game.settings.get(MODULE_ID, ALERT_PATH_SETTING) ?? "").trim();
  const src = configuredPath || DEFAULT_ALERT_SOUND;
  const volumeSetting = Number(game.settings.get(MODULE_ID, ALERT_VOLUME_SETTING));
  const volume = Math.max(0, Math.min(1, (Number.isFinite(volumeSetting) ? volumeSetting : 65) / 100));

  try {
    foundry.audio.AudioHelper.play({
      src,
      volume,
      autoplay: true,
      loop: false,
      channel: "interface"
    }, false);
    console.log(`[ZFT] 🔊 v${MODULE_VERSION} | Played raised-hand alert sound`);
  } catch (error) {
    console.error(`[ZFT] ❌ v${MODULE_VERSION} | Failed to play raised-hand alert sound`, error);
  }
}

export async function requestSetHandState(raised) {
  if (!requireSocket()) return false;
  return socket.executeAsGM("setHandState", game.user.id, Boolean(raised));
}

export async function requestClearUser(userId) {
  if (!game.user.isGM) return false;
  if (!requireSocket()) return false;
  return socket.executeAsGM("setHandState", userId, false);
}

export async function requestClearNext() {
  if (!game.user.isGM) return false;
  if (!requireSocket()) return false;
  return socket.executeAsGM("clearNext");
}

export async function requestClearAll() {
  if (!game.user.isGM) return false;
  if (!requireSocket()) return false;
  return socket.executeAsGM("clearAll");
}
