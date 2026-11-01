/**
 * Running inside another site's frame (a game portal such as CrazyGames).
 * Portals handle full screen and rotation themselves and don't allow our own
 * sign-in, so those stay off there. On the game's own site this is false.
 */
export const embedded: boolean = (() => {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin parent blocks the check: that's a frame too.
    return true;
  }
})();
