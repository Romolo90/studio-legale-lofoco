(function() {
  // Utility: Debounce function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Main App object
  const App = {
    init() {
      try {
        this.initCookieManager();
        this.initMenu();
        this.initScrollToTop();
        this.initAccordion();
        this.initFormValidation();
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    },

    initCookieManager() {
      CookieManager.init();
    },

    initMenu() {
      const hamburgerMenu = document.getElementById('hamburgerMenu');
      const mainNav = document.getElementById('mainNav');
      if (!hamburgerMenu || !mainNav) return;

      hamburgerMenu.addEventListener('click', () => {
        mainNav.classList.toggle('active');
      });

      mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          mainNav.classList.remove('active');
        });
      });
    },

    initScrollToTop() {
      const scrollToTopBtn = document.getElementById('scrollToTop');
      if (!scrollToTopBtn) return;

      const handleScroll = debounce(() => {
        scrollToTopBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
      }, 100);

      window.addEventListener('scroll', handleScroll, { passive: true });

      scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    },

    initAccordion() {
      const accordionHeaders = document.querySelectorAll('.accordion-header');
      if (accordionHeaders.length === 0) return;

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
      const errorMsg = document.getElementById('privacy-error');

      if (!form || !privacyCheckbox || !errorMsg) return;

      // Hide error when checkbox is checked
      privacyCheckbox.addEventListener('change', () => {
        if (privacyCheckbox.checked) {
          errorMsg.style.display = 'none';
        }
      });

      // Validate on submit
      form.addEventListener('submit', e => {
        if (!privacyCheckbox.checked) {
          e.preventDefault();
          errorMsg.style.display = 'block';
          privacyCheckbox.focus();
        }
      });
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
      document.cookie = "cookiesAccepted=true; path=/; max-age=" + 60 * 60 * 24 * 365 + "; SameSite=Strict; Secure";
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
      
      document.cookie = `cookiePreferences=${JSON.stringify(preferences)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict; ${location.protocol === 'https:' ? 'Secure; ' : ''}`;
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
