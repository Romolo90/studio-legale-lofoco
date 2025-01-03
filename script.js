// ======== Riferimenti agli elementi ========

// Hamburger menu per mobile
const hamburgerMenu = document.getElementById('hamburgerMenu');
const mainNav = document.getElementById('mainNav');

// Pulsante torna su
const scrollToTopBtn = document.getElementById('scrollToTop');

// Checkbox privacy e pulsante submit
const privacyCheckbox = document.getElementById('privacy');
const submitButton = document.getElementById('submitButton');

// Accordion (sezione servizi)
const accordionHeaders = document.querySelectorAll('.accordion-header');


// ======== Funzioni ========

// Mostra/nasconde menu mobile
function toggleMenu() {
  mainNav.classList.toggle('active');
}

// Torna all’inizio della pagina
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Mostra o nasconde il pulsante "Torna su"
function handleScroll() {
  scrollToTopBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
}

// Funzione accordion
function toggleAccordion() {
  const isExpanded = this.getAttribute('aria-expanded') === 'true';
  // Chiudi tutti gli accordion prima
  accordionHeaders.forEach(header => {
    header.setAttribute('aria-expanded', 'false');
  });
  // Se era chiuso, apri l’accordion cliccato
  if (!isExpanded) {
    this.setAttribute('aria-expanded', 'true');
  }
}

// Disabilita invio del form se la checkbox non è spuntata
function handleFormSubmit(e) {
  if (!privacyCheckbox.checked) {
    e.preventDefault();
    alert('Devi accettare la Privacy Policy e i Termini di Servizio prima di inviare.');
  }
}


// ======== Event Listener ========

// Apertura/chiusura menu
if (hamburgerMenu) {
  hamburgerMenu.addEventListener('click', toggleMenu);
}

// Link nav: chiudi menu al click su mobile
const navLinks = mainNav.querySelectorAll('a');
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('active');
  });
});

// Scroll
window.addEventListener('scroll', handleScroll);
scrollToTopBtn.addEventListener('click', scrollToTop);

// Accordion
accordionHeaders.forEach(header => {
  header.addEventListener('click', toggleAccordion);
});

// Controllo form
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
});
