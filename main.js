if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    } else {
      navigator.serviceWorker.register('./service-worker.js')
        .then(function (registration) {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch(function (error) {
          console.log('ServiceWorker registration failed: ', error);
        });
    }
  });
}

document.addEventListener('DOMContentLoaded', async function () {
  await i18n.init();

  const t = (key, params) => i18n.t(key, params);
  const getResortName = (resort) => i18n.getResortName(resort.id, resort.name);
  const getWebcamName = (resort, webcamIndex, defaultName) => i18n.getWebcamName(resort.id, webcamIndex, defaultName);

  const toggleMenu = document.querySelector('.toggle-menu');
  const sidebar = document.querySelector('.sidebar');
  const sidebarBackdrop = document.querySelector('.sidebar-backdrop');
  const mainContent = document.querySelector('.main-content');
  const basicTitle = t('site.title');
  let activePlayers = [];
  let activeVivaldiPlayers = []; // Track Vivaldi iframes for concurrent stream management
  let quadPlayers = [null, null, null, null];
  let activeResort = null;
  let activeWebcam = null;
  let data = [];
  let weatherData = [];
  let isMobile = window.innerWidth <= 768;
  let favorites = loadFavorites();
  let settings = loadSettings();
  let quadSelections = loadQuadState();

  function loadSettings() {
    try {
      const settingsData = localStorage.getItem('webcamSettings');
      if (settingsData) {
        const parsed = JSON.parse(settingsData);
        if (typeof parsed.autoplay === 'undefined') {
          parsed.autoplay = !isMobile;
        }
        if (typeof parsed.darkMode === 'undefined') {
          parsed.darkMode = true;
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }

    return {
      autoplay: !isMobile, // Default: enabled on desktop, disabled on mobile
      darkMode: true,
      quadViewOpen: false
    };
  }

  function saveSettings() {
    try {
      localStorage.setItem('webcamSettings', JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  }

  function loadQuadState() {
    try {
      const stored = localStorage.getItem('quadViewSelections');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          while (parsed.length < 4) parsed.push('');
          return parsed.slice(0, 4).map(item => (typeof item === 'string' ? item : ''));
        }
      }
    } catch (e) {
      console.error('Error loading quad selections:', e);
    }
    return ['', '', '', ''];
  }

  function saveQuadState() {
    try {
      localStorage.setItem('quadViewSelections', JSON.stringify(quadSelections));
    } catch (e) {
      console.error('Error saving quad selections:', e);
    }
  }

  function applyTheme() {
    if (settings.darkMode === false) {
      document.body.classList.add('light-mode');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.body.classList.remove('light-mode');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    updateQuadPageTheme();
  }

  const settingsButton = document.getElementById('settingsButton');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsModal = document.getElementById('closeSettingsModal');
  const autoplayToggle = document.getElementById('autoplayToggle');
  const themeToggle = document.getElementById('themeToggle');

  applyTheme();
  autoplayToggle.checked = settings.autoplay;
  if (themeToggle) {
    themeToggle.checked = settings.darkMode !== false;
  }

  autoplayToggle.addEventListener('change', function () {
    settings.autoplay = this.checked;
    saveSettings();
  });

  if (themeToggle) {
    themeToggle.addEventListener('change', function () {
      settings.darkMode = this.checked;
      applyTheme();
      saveSettings();
    });
  }

  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.value = i18n.getLanguage();
    languageSelect.addEventListener('change', async function () {
      await i18n.setLanguage(this.value);
      document.documentElement.lang = this.value;
      window.location.reload();
    });
  }

  settingsButton.addEventListener('click', function () {
    settingsModal.style.display = 'block';
  });

  closeSettingsModal.addEventListener('click', function () {
    settingsModal.style.display = 'none';
  });

  window.addEventListener('click', function (event) {
    if (event.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });

  const infoButton = document.getElementById('infoButton');
  const infoModal = document.getElementById('infoModal');
  const closeInfoModal = document.getElementById('closeInfoModal');

  infoButton.addEventListener('click', function () {
    infoModal.style.display = 'flex';
  });

  closeInfoModal.addEventListener('click', function () {
    infoModal.style.display = 'none';
  });

  window.addEventListener('click', function (event) {
    if (event.target === infoModal) {
      infoModal.style.display = 'none';
    }
  });

  const addToHomeButton = document.getElementById('addToHomeButton');
  const installationModal = document.getElementById('installationModal');
  const closeModal = document.getElementById('closeModal');
  const quadViewButton = document.getElementById('quadViewButton');
  const quadViewContainer = document.getElementById('quadViewContainer');
  const quadBackButton = document.getElementById('quadBackButton');
  const quadSelects = Array.from(document.querySelectorAll('.quad-select'));
  const quadVideoContainers = Array.from(document.querySelectorAll('.quad-video'));

  addToHomeButton.addEventListener('click', function () {
    installationModal.style.display = 'block';
    setTimeout(function () {
      installationModal.classList.add('active');
    }, 10);
  });

  closeModal.addEventListener('click', function () {
    installationModal.classList.remove('active');
    setTimeout(function () {
      installationModal.style.display = 'none';
    }, 400);
  });

  installationModal.addEventListener('click', function (event) {
    if (event.target === installationModal) {
      closeModal.click();
    }
  });

  function disposeQuadPlayers() {
    quadPlayers.forEach((player, idx) => {
      if (player && typeof player.dispose === 'function') {
        try {
          player.dispose();
        } catch (e) {
          console.error('Error disposing quad player', e);
        }
      }
      quadPlayers[idx] = null;
    });
    quadVideoContainers.forEach(container => {
      container.innerHTML = '';
    });
  }

  function loadQuadSlot(slotIndex, value, skipSave = false) {
    const container = quadVideoContainers[slotIndex];
    if (!container) return;

    if (quadPlayers[slotIndex] && typeof quadPlayers[slotIndex].dispose === 'function') {
      quadPlayers[slotIndex].dispose();
    }
    quadPlayers[slotIndex] = null;
    container.innerHTML = '';

    if (!value) {
      quadSelections[slotIndex] = '';
      if (!skipSave) {
        saveQuadState();
      }
      return;
    }

    const [resortId, webcamIndexStr] = value.split('||');
    const webcamIndex = parseInt(webcamIndexStr, 10);
    const resort = data.find(r => r.id === resortId);
    if (!resort || isNaN(webcamIndex)) return;

    const webcams = resort.links || resort.webcams || [];
    const webcam = webcams[webcamIndex];
    if (!webcam) return;

    const videoUrl = webcam.video || webcam.link;
    if (!videoUrl) return;

    const player = createVideoPlayer(videoUrl, container, `quad-${resortId}-${webcamIndex}`, webcam.video_type, true);
    if (player) {
      quadPlayers[slotIndex] = player;
    }
    quadSelections[slotIndex] = value;
    if (!skipSave) {
      saveQuadState();
    }
  }

  function updateQuadPageTheme() {
    const quadPage = document.getElementById('quadViewPage');
    if (!quadPage) return;
    if (settings.darkMode === false) {
      quadPage.classList.add('light-mode');
    } else {
      quadPage.classList.remove('light-mode');
    }
  }

  function populateQuadSelects() {
    if (!Array.isArray(data) || data.length === 0) return;
    if (window.quadSelectsInitialized) return;
    window.quadSelectsInitialized = true;

    const dropdowns = document.querySelectorAll('.custom-dropdown');

    // Close dropdowns when clicking outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('active'));
      }
    });

    dropdowns.forEach((dropdown, idx) => {
      const trigger = dropdown.querySelector('.dropdown-trigger');
      const menu = dropdown.querySelector('.dropdown-menu');
      const searchInput = dropdown.querySelector('.dropdown-search');
      const list = dropdown.querySelector('.dropdown-list');
      const slotIndex = parseInt(dropdown.getAttribute('data-slot'));

      // Toggle dropdown
      trigger.addEventListener('click', function () {
        const isActive = dropdown.classList.contains('active');
        // Close others
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('active'));

        if (!isActive) {
          dropdown.classList.add('active');
          searchInput.value = '';
          filterItems('');
          searchInput.focus();
        }
      });

      // Search functionality
      searchInput.addEventListener('input', function (e) {
        filterItems(e.target.value.toLowerCase());
      });

      function filterItems(query) {
        const items = list.querySelectorAll('.dropdown-item');
        const groups = list.querySelectorAll('.dropdown-group');

        groups.forEach(group => {
          let hasVisibleItems = false;
          const groupItems = group.querySelectorAll('.dropdown-item');

          groupItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(query)) {
              item.style.display = 'flex';
              hasVisibleItems = true;
            } else {
              item.style.display = 'none';
            }
          });

          const header = group.querySelector('.dropdown-group-header');
          if (header) {
            // Check if resort name matches
            if (header.textContent.toLowerCase().includes(query)) {
              groupItems.forEach(item => {
                item.style.display = 'flex';
                hasVisibleItems = true;
              });
            }
            header.style.display = hasVisibleItems ? 'block' : 'none';
          }
        });
      }

      // Populate list
      list.innerHTML = '';

      // Add "None" option
      const noneGroup = document.createElement('div');
      noneGroup.className = 'dropdown-group';
      const noneItem = document.createElement('div');
      noneItem.className = 'dropdown-item';
      noneItem.textContent = t('camera.none');
      noneItem.dataset.value = '';
      noneItem.addEventListener('click', () => selectItem('', t('camera.select')));
      noneGroup.appendChild(noneItem);
      list.appendChild(noneGroup);

      data.forEach(resort => {
        const webcams = resort.links || resort.webcams || [];
        if (webcams.length === 0) return;

        const group = document.createElement('div');
        group.className = 'dropdown-group';

        const header = document.createElement('div');
        header.className = 'dropdown-group-header';
        header.textContent = getResortName(resort);
        group.appendChild(header);

        webcams.forEach((webcam, webcamIndex) => {
          const videoUrl = webcam.video || webcam.link;
          if (!videoUrl) return;

          const item = document.createElement('div');
          item.className = 'dropdown-item';
          const webcamDisplayName = getWebcamName(resort, webcamIndex, webcam.name) || t('camera.default') + ` ${webcamIndex + 1}`;
          item.innerHTML = `<i class="bi bi-camera-video"></i> ${webcamDisplayName}`;
          item.dataset.value = `${resort.id}||${webcamIndex}`;

          item.addEventListener('click', () => {
            const label = `${getResortName(resort)} - ${webcamDisplayName}`;
            selectItem(item.dataset.value, label);
          });

          group.appendChild(item);
        });

        list.appendChild(group);
      });

      function selectItem(value, label) {
        trigger.textContent = label;
        dropdown.classList.remove('active');

        list.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
        const selectedItem = list.querySelector(`.dropdown-item[data-value="${value}"]`);
        if (selectedItem) selectedItem.classList.add('selected');

        loadQuadSlot(slotIndex, value);
      }

      const savedValue = quadSelections[idx] || '';
      if (savedValue) {
        const [rId, wIdx] = savedValue.split('||');
        const resort = data.find(r => r.id === rId);
        if (resort) {
          const webcams = resort.links || resort.webcams || [];
          const webcam = webcams[parseInt(wIdx)];
          if (webcam) {
            const webcamDisplayName = getWebcamName(resort, parseInt(wIdx), webcam.name) || t('camera.default') + ` ${parseInt(wIdx) + 1}`;
            const label = `${getResortName(resort)} - ${webcamDisplayName}`;
            trigger.textContent = label;
            // Mark as selected
            setTimeout(() => {
              const item = list.querySelector(`.dropdown-item[data-value="${savedValue}"]`);
              if (item) item.classList.add('selected');
            }, 0);
            loadQuadSlot(idx, savedValue, true);
          }
        }
      } else {
        loadQuadSlot(idx, '', true);
      }
    });
  }

  function openQuadView(setHash = false) {
    if (!quadViewContainer) return;
    quadViewContainer.classList.add('active');
    document.body.classList.add('quad-view-open');
    disposeAllPlayers();
    populateQuadSelects();
    updateQuadPageTheme();
    if (setHash) {
      window.location.hash = 'quad';
    }
    settings.quadViewOpen = true;
    saveSettings();
  }

  function closeQuadView(updateHash = false) {
    if (!quadViewContainer) return;
    quadViewContainer.classList.remove('active');
    document.body.classList.remove('quad-view-open');
    disposeQuadPlayers();
    if (updateHash && window.location.hash === '#quad') {
      window.location.hash = '';
    }
    settings.quadViewOpen = false;
    saveSettings();
  }

  function updateFloatingLayout() {
    const buttons = [
      document.getElementById('addToHomeButton'),
      document.getElementById('bugReportButton'),
      document.getElementById('settingsButton'),
      document.getElementById('quadViewButton')
    ];
    const container = document.querySelector('.floating-button-group');
    if (!container) return;

    buttons.forEach(btn => {
      if (btn) {
        container.appendChild(btn);
      }
    });
  }

  updateFloatingLayout();

  if (settings.quadViewOpen) {
    openQuadView(true);
  }

  if (quadViewButton) {
    quadViewButton.addEventListener('click', function () {
      openQuadView(true);
    });
  }

  if (quadBackButton) {
    quadBackButton.addEventListener('click', function () {
      closeQuadView(true);
    });
  }

  const quadAddToHomeButton = document.getElementById('quadAddToHomeButton');
  if (quadAddToHomeButton) {
    quadAddToHomeButton.addEventListener('click', function () {
      const installationModal = document.getElementById('installationModal');
      if (installationModal) {
        installationModal.style.display = 'block';
        setTimeout(function () {
          installationModal.classList.add('active');
        }, 10);
      }
    });
  }

  quadSelects.forEach((select, idx) => {
    select.addEventListener('change', function () {
      loadQuadSlot(idx, this.value);
    });
  });

  function loadFavorites() {
    try {
      const favoritesData = localStorage.getItem('webcamFavorites');
      return favoritesData ? JSON.parse(favoritesData) : [];
    } catch (e) {
      console.error('Error loading favorites:', e);
      return [];
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem('webcamFavorites', JSON.stringify(favorites));
    } catch (e) {
      console.error('Error saving favorites:', e);
    }
  }

  function isFavorite(resortId, webcamIndex) {
    return favorites.some(f => f.resortId === resortId && f.webcamIndex === webcamIndex);
  }

  function toggleFavorite(resortId, webcamIndex, webcamName, videoUrl, videoType) {
    const index = favorites.findIndex(f => f.resortId === resortId && f.webcamIndex === webcamIndex);

    if (index === -1) {
      favorites.push({
        resortId,
        webcamIndex,
        webcamName,
        resortName: data.find(r => r.id === resortId)?.name || '',
        videoUrl,
        videoType
      });
    } else {
      favorites.splice(index, 1);
    }

    saveFavorites();
    updateFavoriteButtons();
    updateFavoritesDisplay();
  }

  function updateFavoriteButtons() {
    document.querySelectorAll('.bookmark-button').forEach(btn => {
      const resortId = btn.getAttribute('data-resort-id');
      const webcamIndex = parseInt(btn.getAttribute('data-webcam-index'));

      if (isFavorite(resortId, webcamIndex)) {
        btn.classList.add('active');
        btn.querySelector('.bookmark-icon').innerHTML = '<i class="bi bi-bookmark-fill"></i>';
      } else {
        btn.classList.remove('active');
        btn.querySelector('.bookmark-icon').innerHTML = '<i class="bi bi-bookmark"></i>';
      }
    });
  }

  function updateFavoritesDisplay() {
    const favoritesContainer = document.getElementById('favorites-container');
    const favoritesGrid = document.getElementById('favorites-grid');

    if (!favoritesContainer || !favoritesGrid) {
      console.error("Favorites container or grid not found");
      return;
    }

    if (favorites.length === 0) {
      const instruction = document.createElement('div');
      instruction.className = 'instruction';
      instruction.innerHTML = `<p>${t('bookmarks.empty')}<br>${t('bookmarks.browserOnly')}</p>`;
      favoritesContainer.appendChild(instruction);
    }

    favoritesContainer.style.display = 'block';
    favoritesGrid.innerHTML = '';

    if (window.location.hash === '') {
      const favoritesSection = favoritesContainer.closest('.content-section');
      if (favoritesSection) {
        favoritesSection.style.display = 'block';
      }
    } else {
      const favoritesSection = favoritesContainer.closest('.content-section');
      if (favoritesSection) {
        favoritesSection.style.display = 'none';
      }
    }

    if (activePlayers && activePlayers.length > 0) {
      activePlayers = activePlayers.filter(player => {
        const id = player.el_?.id;
        if (id && id.includes('favorite-player')) {
          player.dispose();
          return false;
        }
        return true;
      });
    }

    favorites.forEach((favorite, idx) => {
      const videoCard = document.createElement('div');
      videoCard.className = 'video-card favorite-card';
      videoCard.draggable = true;
      videoCard.setAttribute('data-index', idx);

      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      dragHandle.innerHTML = '<i class="bi bi-grip-vertical"></i>';
      videoCard.appendChild(dragHandle);

      const headerContainer = document.createElement('div');
      headerContainer.className = 'favorites-header-container';

      const header = document.createElement('div');
      header.className = 'favorite-header';

      const locationName = document.createElement('span');
      locationName.className = 'favorite-location cursor-pointer';
      locationName.textContent = favorite.webcamName;
      locationName.addEventListener('click', function () {
        const hash = `${favorite.resortId}/${favorite.webcamIndex}`;
        window.location.hash = hash;
      });

      const resortName = document.createElement('span');
      resortName.className = 'favorite-resort';
      resortName.textContent = favorite.resortName;

      header.appendChild(locationName);
      header.appendChild(resortName);
      headerContainer.appendChild(header);

      const removeButton = document.createElement('button');
      removeButton.className = 'favorites-remove-button';
      removeButton.innerHTML = '<i class="bi bi-trash"></i>';
      removeButton.setAttribute('title', t('buttons.removeBookmark'));
      removeButton.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(favorite.resortId, favorite.webcamIndex);
      });

      headerContainer.appendChild(removeButton);
      videoCard.appendChild(headerContainer);

      const videoContainer = document.createElement('div');
      videoContainer.className = 'video-container';
      videoCard.appendChild(videoContainer);

      favoritesGrid.appendChild(videoCard);

      if (favorite.videoUrl) {
        const playerId = `favorite-player-${idx}`;
        const player = createVideoPlayer(
          favorite.videoUrl,
          videoContainer,
          playerId,
          favorite.videoType
        );
        if (player) activePlayers.push(player);
      }

      videoCard.addEventListener('dragstart', handleDragStart);
      videoCard.addEventListener('dragover', handleDragOver);
      videoCard.addEventListener('dragenter', handleDragEnter);
      videoCard.addEventListener('dragleave', handleDragLeave);
      videoCard.addEventListener('drop', handleDrop);
      videoCard.addEventListener('dragend', handleDragEnd);
    });

    updateAllResortsWeather();
  }

  let draggedItem = null;
  let dragSourceIndex = -1;

  function handleDragStart(e) {
    draggedItem = this;
    dragSourceIndex = parseInt(this.getAttribute('data-index'));

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);

    this.classList.add('dragging');

    document.querySelectorAll('.favorite-card').forEach(card => {
      if (card !== this) {
        card.classList.add('drop-target');
      }
    });
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragEnter(e) {
    this.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    this.classList.remove('drag-over');

    if (draggedItem === this) {
      return false;
    }

    const dropTargetIndex = parseInt(this.getAttribute('data-index'));

    if (dragSourceIndex !== -1 && dropTargetIndex !== -1) {
      const itemToMove = favorites[dragSourceIndex];

      favorites.splice(dragSourceIndex, 1);

      favorites.splice(dropTargetIndex, 0, itemToMove);

      saveFavorites();

      updateFavoritesDisplay();
    }

    return false;
  }

  function handleDragEnd(e) {
    const favoriteCards = document.querySelectorAll('.favorite-card');
    favoriteCards.forEach(card => {
      card.classList.remove('dragging', 'drag-over', 'drop-target');
    });
  }

  function createLocationNameDiv(data, timestamp, displaySource = false) {
    const locationNameDiv = document.createElement('div');
    locationNameDiv.className = 'location-name';
    if (data.name.startsWith('리조트_')) {
      locationNameDiv.textContent = data.name.replace('리조트_', '');
    } else {
      locationNameDiv.textContent = data.name;
    }

    if (timestamp) {
      const date = new Date(timestamp);
      month = date.getMonth() + 1;
      day = date.getDate();
      hours = date.getHours().toString().padStart(2, '0');
      minutes = date.getMinutes().toString().padStart(2, '0');

      const timeSpan = document.createElement('span');
      timeSpan.className = 'weather-update-time';
      timeSpan.textContent = t('weather.updateTime', { month, day, hours, minutes });
      if (displaySource) {
        if (data.name.startsWith('리조트_')) {
          timeSpan.textContent += ` (${t('weather.resortProvided')})`;
        } else {
          timeSpan.textContent += ` (${t('weather.kmaProvided')})`;
        }
      }
      locationNameDiv.appendChild(timeSpan);
    }

    return locationNameDiv;
  }

  function createWeatherDataDiv(data) {
    const weatherDataDiv = document.createElement('div');
    weatherDataDiv.className = 'weather-data';

    class WeatherMetric {
      constructor(className, iconClass, value, unit, decimals = 1) {
        this.span = document.createElement('span');
        this.span.className = className;

        const icon = document.createElement('i');
        icon.className = iconClass;
        this.span.appendChild(icon);

        const formattedValue = Number(value).toFixed(decimals);
        this.span.appendChild(document.createTextNode(`${formattedValue}${unit}`));

        return this.span;
      }
    }

    if (data.temperature !== null) {
      const tempMetric = new WeatherMetric('temperature', 'bi bi-thermometer-half', data.temperature, '°C');
      weatherDataDiv.appendChild(tempMetric);
    }

    if (data.humidity !== null) {
      weatherDataDiv.appendChild(document.createTextNode(' • '));
      const humidityMetric = new WeatherMetric('humidity', 'bi bi-moisture', data.humidity, '%', 0);
      weatherDataDiv.appendChild(humidityMetric);
    }

    if (data.wind_speed !== null) {
      weatherDataDiv.appendChild(document.createTextNode(' • '));
      const windMetric = new WeatherMetric('wind-speed', 'bi bi-wind', data.wind_speed, 'm/s');
      weatherDataDiv.appendChild(windMetric);
    }

    if (data.rainfall !== null) {
      weatherDataDiv.appendChild(document.createTextNode(' • '));
      const rainfallMetric = new WeatherMetric('rainfall', 'bi bi-droplet-fill', data.rainfall, 'mm');
      weatherDataDiv.appendChild(rainfallMetric);
    }

    if (data.snowfall_3hr !== null) {
      weatherDataDiv.appendChild(document.createTextNode(' • '));
      const snowfallMetric = new WeatherMetric('snowfall', 'bi bi-snow', data.snowfall_3hr, 'cm');
      weatherDataDiv.appendChild(snowfallMetric);
    }

    return weatherDataDiv;
  }

  function updateAllResortsWeather() {
    if (!weatherData || weatherData.length === 0) return;
    if (!data || data.length === 0) return;

    const defaultMessage = document.getElementById('default-message');
    if (!defaultMessage) return;

    const existingWeatherOverview = defaultMessage.querySelector('.all-resorts-weather');
    if (existingWeatherOverview) existingWeatherOverview.remove();

    const allResortsWeatherContainer = document.createElement('div');
    allResortsWeatherContainer.className = 'all-resorts-weather';
    allResortsWeatherContainer.innerHTML = `<h3>${t('weather.allResortsTitle')} <span style="font-size: 0.6em; font-weight: normal; color: #999; margin-left: 6px;">${t('weather.kmaData')}</span></h3>`;

    const weatherGrid = document.createElement('div');
    weatherGrid.className = 'weather-container';
    allResortsWeatherContainer.appendChild(weatherGrid);

    data.forEach(resort => {
      const resortName = resort.name;
      const baseAreaWeather = weatherData.find(w => w.resort === resortName && w.name === '스키하우스');

      if (baseAreaWeather && baseAreaWeather.data && baseAreaWeather.data.length > 0) {
        const wrapper = document.createElement('div');
        wrapper.className = 'weather-info-wrapper';

        const weatherInfo = document.createElement('div');
        weatherInfo.className = 'weather-info';

        const mostRecent = baseAreaWeather.data[baseAreaWeather.data.length - 1];

        const locationNameDiv = createLocationNameDiv(resort, baseAreaWeather.timestamp, false);
        const weatherDataDiv = createWeatherDataDiv(mostRecent);

        weatherInfo.appendChild(locationNameDiv);
        weatherInfo.appendChild(weatherDataDiv);

        wrapper.appendChild(weatherInfo);
        weatherGrid.appendChild(wrapper);
      }
    });

    if (weatherGrid.children.length > 0) {
      const favoritesContainer = defaultMessage.querySelector('#favorites-container');
      if (favoritesContainer) {
        favoritesContainer.after(allResortsWeatherContainer);
      } else {
        defaultMessage.appendChild(allResortsWeatherContainer);
      }
    }

    const resortProvidedWeatherTitle = document.createElement('h3');
    resortProvidedWeatherTitle.style.marginTop = '16px';
    resortProvidedWeatherTitle.textContent = t('weather.allResortsTitle');
    const resortProvidedWeatherSpan = document.createElement('span');
    resortProvidedWeatherSpan.textContent = t('weather.resortData');
    resortProvidedWeatherSpan.style.fontSize = '0.6em';
    resortProvidedWeatherSpan.style.fontWeight = 'normal';
    resortProvidedWeatherSpan.style.color = '#999';
    resortProvidedWeatherSpan.style.marginLeft = '6px';
    resortProvidedWeatherTitle.appendChild(resortProvidedWeatherSpan);
    allResortsWeatherContainer.appendChild(resortProvidedWeatherTitle);

    const resortProvidedWeatherGrid = document.createElement('div');
    resortProvidedWeatherGrid.className = 'weather-container';
    allResortsWeatherContainer.appendChild(resortProvidedWeatherGrid);

    data.forEach(resort => {
      const resortName = resort.name;
      const baseAreaWeathers = weatherData.filter(w => w.resort === resortName && w.name.startsWith('리조트_'));

      baseAreaWeathers.forEach(baseAreaWeather => {
        if (baseAreaWeather && baseAreaWeather.data && baseAreaWeather.data.length > 0) {
          const wrapper = document.createElement('div');
          wrapper.className = 'weather-info-wrapper';

          const weatherInfo = document.createElement('div');
          weatherInfo.className = 'weather-info';

          const mostRecent = baseAreaWeather.data[baseAreaWeather.data.length - 1];

          const locationNameDiv = createLocationNameDiv(resort, baseAreaWeather.timestamp, false);
          const weatherDataDiv = createWeatherDataDiv(mostRecent);

          weatherInfo.appendChild(locationNameDiv);
          weatherInfo.appendChild(weatherDataDiv);

          wrapper.appendChild(weatherInfo);
          resortProvidedWeatherGrid.appendChild(wrapper);
        }
      });
    });

    if (resortProvidedWeatherGrid.children.length > 0) {
      const favoritesContainer = defaultMessage.querySelector('#favorites-container');
      if (favoritesContainer) {
        favoritesContainer.after(allResortsWeatherContainer);
      } else {
        defaultMessage.appendChild(allResortsWeatherContainer);
      }
    }
  }

  function hideAllSubmenus() {
    document.querySelectorAll('.submenu').forEach(submenu => {
      submenu.classList.remove('active');
    });
    document.querySelectorAll('.menu-item[data-has-submenu="true"]').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
      toggle.innerHTML = '<i class="bi bi-chevron-down"></i>';
    });
  }

  function updateUrlHash(resort, webcam) {
    const currentHash = window.location.hash.substring(1);
    const newHash = webcam ? `${resort}/${webcam}` : resort;

    if (currentHash === newHash) return;

    const url = new URL(window.location);
    url.hash = newHash;
    history.pushState(null, '', url);
    updatePageTitle(resort, webcam);
  }

  function updatePageTitle(resortId, webcamId) {
    if (!resortId) {
      document.title = basicTitle;
      return;
    }

    const resort = data.find(r => r.id === resortId);
    if (!resort) {
      document.title = basicTitle;
      return;
    }

    if (webcamId !== undefined && webcamId !== null) {
      const webcamIndex = parseInt(webcamId);
      const webcams = resort.links || resort.webcams || [];

      if (!isNaN(webcamIndex) && webcams[webcamIndex]) {
        const webcamName = getWebcamName(resort, webcamIndex, webcams[webcamIndex].name);
        document.title = `${basicTitle} - ${webcamName} - ${getResortName(resort)}`;
      } else {
        document.title = `${basicTitle} - ${getResortName(resort)}`;
      }
    } else {
      document.title = `${basicTitle} - ${getResortName(resort)}`;
    }
  }

  function disposeAllPlayers() {
    if (activePlayers && activePlayers.length > 0) {
      activePlayers.forEach(player => {
        if (player && typeof player.dispose === 'function') {
          player.dispose();
        }
      });
      activePlayers = [];
    }
  }

  function updateWeatherDisplay(resortId) {
    if (!weatherData || weatherData.length === 0) return;

    const resort = data.find(r => r.id === resortId);
    if (!resort) return;

    const resortName = resort.name;
    const resortWeather = weatherData.filter(w => w.resort === resortName);

    if (resortWeather.length === 0) return;

    const sections = document.querySelectorAll(`.content-section[id^="${resortId}"]`);

    sections.forEach(section => {
      const existingWeather = section.querySelector('.weather-container');
      if (existingWeather) existingWeather.remove();

      const weatherContainer = document.createElement('div');
      weatherContainer.className = 'weather-container';

      resortWeather.forEach(locationData => {
        if (!locationData || !locationData.data || locationData.data.length === 0) return;

        const mostRecent = locationData.data[locationData.data.length - 1];

        const weatherInfoWrapper = document.createElement('div');
        weatherInfoWrapper.className = 'weather-info-wrapper';

        const weatherInfo = document.createElement('div');
        weatherInfo.className = 'weather-info';

        const locationNameDiv = createLocationNameDiv(locationData, locationData.timestamp, true);
        const weatherDataDiv = createWeatherDataDiv(mostRecent);

        weatherInfo.appendChild(locationNameDiv);
        weatherInfo.appendChild(weatherDataDiv);

        weatherInfoWrapper.appendChild(weatherInfo);
        weatherContainer.appendChild(weatherInfoWrapper);
      });

      const videosGrid = section.querySelector('.videos-grid');
      const videoContainer = section.querySelector('.video-container');

      if (videosGrid) {
        videosGrid.after(weatherContainer);
      } else if (videoContainer) {
        videoContainer.after(weatherContainer);
      } else {
        const title = section.querySelector('h2');
        if (title) {
          title.after(weatherContainer);
        } else {
          section.appendChild(weatherContainer);
        }
      }
    });
  }

  function handleHashChange() {
    const hash = window.location.hash.substring(1);
    if (!hash) {
      closeQuadView(false);
      document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
      });
      const defaultMessage = document.getElementById('default-message');
      defaultMessage.classList.add('active');
      defaultMessage.style.display = 'block';
      updateFavoritesDisplay();
      document.title = basicTitle;
      return;
    }

    if (window.processingHashChange) return;
    window.processingHashChange = true;

    try {
      if (hash === 'quad') {
        openQuadView(false);
        document.title = `${basicTitle} - 4분할 모드`;
        return;
      }

      closeQuadView(false);

      if (hash === 'misc') {
        const defaultMessage = document.getElementById('default-message');
        defaultMessage.classList.remove('active');
        defaultMessage.style.display = 'none';

        document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
        const miscMenuItem = document.querySelector('.menu-item[data-target="misc"]');
        if (miscMenuItem) {
          miscMenuItem.classList.add('active');
        }

        hideAllSubmenus();
        disposeAllPlayers();

        document.querySelectorAll('.content-section').forEach(section => {
          section.classList.remove('active');
        });

        const miscSection = document.getElementById('misc');
        if (miscSection) {
          miscSection.classList.add('active');
        }

        document.title = `${basicTitle} - ${t('nav.usefulFeatures')}`;
        return;
      }

      if (hash.startsWith('misc/')) {
        const defaultMessage = document.getElementById('default-message');
        defaultMessage.classList.remove('active');
        defaultMessage.style.display = 'none';

        document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
        const miscMenuItem = document.querySelector('.menu-item[data-target="misc"]');
        if (miscMenuItem) {
          miscMenuItem.classList.add('active');
        }

        const submenu = document.getElementById('misc-submenu');
        if (submenu) {
          submenu.classList.add('active');

          const dropdownToggle = miscMenuItem.querySelector('.dropdown-toggle');
          if (dropdownToggle) {
            dropdownToggle.innerHTML = '<i class="bi bi-chevron-up"></i>';
          }
        }

        const submenuPart = hash.split('/')[1];
        if (submenuPart === 'forecast') {
          document.querySelectorAll('.submenu-item').forEach(item => {
            item.classList.remove('active');
          });

          const forecastSubmenuItem = document.querySelector('.submenu-item[data-target="misc-forecast"]');
          if (forecastSubmenuItem) {
            forecastSubmenuItem.classList.add('active');
          }

          document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
          });

          const forecastSection = document.getElementById('misc-forecast');
          if (forecastSection) {
            forecastSection.classList.add('active');
          }

          document.title = `${basicTitle} - ${t('nav.forecast')}`;
          updateAllResortsWeather();
          loadForecastCharts();
          closeSidebar();
        }

        return;
      }

      const parts = hash.split('/');
      const resortId = parts[0];
      const webcamId = parts[1];

      updatePageTitle(resortId, webcamId);

      const defaultMessage = document.getElementById('default-message');
      defaultMessage.classList.remove('active');
      defaultMessage.style.display = 'none';

      const resortMenuItem = document.querySelector(`.menu-item[data-target="${resortId}"]`);
      if (resortMenuItem) {
        document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
        resortMenuItem.classList.add('active');

        hideAllSubmenus();

        resortMenuItem.classList.add('active');

        disposeAllPlayers();

        document.querySelectorAll('.content-section').forEach(section => {
          section.classList.remove('active');
        });

        const hasSubmenu = resortMenuItem.getAttribute('data-has-submenu') === 'true';
        if (hasSubmenu) {
          const submenu = document.getElementById(`${resortId}-submenu`);
          if (submenu) {
            submenu.classList.add('active');
          }

          if (webcamId) {
            const webcamIndex = parseInt(webcamId);
            if (!isNaN(webcamIndex)) {
              const webcamItem = document.querySelector(`#${resortId}-submenu .submenu-item[data-webcam-index="${webcamIndex}"]`);
              if (webcamItem) {
                document.querySelectorAll('.submenu-item').forEach(item => {
                  item.classList.remove('active');
                });
                webcamItem.classList.add('active');

                const targetSection = document.getElementById(webcamItem.getAttribute('data-target'));
                if (targetSection) {
                  targetSection.classList.add('active');

                  const videoContainer = targetSection.querySelector('.video-container');
                  if (videoContainer) {
                    const resort = data.find(r => r.id === resortId);
                    if (resort) {
                      const webcams = resort.links || resort.webcams || [];
                      if (webcams[webcamIndex]) {
                        const videoUrl = webcams[webcamIndex].video || webcams[webcamIndex].link;
                        if (videoUrl) {
                          const player = createVideoPlayer(videoUrl, videoContainer, `${resortId}-${webcamIndex}`, webcams[webcamIndex].video_type);
                          if (player) activePlayers.push(player);

                          addBookmarkButton(
                            videoContainer,
                            resortId,
                            webcamIndex,
                            getWebcamName(resort, webcamIndex, webcams[webcamIndex].name),
                            videoUrl,
                            webcams[webcamIndex].video_type
                          );

                          updateWeatherDisplay(resortId);
                        } else {
                          videoContainer.innerHTML = '<div class="error-message">No video stream available</div>';
                        }
                      } else {
                        videoContainer.innerHTML = '<div class="error-message">No video stream available</div>';
                      }
                    }
                  }
                }
              }
            }
          } else {
            document.querySelectorAll('.submenu-item').forEach(smi => smi.classList.remove('active'));
            const mainSection = document.getElementById(`${resortId}-main`);
            if (mainSection) {
              mainSection.classList.add('active');

              loadAllWebcams(resortId);
            }
          }

          const dropdownToggle = resortMenuItem.querySelector('.dropdown-toggle');
          if (dropdownToggle) {
            dropdownToggle.innerHTML = '<i class="bi bi-chevron-up"></i>';
          }
        } else {
          const targetSection = document.getElementById(resortId);
          if (targetSection) {
            targetSection.classList.add('active');
          }
        }

        if (weatherData && weatherData.length > 0) {
          updateWeatherDisplay(resortId);
        } else {
          fetch('weather.json?v=' + new Date().getTime())
            .then(response => {
              if (!response.ok) {
                console.warn('Weather data not available');
                return null;
              }
              return response.json();
            })
            .then(data => {
              if (data) {
                weatherData = data;
                console.log('Weather data loaded:', weatherData.length, 'locations');
                updateWeatherDisplay(resortId);
              }
            })
            .catch(error => {
              console.error('Error loading weather data:', error);
            });
        }
      }
    } finally {
      setTimeout(() => {
        window.processingHashChange = false;
        updateFavoriteButtons();
        manageVideoPlayback();
      }, 100);
    }
  }

  function loadAllWebcams(resortId) {
    const resort = data.find(r => r.id === resortId);
    if (!resort) return;

    const webcams = resort.links || resort.webcams || [];
    if (webcams.length === 0) return;

    const mainSection = document.getElementById(`${resortId}-main`);
    if (!mainSection) return;

    let videosGrid = mainSection.querySelector('.videos-grid');
    if (!videosGrid) {
      videosGrid = document.createElement('div');
      videosGrid.className = 'videos-grid';

      const title = mainSection.querySelector('h2');
      if (title) {
        title.after(videosGrid);
      } else {
        mainSection.appendChild(videosGrid);
      }
    }

    videosGrid.innerHTML = '';

    webcams.forEach((webcam, index) => {
      const videoUrl = webcam.video || webcam.link;
      if (!videoUrl) return;

      const videoCard = document.createElement('div');
      videoCard.className = 'video-card';

      const cardTitle = document.createElement('h3');
      cardTitle.textContent = getWebcamName(resort, index, webcam.name);
      cardTitle.className = 'cursor-pointer';
      cardTitle.addEventListener('click', function () {
        const submenuItem = document.querySelector(`#${resortId}-submenu .submenu-item[data-webcam-index="${index}"]`);
        if (submenuItem) {
          submenuItem.click();
        }
      });
      videoCard.appendChild(cardTitle);

      const videoContainer = document.createElement('div');
      videoContainer.className = 'video-container';
      videoCard.appendChild(videoContainer);

      videosGrid.appendChild(videoCard);

      const player = createVideoPlayer(videoUrl, videoContainer, `${resortId}-grid-${index}`, webcam.video_type);
      if (player) activePlayers.push(player);

      addBookmarkButton(
        videoContainer,
        resortId,
        index,
        getWebcamName(resort, index, webcam.name),
        videoUrl,
        webcam.video_type
      );
    });

    updateFavoriteButtons();

    updateWeatherDisplay(resortId);

    setTimeout(manageVideoPlayback, 500); // Give some time for DOM to settle
  }

  function initializeResorts(resorts) {
    data = resorts;
    populateQuadSelects();

    sidebar.innerHTML = '<div class="site-title"><a href="./">Slopes cam</a></div>';
    const defaultContent = document.getElementById('default-message');
    const otherContent = Array.from(document.querySelectorAll('.content-section:not(#default-message)'));
    otherContent.forEach(el => el.remove());

    const miscMenuItemContainer = document.createElement('div');
    miscMenuItemContainer.className = 'menu-item-container';

    const miscMenuItem = document.createElement('div');
    miscMenuItem.className = 'menu-item';
    miscMenuItem.setAttribute('data-target', 'misc');
    miscMenuItem.setAttribute('data-has-submenu', 'true');
    miscMenuItem.textContent = t('nav.usefulFeatures');
    miscMenuItemContainer.appendChild(miscMenuItem);

    const dropdownToggle = document.createElement('span');
    dropdownToggle.className = 'dropdown-toggle';
    dropdownToggle.innerHTML = '<i class="bi bi-chevron-down"></i>';
    dropdownToggle.setAttribute('aria-label', 'Toggle submenu');
    miscMenuItem.appendChild(dropdownToggle);

    dropdownToggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const submenu = miscMenuItemContainer.querySelector('.submenu');
      if (submenu) {
        const isActive = submenu.classList.contains('active');

        hideAllSubmenus();

        if (!isActive) {
          submenu.classList.add('active');
          miscMenuItem.classList.add('active');
          this.innerHTML = '<i class="bi bi-chevron-up"></i>';
        }
      }
    });

    const miscSubmenu = document.createElement('div');
    miscSubmenu.className = 'submenu';
    miscSubmenu.id = 'misc-submenu';
    miscMenuItemContainer.appendChild(miscSubmenu);

    const forecastSubmenuItem = document.createElement('div');
    forecastSubmenuItem.className = 'submenu-item';
    forecastSubmenuItem.setAttribute('data-target', 'misc-forecast');
    forecastSubmenuItem.textContent = t('nav.forecast');
    miscSubmenu.appendChild(forecastSubmenuItem);

    const forecastSection = document.createElement('div');
    forecastSection.className = 'content-section';
    forecastSection.id = 'misc-forecast';

    const forecastTitle = document.createElement('h2');
    forecastTitle.textContent = t('nav.forecast');
    forecastTitle.className = 'inline-title';
    forecastSection.appendChild(forecastTitle);

    const forecastContent = document.createElement('div');
    forecastContent.className = 'misc-content';
    forecastContent.innerHTML = `
      <div class="forecast-container">
        <div id="forecast"></div>
      </div>
    `;
    forecastSection.appendChild(forecastContent);

    mainContent.appendChild(forecastSection);

    forecastSubmenuItem.addEventListener('click', function () {
      document.querySelectorAll('.submenu-item').forEach(item => {
        item.classList.remove('active');
      });
      this.classList.add('active');

      document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
      });

      const defaultMessage = document.getElementById('default-message');
      defaultMessage.classList.remove('active');
      defaultMessage.style.display = 'none';

      forecastSection.classList.add('active');

      window.location.hash = 'misc/forecast';
      document.title = `${basicTitle} - ${t('nav.forecast')}`;

      updateAllResortsWeather();
      loadForecastCharts();
      closeSidebar();
    });

    // TODO: 일기예보 완성 후 메뉴 활성화
    // sidebar.appendChild(miscMenuItemContainer);

    const miscSection = document.createElement('div');
    miscSection.className = 'content-section';
    miscSection.id = 'misc';

    const miscTitle = document.createElement('h2');
    miscTitle.textContent = t('nav.usefulFeatures');
    miscTitle.className = 'inline-title';
    miscSection.appendChild(miscTitle);

    const miscContent = document.createElement('div');
    miscContent.className = 'misc-content';
    miscContent.innerHTML = `
      <p>${t('nav.selectFromMenu')}</p>
    `;
    miscSection.appendChild(miscContent);

    mainContent.appendChild(miscSection);

    miscMenuItem.addEventListener('click', function (e) {
      if (e.target.classList.contains('dropdown-toggle') || e.target.closest('.dropdown-toggle')) {
        return;
      }

      document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
      document.querySelectorAll('.submenu-item').forEach(smi => smi.classList.remove('active'));
      this.classList.add('active');

      hideAllSubmenus();
      disposeAllPlayers();

      document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
      });

      const defaultMessage = document.getElementById('default-message');
      defaultMessage.classList.remove('active');
      defaultMessage.style.display = 'none';

      const submenu = document.getElementById('misc-submenu');
      if (submenu) {
        submenu.classList.add('active');
        this.classList.add('active');

        const dropdownToggle = this.querySelector('.dropdown-toggle');
        if (dropdownToggle) {
          dropdownToggle.innerHTML = '<i class="bi bi-chevron-up"></i>';
        }
      }

      const miscSection = document.getElementById('misc');
      if (miscSection) {
        miscSection.classList.add('active');
      }

      window.location.hash = 'misc';
      document.title = `${basicTitle} - ${t('nav.usefulFeatures')}`;

      closeSidebar();
    });

    resorts.forEach(resort => {
      const resortId = resort.id;
      const resortDisplayName = getResortName(resort);
      const webcams = resort.links || resort.webcams || [];
      const hasSubmenu = webcams.length > 0;

      if (webcams.length === 0) {
        return;
      }

      const menuItemContainer = document.createElement('div');
      menuItemContainer.className = 'menu-item-container';

      const menuItem = document.createElement('div');
      menuItem.className = 'menu-item';
      menuItem.setAttribute('data-target', resortId);
      if (hasSubmenu) {
        menuItem.setAttribute('data-has-submenu', 'true');
        menuItem.setAttribute('data-resort-id', resortId);
      }
      menuItem.textContent = resortDisplayName;
      menuItemContainer.appendChild(menuItem);

      if (hasSubmenu) {
        const dropdownToggle = document.createElement('span');
        dropdownToggle.className = 'dropdown-toggle';
        dropdownToggle.innerHTML = '<i class="bi bi-chevron-down"></i>';
        dropdownToggle.setAttribute('aria-label', 'Toggle submenu');
        menuItem.appendChild(dropdownToggle);

        dropdownToggle.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          const submenu = menuItemContainer.querySelector('.submenu');
          if (submenu) {
            const isActive = submenu.classList.contains('active');

            hideAllSubmenus();

            if (!isActive) {
              submenu.classList.add('active');
              menuItem.classList.add('active');
              this.innerHTML = '<i class="bi bi-chevron-up"></i>';
            }
          }
        });
      }

      sidebar.appendChild(menuItemContainer);

      const contentSection = document.createElement('div');
      contentSection.className = 'content-section';
      contentSection.id = hasSubmenu ? `${resortId}-main` : resortId;

      const contentTitle = document.createElement('h2');
      contentTitle.textContent = resortDisplayName;
      contentTitle.className = 'inline-title';
      contentSection.appendChild(contentTitle);

      mainContent.appendChild(contentSection);

      if (hasSubmenu) {
        const submenu = document.createElement('div');
        submenu.className = 'submenu';
        submenu.id = `${resortId}-submenu`;
        menuItemContainer.appendChild(submenu);

        if (resort.status) {
          const statusItem = document.createElement('div');
          statusItem.className = 'submenu-item submenu-item-status';
          statusItem.innerHTML = `${t('nav.openStatus')} <i class="bi bi-box-arrow-up-right me-1"></i>`;
          submenu.appendChild(statusItem);

          statusItem.addEventListener('click', function () {
            window.open(resort.status, '_blank', 'noopener,noreferrer');
          });
        }

        webcams.forEach((webcam, index) => {
          const webcamDisplayName = getWebcamName(resort, index, webcam.name);
          if (!webcamDisplayName) return;

          const submenuItem = document.createElement('div');
          submenuItem.className = 'submenu-item';
          submenuItem.setAttribute('data-target', `${resortId}-webcam-${index}`);
          submenuItem.setAttribute('data-webcam-index', index);
          submenuItem.textContent = webcamDisplayName;
          submenu.appendChild(submenuItem);

          const webcamSection = document.createElement('div');
          webcamSection.className = 'content-section';
          webcamSection.id = `${resortId}-webcam-${index}`;

          const webcamTitle = document.createElement('h2');
          webcamTitle.textContent = webcamDisplayName;
          webcamTitle.className = 'inline-title inline-title-submenu cursor-pointer';
          webcamTitle.addEventListener('click', function () {
            const submenuItem = document.querySelector(`#${resortId}-submenu .submenu-item[data-webcam-index="${index}"]`);
            if (submenuItem) {
              submenuItem.click();
            }
          });
          webcamSection.appendChild(webcamTitle);

          const resortLabel = document.createElement('span');
          resortLabel.textContent = resortDisplayName;
          resortLabel.className = 'resort-label';
          webcamSection.appendChild(resortLabel);

          const videoContainer = document.createElement('div');
          videoContainer.className = 'video-container';
          webcamSection.appendChild(videoContainer);

          mainContent.appendChild(webcamSection);

          submenuItem.addEventListener('click', function () {
            const webcamIndex = this.getAttribute('data-webcam-index');
            activeWebcam = webcamIndex;

            updateUrlHash(resortId, webcamIndex);
            updatePageTitle(resortId, webcamIndex);

            document.querySelectorAll('.submenu-item').forEach(item => {
              item.classList.remove('active');
            });
            this.classList.add('active');

            document.querySelectorAll('.content-section').forEach(section => {
              section.classList.remove('active');
            });

            const defaultMessage = document.getElementById('default-message');
            defaultMessage.classList.remove('active');
            defaultMessage.style.display = 'none';

            const targetSection = document.getElementById(this.getAttribute('data-target'));
            if (targetSection) {
              targetSection.classList.add('active');

              disposeAllPlayers();

              const videoContainer = targetSection.querySelector('.video-container');
              if (videoContainer && webcams[webcamIndex]) {
                const videoUrl = webcams[webcamIndex].video || webcams[webcamIndex].link;
                if (videoUrl) {
                  const player = createVideoPlayer(videoUrl, videoContainer, `${resortId}-${webcamIndex}`, webcams[webcamIndex].video_type);
                  if (player) activePlayers.push(player);

                  updateWeatherDisplay(resortId);
                } else {
                  videoContainer.innerHTML = '<div class="error-message">No video stream available</div>';
                }
              }
            }

            closeSidebar();
          });
        });
      }

      menuItem.addEventListener('click', function (e) {
        if (e.target.classList.contains('dropdown-toggle') || e.target.closest('.dropdown-toggle')) {
          return;
        }

        const target = this.getAttribute('data-target');
        const hasSubmenu = this.getAttribute('data-has-submenu') === 'true';
        const resortId = this.getAttribute('data-resort-id');

        if (resortId) {
          activeResort = resortId;
          activeWebcam = null;
        }

        updateUrlHash(target);
        updatePageTitle(target, null);

        document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
        document.querySelectorAll('.submenu-item').forEach(smi => smi.classList.remove('active'));
        this.classList.add('active');

        hideAllSubmenus();

        if (hasSubmenu) {
          const submenu = document.getElementById(`${target}-submenu`);
          if (submenu) {
            submenu.classList.add('active');
            this.classList.add('active');

            const dropdownToggle = this.querySelector('.dropdown-toggle');
            if (dropdownToggle) {
              dropdownToggle.innerHTML = '<i class="bi bi-chevron-up"></i>';
            }
          }
        }

        disposeAllPlayers();

        document.querySelectorAll('.content-section').forEach(section => {
          section.classList.remove('active');
        });

        const defaultMessage = document.getElementById('default-message');
        defaultMessage.classList.remove('active');
        defaultMessage.style.display = 'none';

        if (hasSubmenu) {
          const mainSection = document.getElementById(`${target}-main`);
          if (mainSection) {
            mainSection.classList.add('active');

            loadAllWebcams(target);
          }
        } else {
          const targetSection = document.getElementById(target);
          if (targetSection) {
            targetSection.classList.add('active');
          }
        }

        updateWeatherDisplay(target);

        closeSidebar();
      });
    });

    if (!window.location.hash && data.length > 0) {
      return;
    }

    if (window.location.hash) {
      handleHashChange();
    }
  }

  function createVideoPlayer(videoUrl, container, id, videoType, autoplayOverride = null) {
    container.innerHTML = '';

    const idParts = id.split('-');
    const resortId = idParts[0];
    let webcamIndex = parseInt(idParts[1]);

    if (idParts.length === 3 && idParts[1] === 'grid') {
      webcamIndex = parseInt(idParts[2]);
    }

    let webcamName = '';
    if (resortId && !isNaN(webcamIndex)) {
      const resort = data.find(r => r.id === resortId);
      if (resort) {
        const webcams = resort.links || resort.webcams || [];
        if (webcams[webcamIndex]) {
          webcamName = getWebcamName(resort, webcamIndex, webcams[webcamIndex].name) || '';
        }
      }
    }

    if (videoType === 'vivaldi') {
      const vivaldiContainerId = `vivaldi-player-${id}`;
      const vivaldiContainer = document.createElement('div');
      vivaldiContainer.className = 'iframe-container';

      const vivaldiParams = videoUrl.split(':');
      if (vivaldiParams.length === 2) {
        const channel = vivaldiParams[0];
        const serial = vivaldiParams[1];

        const shouldAutoplay = autoplayOverride !== null ? autoplayOverride : settings.autoplay;
        vivaldiContainer.innerHTML = `<iframe src="vivaldi.html?channel=${channel}&serial=${serial}&autoplay=${shouldAutoplay}" allowfullscreen></iframe>`;
        container.appendChild(vivaldiContainer);

        const iframe = vivaldiContainer.querySelector('iframe');

        // Create a player-like object for Vivaldi iframes to track in manageVideoPlayback
        const vivaldiPlayerWrapper = {
          iframe: iframe,
          container: vivaldiContainer,
          channel: channel,
          serial: serial,
          _paused: !shouldAutoplay,
          el: function () {
            return this.container;
          },
          paused: function () {
            return this._paused;
          },
          play: function () {
            if (this._paused && this.iframe && this.iframe.contentWindow) {
              this.iframe.contentWindow.postMessage({ action: 'play' }, '*');
              this._paused = false;
            }
          },
          pause: function () {
            if (!this._paused && this.iframe && this.iframe.contentWindow) {
              this.iframe.contentWindow.postMessage({ action: 'pause' }, '*');
              this._paused = true;
            }
          }
        };

        // Track this Vivaldi player for concurrent stream management
        activeVivaldiPlayers.push(vivaldiPlayerWrapper);

        if (resortId && !isNaN(webcamIndex)) {
          addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, BookmarkButtonType.VIVALDI);
        }

        const captureBtn = document.createElement('button');
        captureBtn.className = 'capture-button';
        captureBtn.innerHTML = `
          <i class="bi bi-camera"></i>
          ${t('buttons.capture')}
          `;
        captureBtn.addEventListener('click', () => {
          const captureIframe = container.querySelector('iframe');
          if (captureIframe) {
            try {
              const playerContainer = captureIframe.contentDocument.getElementById('player-container');
              if (playerContainer && !playerContainer.classList.contains('playing')) {
                showToastMessage(container, t('messages.captureOnlyWhilePlaying'), 'warning');
                return;
              }
            } catch (e) {
              console.error('Cannot check vivaldi playing state', e);
            }
          }
          captureScreenshot(container);
        });
        container.appendChild(captureBtn);

        return {
          dispose: function () {
            // Remove from activeVivaldiPlayers when disposed
            const idx = activeVivaldiPlayers.indexOf(vivaldiPlayerWrapper);
            if (idx > -1) {
              activeVivaldiPlayers.splice(idx, 1);
            }
            container.innerHTML = '';
          }
        };
      } else {
        container.innerHTML = '<div class="error-message">Invalid vivaldi video URL format. Expected: "channel:serial"</div>';
        return null;
      }
    }

    if (videoType === 'iframe') {
      const iframeContainer = document.createElement('div');
      iframeContainer.className = 'iframe-container';
      iframeContainer.innerHTML = `<iframe src="${videoUrl}" allowfullscreen></iframe>`;
      container.appendChild(iframeContainer);

      if (resortId && !isNaN(webcamIndex)) {
        addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, BookmarkButtonType.LINK);
      }

      return {
        dispose: function () {
          container.innerHTML = '';
        }
      };
    }

    if (videoType === 'youtube') {
      const youtubeContainer = document.createElement('div');
      youtubeContainer.className = 'iframe-container';

      const youtubeId = getYoutubeId(videoUrl);
      if (youtubeId) {
        const shouldAutoplay = autoplayOverride !== null ? autoplayOverride : settings.autoplay;
        const autoplayParam = shouldAutoplay ? '1' : '0';
        youtubeContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplayParam}&mute=1" allowfullscreen></iframe>`;
        container.appendChild(youtubeContainer);

        if (resortId && !isNaN(webcamIndex)) {
          addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, BookmarkButtonType.YOUTUBE);
        }

        return {
          dispose: function () {
            container.innerHTML = '';
          }
        };
      }
    }

    if (videoType === 'link') {
      const linkContainer = document.createElement('div');
      linkContainer.className = 'd-flex justify-content-center align-items-center link-container';

      const linkButton = document.createElement('a');
      linkButton.href = videoUrl;
      linkButton.target = '_blank';
      linkButton.rel = 'noopener noreferrer';
      linkButton.className = 'btn btn-primary btn-lg';
      linkButton.innerHTML = `
        <i class="bi bi-box-arrow-up-right me-2"></i>
        ${t('buttons.externalLink')}
      `;

      linkContainer.appendChild(linkButton);
      container.appendChild(linkContainer);

      if (resortId && !isNaN(webcamIndex)) {
        addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, BookmarkButtonType.LINK);
      }

      return {
        dispose: function () {
          container.innerHTML = '';
        }
      };
    }

    const resort = getResortAndWebcamFromId(id);
    let linkUrl = null;
    if (resort && resort.webcam && resort.webcam.link) {
      linkUrl = resort.webcam.link;
    }

    container.innerHTML = `
      <video
        id="webcam-player-${id}"
        class="video-js vjs-theme-forest vjs-big-play-centered"
        controls
        ${settings.autoplay ? 'autoplay' : ''}
        muted
        playsinline
        preload="auto"
        crossorigin="anonymous"
      >
        <source src="${videoUrl}" type="application/x-mpegURL">
        <p class="vjs-no-js">
          최신 브라우저를 사용하세요.
        </p>
      </video>
    `;

    try {
      const shouldAutoplay = autoplayOverride !== null ? autoplayOverride : settings.autoplay;
      const player = videojs(`webcam-player-${id}`, {
        autoplay: shouldAutoplay,
        muted: true,
        controls: true,
        preload: 'auto',
        fluid: true,
        html5: {
          hls: {
            enableLowInitialPlaylist: true,
            smoothQualityChange: true,
            overrideNative: true
          },
          nativeVideoTracks: false,
          nativeAudioTracks: false
        },
        controlBar: {
          captionsButton: false,
          pictureInPictureToggle: false
        },
        notSupportedMessage: t('errors.videoPlayback')
      });

      const captureBtn = document.createElement('button');
      captureBtn.className = 'capture-button';
      captureBtn.innerHTML = `
        <i class="bi bi-camera"></i>
        ${t('buttons.capture')}
      `;
      captureBtn.addEventListener('click', () => captureVideoFrame(player));
      container.appendChild(captureBtn);

      if (document.pictureInPictureEnabled || (document.exitPictureInPicture && document.requestPictureInPicture)) {
        const pipBtn = document.createElement('button');
        pipBtn.className = 'pip-button';
        pipBtn.innerHTML = `
          <i class="bi bi-pip"></i>
          PIP
        `;
        pipBtn.addEventListener('click', () => togglePictureInPicture(player));
        container.appendChild(pipBtn);
      }

      if (resortId && !isNaN(webcamIndex)) {
        addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, BookmarkButtonType.DEFAULT);
      }

      player.on('error', function () {
        const error = player.error();
        console.error('Video player error:', error);

        let directLink = null;
        if (resort && resort.webcam) {
          directLink = resort.webcam.link || null;
        } else {
          const resortData = data.find(r => r.id === resortId);
          if (resortData) {
            const webcams = resortData.links || resortData.webcams || [];
            if (webcams[webcamIndex] && webcams[webcamIndex].link) {
              directLink = webcams[webcamIndex].link;
            }
          }
        }

        let errorHtml = `<div class="error-message"><p>${t('errors.videoPlayback')}</p>`;

        errorHtml += '<div class="d-flex justify-content-center gap-2 mt-3 flex-wrap">';

        if (directLink) {
          errorHtml += `
            <a href="${directLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
              <i class="bi bi-box-arrow-up-right me-2"></i>
              ${t('buttons.originalLink')}
            </a>`;
        }

        errorHtml += `
          <button class="btn btn-secondary retry-button">
            <i class="bi bi-arrow-clockwise me-2"></i>
            ${t('buttons.retry')}
          </button>`;

        errorHtml += '</div>';
        errorHtml += '</div>';
        container.innerHTML = errorHtml;

        if (resortId && !isNaN(webcamIndex)) {
          addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, BookmarkButtonType.ERROR);
        }

        const retryBtn = container.querySelector('.retry-button');
        if (retryBtn) {
          retryBtn.addEventListener('click', function (e) {
            e.preventDefault();
            console.log('Retrying video load:', id);
            createVideoPlayer(videoUrl, container, id, videoType);
          });
        }
      });

      return player;
    } catch (e) {
      console.error('Error creating video player:', e);
      container.innerHTML = '<div class="error-message">비디오 플레이어를 생성하는 중 오류가 발생했습니다.</div>';

      if (resortId && !isNaN(webcamIndex)) {
        addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, BookmarkButtonType.ERROR);
      }

      return null;
    }
  }

  function togglePictureInPicture(player) {
    const video = player.el().querySelector('video');

    if (!video) return;

    if (document.pictureInPictureElement) {
      document.exitPictureInPicture()
        .catch(error => {
          console.error('Error exiting Picture-in-Picture mode:', error);
        });
    } else if (document.pictureInPictureEnabled || video.requestPictureInPicture) {
      video.requestPictureInPicture()
        .catch(error => {
          console.error('Error entering Picture-in-Picture mode:', error);
        });
    }
  }

  const BookmarkButtonType = {
    ERROR: 1,
    LINK: 2,
    YOUTUBE: 3,
    VIVALDI: 4,
    DEFAULT: 0
  };

  function addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, type = BookmarkButtonType.DEFAULT) {
    if (typeof resortId === 'string' && resortId.includes('favorite-player')) {
      return;
    }

    if (container.querySelector('.bookmark-button')) {
      return;
    }

    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.className = 'bookmark-button';
    bookmarkBtn.setAttribute('data-resort-id', resortId);
    bookmarkBtn.setAttribute('data-webcam-index', webcamIndex);
    bookmarkBtn.innerHTML = `
      <span class="bookmark-icon"><i class="bi bi-bookmark"></i></span>
      ${t('buttons.bookmark')}
    `;
    bookmarkBtn.addEventListener('click', function () {
      toggleFavorite(
        resortId,
        webcamIndex,
        webcamName,
        videoUrl,
        videoType
      );
    });

    if (type === BookmarkButtonType.ERROR) {
      bookmarkBtn.classList.add('bookmark-button-error');
    } else if (type === BookmarkButtonType.LINK) {
      bookmarkBtn.classList.add('bookmark-button-link');
    } else if (type === BookmarkButtonType.YOUTUBE) {
      bookmarkBtn.classList.add('bookmark-button-youtube');
    } else if (type === BookmarkButtonType.VIVALDI) {
      bookmarkBtn.classList.add('bookmark-button-vivaldi');
    }

    container.appendChild(bookmarkBtn);
  }

  function captureVideoFrame(player) {
    try {
      const canvas = document.createElement('canvas');
      const video = player.el().querySelector('video');

      if (video.readyState < 2) {
        showToastMessage(player.el(), t('errors.videoNotLoaded'), 'warning');
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const playerId = player.el().id;
      let resortId, webcamIndex;

      if (playerId) {
        const idParts = playerId.replace('webcam-player-', '').split('-');
        if (idParts.length >= 2) {
          if (idParts[0] === 'quad' && idParts.length >= 3) {
            resortId = idParts[1];
            webcamIndex = parseInt(idParts[2]);
          } else if (idParts[1] === 'grid') {
            resortId = idParts[0];
            webcamIndex = parseInt(idParts[2]);
          } else {
            resortId = idParts[0];
            webcamIndex = parseInt(idParts[1]);
          }

          const resort = data.find(r => r.id === resortId);
          if (resort && !isNaN(webcamIndex)) {
            const webcams = resort.links || resort.webcams || [];
            if (webcams[webcamIndex]) {
              const resortName = sanitizeForFilename(getResortName(resort));
              const webcamName = sanitizeForFilename(getWebcamName(resort, webcamIndex, webcams[webcamIndex].name) || `Camera ${webcamIndex + 1}`);
              const timestamp = formatTimestamp();
              const filename = `capture_${resortName}_${webcamName}_${timestamp}.jpg`;

              const dataURL = canvas.toDataURL('image/jpeg');
              downloadImage(dataURL, filename);

              const container = player.el().parentNode;

              showToastMessage(container, t('messages.captureSuccess'), 'success');

              return;
            }
          }
        }
      }

      const resortName = getResortNameForCapture(player.el());
      const webcamName = getWebcamNameForCapture(player.el());
      const timestamp = formatTimestamp();
      const filename = `capture_${resortName}_${webcamName}_${timestamp}.jpg`;

      const dataURL = canvas.toDataURL('image/jpeg');
      downloadImage(dataURL, filename);

      const container = player.el().parentNode;
      showSuccessMessage(container);

    } catch (e) {
      console.error('Error capturing frame:', e);
      alert(t('errors.captureError'));
    }
  }

  function showToastMessage(container, message, type = 'success') {
    const toastMsg = document.createElement('div');
    toastMsg.className = `alert alert-${type} position-absolute top-0 start-50 translate-middle-x mt-3 toast-message`;
    toastMsg.textContent = message;
    container.appendChild(toastMsg);

    setTimeout(() => {
      toastMsg.classList.add('fade-out');
      setTimeout(() => {
        toastMsg.remove();
      }, 500);
    }, 2000);
  }

  function captureScreenshot(container) {
    try {
      const iframe = container.querySelector('iframe');
      if (!iframe) {
        alert(t('errors.captureNotFound'));
        return;
      }

      const parentSection = container.closest('.content-section');
      let resortName, webcamName;

      if (parentSection) {
        const parentId = parentSection.id;
        const idParts = parentId.split('-');

        if (idParts.length >= 3 && idParts[1] === 'webcam') {
          const resortId = idParts[0];
          const webcamIndex = parseInt(idParts[2]);

          const resort = data.find(r => r.id === resortId);
          if (resort && !isNaN(webcamIndex)) {
            const webcams = resort.links || resort.webcams || [];
            if (webcams[webcamIndex]) {
              resortName = getResortNameForCapture(container);
              webcamName = getWebcamNameForCapture(container);
            }
          }
        }
      }

      if (!resortName || !webcamName) {
        const hash = window.location.hash.substring(1);
        const parts = hash.split('/');
        if (parts.length > 1) {
          const resortId = parts[0];
          const webcamIdx = parseInt(parts[1]);

          const resort = data.find(r => r.id === resortId);
          if (resort && !isNaN(webcamIdx)) {
            const webcams = resort.links || resort.webcams || [];
            if (webcams[webcamIdx]) {
              resortName = getResortNameForCapture(container);
              webcamName = getWebcamNameForCapture(container);
            }
          }
        }
      }

      if (!resortName) {
        resortName = getResortNameForCapture(container);
      }
      if (!webcamName) {
        webcamName = getWebcamNameForCapture(container);
      }

      const timestamp = formatTimestamp();
      const filename = `capture_${resortName}_${webcamName}_${timestamp}.jpg`;

      const iframeBody = iframe.contentDocument.body;
      html2canvas(iframeBody, {
        useCORS: false,
      }).then(canvas => {
        const dataURL = canvas.toDataURL('image/jpeg');
        downloadImage(dataURL, filename);

        showToastMessage(container, t('messages.captureSuccess'), 'success');
      });
    } catch (e) {
      console.error('Error capturing screenshot:', e);
      showToastMessage(container, t('errors.captureError'), 'danger');
    }
  }

  function getResortNameForCapture(element) {
    if (element) {
      const favoriteCard = element.closest('.favorite-card');
      if (favoriteCard) {
        const favoriteResort = favoriteCard.querySelector('.favorite-resort');
        if (favoriteResort && favoriteResort.textContent) {
          return sanitizeForFilename(favoriteResort.textContent.trim());
        }
      }
    }

    const resortLabel = document.querySelector('.content-section.active .resort-label');
    if (resortLabel && resortLabel.textContent) {
      return sanitizeForFilename(resortLabel.textContent.trim());
    }

    const hash = window.location.hash.substring(1);
    if (hash) {
      const parts = hash.split('/');
      const resortId = parts[0];
      const resort = data.find(r => r.id === resortId);
      if (resort) {
        return sanitizeForFilename(getResortName(resort));
      }
    }

    const activeMenuItem = document.querySelector('.menu-item.active');
    if (activeMenuItem) {
      const menuText = activeMenuItem.textContent.trim().split('\n')[0];
      return sanitizeForFilename(menuText);
    }

    return 'unknown';
  }

  function getWebcamNameForCapture(element) {
    const videoContainer = element.closest('.video-container, .quad-video');
    if (!videoContainer) return 'unknown';
    const favoriteCard = videoContainer.closest('.favorite-card');
    if (favoriteCard) {
      const favoriteLocation = favoriteCard.querySelector('.favorite-location');
      if (favoriteLocation && favoriteLocation.textContent) {
        return sanitizeForFilename(favoriteLocation.textContent.trim());
      }
    }

    const playerElement = videoContainer.querySelector('.vjs-tech') ||
      videoContainer.querySelector('iframe') ||
      videoContainer.querySelector('.vivaldi-container');

    if (playerElement && playerElement.id) {
      const idMatch = playerElement.id.match(/player-([^-]+)-(\d+)/) ||
        playerElement.id.match(/player-([^-]+)-grid-(\d+)/);

      if (idMatch && idMatch.length >= 3) {
        const resortId = idMatch[1];
        const webcamIndex = parseInt(idMatch[2]);

        const resort = data.find(r => r.id === resortId);
        if (resort) {
          const webcams = resort.links || resort.webcams || [];
          if (webcams[webcamIndex]) {
            return sanitizeForFilename(getWebcamName(resort, webcamIndex, webcams[webcamIndex].name));
          }
        }
      }
    }

    const activeSubmenuItem = document.querySelector('.submenu-item.active');
    if (activeSubmenuItem && !activeSubmenuItem.classList.contains('submenu-item-status')) {
      return sanitizeForFilename(activeSubmenuItem.textContent.trim());
    }

    const inlineTitle = document.querySelector('.content-section.active .inline-title.inline-title-submenu');
    if (inlineTitle && inlineTitle.textContent) {
      return sanitizeForFilename(inlineTitle.textContent.trim());
    }

    const hash = window.location.hash.substring(1);
    if (hash) {
      const parts = hash.split('/');
      if (parts.length > 1) {
        const resortId = parts[0];
        const webcamId = parts[1];
        if (resortId && webcamId && !isNaN(parseInt(webcamId))) {
          const resort = data.find(r => r.id === resortId);
          if (resort) {
            const webcams = resort.links || resort.webcams || [];
            const webcamIndex = parseInt(webcamId);
            if (webcams[webcamIndex]) {
              return sanitizeForFilename(getWebcamName(resort, webcamIndex, webcams[webcamIndex].name));
            }
          }
        }
      }
    }

    const card = element.closest('.video-card');
    if (card) {
      const cardTitle = card.querySelector('h3');
      if (cardTitle) {
        return sanitizeForFilename(cardTitle.textContent.trim());
      }
    }

    return 'webcam';
  }

  function formatTimestamp() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${month}-${day}_${hours}:${minutes}:${seconds}`;
  }

  function sanitizeForFilename(name) {
    return name
      .replace(/[^가-힣\w\s,()-]/g, '')
      .replace(/\s+/g, '_')
  }

  function downloadImage(dataURL, filename) {
    // Check if mobile (iOS/Android)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Try Web Share API first (only for mobile devices)
    if (isMobile && navigator.canShare && navigator.share) {
      try {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const file = new File([u8arr], filename, { type: mime });

        if (navigator.canShare({ files: [file] })) {
          navigator.share({
            files: [file],
            title: filename
          }).catch((error) => {
            if (error.name !== 'AbortError') {
              console.error('Sharing failed:', error);
              fallbackDownload(dataURL, filename);
            }
          });
          return;
        }
      } catch (e) {
        console.error('Error preparing share:', e);
      }
    }

    fallbackDownload(dataURL, filename);
  }

  function fallbackDownload(dataURL, filename) {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getResortAndWebcamFromId(id) {
    if (!id || !id.includes('-')) return null;

    const parts = id.split('-');
    if (parts.length < 2) return null;

    let resortId = parts[0];
    let webcamIndex = parseInt(parts[1]);

    if (parts[0] === 'quad' && parts.length >= 3) {
      resortId = parts[1];
      webcamIndex = parseInt(parts[2]);
    } else if (parts.length === 3 && parts[1] === 'grid') {
      webcamIndex = parseInt(parts[2]);
    }

    if (isNaN(webcamIndex)) return null;

    const resort = data.find(r => r.id === resortId);
    if (!resort) return null;

    const webcams = resort.links || resort.webcams || [];
    if (!webcams[webcamIndex]) return null;

    return {
      resort: resort,
      webcam: webcams[webcamIndex]
    };
  }

  function getYoutubeId(url) {
    const liveRegExp = /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([^#&?]*).*/;
    const liveMatch = url.match(liveRegExp);
    if (liveMatch && liveMatch[1] && liveMatch[1].length === 11) {
      return liveMatch[1];
    }

    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  function toggleSidebar() {
    sidebar.classList.toggle('active');
    sidebarBackdrop.classList.toggle('active');
  }

  function closeSidebar() {
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('active');
      sidebarBackdrop.classList.remove('active');
    }
  }

  toggleMenu.addEventListener('click', toggleSidebar);

  sidebarBackdrop.addEventListener('click', closeSidebar);

  window.addEventListener('resize', function () {
    isMobile = window.innerWidth <= 768;
    if (window.innerWidth > 768) {
      sidebar.classList.remove('active');
      sidebarBackdrop.classList.remove('active');
    }
  });

  window.addEventListener('hashchange', handleHashChange);

  function initializeApp() {
    let initialWeatherDataPromise = Promise.resolve(null);

    if (window.location.hash) {
      initialWeatherDataPromise = fetch('weather.json?v=' + new Date().getTime())
        .then(response => {
          if (!response.ok) {
            console.warn('Weather data not available');
            return null;
          }
          return response.json();
        })
        .then(weatherResult => {
          if (weatherResult) {
            weatherData = weatherResult;
            return weatherResult;
          }
          return null;
        })
        .catch(error => {
          console.error('Error loading weather data:', error);
          return null;
        });
    }

    fetch('links.json?v=' + new Date().getTime())
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(responseData => {
        if (Array.isArray(responseData) && responseData.length > 0) {
          initializeResorts(responseData);

          return initialWeatherDataPromise.then(existingWeatherData => {
            if (existingWeatherData) {
              return existingWeatherData;
            } else {
              return fetch('weather.json?v=' + new Date().getTime())
                .then(response => {
                  if (!response.ok) {
                    console.warn('Weather data not available');
                    return null;
                  }
                  return response.json();
                });
            }
          });
        } else {
          throw new Error('Invalid data format');
        }
      })
      .then(weatherResult => {
        if (weatherResult) {
          weatherData = weatherResult;
          console.log('Weather data loaded:', weatherData.length, 'locations');

          if (window.location.hash) {
            const parts = window.location.hash.substring(1).split('/');
            const resortId = parts[0];
            if (resortId) {
              updateWeatherDisplay(resortId);
            }
          }

          updateAllResortsWeather();
        }

        if (window.location.hash) {
          handleHashChange();
        } else {
          updateFavoritesDisplay();
        }
      })
      .catch(error => {
        console.error('Error initializing app:', error);
        const defaultMessage = document.getElementById('default-message');
        if (defaultMessage) {
          defaultMessage.innerHTML = `<div class="error-message p-5 text-center"><h3>${t('errors.loadResortInfo')}</h3><p>${t('errors.refreshPage')}</p></div>`;
          defaultMessage.classList.add('active');
        } else {
          mainContent.innerHTML = `<div class="error-message">${t('errors.loadResortInfo')}</div>`;
        }
      });
  }

  function loadForecastCharts() {
    fetch('weather.grid.json?v=' + new Date().getTime())
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load forecast data');
        }
        return response.json();
      })
      .then(gridData => {
        createForecastCharts(gridData);
      })
      .catch(error => {
        console.error('Error loading forecast data:', error);
        const forecastDiv = document.getElementById('forecast');
        if (forecastDiv) {
          forecastDiv.innerHTML = `<div class="alert alert-danger">${t('errors.loadForecast')}</div>`;
        }
      });
  }

  function createForecastCharts(gridData) {
    const forecastDiv = document.getElementById('forecast');
    if (!forecastDiv) return;

    forecastDiv.innerHTML = '';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'forecast-header';
    const updateTime = new Date(gridData.last_fetch_time);
    headerDiv.innerHTML = `<h4>5일 예보 <small>(${updateTime.toLocaleDateString('ko-KR')} ${updateTime.toLocaleTimeString('ko-KR')} 업데이트)</small></h4>`;
    forecastDiv.appendChild(headerDiv);

    const chartColors = {
      temperature: 'rgb(255, 99, 132)',
      wind: 'rgb(54, 162, 235)',
      snowfall: 'rgb(153, 102, 255)'
    };

    const now = new Date();
    const timeLabels = [];
    for (let i = 0; i <= 120; i += 3) {
      const time = new Date(now.getTime() + i * 60 * 60 * 1000);
      timeLabels.push(time);
    }

    const resorts = data.filter(resort => resort.name);

    const chartGrid = document.createElement('div');
    chartGrid.className = 'chart-grid';
    forecastDiv.appendChild(chartGrid);

    const forecastData = gridData.weathers;

    console.log("Weather data structure:", {
      lastFetchTime: gridData.last_fetch_time,
      weathersCount: forecastData.length,
      sampleData: forecastData[0] || null
    });

    resorts.forEach(resort => {
      const resortName = resort.name;
      const resortDisplayName = getResortName(resort);

      const resortData = forecastData.find(item =>
        item && typeof item === 'object' && item.resort === resortName
      );

      if (!resortData) {
        console.error(`No forecast data found for resort ${resortName}`);
        return;
      }

      const chartContainer = document.createElement('div');
      chartContainer.className = 'chart-container';

      const chartHeader = document.createElement('div');
      chartHeader.className = 'chart-header';

      const chartTitle = document.createElement('h4');
      chartTitle.textContent = resortDisplayName;
      chartHeader.appendChild(chartTitle);

      if (!resortData.forecasts) {
        console.error(`Invalid data format for resort ${resortName}:`, resortData);

        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-warning';
        errorMessage.textContent = t('errors.loadForecast');
        chartContainer.appendChild(errorMessage);
        chartGrid.appendChild(chartContainer);
        return;
      }

      // Ensure forecasts data is valid by filtering out null/undefined entries
      const validForecasts = resortData.forecasts.filter(f => f && typeof f === 'object');

      // Log the first forecast to debug
      if (validForecasts.length > 0) {
        console.log(`Sample forecast for ${resortName}:`, validForecasts[0]);
      }

      if (validForecasts.length === 0) {
        console.error(`No valid forecasts for resort ${resortName}`);

        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-warning';
        errorMessage.textContent = t('errors.loadForecast');
        chartContainer.appendChild(errorMessage);
        chartGrid.appendChild(chartContainer);
        return;
      }

      const maxTemp = Math.max(...validForecasts.map(d => d.temp || -Infinity));
      const minTemp = Math.min(...validForecasts.map(d => d.temp || Infinity));
      const totalSnowfall = validForecasts.reduce((sum, d) => sum + (d.snow_3h || 0), 0);

      const forecastSummary = document.createElement('div');
      forecastSummary.className = 'forecast-summary';
      forecastSummary.innerHTML = `
        <span class="temp-range">${t('forecast.temperature')}: ${minTemp.toFixed(1)}°C ~ ${maxTemp.toFixed(1)}°C</span>
        <span class="total-snow">${t('forecast.totalSnowfall')}: ${totalSnowfall.toFixed(1)}cm</span>
      `;
      chartHeader.appendChild(forecastSummary);

      chartContainer.appendChild(chartHeader);

      const canvas = document.createElement('canvas');
      canvas.id = `chart-${resort.id}`;
      chartContainer.appendChild(canvas);

      chartGrid.appendChild(chartContainer);

      const temperatureData = [];
      const windData = [];
      const snowfallData = [];
      const actualTimeLabels = [];

      // Sort forecasts by timestamp to ensure proper order
      validForecasts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Use actual forecast timestamps instead of generating new ones
      validForecasts.forEach(forecast => {
        if (forecast && forecast.timestamp) {
          const forecastTime = new Date(forecast.timestamp);

          // Only include forecasts in the next 120 hours
          if (forecastTime > now && forecastTime < new Date(now.getTime() + 120 * 60 * 60 * 1000)) {
            actualTimeLabels.push(forecastTime);
            temperatureData.push(forecast.temp);
            windData.push(forecast.wind_speed);
            snowfallData.push(forecast.snow_3h || 0);
          }
        }
      });

      // Configure chart theme for dark mode
      Chart.defaults.color = '#e0e0e0';
      Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

      // Create the chart
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: actualTimeLabels,
          datasets: [
            {
              label: t('forecast.tempLabel'),
              data: temperatureData,
              borderColor: chartColors.temperature,
              backgroundColor: chartColors.temperature + '33',
              borderWidth: 2,
              yAxisID: 'y',
              tension: 0.3,
              pointRadius: 3,
              pointHoverRadius: 5,
              fill: false,
              spanGaps: true
            },
            {
              label: t('forecast.windLabel'),
              data: windData,
              borderColor: chartColors.wind,
              backgroundColor: chartColors.wind + '33',
              borderWidth: 2,
              yAxisID: 'y1',
              tension: 0.3,
              pointRadius: 3,
              pointHoverRadius: 5,
              fill: false,
              spanGaps: true
            },
            {
              label: t('forecast.snowLabel'),
              data: snowfallData,
              borderColor: chartColors.snowfall,
              backgroundColor: chartColors.snowfall + '33',
              borderWidth: 2,
              yAxisID: 'y2',
              tension: 0.3,
              pointRadius: 3,
              pointHoverRadius: 5,
              fill: false,
              spanGaps: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            tooltip: {
              callbacks: {
                title: function (context) {
                  const date = new Date(context[0].parsed.x);
                  const locale = i18n.getLanguage() === 'ko' ? 'ko-KR' : 'en-US';
                  return date.toLocaleDateString(locale) + ' ' +
                    date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                }
              },
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#ffffff',
              bodyColor: '#ffffff',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              borderWidth: 1
            },
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 15,
                color: '#e0e0e0',
                font: {
                  weight: 'bold'
                }
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'day',
                displayFormats: {
                  day: 'M/d'
                },
                tooltipFormat: i18n.getLanguage() === 'ko' ? 'yyyy년 MM월 dd일 HH:mm' : 'MMM d, yyyy HH:mm'
              },
              title: {
                display: true,
                text: t('forecast.dateTime'),
                color: '#e0e0e0',
                font: {
                  weight: 'bold'
                }
              },
              ticks: {
                maxRotation: 0,
                color: '#e0e0e0'
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
                borderColor: 'rgba(255, 255, 255, 0.2)'
              }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: t('forecast.tempLabel'),
                color: chartColors.temperature,
                font: {
                  weight: 'bold'
                }
              },
              suggestedMin: minTemp - 5,
              suggestedMax: maxTemp + 5,
              ticks: {
                color: '#e0e0e0'
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
                borderColor: 'rgba(255, 255, 255, 0.2)'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: t('forecast.windLabel'),
                color: chartColors.wind,
                font: {
                  weight: 'bold'
                }
              },
              grid: {
                drawOnChartArea: false,
                color: 'rgba(255, 255, 255, 0.1)',
                borderColor: 'rgba(255, 255, 255, 0.2)'
              },
              ticks: {
                color: '#e0e0e0'
              }
            },
            y2: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: t('forecast.snowLabel'),
                color: chartColors.snowfall,
                font: {
                  weight: 'bold'
                }
              },
              grid: {
                drawOnChartArea: false,
                color: 'rgba(255, 255, 255, 0.1)',
                borderColor: 'rgba(255, 255, 255, 0.2)'
              },
              suggestedMin: 0,
              suggestedMax: Math.max(...snowfallData) * 1.5 || 10,
              ticks: {
                color: '#e0e0e0'
              }
            }
          }
        }
      });
    });

    if (chartGrid.children.length === 0) {
      forecastDiv.innerHTML = '<div class="alert alert-info">예보 데이터가 없습니다.</div>';
    }
  }

  let scrollTimeout;
  function onScrollOrResize() {
    if (scrollTimeout) {
      cancelAnimationFrame(scrollTimeout);
    }
    scrollTimeout = requestAnimationFrame(manageVideoPlayback);
  }

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      activePlayers.forEach(player => {
        if (!player.paused()) {
          player.pause();
        }
      });
      activeVivaldiPlayers.forEach(player => {
        if (!player.paused()) {
          player.pause();
        }
      });
    } else {
      manageVideoPlayback();
    }
  });

  function manageVideoPlayback() {
    if (!settings.autoplay || document.hidden) return;

    // Filter out disposed players or those not in the DOM
    activePlayers = activePlayers.filter(player => {
      const el = player.el();
      return el && document.body.contains(el);
    });

    // Filter out disposed Vivaldi players or those not in the DOM
    activeVivaldiPlayers = activeVivaldiPlayers.filter(player => {
      const el = player.el();
      return el && document.body.contains(el);
    });

    // Combine Video.js players and Vivaldi players for unified management
    const allPlayers = [...activePlayers, ...activeVivaldiPlayers];

    const playersWithPosition = allPlayers.map(player => {
      const el = player.el();
      const rect = el.getBoundingClientRect();

      const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      const visibleRatio = rect.height > 0 ? Math.max(0, visibleHeight) / rect.height : 0;

      const visible = visibleRatio > 0.3;

      return {
        player,
        rect,
        visible,
        top: rect.top
      };
    });

    const visiblePlayers = playersWithPosition.filter(p => p.visible);
    visiblePlayers.sort((a, b) => a.top - b.top);

    const MAX_CONCURRENT = isMobile ? 4 : 9;
    const playersToPlay = visiblePlayers.slice(0, MAX_CONCURRENT).map(p => p.player);

    allPlayers.forEach(player => {
      if (playersToPlay.includes(player)) {
        // Should play
        if (player.paused()) {
          const playPromise = player.play();
          if (playPromise !== undefined && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
              // Auto-play was prevented
            });
          }
        }
      } else {
        // Should pause
        if (!player.paused()) {
          player.pause();
        }
      }
    });
  }

  /* Bug Report Modal Logic */
  const bugReportButton = document.getElementById('bugReportButton');
  const bugReportModal = document.getElementById('bugReportModal');
  const closeBugReportModal = document.getElementById('closeBugReportModal');
  const bugReportForm = document.getElementById('bugReportForm');

  if (bugReportButton && bugReportModal) {
    bugReportButton.addEventListener('click', function () {
      bugReportModal.classList.add('active');
    });

    closeBugReportModal.addEventListener('click', function () {
      bugReportModal.classList.remove('active');
    });

    window.addEventListener('click', function (event) {
      if (event.target === bugReportModal) {
        bugReportModal.classList.remove('active');
      }
    });

    bugReportForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const recaptchaResponse = grecaptcha.getResponse();
      if (!recaptchaResponse) {
        alert(t('bugReport.captchaRequired'));
        return;
      }

      const type = document.getElementById('reportType').value;
      const subheaderTitle = document.getElementById('reportTitle').value; // Changed variable name to avoid conflict with field ID
      const content = document.getElementById('reportContent').value;
      const submitButton = bugReportForm.querySelector('.submit-button');

      submitButton.disabled = true;
      submitButton.textContent = t('bugReport.submitting');

      const payload = {
        recaptchaResponse: recaptchaResponse,
        type: type,
        title: subheaderTitle,
        content: content
      };

      fetch('report.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            alert(t('bugReport.submitted'));
            bugReportModal.classList.remove('active');
            bugReportForm.reset();
            grecaptcha.reset();
          } else {
            alert(t('bugReport.submitFailed') + ': ' + (data.error || 'error'));
            console.error('Server Error:', data);
          }
        })
        .catch(error => {
          console.error('Error:', error);
          alert(t('bugReport.submitError'));
        })
        .finally(() => {
          submitButton.disabled = false;
          submitButton.textContent = t('bugReport.submit');
        });
    });
  }

  initializeApp();
});
