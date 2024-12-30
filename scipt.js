// Riferimenti agli elementi
const hamburgerMenu = document.getElementById('hamburgerMenu');
const navLinks = document.getElementById('navLinks');

// Evento per mostrare/nascondere il menu
hamburgerMenu.addEventListener('click', () => {
  navLinks.classList.toggle('nav-active');
  console.log('Menu hamburger cliccato');
  console.log('Classe nav-active presente:', navLinks.classList.contains('nav-active'));
});