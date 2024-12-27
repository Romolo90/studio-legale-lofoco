<?php
// Verifica che il form sia stato inviato col metodo POST
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Recupera i campi inviati dal form
    $nome = htmlspecialchars($_POST["nome"]);
    $email = htmlspecialchars($_POST["email"]);
    $messaggio = htmlspecialchars($_POST["messaggio"]);

    // Costruisci l’email
    $to = "info@studiolegale-lofoco.it"; // Inserisci la tua email di destinazione
    $subject = "Richiesta di contatto da: $nome";
    $body = "Nome: $nome\nEmail: $email\n\nMessaggio:\n$messaggio";
    $headers = "From: $email\r\n";

    // Invia l’email
    if (mail($to, $subject, $body, $headers)) {
        // Reindirizza a una pagina di conferma (o visualizza un messaggio di successo)
        header("Location: grazie.html");
        exit;
    } else {
        // In caso di errore
        echo "Si è verificato un errore nell'invio del messaggio. Riprova più tardi.";
    }
} else {
    // Se l’accesso a questa pagina non è avvenuto tramite POST, reindirizza altrove
    header("Location: index.html");
    exit;
}
