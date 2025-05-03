if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    } else {
      navigator.serviceWorker.register('./service-worker.js')
        .then(function(registration) {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch(function(error) {
          console.log('ServiceWorker registration failed: ', error);
        });
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const toggleMenu = document.querySelector('.toggle-menu');
  const sidebar = document.querySelector('.sidebar');
  const sidebarBackdrop = document.querySelector('.sidebar-backdrop');
  const mainContent = document.querySelector('.main-content');
  const basicTitle = "Slopes cam";
  let activePlayers = [];
  let activeResort = null;
  let activeWebcam = null;
  let data = [];
  let weatherData = [];
  let isMobile = window.innerWidth <= 768;
  let favorites = loadFavorites();
  let settings = loadSettings();

  function loadSettings() {
    try {
      const settingsData = localStorage.getItem('webcamSettings');
      if (settingsData) {
        return JSON.parse(settingsData);
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }

    return {
      autoplay: !isMobile // Default: enabled on desktop, disabled on mobile
    };
  }

  function saveSettings() {
    try {
      localStorage.setItem('webcamSettings', JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  }

  const settingsButton = document.getElementById('settingsButton');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsModal = document.getElementById('closeSettingsModal');
  const autoplayToggle = document.getElementById('autoplayToggle');

  autoplayToggle.checked = settings.autoplay;

  autoplayToggle.addEventListener('change', function() {
    settings.autoplay = this.checked;
    saveSettings();
  });

  settingsButton.addEventListener('click', function() {
    settingsModal.style.display = 'block';
  });

  closeSettingsModal.addEventListener('click', function() {
    settingsModal.style.display = 'none';
  });

  window.addEventListener('click', function(event) {
    if (event.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });

  const infoButton = document.getElementById('infoButton');
  const infoModal = document.getElementById('infoModal');
  const closeInfoModal = document.getElementById('closeInfoModal');

  infoButton.addEventListener('click', function() {
    infoModal.style.display = 'flex';
  });

  closeInfoModal.addEventListener('click', function() {
    infoModal.style.display = 'none';
  });

  window.addEventListener('click', function(event) {
    if (event.target === infoModal) {
      infoModal.style.display = 'none';
    }
  });

  const addToHomeButton = document.getElementById('addToHomeButton');
  const installationModal = document.getElementById('installationModal');
  const closeModal = document.getElementById('closeModal');

  addToHomeButton.addEventListener('click', function() {
    installationModal.style.display = 'block';
    setTimeout(function() {
      installationModal.classList.add('active');
    }, 10);
  });

  closeModal.addEventListener('click', function() {
    installationModal.classList.remove('active');
    setTimeout(function() {
      installationModal.style.display = 'none';
    }, 400);
  });

  installationModal.addEventListener('click', function(event) {
    if (event.target === installationModal) {
      closeModal.click();
    }
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
      instruction.innerHTML = '<p>북마크한 영상이 없습니다. 영상 오른쪽 위의 북마크 버튼을 눌러 영상을 추가해 보세요.<br>북마크는 같은 브라우저에서만 저장됩니다.</p>';
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
      locationName.addEventListener('click', function() {
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
      removeButton.setAttribute('title', '북마크 제거');
      removeButton.addEventListener('click', function(e) {
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
      timeSpan.textContent = `${month}월 ${day}일 ${hours}:${minutes} 기준`;
      if (displaySource) {
        if (data.name.startsWith('리조트_')) {
          timeSpan.textContent += ` (리조트 제공)`;
        } else {
          timeSpan.textContent += ` (기상청 제공)`;
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
    allResortsWeatherContainer.innerHTML = '<h3>전국 스키장 날씨 <span style="font-size: 0.6em; font-weight: normal; color: #999; margin-left: 6px;">기상청 데이터 기준</span></h3>';

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
    resortProvidedWeatherTitle.textContent = '전국 스키장 날씨';
    const resortProvidedWeatherSpan = document.createElement('span');
    resortProvidedWeatherSpan.textContent = '리조트 데이터 기준';
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
        const webcamName = webcams[webcamIndex].name;
        document.title = `${basicTitle} - ${webcamName} - ${resort.name}`;
      } else {
        document.title = `${basicTitle} - ${resort.name}`;
      }
    } else {
      document.title = `${basicTitle} - ${resort.name}`;
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

        document.title = `${basicTitle} - 유용한 기능`;
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

          document.title = `${basicTitle} - 일기예보`;
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
                            webcams[webcamIndex].name,
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
      cardTitle.textContent = webcam.name;
      cardTitle.className = 'cursor-pointer';
      cardTitle.addEventListener('click', function() {
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
        webcam.name,
        videoUrl,
        webcam.video_type
      );
    });

    updateFavoriteButtons();

    updateWeatherDisplay(resortId);
  }

  function initializeResorts(resorts) {
    data = resorts;

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
    miscMenuItem.textContent = '유용한 기능';
    miscMenuItemContainer.appendChild(miscMenuItem);

    const dropdownToggle = document.createElement('span');
    dropdownToggle.className = 'dropdown-toggle';
    dropdownToggle.innerHTML = '<i class="bi bi-chevron-down"></i>';
    dropdownToggle.setAttribute('aria-label', 'Toggle submenu');
    miscMenuItem.appendChild(dropdownToggle);

    dropdownToggle.addEventListener('click', function(e) {
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
    forecastSubmenuItem.textContent = '일기예보';
    miscSubmenu.appendChild(forecastSubmenuItem);

    const forecastSection = document.createElement('div');
    forecastSection.className = 'content-section';
    forecastSection.id = 'misc-forecast';

    const forecastTitle = document.createElement('h2');
    forecastTitle.textContent = '일기예보';
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

    forecastSubmenuItem.addEventListener('click', function() {
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
      document.title = `${basicTitle} - 일기예보`;

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
    miscTitle.textContent = '유용한 기능';
    miscTitle.className = 'inline-title';
    miscSection.appendChild(miscTitle);

    const miscContent = document.createElement('div');
    miscContent.className = 'misc-content';
    miscContent.innerHTML = `
      <p>메뉴에서 기능을 선택하세요.</p>
    `;
    miscSection.appendChild(miscContent);

    mainContent.appendChild(miscSection);

    miscMenuItem.addEventListener('click', function(e) {
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
      document.title = `${basicTitle} - 유용한 기능`;

      closeSidebar();
    });

    resorts.forEach(resort => {
      const resortId = resort.id;
      const resortName = resort.name;
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
      menuItem.textContent = resortName;
      menuItemContainer.appendChild(menuItem);

      if (hasSubmenu) {
        const dropdownToggle = document.createElement('span');
        dropdownToggle.className = 'dropdown-toggle';
        dropdownToggle.innerHTML = '<i class="bi bi-chevron-down"></i>';
        dropdownToggle.setAttribute('aria-label', 'Toggle submenu');
        menuItem.appendChild(dropdownToggle);

        dropdownToggle.addEventListener('click', function(e) {
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
      contentTitle.textContent = resortName;
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
          statusItem.innerHTML = '오픈현황 <i class="bi bi-box-arrow-up-right me-1"></i>';
          submenu.appendChild(statusItem);

          statusItem.addEventListener('click', function() {
            window.open(resort.status, '_blank', 'noopener,noreferrer');
          });
        }

        webcams.forEach((webcam, index) => {
          const webcamName = webcam.name;
          if (!webcamName) return;

          const submenuItem = document.createElement('div');
          submenuItem.className = 'submenu-item';
          submenuItem.setAttribute('data-target', `${resortId}-webcam-${index}`);
          submenuItem.setAttribute('data-webcam-index', index);
          submenuItem.textContent = webcamName;
          submenu.appendChild(submenuItem);

          const webcamSection = document.createElement('div');
          webcamSection.className = 'content-section';
          webcamSection.id = `${resortId}-webcam-${index}`;

          const webcamTitle = document.createElement('h2');
          webcamTitle.textContent = webcamName;
          webcamTitle.className = 'inline-title inline-title-submenu cursor-pointer';
          webcamTitle.addEventListener('click', function() {
            const submenuItem = document.querySelector(`#${resortId}-submenu .submenu-item[data-webcam-index="${index}"]`);
            if (submenuItem) {
              submenuItem.click();
            }
          });
          webcamSection.appendChild(webcamTitle);

          const resortLabel = document.createElement('span');
          resortLabel.textContent = resortName;
          resortLabel.className = 'resort-label';
          webcamSection.appendChild(resortLabel);

          const videoContainer = document.createElement('div');
          videoContainer.className = 'video-container';
          webcamSection.appendChild(videoContainer);

          mainContent.appendChild(webcamSection);

          submenuItem.addEventListener('click', function() {
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

      menuItem.addEventListener('click', function(e) {
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

  function createVideoPlayer(videoUrl, container, id, videoType) {
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
          webcamName = webcams[webcamIndex].name || '';
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

        vivaldiContainer.innerHTML = `<iframe src="vivaldi.html?channel=${channel}&serial=${serial}&autoplay=${settings.autoplay}" allowfullscreen></iframe>`;
        container.appendChild(vivaldiContainer);

        if (resortId && !isNaN(webcamIndex)) {
          addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, BookmarkButtonType.VIVALDI);
        }

        const captureBtn = document.createElement('button');
        captureBtn.className = 'capture-button';
        captureBtn.innerHTML = `
          <i class="bi bi-camera"></i>
          캡처
          `;
        captureBtn.addEventListener('click', () => captureScreenshot(container));
        container.appendChild(captureBtn);

        return {
          dispose: function() {
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
        dispose: function() {
          container.innerHTML = '';
        }
      };
    }

    if (videoType === 'youtube') {
      const youtubeContainer = document.createElement('div');
      youtubeContainer.className = 'iframe-container';

      const youtubeId = getYoutubeId(videoUrl);
      if (youtubeId) {
        const autoplayParam = settings.autoplay ? '1' : '0';
        youtubeContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplayParam}&mute=1" allowfullscreen></iframe>`;
        container.appendChild(youtubeContainer);

        if (resortId && !isNaN(webcamIndex)) {
          addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, BookmarkButtonType.YOUTUBE);
        }

        return {
          dispose: function() {
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
        외부 링크
      `;

      linkContainer.appendChild(linkButton);
      container.appendChild(linkContainer);

      if (resortId && !isNaN(webcamIndex)) {
        addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, BookmarkButtonType.LINK);
      }

      return {
        dispose: function() {
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
      >
        <source src="${videoUrl}" type="application/x-mpegURL">
        <p class="vjs-no-js">
          최신 브라우저를 사용하세요.
        </p>
      </video>
    `;

    try {
      const player = videojs(`webcam-player-${id}`, {
        liveui: true,
        responsive: true,
        fluid: false,
        crossorigin: "anonymous",
        liveTracker: {
          trackingThreshold: 0
        },
        controlBar: {
          captionsButton: false,
          pictureInPictureToggle: false
        },
        notSupportedMessage: '비디오 재생 중 오류가 발생했습니다.'
      });

      const captureBtn = document.createElement('button');
      captureBtn.className = 'capture-button';
      captureBtn.innerHTML = `
        <i class="bi bi-camera"></i>
        캡처
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

      player.on('error', function() {
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

        let errorHtml = '<div class="error-message"><p>비디오 재생 중 오류가 발생했습니다.</p>';

        if (directLink) {
          errorHtml += `<div class="mt-3">
            <a href="${directLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
              <i class="bi bi-box-arrow-up-right me-2"></i>
              원본 링크에서 보기
            </a>
          </div>`;
        }

        errorHtml += '</div>';
        container.innerHTML = errorHtml;

        if (resortId && !isNaN(webcamIndex)) {
          addBookmarkButton(container, resortId, webcamIndex, webcamName, videoUrl, videoType, BookmarkButtonType.ERROR);
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
      북마크
    `;
    bookmarkBtn.addEventListener('click', function() {
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

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const playerId = player.el().id;
      let resortId, webcamIndex;

      if (playerId) {
        const idParts = playerId.replace('webcam-player-', '').split('-');
        if (idParts.length >= 2) {
          if (idParts[1] === 'grid') {
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
              const resortName = getResortNameForCapture(player.el());
              const webcamName = getWebcamNameForCapture(player.el());
              const timestamp = formatTimestamp();
              const filename = `capture_${resortName}_${webcamName}_${timestamp}.jpg`;

              const dataURL = canvas.toDataURL('image/jpeg');
              downloadImage(dataURL, filename);

              const container = player.el().parentNode;

              showSuccessMessage(container);

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
      alert('캡처 중 오류가 발생했습니다.');
    }
  }

  function showSuccessMessage(container) {
    const successMsg = document.createElement('div');
    successMsg.className = 'alert alert-success position-absolute top-0 start-50 translate-middle-x mt-3 success-message';
    successMsg.textContent = '캡처 완료!';
    container.appendChild(successMsg);

    setTimeout(() => {
      successMsg.classList.add('fade-out');
      setTimeout(() => {
        successMsg.remove();
      }, 500);
    }, 2000);
  }

  function captureScreenshot(container) {
    try {
      const iframe = container.querySelector('iframe');
      if (!iframe) {
        alert('캡처할 영상을 찾을 수 없습니다.');
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

        showSuccessMessage(container);
      });
    } catch (e) {
      console.error('Error capturing screenshot:', e);
      alert('캡처 중 오류가 발생했습니다.');
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
        return sanitizeForFilename(resort.name);
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
    const videoContainer = element.closest('.video-container');
    const favoriteCard = videoContainer?.closest('.favorite-card');
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
            return sanitizeForFilename(webcams[webcamIndex].name);
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
              return sanitizeForFilename(webcams[webcamIndex].name);
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

    const resortId = parts[0];
    let webcamIndex = parseInt(parts[1]);

    if (parts.length === 3 && parts[1] === 'grid') {
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

  window.addEventListener('resize', function() {
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
          defaultMessage.innerHTML = '<div class="error-message p-5 text-center"><h3>리조트 정보를 불러오지 못했습니다.</h3><p>페이지를 새로고침하세요.</p></div>';
          defaultMessage.classList.add('active');
        } else {
          mainContent.innerHTML = '<div class="error-message">리조트 정보를 불러오지 못했습니다.</div>';
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
          forecastDiv.innerHTML = '<div class="alert alert-danger">일기예보 데이터를 불러오지 못했습니다.</div>';
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

    resorts.forEach(resort => {
      const resortName = resort.name;

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
      chartTitle.textContent = resortName;
      chartHeader.appendChild(chartTitle);

      if (!resortData.forecasts) {
        console.error(`Invalid data format for resort ${resortName}:`, resortData);

        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-warning';
        errorMessage.textContent = `${resortName}의 예보 데이터를 불러올 수 없습니다.`;
        chartContainer.appendChild(errorMessage);
        chartGrid.appendChild(chartContainer);
        return;
      }

      const maxTemp = Math.max(...resortData.forecasts.map(d => d.temp || -Infinity));
      const minTemp = Math.min(...resortData.forecasts.map(d => d.temp || Infinity));
      const totalSnowfall = resortData.forecasts.reduce((sum, d) => sum + (d.snow_3h || 0), 0);

      const forecastSummary = document.createElement('div');
      forecastSummary.className = 'forecast-summary';
      forecastSummary.innerHTML = `
        <span class="temp-range">기온: ${minTemp.toFixed(1)}°C ~ ${maxTemp.toFixed(1)}°C</span>
        <span class="total-snow">총 강설량: ${totalSnowfall.toFixed(1)}cm</span>
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

      timeLabels.forEach(time => {
        const timePoint = resortData.forecasts.find(d => {
          const forecastTime = new Date(d.timestamp);
          return Math.abs(forecastTime - time) < 3 * 60 * 60 * 1000; // Within 3 hours
        });

        if (timePoint) {
          temperatureData.push(timePoint.temp);
          windData.push(timePoint.wind_speed);
          snowfallData.push(timePoint.snow_3hr || 0);
        } else {
          temperatureData.push(null);
          windData.push(null);
          snowfallData.push(null);
        }
      });

      new Chart(canvas, {
        type: 'line',
        data: {
          labels: timeLabels,
          datasets: [
            {
              label: '기온 (°C)',
              data: temperatureData,
              borderColor: chartColors.temperature,
              backgroundColor: chartColors.temperature + '33',
              borderWidth: 2,
              yAxisID: 'y',
              tension: 0.3,
              pointRadius: 3,
              pointHoverRadius: 5
            },
            {
              label: '풍속 (m/s)',
              data: windData,
              borderColor: chartColors.wind,
              backgroundColor: chartColors.wind + '33',
              borderWidth: 2,
              yAxisID: 'y1',
              tension: 0.3,
              pointRadius: 3,
              pointHoverRadius: 5
            },
            {
              label: '강설량 (cm/3h)',
              data: snowfallData,
              borderColor: chartColors.snowfall,
              backgroundColor: chartColors.snowfall + '33',
              borderWidth: 2,
              yAxisID: 'y2',
              tension: 0.3,
              pointRadius: 3,
              pointHoverRadius: 5
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
                title: function(context) {
                  const date = new Date(context[0].parsed.x);
                  return date.toLocaleDateString('ko-KR') + ' ' +
                         date.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'});
                }
              }
            },
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 15
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
                tooltipFormat: 'yyyy년 MM월 dd일 HH:mm'
              },
              title: {
                display: true,
                text: '날짜/시간',
                font: {
                  weight: 'bold'
                }
              },
              ticks: {
                maxRotation: 0
              }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: '기온 (°C)',
                font: {
                  weight: 'bold'
                }
              },
              suggestedMin: minTemp - 5,
              suggestedMax: maxTemp + 5
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: '풍속 (m/s)',
                font: {
                  weight: 'bold'
                }
              },
              grid: {
                drawOnChartArea: false
              }
            },
            y2: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: '강설량 (cm/3h)',
                font: {
                  weight: 'bold'
                }
              },
              grid: {
                drawOnChartArea: false
              },
              suggestedMin: 0,
              suggestedMax: Math.max(...snowfallData) * 1.5 || 10
            }
          }
        }
      });
    });

    if (chartGrid.children.length === 0) {
      forecastDiv.innerHTML = '<div class="alert alert-info">예보 데이터가 없습니다.</div>';
    }
  }

  initializeApp();
});