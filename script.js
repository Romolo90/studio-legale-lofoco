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
        this.initMapPlaceholder();
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

      const syncExpanded = () => {
        hamburgerMenu.setAttribute('aria-expanded', String(mainNav.classList.contains('active')));
      };
      syncExpanded();

      hamburgerMenu.addEventListener('click', () => {
        mainNav.classList.toggle('active');
        syncExpanded();
      });

      mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          mainNav.classList.remove('active');
          syncExpanded();
        });
      });
    },

    initScrollToTop() {
      let scrollToTopBtn = document.getElementById('scrollToTop');

      // Inject the button if missing on the page (ensures consistency across all pages without duplicating HTML)
      if (!scrollToTopBtn) {
        scrollToTopBtn = document.createElement('button');
        scrollToTopBtn.id = 'scrollToTop';
        scrollToTopBtn.className = 'scroll-to-top';
        const isEn = (document.documentElement.lang || 'it').toLowerCase().startsWith('en');
        scrollToTopBtn.setAttribute('aria-label', isEn ? 'Scroll to top' : 'Torna all\'inizio della pagina');
        scrollToTopBtn.innerHTML = '&#8593;';
        scrollToTopBtn.style.display = 'none';
        document.body.appendChild(scrollToTopBtn);
      }

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
    },

    // Click-to-load Google Maps: the embed (and its third-party cookies) is only
    // requested after the user explicitly clicks the placeholder.
    initMapPlaceholder() {
      const placeholder = document.querySelector('.map-placeholder[data-map-src]');
      if (!placeholder) return;

      placeholder.addEventListener('click', () => {
        const iframe = document.createElement('iframe');
        iframe.src = placeholder.dataset.mapSrc;
        iframe.width = '600';
        iframe.height = '450';
        iframe.style.border = '0';
        iframe.loading = 'lazy';
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = 'no-referrer-when-downgrade';
        iframe.title = placeholder.dataset.mapTitle || 'Map';
        placeholder.replaceWith(iframe);
      });
    }
  };

  // Cookie Manager object
  const CookieManager = {
    init() {
      this.cookieBanner = document.getElementById('cookie-banner');
      this.cookiePreferences = document.getElementById('cookie-preferences');
      this.acceptCookiesBtn = document.getElementById('accept-cookies');
      this.rejectCookiesBtn = document.getElementById('reject-cookies');
      this.manageCookiesBtn = document.getElementById('manage-cookies');
      this.savePreferencesBtn = document.getElementById('save-preferences');
      this.cookieSettingsLink = document.getElementById('cookie-settings');

      if (this.acceptCookiesBtn) {
        this.acceptCookiesBtn.addEventListener('click', () => {
          this.acceptAllCookies();
        });
      }

      if (this.rejectCookiesBtn) {
        this.rejectCookiesBtn.addEventListener('click', () => {
          this.rejectNonEssential();
        });
      }

      if (this.manageCookiesBtn) {
        this.manageCookiesBtn.addEventListener('click', () => {
          if (this.cookiePreferences) {
            this.openPreferences();
          } else {
            // Fallback: no preferences panel on this page -> record a "necessary only"
            // choice. Never silently accept analytics without an explicit opt-in.
            this.rejectNonEssential();
          }
        });
      }

      if (this.savePreferencesBtn) {
        this.savePreferencesBtn.addEventListener('click', () => {
          this.savePreferences();
        });
      }

      // Footer "Gestisci cookie" / "Cookie settings" link: reopen the banner so the
      // user can change or withdraw consent at any time (GDPR art. 7(3)).
      if (this.cookieSettingsLink) {
        this.cookieSettingsLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.reopenBanner();
        });
      }

      if (this.hasMadeChoice()) {
        this.hideBanner();
        // Load GA for returning visitors ONLY if they explicitly consented to analytics.
        if (this.analyticsConsentGiven()) {
          this.loadGoogleAnalytics();
        }
      }
    },

    // Persist the consent choice. `analytics` true only on explicit opt-in.
    // We store both a "choice made" flag and the analytics preference so the
    // banner stays hidden on return while GA loads only with real consent.
    setConsent(analytics) {
      const secureFlag = location.protocol === 'https:' ? 'Secure; ' : '';
      const maxAge = 60 * 60 * 24 * 365;
      document.cookie = `cookiesAccepted=true; path=/; max-age=${maxAge}; SameSite=Strict; ${secureFlag}`;
      document.cookie = `cookiePreferences=${JSON.stringify({ analytics: !!analytics })}; path=/; max-age=${maxAge}; SameSite=Strict; ${secureFlag}`;
    },

    acceptAllCookies() {
      this.setConsent(true);
      this.hideBanner();
      this.loadGoogleAnalytics();   // Load GA only after explicit consent
    },

    rejectNonEssential() {
      this.setConsent(false);       // Necessary only: GA is NOT loaded
      this.hideBanner();
    },

    openPreferences() {
      this.cookiePreferences.style.display = 'block';
      this.cookieBanner.style.display = 'none';

      // Accessibility: move focus into the dialog and allow Escape to close it.
      const focusable = this.cookiePreferences.querySelector('input, button, [tabindex]');
      if (focusable) focusable.focus();
      this._onPrefsKeydown = (e) => {
        if (e.key === 'Escape') this.closePreferences();
      };
      this.cookiePreferences.addEventListener('keydown', this._onPrefsKeydown);
    },

    _teardownPrefsKeydown() {
      if (this._onPrefsKeydown) {
        this.cookiePreferences.removeEventListener('keydown', this._onPrefsKeydown);
        this._onPrefsKeydown = null;
      }
    },

    // Cancel the dialog (e.g. Escape): hide it and bring back the banner so the
    // user can still make a choice. No consent is recorded.
    closePreferences() {
      this.cookiePreferences.style.display = 'none';
      this._teardownPrefsKeydown();
      if (this.cookieBanner) this.cookieBanner.style.display = '';
      if (this.manageCookiesBtn) this.manageCookiesBtn.focus();
    },

    savePreferences() {
      const checkboxes = document.querySelectorAll("#cookie-preferences input[name='cookieType']");
      const analyticalEnabled = Array.from(checkboxes).some(cb =>
        (cb.value === 'analitici' || cb.value === 'analytical') && cb.checked
      );

      this.setConsent(analyticalEnabled);
      this.cookiePreferences.style.display = 'none';
      this._teardownPrefsKeydown();

      // Load GA4 only if the user explicitly enabled analytical cookies
      if (analyticalEnabled) {
        this.loadGoogleAnalytics();
      }
    },

    // Reopen the banner to let the user change or withdraw consent.
    reopenBanner() {
      if (this.cookiePreferences) {
        this.cookiePreferences.style.display = 'none';
      }
      if (this.cookieBanner) {
        this.cookieBanner.style.display = '';
      }
    },

    hasMadeChoice() {
      return document.cookie.includes('cookiesAccepted=true');
    },

    analyticsConsentGiven() {
      const match = document.cookie.match(/cookiePreferences=([^;]+)/);
      if (!match) return false;
      try {
        const prefs = JSON.parse(decodeURIComponent(match[1]));
        return prefs.analytics === true;
      } catch (e) {
        return false;
      }
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
