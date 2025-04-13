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
});