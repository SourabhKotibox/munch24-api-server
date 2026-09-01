/**
 * Shared runtime configuration — read from environment variables.
 *
 * This is the single source of truth for API_URL / BASE_URL.
 * All controllers that build shareUrl, deeplinks, or absolute URLs
 * must import from here instead of duplicating the constant.
 *
 * Set API_URL in .env to your production server:
 *   API_URL=https://flipshorts.app/api
 */

/** Base API URL — strips trailing slash for consistency */
export const API_URL = (process.env.API_URL || 'https://flipshorts.app/api').replace(/\/$/, '');

/**
 * Build a smart share / deep-link URL for a content item.
 * Points to the backend redirect endpoint which resolves to the app or store.
 *
 * Example output: https://flipshorts.app/api/share/64abc123...
 */
export const buildShareUrl = (itemId: string): string =>
  `${API_URL}/share/${itemId}`;
