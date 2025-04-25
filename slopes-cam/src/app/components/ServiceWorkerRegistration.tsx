'use client';

import { useEffect, useState } from 'react';

const ServiceWorkerRegistration = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js?v=4', {
        scope: '/'
      }).then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);

        // Check for updates periodically
        const checkForUpdates = () => {
          registration.update()
            .then(() => {
              console.log('Service worker checked for updates');
            })
            .catch(err => {
              console.error('Service worker update failed:', err);
            });
        };

        // Check for existing waiting service worker
        if (registration.waiting) {
          setUpdateAvailable(true);
        }

        // Listen for new updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });

        // Check for updates every hour
        checkForUpdates();
        const intervalId = setInterval(checkForUpdates, 60 * 60 * 1000);

        return () => clearInterval(intervalId);
      }).catch(error => {
        console.error('Service Worker registration failed:', error);
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('Service worker updated, reloading page');
          window.location.reload();
        }
      });
    }
  }, []);

  const activateUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
    setUpdateAvailable(false);
  };

  return (
    <>
      {updateAvailable && (
        <div className="update-notification" style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#4CAF50',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minWidth: '250px',
          fontSize: '14px'
        }}>
          <span>업데이트가 준비되었습니다.</span>
          <button
            onClick={activateUpdate}
            style={{
              backgroundColor: 'white',
              color: '#4CAF50',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '4px',
              marginLeft: '10px',
              cursor: 'pointer'
            }}
          >
            지금 적용
          </button>
        </div>
      )}
    </>
  );
};

export default ServiceWorkerRegistration;