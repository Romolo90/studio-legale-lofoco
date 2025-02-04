'use strict';

const ONE_YEAR = 60 * 60 * 24 * 365; // Durata in secondi

// Oggetto principale dell'applicazione
const App = {
  init() {
    this.initCookieManager();
    this.initMenu();
    this.initScrollToTop();
    this.initAccordion();
    this.initFormValidation();
  },

  initCookieManager() {
    CookieManager.init();
  },

  initMenu() {
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const mainNav = document.getElementById('mainNav');

    if (hamburgerMenu && mainNav) {
      hamburgerMenu.addEventListener('click', () => {
        mainNav.classList.toggle('active');
      });

      mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          mainNav.classList.remove('active');
        });
      });
    }
  },

  initScrollToTop() {
    const scrollToTopBtn = document.getElementById('scrollToTop');
    if (scrollToTopBtn) {
      window.addEventListener('scroll', () => {
        scrollToTopBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
      });

      scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  },

  initAccordion() {
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        // Collassa tutti gli accordion
        accordionHeaders.forEach(h => h.setAttribute('aria-expanded', 'false'));
        // Se l'elemento cliccato non era già aperto, espandilo
        if (!isExpanded) {
          header.setAttribute('aria-expanded', 'true');
        }
      });
    });
  },

  initFormValidation() {
    const privacyCheckbox = document.getElementById('privacy');
    const form = document.querySelector('.contact-form');
    if (form && privacyCheckbox) {
      form.addEventListener('submit', e => {
        if (!privacyCheckbox.checked) {
          e.preventDefault();
          alert('Devi accettare la Privacy Policy e i Termini di Servizio prima di inviare.');
        }
      });
    }
  }
};

// Gestione dei cookie
const CookieManager = {
  init() {
    this.cookieBanner = document.getElementById('cookie-banner');
    this.cookiePreferences = document.getElementById('cookie-preferences');
    this.acceptCookiesBtn = document.getElementById('accept-cookies');
    this.manageCookiesBtn = document.getElementById('manage-cookies');
    this.savePreferencesBtn = document.getElementById('save-preferences');

    if (this.acceptCookiesBtn) {
      this.acceptCookiesBtn.addEventListener('click', () => {
        this.acceptAllCookies();
      });
    }

    if (this.manageCookiesBtn) {
      this.manageCookiesBtn.addEventListener('click', () => {
        this.openPreferences();
      });
    }

    if (this.savePreferencesBtn) {
      this.savePreferencesBtn.addEventListener('click', () => {
        this.savePreferences();
      });
    }

    // Se l'utente ha già acconsentito, nascondi il banner
    if (this.hasAcceptedCookies()) {
      this.hideBanner();
    }
  },

  acceptAllCookies() {
    document.cookie = `cookiesAccepted=true; path=/; max-age=${ONE_YEAR}`;
    this.hideBanner();
    // Carica il Google Tag (gtag.js) al momento del consenso
    loadGoogleTag();
  },

  openPreferences() {
    if (this.cookiePreferences && this.cookieBanner) {
      this.cookiePreferences.style.display = 'block';
      this.cookieBanner.style.display = 'none';
    }
  },

  savePreferences() {
    const checkboxes = document.querySelectorAll("#cookie-preferences input[name='cookieType']");
    const preferences = Array.from(checkboxes).reduce((prefs, checkbox) => {
      prefs[checkbox.value] = checkbox.checked;
      return prefs;
    }, {});
    
    document.cookie = `cookiePreferences=${encodeURIComponent(JSON.stringify(preferences))}; path=/; max-age=${ONE_YEAR}`;
    if (this.cookiePreferences) {
      this.cookiePreferences.style.display = 'none';
    }
  },

  hasAcceptedCookies() {
    // Controlla se esiste il cookie "cookiesAccepted" impostato su "true"
    return document.cookie
      .split(';')
      .some(cookie => cookie.trim().startsWith('cookiesAccepted=true'));
  },

  hideBanner() {
    if (this.cookieBanner) {
      this.cookieBanner.style.display = 'none';
    }
    if (this.cookiePreferences) {
      this.cookiePreferences.style.display = 'none';
    }
  }
};

// Funzione per caricare Google Tag (gtag.js) dinamicamente
function loadGoogleTag() {
  var gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-E7P6F0SVRY';
  document.head.appendChild(gtagScript);
  gtagScript.onload = function() {
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-E7P6F0SVRY');
  };
}

// Inizializzazione dell'app al caricamento del DOM
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
