// Seleziona gli elementi
const scrollToTopBtn = document.getElementById('scrollToTop');
const privacyCheckbox = document.getElementById('privacy');
const submitButton = document.getElementById('submitButton');

// Mostra/nasconde il pulsante "Torna su"
window.addEventListener('scroll', () => {
  if (window.scrollY > 300) {
    scrollToTopBtn.style.display = 'block';
  } else {
    scrollToTopBtn.style.display = 'none';
  }
});

// Funzione per tornare in cima alla pagina
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Abilita il checkbox non appena l'utente clicca 
 * su uno dei due link (Privacy o Termini).
 * Se vuoi obbligarli a cliccare entrambi i link, 
 * usa due variabili booleane come in precedenza.
 */
function enableCheckbox(event) {
  event.preventDefault(); // Previene l’apertura immediata
  // Apri il link in una nuova scheda manualmente
  window.open(event.target.href, '_blank');

  // Abilita subito la checkbox
  if (privacyCheckbox) {
    privacyCheckbox.disabled = false;
    document.getElementById('privacyNotice').textContent = 
      'Ora puoi selezionare la casella e inviare il modulo.';
  }
}

// Controlla la selezione della checkbox prima di inviare il modulo
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.contact-form');
  if (!form || !privacyCheckbox) return; // se non troviamo il form o la checkbox, esci

  // Mostra un messaggio di errore se l'utente prova a inviare senza spuntare
  const errorElement = document.createElement('p');
  errorElement.style.color = 'red';
  errorElement.style.fontSize = '0.9rem';
  errorElement.style.marginTop = '0.5rem';
  errorElement.textContent = 'Devi accettare la Privacy Policy e i Termini di Servizio prima di inviare.';
  errorElement.style.display = 'none';

  // Evento di submit sul form
  form.addEventListener('submit', (event) => {
    if (privacyCheckbox.disabled || !privacyCheckbox.checked) {
      event.preventDefault(); // blocca l’invio
      // Mostra messaggio di errore
      if (!form.contains(errorElement)) {
        privacyCheckbox.parentElement.appendChild(errorElement);
      }
      errorElement.style.display = 'block';
    } else {
      errorElement.style.display = 'none';
    }
  });
});
