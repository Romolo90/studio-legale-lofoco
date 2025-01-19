// Funzioni di utilità per il logging
const Logger = {
  log(message) {
    console.log(message);
  },
  error(message) {
    console.error(message);
  }
};

// Oggetto principale dell'applicazione
const App = {
  init() {
    this.initModules();
  },

  initModules() {
    Logger.log("Inizializzazione dei moduli...");
    const modules = [CookieManager, MenuManager, ScrollManager, AccordionManager, FormValidator];
    modules.forEach(module => module.init ? module.init() : Logger.error("Init method missing in module"));
  }
};

// Gestione dei cookie
const CookieManager = {
  init() {
    this.setupCookieConsentElements();
    this.handleCookieConsent();
  },

  setupCookieConsentElements() {
    this.cookieBanner = document.getElementById('cookie-banner');
    this.cookiePreferences = document.getElementById('cookie-preferences');
    this.acceptCookiesBtn = document.getElementById('accept-cookies');
    this.manageCookiesBtn = document.getElementById('manage-cookies');
    this.savePreferencesBtn = document.getElementById('save-preferences');
  },

  handleCookieConsent() {
    this.acceptCookiesBtn?.addEventListener('click', () => this.acceptAllCookies());
    this.manageCookiesBtn?.addEventListener('click', () => this.showPreferences());
    this.savePreferencesBtn?.addEventListener('click', () => this.savePreferences());

    if (this.hasAcceptedCookies()) {
      this.hideBanner();
    }
  },

  acceptAllCookies() {
    document.cookie = "cookiesAccepted=true; path=/; max-age=" + 60 * 60 * 24 * 365;
    this.hideBanner();
  },

  showPreferences() {
    this.cookiePreferences.style.display = 'block';
    this.cookieBanner.style.display = 'none';
  },

  savePreferences() {
    const checkboxes = document.querySelectorAll("#cookie-preferences input[name='cookieType']");
    const preferences = Array.from(checkboxes).reduce((prefs, checkbox) => {
      prefs[checkbox.value] = checkbox.checked;
      return prefs;
    }, {});

    document.cookie = `cookiePreferences=${JSON.stringify(preferences)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    this.cookiePreferences.style.display = 'none';
  },

  hasAcceptedCookies() {
    return document.cookie.includes('cookiesAccepted=true');
  },

  hideBanner() {
    this.cookieBanner.style.display = 'none';
    this.cookiePreferences.style.display = 'none';
  }
};

const MenuManager = {
  init() {
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const mainNav = document.getElementById('mainNav');

    hamburgerMenu?.addEventListener('click', () => {
      mainNav?.classList.toggle('active');
    });

    mainNav?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('active');
      });
    });
  }
};

const ScrollManager = {
  init() {
    const scrollToTopBtn = document.getElementById('scrollToTop');
    window.addEventListener('scroll', () => {
      scrollToTopBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
    });

    scrollToTopBtn?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
};

const AccordionManager = {
  init() {
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        document.querySelectorAll('.accordion-header').forEach(h => h.setAttribute('aria-expanded', 'false'));
        if (!isExpanded) {
          header.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }
};

const FormValidator = {
  init() {
    const form = document.querySelector('.contact-form');
    form?.addEventListener('submit', this.validateForm);
  },

  validateForm(e) {
    const privacyCheckbox = document.getElementById('privacy');
    if (!privacyCheckbox.checked) {
      e.preventDefault();
      alert('Devi accettare la Privacy Policy e i Termini di Servizio prima di inviare.');
    }
  }
};

// Inizializzazione dell'app al caricamento del DOM
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
