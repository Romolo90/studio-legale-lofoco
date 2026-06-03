# Studio Legale Lo Foco - Sito Web

Sito web ufficiale dello **Studio Legale Lo Foco** (Roma): esperti in diritto d'autore, cinema, audiovisivo, diritto amministrativo e progetti culturali.

Progetto statico HTML/CSS/JS (senza framework) con supporto bilingue completo (IT/EN), tool interattivo per verifica incentivi/Tax Credit, news hub data-driven e area clienti preview.

## Stato attuale
- Design professionale con tipografia serif elegante (EB Garamond) e palette blu tenue.
- Completamente bilingue con hreflang, pagine -en.html e selettore lingua.
- SEO: meta, OpenGraph, schema LocalBusiness/LegalService, sitemap.xml, robots.txt, canonical.
- Funzionalità: form contatti via Formspree, cookie consent + prefs + GA4 lazy-load, hamburger mobile, accordion servizi, scroll-to-top, modal viewer per risorse.
- Tool: **Verifica Incentivi** (rule-based orientativo + stime grezze; supporto videogiochi 2026).
- Contenuti: Approfondimenti/Notizie data-driven da `data/notizie-*.json` (pre-render statico in build per SEO + 12+ schede arricchite con implicazioni operative).
- Risorse scaricabili: nuove pagine HTML print-friendly (es. `checklist-tax-credit-produzione-2026.html`) linkate dall'hub.
- PWA manifest, favicons, Google Site Verification, JSON-LD ItemList su risorse.

## Struttura del progetto
- `index.html` / `index-en.html`: Homepage + presentazione team (3 avvocati).
- `michele-lo-foco.html` (+-en), `andrea-lo-foco.html`, `samory-maiga.html`: Biografie dettagliate.
- `notizie.html` / `notizie-en.html`: Hub Approfondimenti (static pre-rendered lists da build per SEO + JS filters + 12+ schede con implicazioni/errori/tags; sezione risorse scaricabili).
- `verifica-incentivi.html` / `-en.html`: Tool interattivo (esteso videogiochi, stime orientative, metodologia statica, link a risorse).
- `checklist-tax-credit-produzione-2026.html` (+ en): Checklist pratica stampabile.
- `area-clienti.html` / `-en.html`: Preview area riservata (in sviluppo).
- Pagine legali: privacy*, terms*, cookie-policy* (bilingue).
- `style.css`: Unico foglio di stile (molto esteso per componenti insights/modali).
- `script.js`: Logica condivisa (menu, cookie, scroll, form, GA consent). Inietta scroll button se assente.
- `data/`: JSON per notizie (it/en) – aggiornare qui per nuove voci ufficiali.
- `image/`, `pdf/`: Asset (ottimizza JPG grandi prima di commit).
- `sitemap.xml`, `robots.txt`, `ads.txt`, `manifest.json`, `CNAME`.

**Nota**: Sistema partials attivo per ridurre duplicazione.
- `partials/` (cookie, header-home/sub, footer) — vedi `partials/README.md`
- Esegui sempre `npm run build:html` (o `npm run build`) dopo aver modificato qualcosa dentro `partials/`.
- Il build propaga automaticamente header (home vs sub + IT/EN), footer (con/senza Dogecoin) e cookie su tutte le 20 pagine.
- Pagine molto custom (es. tool con stili propri) mantengono il loro contenuto interno ma ereditano il chrome comune.

## Come avviare / sviluppare
```bash
git clone https://github.com/Romolo90/studio-legale-lofoco.git
cd studio-legale-lofoco
npm install   # per dev deps (minify, validate, prettier, stylelint)
npm run dev   # python http.server su :8000 (apri http://localhost:8000)
```

### Utility
- `npm run validate:html` – html-validate (molti warning sono preferenze style).
- `npm run lint:css` – stylelint (richiede config).
- `npm run format` – prettier.
- `npm run build:html` – sincronizza i partials (cookie, header, footer) dentro tutte le pagine HTML della root. Usa questo per sviluppo.
- `npm run build` – **produzione**: sincronizza partials + minifica + crea cartella `dist/` completa con riferimenti a `style.min.css` + `script.min.js` + tutti gli asset. **Usa questo prima del deploy**.
- `npm run minify` – genera solo i file .min.
- Ottimizza immagini: `sips -Z 800 --setProperty formatOptions 75 image/foo.JPG --out image/foo-opt.jpg` (su macOS).

**Deploy**: esegui `npm run build`, poi carica la cartella `dist/` sul tuo hosting (Cloudflare Pages, GitHub Pages, ecc.). La `dist/` è self-contained e non va committata (è in .gitignore).

## Deploy
Il sito è online su https://studiolegalelofoco.com (Cloudflare + custom domain da GitHub?).
Per aggiornare: push su `main`, deploy manuale o imposta GitHub Pages / CF Pages / action.

Aggiorna sempre `lastmod` in sitemap.xml e data JSON quando aggiungi contenuti.

**Come tenere aggiornati i contenuti (notizie e tool):**
- Le "Ultime Novità" e le schede "Risorse e Analisi" sono in `data/notizie-it.json` e `notizie-en.json` (elenco newsItems + articles).
- Per nuovi avvisi: aggiungi in cima a `newsItems` (data ISO, titolo, context, source, link ufficiale).
- Per nuove risorse: aggiungi a `articles` (usa campi extra opzionali: implications, errorsToAvoid, tags, lastUpdated per UI ricca).
- Dopo edit JSON/HTML (incluso nuove pagine): `npm run build:html` (pre-render insights + partials), poi `npm run build` per prod. Commit & push.
- Verifica periodicamente https://cinema.cultura.gov.it/comunicazione/avvisi/ (fonte ufficiale). Aggiornamento consigliato mensile o post-decreto.
- Esempio: fine maggio 2026 aggiunti decreti TC 29/5 (videogiochi, potenziamento, nazionalità) + nuove schede "errori eleggibilità", "DGCOL pratica", "cumulabilità".
- Sitemap: aggiorna lastmod manualmente o via script quando pubblichi.

## Form contatti
Usa Formspree (endpoint `mgvvkobk`). Verifica ricezione email e configura thank you page se vuoi.

## Prossimi passi suggeriti (roadmap)
- [x] Pre-render statico insights (build.js) + schede arricchite per SEO (news + 9+ nuovi articoli con implicazioni).
- [x] Risorse scaricabili (checklist HTML print-friendly + link in hub).
- [x] Tool esteso (videogiochi, stime, metodologia statica, link risorse).
- [ ] Migliorare Area Clienti (demo più ricca o nota "solo per clienti autenticati").
- [ ] GitHub Action per validazione + deploy automatico (es. CF Pages).
- [ ] Lighthouse trimestrale (SEO/perf/a11y) + GSC monitoring long-tail.
- [ ] Aggiungere FAQPage schema + più pagine deep-dive (es. videogiochi dedicato).
- [ ] Lead magnet (newsletter aggiornamenti via form).
- [ ] Ottimizza/rimuovi badge Dogecoin se brand perception lo richiede.

## Contatti / info
Sito live: https://studiolegalelofoco.com  
GitHub: https://github.com/Romolo90/studio-legale-lofoco  
Email studio: info@studiolegalelofoco.com

---

Sviluppato con attenzione a professionalità, accessibilità e utilità concreta per clienti del settore creativo/cinematografico.
