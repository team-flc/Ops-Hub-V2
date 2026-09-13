import { ClientRecord } from '../types';

export const CLIENT_STORAGE_KEY_PREFIX = 'ops_hub_selected_client_';

/**
 * Returns the storage key scoped to a specific authenticated user.
 */
export function getUserClientStorageKey(userId: string): string {
  return `${CLIENT_STORAGE_KEY_PREFIX}${userId}`;
}

/**
 * Reads the remembered client ID for a specific user from localStorage.
 */
export function getStoredSelectedClientId(userId?: string | null): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(getUserClientStorageKey(userId));
  } catch {
    return null;
  }
}

/**
 * Saves the selected client ID for a specific user to localStorage.
 */
export function setStoredSelectedClientId(userId?: string | null, clientId?: string | null): void {
  if (!userId || !clientId) return;
  try {
    localStorage.setItem(getUserClientStorageKey(userId), clientId);
  } catch {
    // Gracefully handle storage quota or privacy mode restrictions
  }
}

/**
 * Clears the remembered client ID for a user.
 */
export function clearStoredSelectedClientId(userId?: string | null): void {
  if (!userId) return;
  try {
    localStorage.removeItem(getUserClientStorageKey(userId));
  } catch {
    // Gracefully handle storage restrictions
  }
}

export interface ResolveSelectedClientOptions {
  clients: ClientRecord[];
  userId?: string | null;
  routeClientId?: string | null;
  currentSelectedId?: string | null;
}

/**
 * Resolves the selected client according to strict priority:
 * 1. Valid `/clients/:clientId` route param that exists in the accessible `clients` array.
 * 2. User's remembered accessible client (scoped to user.id in localStorage) if present in `clients` and not archived.
 * 3. Currently selected client in memory if present in `clients` and not archived.
 * 4. First accessible active client (`status !== 'Archived'`) or first accessible client as safe fallback.
 */
export function resolveSelectedClientId({
  clients,
  userId,
  routeClientId,
  currentSelectedId
}: ResolveSelectedClientOptions): string | null {
  if (!clients || clients.length === 0) return null;

  // Priority 1: Route param clientId (if valid and accessible)
  if (routeClientId) {
    const routeClient = clients.find((c) => c.id === routeClientId);
    if (routeClient) {
      return routeClient.id;
    }
  }

  // Priority 2: User's remembered accessible client (from user-scoped localStorage)
  if (userId) {
    const rememberedId = getStoredSelectedClientId(userId);
    if (rememberedId) {
      const rememberedClient = clients.find((c) => c.id === rememberedId);
      if (rememberedClient && rememberedClient.status !== 'Archived') {
        return rememberedClient.id;
      }
    }
  }

  // Priority 3: Current in-memory selected client (if valid and active)
  if (currentSelectedId) {
    const currentClient = clients.find((c) => c.id === currentSelectedId);
    if (currentClient && currentClient.status !== 'Archived') {
      return currentClient.id;
    }
  }

  // Priority 4: First active accessible client fallback (or first client if all archived)
  const firstActive = clients.find((c) => c.status !== 'Archived');
  return firstActive ? firstActive.id : clients[0].id;
}
