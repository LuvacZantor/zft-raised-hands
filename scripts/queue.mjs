import { MODULE_ID, MODULE_VERSION, QUEUE_SETTING } from "./constants.mjs";

let mutationChain = Promise.resolve();

export function getQueue() {
  const raw = game.settings.get(MODULE_ID, QUEUE_SETTING) ?? {};
  const entries = Array.isArray(raw.entries) ? raw.entries : [];

  return {
    entries: entries
      .filter(entry => entry?.userId && Number.isFinite(Number(entry.raisedAt)))
      .map(entry => ({
        userId: String(entry.userId),
        raisedAt: Number(entry.raisedAt)
      }))
      .sort((a, b) => a.raisedAt - b.raisedAt)
  };
}

export function getQueueEntries() {
  return getQueue().entries;
}

export function isUserRaised(userId) {
  if (!userId) return false;
  return getQueueEntries().some(entry => entry.userId === userId);
}

function serializeMutation(work) {
  const run = mutationChain.then(work, work);
  mutationChain = run.catch(() => undefined);
  return run;
}

async function writeEntries(entries) {
  const normalized = [...entries]
    .filter(entry => entry?.userId && Number.isFinite(Number(entry.raisedAt)))
    .map(entry => ({
      userId: String(entry.userId),
      raisedAt: Number(entry.raisedAt)
    }))
    .sort((a, b) => a.raisedAt - b.raisedAt);

  await game.settings.set(MODULE_ID, QUEUE_SETTING, { entries: normalized });
}

export function setUserRaisedAuthoritative(userId, raised) {
  return serializeMutation(async () => {
    if (!game.user.isGM) {
      console.warn(`[ZFT] ⚠️ v${MODULE_VERSION} | Rejected authoritative queue mutation from non-GM client`);
      return { changed: false, raised: false };
    }

    const user = game.users.get(userId);
    if (!user) {
      console.warn(`[ZFT] ⚠️ v${MODULE_VERSION} | Cannot update raised hand; user ${userId} was not found`);
      return { changed: false, raised: false };
    }

    const entries = getQueueEntries();
    const existingIndex = entries.findIndex(entry => entry.userId === userId);
    const currentlyRaised = existingIndex !== -1;

    if (Boolean(raised) === currentlyRaised) {
      return { changed: false, raised: currentlyRaised };
    }

    if (raised) {
      entries.push({ userId, raisedAt: Date.now() });
    } else {
      entries.splice(existingIndex, 1);
    }

    await writeEntries(entries);
    console.log(`[ZFT] ✅ v${MODULE_VERSION} | ${raised ? "Raised" : "Lowered"} hand for ${user.name} (${userId})`);
    return { changed: true, raised: Boolean(raised) };
  });
}

export function clearNextAuthoritative() {
  return serializeMutation(async () => {
    if (!game.user.isGM) return false;

    const entries = getQueueEntries();
    if (!entries.length) return false;

    const [removed] = entries.splice(0, 1);
    await writeEntries(entries);
    console.log(`[ZFT] 🧹 v${MODULE_VERSION} | Cleared next raised hand (${removed.userId})`);
    return true;
  });
}

export function clearAllAuthoritative() {
  return serializeMutation(async () => {
    if (!game.user.isGM) return false;

    const entries = getQueueEntries();
    if (!entries.length) return false;

    await writeEntries([]);
    console.log(`[ZFT] 🧹 v${MODULE_VERSION} | Cleared all raised hands`);
    return true;
  });
}
