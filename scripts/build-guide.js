#!/usr/bin/env node
/**
 * build-guide.js — genera le pagine-guida da content/guide/*.json.
 *
 * Uso: npm run build:guide
 *      node scripts/build-guide.js --id tc-produzione
 *
 * Scelte di progetto (vedi il piano approvato):
 * - è SEPARATO da build.js, che con ~40 sostituzioni regex agisce su tutte le pagine:
 *   un errore qui non può corrompere le altre venti;
 * - emette pagine già complete di header, footer e banner cookie letti dai partials,
 *   nella forma esatta che build.js si aspetta, così `npm run build:html` resta un no-op;
 * - ogni file generato porta in testa un marcatore, e il generatore si RIFIUTA di
 *   sovrascrivere una pagina che non lo contiene: le pagine scritte a mano sono al sicuro;
 * - status draft = nessun file; review = solo preview/ (ignorata da git e da Pages);
 *   published = guida-<slug>.html in root.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GUIDE_DIR = path.join(ROOT, 'content', 'guide');
const PREVIEW_DIR = path.join(ROOT, 'preview');
const SITE = 'https://studiolegalelofoco.com/';
const MARKER = '<!-- GENERATO da scripts/build-guide.js — non modificare a mano;';

const argId = (() => {
  const i = process.argv.indexOf('--id');
  return i > -1 ? process.argv[i + 1] : null;
})();

const leggiPartial = (f) => fs.readFileSync(path.join(ROOT, 'partials', f), 'utf8').trimEnd();

// Le date in pagina vanno lette da un cliente, non da una macchina: "12 settembre 2026".
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const dataIt = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return `${Number(m[3])} ${MESI[Number(m[2]) - 1]} ${m[1]}`;
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Il CSP e il bootstrap Consent Mode sono identici in tutte le pagine del sito:
// li prendiamo da una pagina esistente, così restano allineati se cambiano.
function headComune() {
  const rif = fs.readFileSync(path.join(ROOT, 'grazie.html'), 'utf8');
  const inizio = rif.indexOf('<meta http-equiv="Content-Security-Policy"');
  const fine = rif.indexOf('<meta name="referrer"');
  if (inizio < 0 || fine < 0) throw new Error('Non trovo CSP/gtag in grazie.html: il generatore va aggiornato.');
  return rif.slice(inizio, fine).trimEnd();
}

function jsonLd(g, url) {
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.metaDescription,
    inLanguage: g.lang || 'it',
    datePublished: g.datePublished,
    dateModified: g.dateModified,
    author: { '@type': 'Person', name: g.author.name, url: SITE + (g.author.url || '') },
    publisher: { '@type': 'Organization', name: 'Studio Legale Lo Foco', url: SITE },
    mainEntityOfPage: url,
    citation: (g.sources || []).map((s) => ({ '@type': 'CreativeWork', name: s.citation, url: s.url })),
  };
  const briciole = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Approfondimenti', item: SITE + 'notizie.html' },
      { '@type': 'ListItem', position: 3, name: g.title, item: url },
    ],
  };
  const blocchi = [article, briciole];
  if ((g.faq || []).length >= 2) {
    blocchi.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: g.faq.map((f) => ({
        '@type': 'Question', name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
  // JSON.stringify, mai concatenazione: la prosa può contenere virgolette.
  return blocchi.map((b) => `  <script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n  </script>`).join('\n');
}

// Indice slug → guida: serve a dare al "Vedi anche" il titolo vero invece dello slug
// e a non pubblicare rimandi verso guide che online non ci sono ancora.
let indice = null;
function indiceGuide() {
  if (indice) return indice;
  indice = new Map();
  if (fs.existsSync(GUIDE_DIR)) {
    for (const f of fs.readdirSync(GUIDE_DIR).filter((x) => x.endsWith('.json'))) {
      const a = JSON.parse(fs.readFileSync(path.join(GUIDE_DIR, f), 'utf8'));
      if (a.slug) indice.set(a.slug, { title: a.title, status: a.status });
    }
  }
  return indice;
}

function corpo(g, anteprima) {
  const fonteById = new Map((g.sources || []).map((s) => [s.id, s]));
  // Quando il paragrafo indica una citazione puntuale, quella copre l'intero richiamo:
  // il primo riferimento la porta come etichetta e gli altri restano solo come collegamento
  // numerato alla voce in fondo. Accodare anche le sigle produceva richiami doppi e, se la
  // stessa fonte è citata per un articolo diverso dalla sua sigla, un riferimento fuorviante.
  const rif = (refs, cite) => {
    if (!(refs || []).length) return '';
    const link = (r, testo) => {
      const s = fonteById.get(r) || {};
      return `<a href="#fonte-${esc(r)}" title="${esc(s.citation || '')}">${esc(testo)}</a>`;
    };
    // Con una citazione puntuale il richiamo è quella e basta: le altre fonti del paragrafo
    // restano raggiungibili dall'elenco in fondo. Appendere sigle o numeri rende il testo
    // meno leggibile senza aggiungere informazione.
    if (cite) return ` <span class="guida-rif">(${link(refs[0], cite)})</span>`;
    return ` <span class="guida-rif">(${refs.map((r) => {
      const s = fonteById.get(r) || {};
      return link(r, s.short || s.citation || r);
    }).join('; ')})</span>`;
  };

  const sezioni = (g.sections || []).map((s) => {
    const par = (s.paragraphs || []).map((p) => `        <p>${esc(p.text)}${rif(p.refs, p.cite)}</p>`).join('\n');
    const elenco = (s.list || []).length
      ? `        <ul>\n${s.list.map((v) => `          <li>${esc(v)}</li>`).join('\n')}\n        </ul>${rif(s.listRefs, s.listCite)}`
      : '';
    return `      <section class="insights-section" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">\n        <h2 id="${esc(s.id)}-title">${esc(s.heading)}</h2>\n${par}\n${elenco}\n      </section>`;
  }).join('\n\n');

  const faq = (g.faq || []).length
    ? `\n      <section class="insights-section" id="faq" aria-labelledby="faq-title">\n        <h2 id="faq-title">Domande frequenti</h2>\n        <div class="accordion">\n` +
      g.faq.map((f) => `          <div class="accordion-item">\n            <button type="button" class="accordion-header" aria-expanded="false">${esc(f.q)}</button>\n            <div class="accordion-content">\n              <p>${esc(f.a)}${rif(f.refs, f.cite)}</p>\n            </div>\n          </div>`).join('\n') +
      `\n        </div>\n      </section>`
    : '';

  const fonti = `\n      <section class="insights-section" id="fonti" aria-labelledby="fonti-title">\n        <h2 id="fonti-title">Fonti</h2>\n        <div class="profile-box">\n        <ul>\n` +
    (g.sources || []).map((s) => `          <li id="fonte-${esc(s.id)}">${esc(s.citation)} — <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">testo</a>${s.urlType === 'primaria' ? ' (fonte primaria)' : ''}, consultata il ${esc(dataIt(s.accessedAt))}</li>`).join('\n') +
    `\n        </ul>\n        </div>\n      </section>`;

  // In anteprima si vedono tutti i rimandi, anche verso guide ancora in revisione:
  // servono proprio a rileggere l'insieme. In pagina pubblicata si linka solo ciò che esiste.
  const idx = indiceGuide();
  const voci = (g.related || [])
    .filter((r) => anteprima || (idx.get(r) || {}).status === 'published')
    .map((r) => `<a href="guida-${esc(r)}.html">${esc((idx.get(r) || {}).title || r.replace(/-/g, ' '))}</a>`);
  const correlate = voci.length
    ? `\n      <p class="guida-correlate">Vedi anche: ${voci.join(' · ')}</p>`
    : '';

  return `    <article class="guida">
      <header class="insights-hero">
        <h1>${esc(g.title)}</h1>
        <p class="guida-abstract">${esc(g.abstract)}</p>
        <p class="guida-meta">A cura dell'<a href="${esc(g.author.url)}">Avv. ${esc(g.author.name)}</a> · Aggiornata al ${esc(dataIt(g.dateModified))} · Dati verificati sulle fonti il ${esc(dataIt(g.verifiedAt))}</p>
      </header>

      <nav class="profile-box guida-sommario" aria-label="Indice della guida">
        <strong>In questa guida</strong>
        <ul>
${(g.sections || []).map((s) => `          <li><a href="#${esc(s.id)}">${esc(s.heading)}</a></li>`).join('\n')}
${(g.faq || []).length ? '          <li><a href="#faq">Domande frequenti</a></li>\n' : ''}          <li><a href="#fonti">Fonti</a></li>
        </ul>
      </nav>

${sezioni}
${faq}
${fonti}${correlate}

      <p class="guida-disclaimer">${esc(g.disclaimer || "Questa guida ha scopo informativo e non costituisce parere legale. Aliquote, soglie e termini cambiano con i decreti attuativi e con gli avvisi della Direzione generale Cinema e audiovisivo: prima di presentare una domanda verifica la disciplina in vigore o contattaci.")}</p>

      <section class="insights-section" id="contatto" aria-labelledby="contatto-title">
        <h2 id="contatto-title">Parliamo del tuo progetto</h2>
        <p>Una verifica preventiva costa una frazione di quanto costa rimediare a un diniego. Se hai un'opera in sviluppo o in preparazione, il momento utile per un confronto è prima della firma dei contratti e prima dell'avvio delle spese.</p>
        <p>Su come lo studio assiste nelle pratiche di incentivo, vedi la pagina <a href="tax-credit-cinema-audiovisivo.html">Tax Credit per il cinema e l'audiovisivo</a>.</p>
        <div class="contact-info">
          <div>
            <span class="ci-label">✉️ Email</span>
            <a href="mailto:info@studiolegalelofoco.com">info@studiolegalelofoco.com</a>
          </div>
          <div>
            <span class="ci-label">📞 Telefono</span>
            <a href="tel:+39063201820">+39&nbsp;06&nbsp;3201820</a>
          </div>
          <div>
            <span class="ci-label">📍 Indirizzo</span>
            <span>Via Boezio, 2/A - 00193, Roma</span>
          </div>
        </div>
        <p class="guida-cta"><a href="index.html#contatti" class="btn-cta">Richiedi una consulenza</a></p>
      </section>
    </article>`;
}

function pagina(g, anteprima) {
  const file = `guida-${g.slug}.html`;
  const url = SITE + file;
  const base = anteprima
    ? '\n  <!-- Solo in anteprima: la pagina sta in preview/, gli asset in root. -->\n  <base href="/">'
    : '';
  return `<!DOCTYPE html>
${MARKER}
     sorgente: content/guide/${g.id}.json -->
<html lang="${esc(g.lang || 'it')}">
<head>
  <meta charset="UTF-8">${base}
${headComune()}
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(g.metaTitle)}</title>
  <meta name="description" content="${esc(g.metaDescription)}">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="it" href="${url}">
  <link rel="alternate" hreflang="x-default" href="${url}">${g.altLang && g.altLang.en ? `\n  <link rel="alternate" hreflang="en" href="${SITE}${esc(g.altLang.en)}">` : ''}
  <meta property="og:title" content="${esc(g.metaTitle)}">
  <meta property="og:description" content="${esc(g.metaDescription)}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="article">
  <meta property="og:image" content="${SITE}image/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(g.metaTitle)}">
  <meta name="twitter:image" content="${SITE}image/og-image.jpg">
  <link rel="icon" type="image/png" sizes="48x48" href="image/favicon-48.png">
  <link rel="stylesheet" href="style.css">
${jsonLd(g, url)}
</head>
<body>

<a href="#main" class="skip-link">Salta al contenuto</a>

${leggiPartial('header-sub-it.html')}

<main id="main">
${corpo(g, anteprima)}
  </main>

${leggiPartial('footer.html')}

${leggiPartial('cookie-it.html')}

<script src="script.js"></script></body>
</html>
`;
}

function scrivi(destinazione, contenuto, nome) {
  if (fs.existsSync(destinazione)) {
    const attuale = fs.readFileSync(destinazione, 'utf8');
    if (!attuale.includes(MARKER)) {
      console.error(`❌ ${nome} esiste e non è generato da questo script: non lo sovrascrivo.`);
      process.exit(1);
    }
    if (attuale === contenuto) return 'invariata';
  }
  fs.mkdirSync(path.dirname(destinazione), { recursive: true });
  fs.writeFileSync(destinazione, contenuto, 'utf8');
  return 'scritta';
}

function main() {
  if (!fs.existsSync(GUIDE_DIR)) { console.log('✓ Nessuna guida da generare.'); return; }
  const files = fs.readdirSync(GUIDE_DIR).filter((f) => f.endsWith('.json'));
  if (!files.length) { console.log('✓ Nessuna guida da generare.'); return; }

  let generate = 0;
  for (const f of files) {
    const g = JSON.parse(fs.readFileSync(path.join(GUIDE_DIR, f), 'utf8'));
    if (argId && g.id !== argId) continue;

    const nome = `guida-${g.slug}.html`;
    const inRoot = path.join(ROOT, nome);

    if (g.status === 'draft') {
      if (fs.existsSync(inRoot)) console.log(`⚠︎ ${g.id}: è in bozza ma ${nome} esiste ancora in root: va rimosso a mano.`);
      console.log(`· ${g.id}: bozza, nessun file generato`);
      continue;
    }
    if (g.status === 'review') {
      const esito = scrivi(path.join(PREVIEW_DIR, nome), pagina(g, true), `preview/${nome}`);
      console.log(`· ${g.id}: in revisione → preview/${nome} (${esito}) — apri con npm run dev`);
      generate++;
      continue;
    }
    if (g.status === 'published') {
      const esito = scrivi(inRoot, pagina(g), nome);
      console.log(`· ${g.id}: pubblicata → ${nome} (${esito})`);
      generate++;
    }
  }
  console.log(`✓ ${generate} pagina/e generata/e.`);
}

main();
