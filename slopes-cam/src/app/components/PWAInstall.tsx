'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                              (window.navigator as any).standalone ||
                              document.referrer.includes('android-app://');
    setIsStandalone(isInStandaloneMode);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        setDeferredPrompt(null);
      });
    } else {
      setShowModal(true);
    }
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const shouldShowInstallButton = (isIOS || /Android/.test(navigator.userAgent)) && !isStandalone;

  if (!shouldShowInstallButton) {
    return null;
  }

  return (
    <>
      <button id="addToHomeButton" className="add-to-home" onClick={handleInstallClick}>
        <i className="bi bi-plus-square"></i>
      </button>

      {showModal && (
        <div id="installationModal" className="installation-modal active">
          <button className="modal-close" id="closeModal" onClick={closeModal}>
            <i className="bi bi-x"></i>
          </button>
          <h4>홈 화면에 추가하기</h4>

          {isIOS && (
            <div id="iOSInstructions" className="installation-steps">
              <p>iOS 기기에서 홈 화면에 추가하는 방법:</p>
              <ol>
                <li>Safari 하단의 공유 버튼을 탭하세요 <i className="bi bi-box-arrow-up"></i></li>
                <li>&quot;홈 화면에 추가&quot;를 선택하세요</li>
                <li>&quot;추가&quot;를 탭하세요</li>
              </ol>
            </div>
          )}

          {!isIOS && (
            <div id="androidInstructions" className="installation-steps">
              <p>Android 기기에서 홈 화면에 추가하는 방법:</p>
              <ol>
                <li>브라우저 메뉴 버튼을 탭하세요 (⋮)</li>
                <li>&quot;홈 화면에 추가&quot;를 선택하세요</li>
                <li>&quot;추가&quot;를 탭하세요</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PWAInstall;