(function() {
  // Main App object
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
          // Collapse all accordion headers
          accordionHeaders.forEach(h => h.setAttribute('aria-expanded', 'false'));
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

  // Cookie Manager object
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

      if (this.hasAcceptedCookies()) {
        this.hideBanner();
      }
    },

    acceptAllCookies() {
      document.cookie = "cookiesAccepted=true; path=/; max-age=" + 60 * 60 * 24 * 365;
      this.hideBanner();
    },

    openPreferences() {
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
      // A simple cookie check; consider using a helper to parse cookies for more robust logic.
      return document.cookie.includes('cookiesAccepted=true');
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

  // Initialize the application once the DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
})();
