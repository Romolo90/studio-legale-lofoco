// ======== COOKIE BANNER E GESTIONE PREFERENZE ========
document.addEventListener('DOMContentLoaded', () => {
  // Elementi banner e preferenze
  const cookieBanner = document.getElementById("cookie-banner");
  const cookiePreferences = document.getElementById("cookie-preferences");
  const acceptCookiesBtn = document.getElementById("accept-cookies");
  const manageCookiesBtn = document.getElementById("manage-cookies");
  const savePreferencesBtn = document.getElementById("save-preferences");

  // Funzione per nascondere il banner
  function hideCookieBanner() {
    cookieBanner.style.display = "none";
  }

  // Salva consenso cookie
  acceptCookiesBtn?.addEventListener("click", () => {
    document.cookie = "cookiesAccepted=true; path=/; max-age=" + 60 * 60 * 24 * 365;
    hideCookieBanner();
  });

  // Mostra gestione preferenze
  manageCookiesBtn?.addEventListener("click", () => {
    cookiePreferences.style.display = "block";
  });

  // Salva preferenze cookie
  savePreferencesBtn?.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll("#cookie-preferences input[name='cookieType']");
    const preferences = Array.from(checkboxes).reduce((prefs, checkbox) => {
      prefs[checkbox.value] = checkbox.checked;
      return prefs;
    }, {});
    document.cookie = `cookiePreferences=${JSON.stringify(preferences)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    cookiePreferences.style.display = "none";
  });

  // Nascondi banner se i cookie sono già accettati
  if (document.cookie.includes("cookiesAccepted=true")) {
    hideCookieBanner();
  }
});

// ======== MENU MOBILE ========
const hamburgerMenu = document.getElementById('hamburgerMenu');
const mainNav = document.getElementById('mainNav');

function toggleMenu() {
  mainNav.classList.toggle('active');
}

hamburgerMenu?.addEventListener('click', toggleMenu);

// Chiude il menu quando si clicca su un link
mainNav?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('active');
  });
});

// ======== PULSANTE "TORNA SU" ========
const scrollToTopBtn = document.getElementById('scrollToTop');

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleScroll() {
  scrollToTopBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
}

window.addEventListener('scroll', handleScroll);
scrollToTopBtn?.addEventListener('click', scrollToTop);

// ======== ACCORDION (SEZIONE SERVIZI) ========
const accordionHeaders = document.querySelectorAll('.accordion-header');

function toggleAccordion() {
  const isExpanded = this.getAttribute('aria-expanded') === 'true';

  // Chiudi tutti gli accordion
  accordionHeaders.forEach(header => header.setAttribute('aria-expanded', 'false'));

  // Apri l'accordion cliccato, se era chiuso
  if (!isExpanded) {
    this.setAttribute('aria-expanded', 'true');
  }
}

accordionHeaders.forEach(header => {
  header.addEventListener('click', toggleAccordion);
});

// ======== FORM CONTATTI ========
const privacyCheckbox = document.getElementById('privacy');
const form = document.querySelector('.contact-form');

form?.addEventListener('submit', e => {
  if (!privacyCheckbox?.checked) {
    e.preventDefault();
    alert('Devi accettare la Privacy Policy e i Termini di Servizio prima di inviare.');
  }
});
