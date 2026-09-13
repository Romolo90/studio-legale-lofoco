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

// Stessa impronta usata da build.js: le due pagine devono concordare, altrimenti
// ogni build:guide riscriverebbe ciò che build:html ha appena normalizzato.
const crypto = require('crypto');
function versioneAsset(nome) {
  const p = path.join(ROOT, nome);
  if (!fs.existsSync(p)) return '';
  return '?v=' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 8);
}
const MARKER = '<!-- GENERATO da scripts/build-guide.js — non modificare a mano;';

const argId = (() => {
  const i = process.argv.indexOf('--id');
  return i > -1 ? process.argv[i + 1] : null;
})();

const leggiPartial = (f) => fs.readFileSync(path.join(ROOT, 'partials', f), 'utf8').trimEnd();

// Le date in pagina vanno lette da un cliente, non da una macchina: "12 settembre 2026".
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dataIt = (iso, lang) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  const mesi = lang === 'en' ? MESI_EN : MESI;
  return `${Number(m[3])} ${mesi[Number(m[2]) - 1]} ${m[1]}`;
};

// Tutto ciò che nella pagina non viene dal JSON della guida. Una guida inglese che
// eredita l'impalcatura italiana manda il lettore sulle pagine sbagliate: i due
// collegamenti in fondo (contatti e pagina di servizio) cambiano con la lingua.
const T = {
  it: {
    skip: 'Salta al contenuto', header: 'header-sub-it.html', footer: 'footer.html', cookie: 'cookie-it.html',
    briciola: 'Approfondimenti', briciolaUrl: 'notizie.html',
    inGuida: 'In questa guida', faq: 'Domande frequenti', fonti: 'Fonti', vediAnche: 'Vedi anche',
    testo: 'testo', primaria: ' (fonte primaria)', consultata: 'consultata il',
    aCura: "A cura dell'", aggiornata: 'Aggiornata al', verificati: 'Dati verificati sulle fonti il',
    disclaimer: 'Questa guida ha scopo informativo e non costituisce parere legale. Aliquote, soglie e termini cambiano con i decreti attuativi e con gli avvisi della Direzione generale Cinema e audiovisivo: prima di presentare una domanda verifica la disciplina in vigore o contattaci.',
    contattoH2: 'Parliamo del tuo progetto',
    contattoP1: "Una verifica preventiva costa una frazione di quanto costa rimediare a un diniego. Se hai un'opera in sviluppo o in preparazione, il momento utile per un confronto è prima della firma dei contratti e prima dell'avvio delle spese.",
    contattoP2pre: 'Su come lo studio assiste nelle pratiche di incentivo, vedi la pagina ',
    servizioUrl: 'tax-credit-cinema-audiovisivo.html', servizioLabel: "Tax Credit per il cinema e l'audiovisivo",
    email: 'Email', telefono: 'Telefono', indirizzo: 'Indirizzo',
    cta: 'Richiedi una consulenza', ctaUrl: 'index.html#contatti',
  },
  en: {
    skip: 'Skip to content', header: 'header-sub-en.html', footer: 'footer-en.html', cookie: 'cookie-en.html',
    briciola: 'Insights', briciolaUrl: 'notizie-en.html',
    inGuida: 'In this guide', faq: 'Frequently asked questions', fonti: 'Sources', vediAnche: 'See also',
    testo: 'text', primaria: ' (primary source)', consultata: 'accessed on',
    aCura: 'By ', aggiornata: 'Updated on', verificati: 'Sources checked on',
    disclaimer: 'This guide is for information only and is not legal advice. Rates, thresholds and deadlines change with implementing decrees and with the notices of the Directorate General for Cinema and Audiovisual: before filing an application, check the rules in force or contact us.',
    contattoH2: "Let's discuss your project",
    contattoP1: 'Checking the requirements in advance costs a fraction of what it costs to fix a refusal. If a production is in development or in preparation, the useful moment to talk is before the contracts are signed and before the spending starts.',
    contattoP2pre: 'On how the firm assists with incentive applications, see ',
    servizioUrl: 'tax-credit-cinema-audiovisivo-en.html', servizioLabel: 'Italian film and audiovisual tax credit',
    email: 'Email', telefono: 'Phone', indirizzo: 'Address',
    cta: 'Request a consultation', ctaUrl: 'index-en.html#contact',
  },
};
const tr = (g) => T[(g && g.lang) === 'en' ? 'en' : 'it'];

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
      { '@type': 'ListItem', position: 2, name: tr(g).briciola, item: SITE + tr(g).briciolaUrl },
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
  const L = tr(g);
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
    ? `\n      <section class="insights-section" id="faq" aria-labelledby="faq-title">\n        <h2 id="faq-title">${L.faq}</h2>\n        <div class="accordion">\n` +
      g.faq.map((f) => `          <div class="accordion-item">\n            <button type="button" class="accordion-header" aria-expanded="false">${esc(f.q)}</button>\n            <div class="accordion-content">\n              <p>${esc(f.a)}${rif(f.refs, f.cite)}</p>\n            </div>\n          </div>`).join('\n') +
      `\n        </div>\n      </section>`
    : '';

  const fonti = `\n      <section class="insights-section" id="fonti" aria-labelledby="fonti-title">\n        <h2 id="fonti-title">${L.fonti}</h2>\n        <div class="profile-box">\n        <ul>\n` +
    (g.sources || []).map((s) => `          <li id="fonte-${esc(s.id)}">${esc(s.citation)} — <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${L.testo}</a>${s.urlType === 'primaria' ? L.primaria : ''}, ${L.consultata} ${esc(dataIt(s.accessedAt, g.lang))}</li>`).join('\n') +
    `\n        </ul>\n        </div>\n      </section>`;

  // In anteprima si vedono tutti i rimandi, anche verso guide ancora in revisione:
  // servono proprio a rileggere l'insieme. In pagina pubblicata si linka solo ciò che esiste.
  const idx = indiceGuide();
  const voci = (g.related || [])
    .filter((r) => anteprima || (idx.get(r) || {}).status === 'published')
    .map((r) => `<a href="guida-${esc(r)}.html">${esc((idx.get(r) || {}).title || r.replace(/-/g, ' '))}</a>`);
  const correlate = voci.length
    ? `\n      <p class="guida-correlate">${L.vediAnche}: ${voci.join(' · ')}</p>`
    : '';

  return `    <article class="guida">
      <header class="insights-hero">
        <h1>${esc(g.title)}</h1>
        <p class="guida-abstract">${esc(g.abstract)}</p>
        <p class="guida-meta">${L.aCura}<a href="${esc(g.author.url)}">Avv. ${esc(g.author.name)}</a> · ${L.aggiornata} ${esc(dataIt(g.dateModified, g.lang))} · ${L.verificati} ${esc(dataIt(g.verifiedAt, g.lang))}</p>
      </header>

      <nav class="profile-box guida-sommario" aria-label="Indice della guida">
        <strong>${L.inGuida}</strong>
        <ul>
${(g.sections || []).map((s) => `          <li><a href="#${esc(s.id)}">${esc(s.heading)}</a></li>`).join('\n')}
${(g.faq || []).length ? `          <li><a href="#faq">${L.faq}</a></li>\n` : ''}          <li><a href="#fonti">${L.fonti}</a></li>
        </ul>
      </nav>

${sezioni}
${faq}
${fonti}${correlate}

      <p class="guida-disclaimer">${esc(g.disclaimer || L.disclaimer)}</p>

      <section class="insights-section" id="contatto" aria-labelledby="contatto-title">
        <h2 id="contatto-title">${L.contattoH2}</h2>
        <p>${L.contattoP1}</p>
        <p>${L.contattoP2pre}<a href="${L.servizioUrl}">${L.servizioLabel}</a>.</p>
        <div class="contact-info">
          <div>
            <span class="ci-label">✉️ ${L.email}</span>
            <a href="mailto:info@studiolegalelofoco.com">info@studiolegalelofoco.com</a>
          </div>
          <div>
            <span class="ci-label">📞 ${L.telefono}</span>
            <a href="tel:+39063201820">+39&nbsp;06&nbsp;3201820</a>
          </div>
          <div>
            <span class="ci-label">📍 ${L.indirizzo}</span>
            <span>Via Boezio, 2/A - 00193, Roma</span>
          </div>
        </div>
        <p class="guida-cta"><a href="${L.ctaUrl}" class="btn-cta">${L.cta}</a></p>
      </section>
    </article>`;
}

function pagina(g, anteprima) {
  const L = tr(g);
  const file = `guida-${g.slug}.html`;
  const url = SITE + file;
  // Una coppia di lingua dichiarata a senso unico, per i motori, vale come non dichiarata:
  // ogni pagina elenca sé stessa e tutte le gemelle. x-default designa la versione italiana,
  // che è quella predefinita del sito, non sé stessa su entrambe.
  const paginaIt = (g.lang || 'it') === 'it' ? file : ((g.altLang || {}).it || file);
  const hreflang = [`  <link rel="alternate" hreflang="${esc(g.lang || 'it')}" href="${url}">`]
    .concat(Object.entries(g.altLang || {}).map(([lingua, p]) => `  <link rel="alternate" hreflang="${esc(lingua)}" href="${SITE}${esc(p)}">`))
    .concat([`  <link rel="alternate" hreflang="x-default" href="${SITE}${esc(paginaIt)}">`])
    .join('\n');
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
${hreflang}
  <meta property="og:title" content="${esc(g.metaTitle)}">
  <meta property="og:description" content="${esc(g.metaDescription)}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="article">
  <meta property="og:image" content="${SITE}image/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(g.metaTitle)}">
  <meta name="twitter:image" content="${SITE}image/og-image.jpg">
  <link rel="icon" type="image/png" sizes="48x48" href="image/favicon-48.png">
  <link rel="stylesheet" href="style.css${versioneAsset('style.css')}">
${jsonLd(g, url)}
</head>
<body>

<a href="#main" class="skip-link">${L.skip}</a>

${leggiPartial(L.header)}

<main id="main">
${corpo(g, anteprima)}
  </main>

${leggiPartial(L.footer)}

${leggiPartial(L.cookie)}

<script src="script.js${versioneAsset('script.js')}"></script></body>
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

// Indici delle guide, uno per lingua. Sono generati dalle guide pubblicate, così una
// guida nuova compare il giorno stesso in cui viene pubblicata e l'elenco non può
// restare indietro. Una guida che ha la gemella nella lingua dell'indice compare una
// volta sola, nella lingua dell'indice, con il rimando all'altra: elencarle entrambe
// sarebbe un doppione. Le guide senza gemella compaiono segnate con la loro lingua.
const INDICE = {
  it: {
    file: 'guide.html', home: 'index.html', h1: 'Le guide dello studio', h2: 'Tutte le guide',
    metaTitle: 'Guide su tax credit e contributi al cinema | Studio Legale Lo Foco',
    descr: "Le guide dello studio su tax credit, contributi selettivi e incentivi al cinema e all'audiovisivo, verificate sulle fonti primarie.",
    intro: "Guide approfondite su incentivi e contributi al cinema e all'audiovisivo. Ogni dato è accompagnato dall'articolo e dal comma della norma che lo stabilisce, e ogni guida indica quando è stata verificata sulle fonti primarie.",
    lingua: { it: 'in italiano', en: 'in inglese' }, anche: { it: 'Disponibile anche in italiano', en: 'Disponibile anche in inglese' },
  },
  en: {
    file: 'guides-en.html', home: 'index-en.html', h1: 'Our guides', h2: 'All guides',
    metaTitle: 'Guides to Italian film tax credits and grants | Studio Legale Lo Foco',
    descr: "The firm's guides on Italian film tax credits, selective grants and audiovisual incentives, checked against primary sources.",
    intro: 'In-depth guides on Italian film and audiovisual incentives. Every figure comes with the article of the provision that sets it, and every guide states when it was last checked against primary sources. Guides marked in Italian have not been translated yet.',
    lingua: { it: 'in Italian', en: 'in English' }, anche: { it: 'Also available in Italian', en: 'Also available in English' },
  },
};

function paginaIndice(lang, pubblicate) {
  const L = T[lang];
  const I = INDICE[lang];
  const altra = lang === 'it' ? 'en' : 'it';
  const url = SITE + I.file;
  const perPagina = new Map(pubblicate.map((g) => [`guida-${g.slug}.html`, g]));

  const voci = pubblicate.filter((g) => {
    const gl = g.lang || 'it';
    if (gl === lang) return true;
    const gemella = (g.altLang || {})[lang];
    return !(gemella && perPagina.has(gemella));
  }).sort((a, b) =>
    ((a.lang || 'it') === lang ? 0 : 1) - ((b.lang || 'it') === lang ? 0 : 1)
    || String(b.dateModified).localeCompare(String(a.dateModified))
    || a.title.localeCompare(b.title));

  const schede = voci.map((g) => {
    const gl = g.lang || 'it';
    const note = [`${L.aggiornata} ${esc(dataIt(g.dateModified, lang))}`];
    if (gl !== lang) note.push(esc(I.lingua[gl]));
    const gemella = (g.altLang || {})[altra];
    if (gl === lang && gemella && perPagina.has(gemella)) {
      note.push(`<a href="${esc(gemella)}" hreflang="${altra}">${esc(I.anche[altra])}</a>`);
    }
    return `        <div class="profile-box">
          <h3><a href="guida-${esc(g.slug)}.html"${gl !== lang ? ` hreflang="${gl}"` : ''}>${esc(g.title)}</a></h3>
          <p>${esc(g.abstract)}</p>
          <p class="guida-meta">${note.join(' · ')}</p>
        </div>`;
  }).join('\n');

  const dati = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: I.h1, description: I.descr, inLanguage: lang, url,
      publisher: { '@type': 'Organization', name: 'Studio Legale Lo Foco', url: SITE },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: voci.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.title, url: `${SITE}guida-${g.slug}.html` })),
      },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + (lang === 'it' ? '' : I.home) },
        { '@type': 'ListItem', position: 2, name: I.h1, item: url },
      ],
    },
  ].map((b) => `  <script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n  </script>`).join('\n');

  return `<!DOCTYPE html>
${MARKER}
     sorgente: content/guide/*.json (indice ${lang}) -->
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
${headComune()}
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(I.metaTitle)}</title>
  <meta name="description" content="${esc(I.descr)}">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="it" href="${SITE}${INDICE.it.file}">
  <link rel="alternate" hreflang="en" href="${SITE}${INDICE.en.file}">
  <link rel="alternate" hreflang="x-default" href="${SITE}${INDICE.it.file}">
  <meta property="og:title" content="${esc(I.metaTitle)}">
  <meta property="og:description" content="${esc(I.descr)}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${SITE}image/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(I.metaTitle)}">
  <meta name="twitter:image" content="${SITE}image/og-image.jpg">
  <link rel="icon" type="image/png" sizes="48x48" href="image/favicon-48.png">
  <link rel="stylesheet" href="style.css${versioneAsset('style.css')}">
${dati}
</head>
<body>

<a href="#main" class="skip-link">${L.skip}</a>

${leggiPartial(L.header)}

<main id="main">
    <article class="guida">
      <header class="insights-hero">
        <h1>${esc(I.h1)}</h1>
        <p class="guida-abstract">${esc(I.intro)}</p>
      </header>

      <section class="insights-section" id="elenco" aria-labelledby="elenco-title">
        <h2 id="elenco-title">${esc(I.h2)}</h2>
${schede}
      </section>
    </article>
  </main>

${leggiPartial(L.footer)}

${leggiPartial(L.cookie)}

<script src="script.js${versioneAsset('script.js')}"></script></body>
</html>
`;
}

function main() {
  if (!fs.existsSync(GUIDE_DIR)) { console.log('✓ Nessuna guida da generare.'); return; }
  const files = fs.readdirSync(GUIDE_DIR).filter((f) => f.endsWith('.json'));
  if (!files.length) { console.log('✓ Nessuna guida da generare.'); return; }

  let generate = 0;
  const pubblicate = [];
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
      pubblicate.push(g);
      const esito = scrivi(inRoot, pagina(g), nome);
      console.log(`· ${g.id}: pubblicata → ${nome} (${esito})`);
      generate++;
    }
  }
  // Gli indici servono l'insieme delle guide: con --id se ne rigenera una sola e
  // l'elenco risulterebbe incompleto, quindi in quel caso non si toccano.
  if (!argId && pubblicate.length) {
    for (const lang of ['it', 'en']) {
      const nome = INDICE[lang].file;
      const esito = scrivi(path.join(ROOT, nome), paginaIndice(lang, pubblicate), nome);
      console.log(`· indice ${lang}: ${nome} (${esito})`);
    }
  }
  console.log(`✓ ${generate} pagina/e generata/e.`);
}

main();
