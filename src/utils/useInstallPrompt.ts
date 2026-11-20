import { useCallback, useEffect, useState } from 'react';

/**
 * Native PWA install experience.
 *
 * Chrome / Edge / Samsung Internet fire `beforeinstallprompt`, which we capture
 * and replay on demand. iOS Safari has no such event — there the only path is
 * Share → "Add to Home Screen", so we detect iOS and show that hint instead.
 *
 * The banner is never shown when the app already runs standalone (installed).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface InstallPromptState {
  /** True when a native install prompt is available (Chromium). */
  canInstall: boolean;
  /** True on iOS Safari, where the user must use Share → Add to Home Screen. */
  isIos: boolean;
  /** True when the app is already running as an installed PWA. */
  isStandalone: boolean;
  /** True when the install banner should be visible. */
  visible: boolean;
  /** Triggers the native install dialog (Chromium only). */
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** Hides the banner for this session. */
  dismiss: () => void;
}

const isIosDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports itself as a Mac with touch support.
  const isIpadOs = /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || isIpadOs;
};

const isStandaloneMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || window.matchMedia?.('(display-mode: window-controls-overlay)').matches === true
    || iosStandalone;
};

export const useInstallPrompt = (): InstallPromptState => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());
  const [isIos, setIsIos] = useState(() => isIosDevice());

  useEffect(() => {
    setIsIos(isIosDevice());
    setIsStandalone(isStandaloneMode());

    const onBeforeInstallPrompt = (event: Event) => {
      // Suppress Chrome's mini-infobar — we render our own native banner.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') setDismissed(true);
      setDeferredPrompt(null);
      return choice.outcome;
    } catch {
      setDeferredPrompt(null);
      return 'dismissed';
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => setDismissed(true), []);

  const visible = !dismissed && !isStandalone && (Boolean(deferredPrompt) || isIos);

  return {
    canInstall: Boolean(deferredPrompt),
    isIos,
    isStandalone,
    visible,
    install,
    dismiss,
  };
};
