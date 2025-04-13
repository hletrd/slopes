document.addEventListener('DOMContentLoaded', function() {
  const addToHomeButton = document.getElementById('addToHomeButton');
  const installationModal = document.getElementById('installationModal');
  const closeModal = document.getElementById('closeModal');
  const iOSInstructions = document.getElementById('iOSInstructions');
  const androidInstructions = document.getElementById('androidInstructions');
  let deferredPrompt;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone || document.referrer.includes('android-app://');

  if (isIOS) {
    iOSInstructions.style.display = 'block';
    androidInstructions.style.display = 'none';
  } else {
    iOSInstructions.style.display = 'none';
    androidInstructions.style.display = 'block';
  }

  if ((isIOS || /Android/.test(navigator.userAgent)) && !isStandalone) {
    addToHomeButton.style.display = 'flex';
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    addToHomeButton.style.display = 'flex';
  });

  addToHomeButton.addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
          addToHomeButton.style.display = 'none';
        }
        deferredPrompt = null;
      });
    } else {
      installationModal.style.display = 'block';
    }
  });

  closeModal.addEventListener('click', () => {
    installationModal.style.display = 'none';
  });

  window.addEventListener('appinstalled', (evt) => {
    addToHomeButton.style.display = 'none';
  });

  const infoButton = document.getElementById('infoButton');
  const infoModal = document.getElementById('infoModal');
  const closeInfoModal = document.getElementById('closeInfoModal');

  infoButton.addEventListener('click', () => {
    infoModal.style.display = 'flex';
  });

  closeInfoModal.addEventListener('click', () => {
    infoModal.style.display = 'none';
  });

  infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) {
      infoModal.style.display = 'none';
    }
  });

  if ('serviceWorker' in navigator) {
    function checkForUpdates() {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) {
          registration.update()
            .then(() => {
              console.log('Service worker updated');
            })
            .catch(err => {
              console.error('Service worker update failed:', err);
            });
        }
      });
    }

    function activateUpdate() {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('Service worker updated, reloading page');
        window.location.reload();
      }
    });

    checkForUpdates();
    setInterval(checkForUpdates, 60 * 60 * 1000);

    if (isStandalone) {
      const createUpdateNotification = () => {
        const notificationContainer = document.createElement('div');
        notificationContainer.className = 'update-notification';
        notificationContainer.style.cssText = `
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #4CAF50;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-width: 250px;
          font-size: 14px;
        `;

        const message = document.createElement('span');
        message.textContent = '업데이트가 준비되었습니다.';

        const updateButton = document.createElement('button');
        updateButton.textContent = '지금 적용';
        updateButton.style.cssText = `
          background-color: white;
          color: #4CAF50;
          border: none;
          padding: 5px 10px;
          border-radius: 4px;
          margin-left: 10px;
          cursor: pointer;
        `;

        updateButton.addEventListener('click', () => {
          activateUpdate();
          notificationContainer.remove();
        });

        notificationContainer.appendChild(message);
        notificationContainer.appendChild(updateButton);
        document.body.appendChild(notificationContainer);
      };

      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) {
          if (registration.waiting) {
            createUpdateNotification();
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                createUpdateNotification();
              }
            });
          });
        }
      });
    }
  }
});