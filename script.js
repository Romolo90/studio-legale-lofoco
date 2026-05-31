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
          if (this.cookiePreferences) {
            this.openPreferences();
          } else {
            // Fallback: if no preferences panel, just accept all (simple behavior on legal pages)
            this.acceptAllCookies();
          }
        });
      }

      if (this.savePreferencesBtn) {
        this.savePreferencesBtn.addEventListener('click', () => {
          this.savePreferences();
        });
      }

      if (this.hasAcceptedCookies()) {
        this.hideBanner();
        // Load GA for returning visitors who already gave consent
        this.loadGoogleAnalytics();
      }
    },

    acceptAllCookies() {
      const secureFlag = location.protocol === 'https:' ? 'Secure; ' : '';
      document.cookie = `cookiesAccepted=true; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict; ${secureFlag}`;
      this.hideBanner();
      this.loadGoogleAnalytics();   // Load GA only after explicit consent
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

      // Load GA4 only if the user explicitly enabled analytical cookies
      const analyticalEnabled = preferences['analitici'] === true || preferences['analytical'] === true;
      if (analyticalEnabled) {
        this.loadGoogleAnalytics();
      }
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
    },

    // Load Google Analytics 4 only after user has given consent
    loadGoogleAnalytics() {
      if (window.gtagLoaded) return; // Prevent loading multiple times

      // Dynamically inject the GA4 script
      const gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-E7P6F0SVRY';
      document.head.appendChild(gaScript);

      gaScript.onload = () => {
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        window.gtag = gtag;

        gtag('js', new Date());
        gtag('config', 'G-E7P6F0SVRY', {
          anonymize_ip: true,           // Privacy-friendly
          cookie_flags: 'SameSite=Strict;Secure'
        });

        window.gtagLoaded = true;
        console.log('%c[Analytics] Google Analytics loaded after consent', 'color:#888');
      };
    }
  };

  // Initialize the application once the DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
})();
