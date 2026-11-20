import { useCallback, useEffect, useRef } from 'react';

/**
 * Hardware (Android) back-button support for modal overlays.
 *
 * Android's back gesture dispatches `popstate` after the browser has already
 * popped a history entry. To make the back button close the *active overlay*
 * instead of leaving the app, the overlay stack owns **exactly one sentinel
 * history entry**:
 *
 * • stack empty → non-empty  : `pushState` a sentinel (history depth +1)
 * • stack non-empty → empty  : `history.back()` pops the sentinel (depth −1)
 * • stack changes, stays open : `replaceState` the sentinel (depth unchanged)
 *
 * When the browser's back gesture pops the sentinel, the `popstate` handler
 * closes the top-most overlay. If overlays remain open underneath, a fresh
 * sentinel is pushed so a second back press closes the next one instead of
 * leaving the application.
 */
export interface BackButtonController {
  /** Register an overlay that has just opened. */
  registerOpen: (id: string) => void;
  /** Register an overlay that closed itself. */
  registerClose: (id: string) => void;
}

const SENTINEL_STATE = { albasarOverlay: true };

export const useHardwareBackButton = (
  closeOverlay: (id: string) => void,
): BackButtonController => {
  const stackRef = useRef<string[]>([]);
  const skipNextPopRef = useRef(false);
  const closeOverlayRef = useRef(closeOverlay);

  useEffect(() => { closeOverlayRef.current = closeOverlay; }, [closeOverlay]);

  useEffect(() => {
    const handlePopState = () => {
      if (skipNextPopRef.current) {
        skipNextPopRef.current = false;
        return;
      }
      const stack = stackRef.current;
      const top = stack[stack.length - 1];
      if (!top) return;

      // The browser consumed our sentinel — drop the top overlay from the
      // stack and close it. History is not touched again here.
      stackRef.current = stack.slice(0, -1);
      closeOverlayRef.current(top);

      // Overlays may still be open underneath — re-arm the sentinel so the
      // next back press closes the next one instead of leaving the app.
      if (stackRef.current.length > 0) {
        try {
          window.history.pushState(SENTINEL_STATE, '');
        } catch {
          // History API unavailable — the overlay still closes, only the
          // gesture for the remaining overlays is degraded.
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const registerOpen = useCallback((id: string) => {
    if (!id) return;
    const stack = stackRef.current;
    if (stack.includes(id)) return;
    stackRef.current = [...stack, id];
    try {
      if (stack.length === 0) {
        // First overlay — claim a dedicated history entry.
        window.history.pushState(SENTINEL_STATE, '');
      } else {
        // Another overlay joined the stack — keep the depth unchanged.
        window.history.replaceState(SENTINEL_STATE, '');
      }
    } catch {
      // History API unavailable — the overlay still works.
    }
  }, []);

  const registerClose = useCallback((id: string) => {
    const stack = stackRef.current;
    const index = stack.lastIndexOf(id);
    if (index < 0) return;
    stackRef.current = stack.filter((_, i) => i !== index);
    if (stackRef.current.length > 0) {
      // Overlays remain open — keep the sentinel in place.
      try {
        window.history.replaceState(SENTINEL_STATE, '');
      } catch {
        // Ignore.
      }
      return;
    }
    // Last overlay closed — release the history entry we claimed.
    skipNextPopRef.current = true;
    try {
      window.history.back();
    } catch {
      skipNextPopRef.current = false;
    }
  }, []);

  return { registerOpen, registerClose };
};
