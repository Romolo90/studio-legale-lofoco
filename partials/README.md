# Partials (Chrome comune)

Questi file sono la **fonte di verità** per le parti ripetute del sito:

- `cookie-*.html` → banner + pannello preferenze
- `header-home-*.html` → header per le homepage (index) con selettore lingua desktop + anchor interni
- `header-sub-*.html` → header per le pagine interne (bio, notizie, tool, legali, area-clienti) con link completi
- `footer*.html` → footer comune (versione "home" include il banner Dogecoin)

## Come usare
1. Modifica solo i file dentro questa cartella.
2. Esegui `npm run build:html` (o `npm run build`).
3. Il build sovrascrive le sezioni corrispondenti in tutte le `*.html` della root.

Non editare mai direttamente l'header/footer/cookie dentro i file .html della root: verrebbero sovrascritti al prossimo build.

## Varianti
- `-it` / `-en` per la lingua
- `home` vs `sub` per header e footer (perché la home ha il selettore lingua visibile + link Dogecoin)

Per aggiungere una nuova variante (es. header minimal per il tool incentivi) basta creare il file e aggiornare `scripts/build.js`.
