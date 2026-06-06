# Revisione accurata del sito — Studio Legale Lo Foco

Data: 6 giugno 2026. Revisione completa su 4 dimensioni: **tecnica/codice**, **SEO/performance/accessibilità**, **contenuti giuridici** (metodologia forense), **sicurezza/privacy/GDPR**. Solo lettura: nessun file di sito modificato.

Legenda severità: 🔴 BLOCCANTE · 🟠 IMPORTANTE · 🟡 MINORE

---

## Sintesi

| Dimensione | 🔴 | 🟠 | 🟡 |
|---|---|---|---|
| Build / codice | 3 | 6 | 7 |
| SEO / perf / a11y | 3 | 11 | 7 |
| Contenuti giuridici | 0 | 2 | 2 |
| Sicurezza / privacy / GDPR | 4 | 6 | 5 |

**Buona notizia di fondo:** i contenuti giuridici sono solidi. I riferimenti ai decreti (D.D. rep. 1479, 1238, importi contributi selettivi) sono stati **verificati sulla fonte ufficiale e risultano reali e accurati** — nessuna citazione inventata. Il disclaimer del tool è corretto. I problemi gravi sono quasi tutti **tecnici** (build) e di **conformità cookie/GDPR**, entrambi risolvibili.

---

## 🔴 BLOCCANTI

### BUILD-1 — Il build non è idempotente: JSON-LD duplicato all'infinito
`scripts/build.js:142`. La guardia `/application\/ld\+json.*InsightsResources/i` non matcha mai (il blocco usa `data-insights-resources`), quindi un nuovo blocco JSON-LD viene **appeso ad ogni build**. Stato attuale committato: `notizie.html` e `notizie-en.html` contengono **25 blocchi `ItemList` duplicati** ciascuno → file gonfi a ~145 KB. Inoltre ogni build aggiunge righe vuote (~6/run) anche alle altre 20 pagine.
**Fix:** correggere la guardia (`data-insights-resources` o marker dedicato), bonificare i 25 duplicati esistenti e rendere il build un vero no-op su albero pulito.

### BUILD-2 — `npm run build` (produzione) genera un `dist/` rotto
`package.json:16` esegue `build:html --prod && minify`: il `dist/` viene creato e copia `style.min.css`/`script.min.js` **prima** che `minify` li produca → copia silenziosamente saltata, HTML in `dist/` referenzia asset minificati **mancanti** (404 in produzione su primo deploy pulito).
**Fix:** invertire l'ordine (`minify && build:html --prod`).

### BUILD-3 / SEO — Nav della home inglese rotta
`partials/header-home-en.html` linka `#chi-siamo`, `#servizi`, `#contatti` ma `index-en.html` usa `id="about-us"`, `services`, `contact`. Le tre voci principali del menu della home EN non portano da nessuna parte.
**Fix:** usare gli id inglesi nel partial.

### COOKIE-1 — Consenso analitici pre-selezionato (consenso non valido)
`partials/cookie-it.html:19`, `cookie-en.html:19`: `<input type="checkbox" value="analitici" checked>`. Consenso opt-out → viola GDPR/ePrivacy e Linee guida Garante 2021.
**Fix:** rimuovere `checked`.

### COOKIE-2 — "Gestisci cookie" equivale ad "Accetta tutti" dove manca il pannello
`script.js:131-140`: se manca `#cookie-preferences`, il bottone esegue `acceptAllCookies()`. Su pagine legali/sottopagine l'utente che vuole **rifiutare** attiva invece GA. Inoltre la cookie-policy promette un link "Gestisci cookie" nel footer che **non esiste** → consenso non revocabile (art. 7 GDPR).
**Fix:** fallback "solo necessari"; aggiungere link reale di revoca in footer.

### GDPR-1 — Formspree e trasferimento extra-UE non dichiarati
Il form invia a Formspree (USA); GA è di Google (USA). Né `privacy*.html` né `cookie-policy*.html` menzionano Formspree come responsabile/destinatario, né il trasferimento dati extra-UE e le garanzie (DPF/SCC). Viola art. 13(1)(f) e Capo V GDPR.
**Fix:** aggiungere Formspree tra i responsabili + sezione "Trasferimento extra-UE".

### PRIV-1 — Area Clienti: login finto realistico, nessun avviso "demo", indicizzabile
`area-clienti.html`: login serio con credenziali demo hardcoded e mostrate (`demo/demo2026`...), classe `.in-development-banner` definita ma **mai usata** → nessun avviso visibile. Linkata dalla nav, senza `noindex`. Dà l'impressione di un'area clienti reale con dati legali → rischio reputazionale/fiducia.
**Fix:** banner "Anteprima/demo" visibile + `<meta name="robots" content="noindex">`; valutare rimozione dalla nav.

---

## 🟠 IMPORTANTI

### Codice / build
- **CODE-1** — Render statico insights EN in italiano: `build.js:72-91`, `renderNewsStatic` ignora `isEn`, `formatDateStatic` usa sempre mesi IT e il label "Leggi l'avviso ufficiale →" è hard-coded. `notizie-en.html` mostra "29 maggio 2026" (11 occorrenze).
- **CODE-2** — `index-en.html:17` canonical punta alla home **IT** (`/`) invece di `/index-en.html` → la pagina EN viene de-duplicata sotto la IT. *(segnalato sia da revisione codice sia SEO)*
- **CODE-3** — Approccio regex di `build.js` (~40 `replace` "NUKE/PRE-CLEANUP", `while(nuke())` senza guardia d'iterazione, inserimento ancorato a `<script src=...script.js>`): fragile e fonte dei bug sopra. Raccomandato passaggio a **marker-based** (come già fatto bene per gli insights, `build.js:129-139`).
- **CODE-4** — `global[cache]` per i dati insights (`build.js:51-64`): stato globale fragile, e `cachedDataIT/EN` locali dichiarati ma **mai usati** (dead code).
- **A11Y-1** — Hamburger menu senza `aria-expanded`/`aria-controls`, stato non comunicato agli screen reader (`script.js initMenu`, partial header). *(codice + a11y)*

### SEO / hreflang / perf / a11y
- **SEO-1** — `og:url` bio EN puntano a URL inesistenti (404): `andrea-lo-foco-en.html` → `avv-andrea-lo-foco.html`; `michele-lo-foco-en.html` → `attorney-michele-lo-foco-en.html`.
- **SEO-2** — Canonical mancante su 6 pagine legali (privacy/terms/cookie-policy IT+EN).
- **SEO-3** — `x-default` incoerente: nelle coppie la EN punta a sé, la IT a sé → si contraddicono. Deve essere lo stesso URL (tipicamente IT) su entrambe.
- **SEO-4** — Checklist (IT+EN) senza alcun hreflang → Google non collega le due versioni.
- **SEO-5** — OG/Twitter assenti su checklist e area-clienti (pagine condivisibili); bio IT senza `og:image` né Twitter card (asimmetria con le EN).
- **SEO-6** — `og:image` = `icon-192.png` (192×192) ma `twitter:card=summary_large_image` richiede ≥1200×630 → anteprima social degradata.
- **SEO-7** — Sitemap: doppione home (`/` priority 1.0 **e** `/index.html` 0.9 non-canonico → rimuovere `/index.html`); `area-clienti` indicizzabile in sitemap (valutare `noindex`); tutti i `lastmod` identici.
- **PERF-1** — `favicon.svg` 356 KB (referenziato su 14 pagine), `favicon.png` 204 KB: spropositati per favicon.
- **PERF-2** — CSS/JS non minificati serviti in produzione (root HTML referenziano `style.css`/`script.js` full).
- **A11Y-2** — Doppio `<h1>` per pagina sulle sotto-pagine (logo header + titolo contenuto).
- **A11Y-3** — Skip-link assente sulla home (presente su tutte le altre 20 pagine).
- **A11Y-4** — Modale "Preferenze Cookie" senza `role="dialog"`/`aria-modal`, focus trap, gestione Escape.

### Sicurezza / privacy
- **SEC-1** — iframe Google Maps caricato sempre, prima del consenso (`index.html:487`) → cookie di terze parti pre-consenso, non citato in policy. Usare click-to-load.
- **SEC-2** — Form senza honeypot/anti-spam (`_gotcha` di Formspree) → endpoint pubblico abusabile.
- **SEC-3** — Nessun header di sicurezza (CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, HSTS). Aggiungere file `_headers` su Cloudflare Pages.
- **SEC-4** — Google Fonts da CDN Google → IP esposto a Google pre-consenso (precedenti UE). Valutare self-hosting (migliora anche performance).
- **GDPR-2** — Area Clienti (dati pratiche/fatture) non coperta dalla privacy policy: da prevedere prima del go-live reale.

### Contenuti giuridici
- **LEX-1** — Aliquote differenziate nel tool (30% doc/corto, 35% co-EU; soglie €0,5M / €1M) presentate come dato ma **non ancorate al DM attuativo vigente**. Il 40% "headline" è coerente col regime; le differenziazioni e le soglie sono euristiche. Da verificare sul DM tax credit vigente e mantenere etichetta "indicativo". *(il disclaimer già copre, ma per uno studio legale conviene citare la norma)*
- **LEX-2** — "art. 26 L. 220/2016" (contributi selettivi): coerente con la struttura nota della Legge Cinema, **da confermare su Normattiva** nella versione vigente prima di darlo per definitivo.

---

## 🟡 MINORI

- **M-CSS-1** — ~15 custom property in `:root` mai usate; 64 hex hard-coded che dovrebbero usare `var()`.
- **M-CSS-2** — Regole duplicate sovrascritte (`.resource-card .card-header` style.css:1274/1320; `.summary` 1296/1348; `body` 52/60).
- **M-CODE-1** — GA `gtag('config')` solo in `onload` (fragile, possibile perdita pageview).
- **M-CODE-2** — `header-sub-it.html` privo del blocco `mobile-language` presente nelle altre 3 varianti.
- **M-CODE-3** — `.htmlvalidate.json`: `no-dup-id`/`close-order`/`unique-landmark` a `warn` invece di `error` (dovrebbero intercettare le regressioni del build).
- **M-CODE-4** — Divergenza struttura `area-clienti.html` (790 righe) vs `-en.html` (595) — da verificare se intenzionale.
- **M-A11Y-1** — Accordion senza `aria-controls`; `role="button"` su `<div>` nelle resource card (18 warning html-validate `prefer-native-element`); manca `prefers-reduced-motion`.
- **M-SEC-1** — `target="_blank"` senza `rel="noopener"` su alcuni link legali.
- **M-SEC-2** — iframe Maps senza `referrerpolicy`/`sandbox`.
- **M-SEC-3** — Email `info@` in chiaro (scraping) — accettabile ma valutare offuscamento.
- **M-GDPR-1** — Cookie-policy datata "30 giugno 2026" (data futura rispetto a oggi 06/06/2026) → refuso. Privacy "02/06/2026". Granularità "cookie di preferenze" dichiarata ma non implementata.
- **M-SEO-1** — Title cookie-policy identici IT/EN; `meta keywords` obsoleto; mancano JSON-LD `Person` su bio, `FAQPage`/`HowTo`, `BreadcrumbList`.

---

## ✅ Note positive

- Contenuti giuridici **verificati**: decreti reali, importi corretti, fonti ufficiali. Disclaimer del tool ben fatto.
- GA4 caricato **solo dopo** consenso, `anonymize_ip:true`, guard anti-doppia-iniezione, cookie `SameSite=Strict; Secure`.
- Nessun segreto/chiave hardcoded (GA Measurement ID e pub AdSense sono pubblici per design).
- Nessun link interno o asset rotto; HTML-validate 0 errori; 0 vulnerabilità npm.
- `style.css` senza alcun `!important`; null-safety solida in `script.js`; insights già marker-based (modello da estendere).

---

## Piano d'intervento consigliato (per ordine)

1. **Fondamenta del build** (sblocca tutto il resto): correggere idempotenza JSON-LD (BUILD-1), ordine `npm run build` (BUILD-2), bonificare i file gonfi. Idealmente refactor marker-based (CODE-3).
2. **Conformità cookie/GDPR**: checkbox non pre-flaggata (COOKIE-1), fallback "Gestisci" + revoca (COOKIE-2), Formspree + extra-UE in policy (GDPR-1), Maps click-to-load (SEC-1).
3. **Area Clienti**: banner demo + noindex (PRIV-1).
4. **Correttezza link/SEO**: nav home EN (BUILD-3), og:url bio EN (SEO-1), canonical index-en + legali (CODE-2/SEO-2), hreflang/x-default (SEO-3/4), render insights EN (CODE-1), sitemap (SEO-7).
5. **Performance**: favicon, minificazione (PERF-1/2).
6. **Accessibilità**: aria-expanded, doppio h1, skip-link home, dialog cookie (A11Y-1..4).
7. **Contenuti**: ancorare aliquote/soglie al DM, confermare art. 26 su Normattiva (LEX-1/2), refusi date (M-GDPR-1).
8. **Pulizia minori**: CSS, htmlvalidate severità, partial mobile-language, ecc.
