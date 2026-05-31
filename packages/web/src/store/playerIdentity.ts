const PLAYER_IDENTITY_KEY = "datacenter-tycoon:player-identity-v1";

export interface StoredPlayerIdentity {
  playerId: string;
  username: string;
}

export function getStoredPlayerIdentity(): StoredPlayerIdentity | null {
  try {
    const raw = localStorage.getItem(PLAYER_IDENTITY_KEY);

    if (!raw) {
      return null;
    }

    return parseStoredPlayerIdentity(JSON.parse(raw) as Partial<StoredPlayerIdentity>);
  } catch {
    return null;
  }
}

export function writeStoredPlayerIdentity(identity: StoredPlayerIdentity): void {
  const normalizedIdentity = parseStoredPlayerIdentity(identity);

  if (!normalizedIdentity) {
    throw new Error("Stored player identity must include non-empty playerId and username strings.");
  }

  localStorage.setItem(PLAYER_IDENTITY_KEY, JSON.stringify(normalizedIdentity));
}

export function clearStoredPlayerIdentity(): void {
  localStorage.removeItem(PLAYER_IDENTITY_KEY);
}

function parseStoredPlayerIdentity(
  identity: Partial<StoredPlayerIdentity>,
): StoredPlayerIdentity | null {
  if (typeof identity.playerId !== "string" || typeof identity.username !== "string") {
    return null;
  }

  const playerId = identity.playerId.trim();
  const username = identity.username.trim();

  if (!playerId || !username) {
    return null;
  }

  return {
    playerId,
    username,
  };
}
