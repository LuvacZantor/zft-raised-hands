import {
  MODULE_VERSION,
  PARTY_HUD_MODULE_ID,
  PARTY_HUD_HAND_FLAG
} from "./constants.mjs";
import {
  getQueueEntries,
  getQueueEntry,
  setUserRaisedAuthoritative
} from "./queue.mjs";
import { requestSetUserHandState } from "./socket.mjs";

let hooksRegistered = false;
let reconciling = false;
let syncChain = Promise.resolve();

export async function initializePartyHudIntegration() {
  if (!isPartyHudActive()) return false;

  if (!hooksRegistered) {
    Hooks.on("updateActor", onPartyHudActorUpdate);
    Hooks.on("userConnected", onUserConnected);
    hooksRegistered = true;
  }

  const partyHudVersion = game.modules.get(PARTY_HUD_MODULE_ID)?.version ?? "unknown";
  console.log(`[ZFT] 🤝 v${MODULE_VERSION} | Party HUD integration enabled (Party HUD ${partyHudVersion})`);

  if (isBridgeAuthority()) await reconcilePartyHudOnStartup();
  return true;
}

export function syncPartyHudFromQueue() {
  if (reconciling || !isPartyHudActive() || !isBridgeAuthority()) return Promise.resolve(false);

  const run = syncChain.then(syncPartyHudFromQueueInternal, syncPartyHudFromQueueInternal);
  syncChain = run.catch(() => undefined);
  return run;
}

async function reconcilePartyHudOnStartup() {
  reconciling = true;

  try {
    for (const { user, actor } of getUniquePartyHudAssignments()) {
      const queueEntry = getQueueEntry(user.id);
      const partyHudRaisedAt = normalizeRaisedAt(actor.getFlag(PARTY_HUD_MODULE_ID, PARTY_HUD_HAND_FLAG));

      if (queueEntry) {
        if (partyHudRaisedAt !== queueEntry.raisedAt) {
          await actor.setFlag(PARTY_HUD_MODULE_ID, PARTY_HUD_HAND_FLAG, queueEntry.raisedAt);
        }
        continue;
      }

      if (partyHudRaisedAt !== null) {
        await setUserRaisedAuthoritative(user.id, true, partyHudRaisedAt);
        console.log(`[ZFT] 🤝 v${MODULE_VERSION} | Adopted existing Party HUD hand for ${user.name} (${user.id})`);
      }
    }
  } finally {
    reconciling = false;
  }

  renderPartyHud();
  await syncPartyHudFromQueue();
}

async function syncPartyHudFromQueueInternal() {
  const entries = new Map(getQueueEntries().map(entry => [entry.userId, entry]));
  const assignments = getUniquePartyHudAssignments();
  let changed = false;

  for (const { user, actor } of assignments) {
    const entry = entries.get(user.id) ?? null;
    const expectedRaisedAt = entry?.raisedAt ?? null;
    const currentRaisedAt = normalizeRaisedAt(actor.getFlag(PARTY_HUD_MODULE_ID, PARTY_HUD_HAND_FLAG));

    if (expectedRaisedAt === null) {
      if (currentRaisedAt !== null) {
        await actor.unsetFlag(PARTY_HUD_MODULE_ID, PARTY_HUD_HAND_FLAG);
        changed = true;
        console.log(`[ZFT] 🤝 v${MODULE_VERSION} | Cleared Party HUD hand for ${user.name} (${user.id})`);
      }
      continue;
    }

    if (currentRaisedAt !== expectedRaisedAt) {
      await actor.setFlag(PARTY_HUD_MODULE_ID, PARTY_HUD_HAND_FLAG, expectedRaisedAt);
      changed = true;
      console.log(`[ZFT] 🤝 v${MODULE_VERSION} | Mirrored raised hand to Party HUD for ${user.name} (${user.id})`);
    }
  }

  if (changed) renderPartyHud();
  return changed;
}

async function onPartyHudActorUpdate(actor, changes, _options, updateUserId) {
  if (reconciling || !isPartyHudActive() || !isBridgeAuthority()) return;

  const handChange = extractPartyHudHandChange(changes);
  if (!handChange.touched) return;

  const user = resolveUniquePartyHudUser(actor);
  if (!user) return;

  const queueEntry = getQueueEntry(user.id);
  const updateUser = updateUserId ? game.users.get(updateUserId) : null;

  if (updateUser && !updateUser.isGM && updateUser.id !== user.id) {
    console.warn(
      `[ZFT] ⚠️ v${MODULE_VERSION} | Ignored Party HUD hand change for ${user.name} (${user.id}) from non-owner user ${updateUser.name} (${updateUser.id})`
    );
    await restorePartyHudActorFromQueue(actor, queueEntry);
    return;
  }

  if (handChange.raisedAt !== null) {
    if (queueEntry) {
      const currentRaisedAt = normalizeRaisedAt(actor.getFlag(PARTY_HUD_MODULE_ID, PARTY_HUD_HAND_FLAG));
      if (currentRaisedAt !== queueEntry.raisedAt) {
        await actor.setFlag(PARTY_HUD_MODULE_ID, PARTY_HUD_HAND_FLAG, queueEntry.raisedAt);
      }
      return;
    }

    console.log(`[ZFT] 🤝 v${MODULE_VERSION} | Party HUD raised hand detected for ${user.name} (${user.id})`);
    await requestSetUserHandState(user.id, true, handChange.raisedAt);
    return;
  }

  if (!queueEntry) return;

  console.log(`[ZFT] 🤝 v${MODULE_VERSION} | Party HUD lowered hand detected for ${user.name} (${user.id})`);
  await requestSetUserHandState(user.id, false, null);
}

async function restorePartyHudActorFromQueue(actor, queueEntry) {
  const expectedRaisedAt = queueEntry?.raisedAt ?? null;
  const currentRaisedAt = normalizeRaisedAt(actor.getFlag(PARTY_HUD_MODULE_ID, PARTY_HUD_HAND_FLAG));

  if (expectedRaisedAt === null) {
    if (currentRaisedAt !== null) await actor.unsetFlag(PARTY_HUD_MODULE_ID, PARTY_HUD_HAND_FLAG);
  } else if (currentRaisedAt !== expectedRaisedAt) {
    await actor.setFlag(PARTY_HUD_MODULE_ID, PARTY_HUD_HAND_FLAG, expectedRaisedAt);
  }

  renderPartyHud();
}

function onUserConnected() {
  if (!isPartyHudActive() || !isBridgeAuthority()) return;
  void syncPartyHudFromQueue();
}

function isPartyHudActive() {
  return game.modules.get(PARTY_HUD_MODULE_ID)?.active === true;
}

function isBridgeAuthority() {
  if (!game.user?.isGM || !game.user.active) return false;

  const activeGms = Array.from(game.users)
    .filter(user => user?.isGM && user.active)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return activeGms[0]?.id === game.user.id;
}

function getUniquePartyHudAssignments() {
  const byActorId = new Map();

  for (const user of Array.from(game.users)) {
    if (!user || user.isGM || !user.character) continue;

    const actorId = user.character.id;
    if (!byActorId.has(actorId)) byActorId.set(actorId, []);
    byActorId.get(actorId).push({ user, actor: user.character });
  }

  const assignments = [];
  for (const matches of byActorId.values()) {
    if (matches.length === 1) {
      assignments.push(matches[0]);
      continue;
    }

    const actor = matches[0]?.actor;
    console.warn(
      `[ZFT] ⚠️ v${MODULE_VERSION} | Party HUD integration skipped Actor ${actor?.name ?? actor?.id ?? "unknown"}; multiple non-GM users share the same assigned character`
    );
  }

  return assignments;
}

function resolveUniquePartyHudUser(actor) {
  if (!actor?.id) return null;

  const matches = Array.from(game.users).filter(user =>
    user && !user.isGM && user.character?.id === actor.id
  );

  if (matches.length === 1) return matches[0];

  if (matches.length > 1) {
    console.warn(
      `[ZFT] ⚠️ v${MODULE_VERSION} | Party HUD hand change ignored for ${actor.name ?? actor.id}; multiple non-GM users share this assigned character`
    );
  }

  return null;
}

function extractPartyHudHandChange(changes) {
  if (!changes || typeof changes !== "object") return { touched: false, raisedAt: null };

  let flattened;
  try {
    flattened = foundry.utils.flattenObject(changes);
  } catch (_error) {
    flattened = changes;
  }

  const raisedKey = `flags.${PARTY_HUD_MODULE_ID}.${PARTY_HUD_HAND_FLAG}`;
  const removedKey = `flags.${PARTY_HUD_MODULE_ID}.-=${PARTY_HUD_HAND_FLAG}`;

  if (Object.prototype.hasOwnProperty.call(flattened, removedKey)) {
    return { touched: true, raisedAt: null };
  }

  if (Object.prototype.hasOwnProperty.call(flattened, raisedKey)) {
    return {
      touched: true,
      raisedAt: normalizeRaisedAt(flattened[raisedKey])
    };
  }

  return { touched: false, raisedAt: null };
}

function renderPartyHud() {
  try {
    ui.partyMonitorDock?.render?.(true);
  } catch (error) {
    console.warn(`[ZFT] ⚠️ v${MODULE_VERSION} | Failed to refresh Party HUD after hand synchronization`, error);
  }
}

function normalizeRaisedAt(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}
