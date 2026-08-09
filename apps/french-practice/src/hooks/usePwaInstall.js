import { useEffect, useState } from 'react';

// Wraps the PWA install flow. Chromium fires `beforeinstallprompt`, which we
// stash so an in-app button can trigger the native install dialog on demand.
// iOS Safari never fires it — there, installing is manual (Share → Add to
// Home Screen), so we detect the platform and surface instructions instead.

const isStandalone = () =>
  (typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)) || false;

const isIOS = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

export default function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPromptEvent(e); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!promptEvent) return null;
    promptEvent.prompt();
    let outcome = null;
    try { ({ outcome } = await promptEvent.userChoice); } catch { /* dismissed */ }
    setPromptEvent(null);
    return outcome;
  };

  return {
    installed,
    canInstall: Boolean(promptEvent) && !installed,
    iosInstall: isIOS() && !installed && !promptEvent, // needs manual steps
    promptInstall,
  };
}
