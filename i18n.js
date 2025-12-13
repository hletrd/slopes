const i18n = (function () {
  const SUPPORTED_LANGUAGES = ['en', 'ko'];
  const DEFAULT_LANGUAGE = 'ko';
  const STORAGE_KEY = 'webcamLanguage';

  let currentLanguage = DEFAULT_LANGUAGE;
  let translations = {};
  let isLoaded = false;

  function getPreferredLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
      return saved;
    }

    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang) {
      const langCode = browserLang.split('-')[0].toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(langCode)) {
        return langCode;
      }
    }

    return DEFAULT_LANGUAGE;
  }

  async function loadTranslations(lang) {
    try {
      const response = await fetch(`lang/${lang}.json?v=${new Date().getTime()}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${lang} translations`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error loading translations for ${lang}:`, error);
      return null;
    }
  }

  function get(key, params = {}) {
    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation is not a string: ${key}`);
      return key;
    }

    return value.replace(/\{(\w+)\}/g, (match, paramName) => {
      return params[paramName] !== undefined ? params[paramName] : match;
    });
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = get(key);

      const attrMatch = key.match(/^\[(\w+)\](.+)$/);
      if (attrMatch) {
        element.setAttribute(attrMatch[1], get(attrMatch[2]));
      } else {
        if (element.hasAttribute('data-i18n-html')) {
          element.innerHTML = translation;
        } else {
          element.textContent = translation;
        }
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = get(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = get(key);
    });

    if (!window.location.hash) {
      document.title = get('site.fullTitle');
    }

    document.dispatchEvent(new CustomEvent('i18n:loaded', { detail: { language: currentLanguage } }));
  }

  async function init() {
    currentLanguage = getPreferredLanguage();
    translations = await loadTranslations(currentLanguage);

    if (!translations) {
      currentLanguage = DEFAULT_LANGUAGE;
      translations = await loadTranslations(DEFAULT_LANGUAGE);
    }

    if (translations) {
      isLoaded = true;
      applyTranslations();
    }

    return isLoaded;
  }

  async function setLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      console.error(`Unsupported language: ${lang}`);
      return false;
    }

    if (lang === currentLanguage && isLoaded) {
      return true;
    }

    const newTranslations = await loadTranslations(lang);
    if (newTranslations) {
      translations = newTranslations;
      currentLanguage = lang;
      localStorage.setItem(STORAGE_KEY, lang);
      applyTranslations();
      return true;
    }

    return false;
  }

  function getLanguage() {
    return currentLanguage;
  }

  function getSupportedLanguages() {
    return [...SUPPORTED_LANGUAGES];
  }

  function getResortName(resortId, defaultName) {
    const key = `resorts.${resortId}.name`;
    const result = get(key);
    return result === key ? defaultName : result;
  }

  function getWebcamName(resortId, webcamIndex, defaultName) {
    const key = `resorts.${resortId}.webcams.${webcamIndex}`;
    const result = get(key);
    return result === key ? defaultName : result;
  }

  return {
    init,
    get,
    t: get,
    setLanguage,
    getLanguage,
    getSupportedLanguages,
    applyTranslations,
    getResortName,
    getWebcamName
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = i18n;
} else {
  window.i18n = i18n;
}
