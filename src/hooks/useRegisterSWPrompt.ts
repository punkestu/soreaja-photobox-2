import { useRegisterSW } from 'virtual:pwa-register/react';

export function useRegisterSWPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, r) {
      console.log('Service Worker registered via useRegisterSW:', swUrl, r);
    },
    onRegisterError(error) {
      console.error('Service Worker registration failed:', error);
    },
  });

  return {
    offlineReady,
    setOfflineReady,
    needRefresh,
    setNeedRefresh,
    updateServiceWorker,
  };
}
