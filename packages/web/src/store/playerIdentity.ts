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

    const parsed = JSON.parse(raw) as Partial<StoredPlayerIdentity>;

    if (typeof parsed.playerId !== "string" || typeof parsed.username !== "string") {
      return null;
    }

    return {
      playerId: parsed.playerId,
      username: parsed.username,
    };
  } catch {
    return null;
  }
}

export function writeStoredPlayerIdentity(identity: StoredPlayerIdentity): void {
  localStorage.setItem(PLAYER_IDENTITY_KEY, JSON.stringify(identity));
}

export function clearStoredPlayerIdentity(): void {
  localStorage.removeItem(PLAYER_IDENTITY_KEY);
}
