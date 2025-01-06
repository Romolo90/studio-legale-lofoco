const App = {
  init() {
    this.initCookieManager();
    this.initMenu();
    this.initScrollToTop();
    this.initAccordion();
    this.initFormValidation();
  },

  const CookieManager = {
  init() {
    const cookieBanner = document.getElementById("cookie-banner");
    const cookiePreferences = document.getElementById("cookie-preferences");
    const acceptCookiesBtn = document.getElementById("accept-cookies");
    const manageCookiesBtn = document.getElementById("manage-cookies");
    const savePreferencesBtn = document.getElementById("save-preferences");

    acceptCookiesBtn?.addEventListener("click", () => {
      this.acceptCookies(cookieBanner);
    });

    manageCookiesBtn?.addEventListener("click", () => {
      cookiePreferences.style.display = "block";
    });

    savePreferencesBtn?.addEventListener("click", () => {
      this.savePreferences(cookiePreferences);
    });

    if (this.hasAcceptedCookies()) {
      this.hideBanner(cookieBanner);
    }
  },
  acceptCookies(banner) {
    document.cookie = "cookiesAccepted=true; path=/; max-age=" + 60 * 60 * 24 * 365;
    this.hideBanner(banner);
  },
  savePreferences(preferencesDiv) {
    const checkboxes = document.querySelectorAll("#cookie-preferences input[name='cookieType']");
    const preferences = Array.from(checkboxes).reduce((prefs, checkbox) => {
      prefs[checkbox.value] = checkbox.checked;
      return prefs;
    }, {});
    document.cookie = `cookiePreferences=${JSON.stringify(preferences)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    preferencesDiv.style.display = "none";
  },
  hasAcceptedCookies() {
    return document.cookie.includes("cookiesAccepted=true");
  },
  hideBanner(banner) {
    banner.style.display = "none";
  },
};

document.addEventListener('DOMContentLoaded', () => {
  CookieManager.init();
});

  // ======== MENU MOBILE ========
  initMenu() {
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const mainNav = document.getElementById('mainNav');

    if (hamburgerMenu) {
      hamburgerMenu.addEventListener('click', () => {
        mainNav.classList.toggle('active');
      });
    }
    mainNav?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('active');
      });
    });
  },

  // ======== SCROLL TO TOP ========
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

  // ======== ACCORDION ========
  initAccordion() {
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const isExpanded = header.getAttribute('aria-expanded') === 'true';

        // Chiudi tutti gli accordion
        accordionHeaders.forEach(h => h.setAttribute('aria-expanded', 'false'));

        // Apri solo quello cliccato
        if (!isExpanded) {
          header.setAttribute('aria-expanded', 'true');
        }
      });
    });
  },

  // ======== FORM VALIDATION ========
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
  },
};

// Inizializza l'app dopo il caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
