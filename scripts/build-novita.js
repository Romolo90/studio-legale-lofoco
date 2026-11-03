#!/usr/bin/env node
/**
 * build-novita.js — una pagina per ogni voce delle «Ultime Novità».
 *
 * Fino al 03/11/2026 le Novità stavano tutte in notizie.html: Google vedeva una sola
 * pagina lunga e non poteva proporre la singola voce a chi cercava «DGCOL» o il numero
 * di un decreto (745 impressioni e 8 clic in 90 giorni). Ogni voce di newsItems ha ora
 * un suo indirizzo stabile:
 *   novita/<slug>.html   (italiano, da data/notizie-it.json)
 *   news/<slug>.html     (inglese, da data/notizie-en.json)
 *
 * Lo slug si calcola una volta sola dalla data e dal titolo e si scrive nel JSON
 * (campo "slug"): se poi il titolo viene corretto l'indirizzo non cambia. Le voci nuove
 * scritte da sito_bozze.py arrivano senza slug e lo ricevono al primo build.
 * La gemella nell'altra lingua si trova dal link ufficiale, che è unico per voce.
 *
 * Le pagine stanno in sottocartelle, quindi i collegamenti di header, footer e banner
 * (relativi alla root nei partials) diventano assoluti dalla root. Lo stesso vale per
 * fogli di stile, script e icone.
 *
 * Gestisce anche il blocco delle Novità nella sitemap, fra i commenti NOVITA, con
 * lastmod uguale alla data della voce. Le pagine generate e non più corrispondenti a
 * una voce vengono tolte, ma solo se portano il MARKER: un file scritto a mano resta.
 *
 * Lo chiama build.js prima di rigenerare notizie*.html; da solo: node scripts/build-novita.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://studiolegalelofoco.com/';
const MARKER = '<!-- GENERATO da scripts/build-novita.js — non modificare a mano;';
const SITEMAP_INIZIO = '  <!-- NOVITA: generato da scripts/build-novita.js -->';
const SITEMAP_FINE = '  <!-- /NOVITA -->';

const LINGUE = {
  it: {
    dati: 'data/notizie-it.json', cartella: 'novita', indice: 'notizie.html',
    skip: 'Salta al contenuto', header: 'header-sub-it.html', footer: 'footer.html', cookie: 'cookie-it.html',
    briciola: 'Approfondimenti', tutte: 'Tutte le novità', avviso: "Leggi l'avviso ufficiale",
    precedente: 'Novità precedente', successiva: 'Novità successiva', percorso: 'Percorso',
    disclaimer: 'Questa scheda riassume un avviso pubblico e non costituisce parere legale. Prima di presentare una domanda verifica il provvedimento integrale o contatta lo studio.',
    // Gli stessi testi del riquadro finale delle guide (build-guide.js)
    contattoH2: 'Parliamo del tuo progetto',
    contattoP1: "Se hai un'opera in sviluppo o in preparazione, il momento utile per un confronto è prima della firma dei contratti e prima dell'avvio delle spese.",
    contattoP2pre: 'Su come lo studio assiste nelle pratiche di incentivo, vedi la pagina ',
    servizioUrl: '/tax-credit-cinema-audiovisivo.html', servizioLabel: "Tax Credit per il cinema e l'audiovisivo",
    email: 'Email', telefono: 'Telefono', indirizzo: 'Indirizzo',
    cta: 'Richiedi una consulenza', ctaUrl: '/index.html#contatti',
    stop: ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'del', 'dello', 'della', 'dei', 'degli', 'delle',
      'a', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'da', 'dal', 'dalla', 'dai', 'in', 'nel', 'nella', 'nei', 'negli',
      'nelle', 'e', 'ed', 'per', 'con', 'su', 'sul', 'sulla', 'sui', 'tra', 'fra', 'che', 'o', 'rep',
      'all', 'dall', 'dell', 'nell', 'sull'],
  },
  en: {
    dati: 'data/notizie-en.json', cartella: 'news', indice: 'notizie-en.html',
    skip: 'Skip to content', header: 'header-sub-en.html', footer: 'footer-en.html', cookie: 'cookie-en.html',
    briciola: 'Insights', tutte: 'All updates', avviso: 'Read the official notice',
    precedente: 'Previous update', successiva: 'Next update', percorso: 'Breadcrumb',
    disclaimer: 'This page summarises a public notice and is not legal advice. Before filing an application, check the full text of the measure or contact the firm.',
    contattoH2: "Let's discuss your project",
    contattoP1: 'If a production is in development or in preparation, the useful moment to talk is before the contracts are signed and before the spending starts.',
    contattoP2pre: 'On how the firm assists with incentive applications, see ',
    servizioUrl: '/tax-credit-cinema-audiovisivo-en.html', servizioLabel: 'Italian film and audiovisual tax credit',
    email: 'Email', telefono: 'Phone', indirizzo: 'Address',
    cta: 'Request a consultation', ctaUrl: '/index-en.html#contact',
    stop: ['the', 'a', 'an', 'of', 'and', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'or', 'rep'],
  },
};

const MESI = {
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
// Stesso formato di formatDateStatic in build.js, così la data coincide con l'elenco.
function dataLeggibile(iso, lang) {
  const [a, m, g] = iso.split('-').map(Number);
  return lang === 'en' ? `${MESI.en[m - 1]} ${g}, ${a}` : `${g} ${MESI.it[m - 1]} ${a}`;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function versioneAsset(nome) {
  const p = path.join(ROOT, nome);
  if (!fs.existsSync(p)) return '';
  return '?v=' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 8);
}

// Le sigle puntate restano una parola sola: «D.Lgs.» → dlgs, «D.D.» → dd.
const parole = (testo, lang) => testo
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\.(?=[A-Za-z])/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .split(' ')
  .filter((p) => p && (p.length > 1 || /\d/.test(p)) && !LINGUE[lang].stop.includes(p));

// Data più parole significative del titolo, al massimo 70 caratteri tagliati a fine parola.
// Il numero del decreto fra parentesi in coda al titolo («(D.D. rep. 3275)») è ciò che
// si cerca, quindi resta sempre, anche quando le parole prima vanno tagliate.
function calcolaSlug(voce, lang) {
  const m = voce.title.match(/^(.*)\(([^()]*)\)\s*$/);
  const conNumero = m && /(?<!\d)(?!20\d\d(?!\d))\d{3,5}(?!\d)/.test(m[2]);
  const coda = conNumero ? parole(m[2], lang).join('-') : '';
  const spazio = 70 - (coda ? coda.length + 1 : 0);
  let slug = '';
  for (const p of parole(conNumero ? m[1] : voce.title, lang)) {
    if ((slug ? slug.length + 1 : 0) + p.length > spazio) break;
    slug = slug ? slug + '-' + p : p;
  }
  if (coda) slug = slug ? `${slug}-${coda}` : coda;
  return `${voce.date}-${slug}`;
}

// Assegna lo slug alle voci che non l'hanno e riscrive il JSON solo se serve.
// Il formato di scrittura è quello di sito_bozze.py (indent 2, a capo finale).
function assegnaSlug(lang) {
  const file = path.join(ROOT, LINGUE[lang].dati);
  const grezzo = fs.readFileSync(file, 'utf8');
  const dati = JSON.parse(grezzo);
  const usati = new Set(dati.newsItems.filter((v) => v.slug).map((v) => v.slug));
  let nuovi = 0;
  for (const v of dati.newsItems) {
    if (v.slug) continue;
    let s = calcolaSlug(v, lang);
    for (let n = 2; usati.has(s); n++) s = `${calcolaSlug(v, lang)}-${n}`;
    v.slug = s;
    usati.add(s);
    nuovi++;
  }
  const doppi = dati.newsItems.map((v) => v.slug).filter((s, i, a) => a.indexOf(s) !== i);
  if (doppi.length) throw new Error(`${LINGUE[lang].dati}: slug ripetuti ${[...new Set(doppi)].join(', ')}`);
  const nuovo = JSON.stringify(dati, null, 2) + '\n';
  if (nuovo !== grezzo) fs.writeFileSync(file, nuovo, 'utf8');
  return { voci: dati.newsItems, nuovi };
}

// Il CSP e il caricamento di Google Analytics subordinato al consenso vengono da
// grazie.html, come in build-guide.js: restano allineati al resto del sito.
function headComune() {
  const rif = fs.readFileSync(path.join(ROOT, 'grazie.html'), 'utf8');
  const inizio = rif.indexOf('<meta http-equiv="Content-Security-Policy"');
  const fine = rif.indexOf('<meta name="referrer"');
  if (inizio < 0 || fine < 0) throw new Error('Non trovo CSP/gtag in grazie.html: il generatore va aggiornato.');
  return rif.slice(inizio, fine).trimEnd();
}

// I partials linkano «index.html», «privacy.html»: da una sottocartella vanno presi dalla root.
const dallaRoot = (html) => html.replace(/\b(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');

function leggiPartial(nome) {
  return fs.readFileSync(path.join(ROOT, 'partials', nome), 'utf8').trimEnd();
}

function header(L, gemellaIt, gemellaEn) {
  let h = leggiPartial(L.header);
  if (gemellaIt) h = h.split('href="index.html">IT</a>').join(`href="${gemellaIt}" hreflang="it">IT</a>`);
  if (gemellaEn) h = h.split('href="index-en.html">EN</a>').join(`href="${gemellaEn}" hreflang="en">EN</a>`);
  return dallaRoot(h);
}

// Descrizione per i motori: inizio del testo, tagliato a fine parola entro 155 caratteri.
function descrizione(testo) {
  const t = testo.replace(/\s+/g, ' ').trim();
  if (t.length <= 155) return t;
  const taglio = t.slice(0, 154);
  return taglio.slice(0, taglio.lastIndexOf(' ')).replace(/[\s,;.]+$/, '') + '…';
}

function titoloPagina(titolo) {
  const conStudio = `${titolo} | Studio Legale Lo Foco`;
  return conStudio.length <= 70 ? conStudio : titolo;
}

function jsonLd(v, lang, url) {
  const L = LINGUE[lang];
  const articolo = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: v.title.length <= 110 ? v.title : v.title.slice(0, 109) + '…',
    description: descrizione(v.context),
    inLanguage: lang,
    datePublished: v.date,
    dateModified: v.date,
    author: { '@type': 'Organization', name: 'Studio Legale Lo Foco', url: SITE },
    publisher: { '@type': 'Organization', name: 'Studio Legale Lo Foco', url: SITE },
    mainEntityOfPage: url,
    isBasedOn: v.link,
  };
  const briciole = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + (lang === 'en' ? 'index-en.html' : '') },
      { '@type': 'ListItem', position: 2, name: L.briciola, item: SITE + L.indice },
      { '@type': 'ListItem', position: 3, name: v.title, item: url },
    ],
  };
  return [articolo, briciole].map((b) => `  <script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n  </script>`).join('\n');
}

function pagina(v, lang, vicine, gemella) {
  const L = LINGUE[lang];
  const file = `${L.cartella}/${v.slug}.html`;
  const url = SITE + file;
  const paginaIt = lang === 'it' ? file : gemella;
  const hreflang = [`  <link rel="alternate" hreflang="${lang}" href="${url}">`];
  if (gemella) hreflang.push(`  <link rel="alternate" hreflang="${lang === 'it' ? 'en' : 'it'}" href="${SITE}${gemella}">`);
  if (paginaIt) hreflang.push(`  <link rel="alternate" hreflang="x-default" href="${SITE}${paginaIt}">`);
  const titolo = titoloPagina(v.title);
  const descr = descrizione(v.context);
  const link = (x) => `/${L.cartella}/${x.slug}.html`;
  // Precedente e successiva per data, non le ultime uscite: così una voce nuova cambia
  // solo la pagina accanto a sé e non tutte le altre.
  const naviga = [
    vicine.precedente ? `<a href="${link(vicine.precedente)}" rel="prev">← ${L.precedente}</a>` : '',
    `<a href="/${L.indice}#novita-title">${L.tutte}</a>`,
    vicine.successiva ? `<a href="${link(vicine.successiva)}" rel="next">${L.successiva} →</a>` : '',
  ].filter(Boolean).join(' · ');
  const home = lang === 'en' ? '/index-en.html' : '/index.html';

  return `<!DOCTYPE html>
${MARKER}
     sorgente: ${L.dati}, voce «${v.slug}» -->
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
${headComune()}
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(titolo)}</title>
  <meta name="description" content="${esc(descr)}">
  <link rel="canonical" href="${url}">
${hreflang.join('\n')}
  <meta property="og:title" content="${esc(v.title)}">
  <meta property="og:description" content="${esc(descr)}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="article">
  <meta property="og:image" content="${SITE}image/og-image.jpg">
  <meta property="article:published_time" content="${v.date}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(v.title)}">
  <meta name="twitter:image" content="${SITE}image/og-image.jpg">
  <link rel="icon" type="image/png" sizes="48x48" href="/image/favicon-48.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/image/icon-192.png">
  <link rel="apple-touch-icon" href="/image/icon-192.png">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#003366">
  <link rel="stylesheet" href="/style.css${versioneAsset('style.css')}">
${jsonLd(v, lang, url)}
</head>
<body>

<a href="#main" class="skip-link">${L.skip}</a>

${header(L, lang === 'it' ? '/' + file : (gemella ? '/' + gemella : null), lang === 'en' ? '/' + file : (gemella ? '/' + gemella : null))}

<main id="main">
    <article class="guida novita">
      <nav class="guida-meta novita-percorso" aria-label="${L.percorso}"><a href="${home}">Home</a> › <a href="/${L.indice}">${L.briciola}</a></nav>
      <header class="insights-hero">
        <h1>${esc(v.title)}</h1>
        <p class="guida-meta"><time datetime="${v.date}">${dataLeggibile(v.date, lang)}</time> · ${esc(v.source)}</p>
      </header>

      <div class="insights-section">
        <p>${esc(v.context)}</p>
        <p class="guida-cta"><a href="${esc(v.link)}" class="btn-cta" target="_blank" rel="noopener noreferrer">${L.avviso} →</a></p>
      </div>

      <p class="guida-disclaimer">${L.disclaimer}</p>

      <p class="guida-correlate novita-naviga">${naviga}</p>

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
    </article>
  </main>

${dallaRoot(leggiPartial(L.footer))}

${dallaRoot(leggiPartial(L.cookie))}

<script src="/script.js${versioneAsset('script.js')}"></script></body>
</html>
`;
}

function scrivi(file, contenuto) {
  const dest = path.join(ROOT, file);
  if (fs.existsSync(dest)) {
    const attuale = fs.readFileSync(dest, 'utf8');
    if (!attuale.includes(MARKER)) throw new Error(`${file} esiste e non è generato da build-novita.js: non lo sovrascrivo.`);
    if (attuale === contenuto) return false;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contenuto, 'utf8');
  return true;
}

// Il blocco delle Novità nella sitemap, sempre prima di </urlset>.
function aggiornaSitemap(voci) {
  const file = path.join(ROOT, 'sitemap.xml');
  const sitemap = fs.readFileSync(file, 'utf8');
  const righe = voci.map(({ file: f, date }) => `  <url>\n    <loc>${SITE}${f}</loc>\n    <lastmod>${date}</lastmod>\n    <priority>0.50</priority>\n  </url>`);
  const blocco = `${SITEMAP_INIZIO}\n${righe.join('\n')}\n${SITEMAP_FINE}\n`;
  const i = sitemap.indexOf(SITEMAP_INIZIO);
  let nuova;
  if (i >= 0) {
    const f = sitemap.indexOf(SITEMAP_FINE, i);
    if (f < 0) throw new Error('sitemap.xml: blocco NOVITA aperto e non chiuso');
    let dopo = f + SITEMAP_FINE.length;
    if (sitemap[dopo] === '\n') dopo++;
    nuova = sitemap.slice(0, i) + blocco + sitemap.slice(dopo);
  } else {
    const chiusura = sitemap.lastIndexOf('</urlset>');
    nuova = sitemap.slice(0, chiusura).replace(/\n*$/, '\n\n') + blocco + '\n' + sitemap.slice(chiusura);
  }
  if (nuova !== sitemap) fs.writeFileSync(file, nuova, 'utf8');
  return nuova !== sitemap;
}

function genera() {
  const perLingua = {};
  let slugNuovi = 0;
  for (const lang of Object.keys(LINGUE)) {
    const { voci, nuovi } = assegnaSlug(lang);
    perLingua[lang] = voci;
    slugNuovi += nuovi;
  }
  const perLink = (lang) => new Map(perLingua[lang].map((v) => [v.link, v]));
  const gemelle = { it: perLink('en'), en: perLink('it') };

  const attese = new Set();
  const inSitemap = [];
  let scritte = 0;
  for (const lang of Object.keys(LINGUE)) {
    const L = LINGUE[lang];
    // Ordine per data, a parità di data quello del JSON (le voci nuove stanno in cima).
    const ordinate = perLingua[lang].map((v, i) => ({ v, i })).sort((a, b) => (a.v.date < b.v.date ? 1 : a.v.date > b.v.date ? -1 : a.i - b.i)).map((x) => x.v);
    ordinate.forEach((v, i) => {
      const altra = gemelle[lang].get(v.link);
      const gemella = altra ? `${LINGUE[lang === 'it' ? 'en' : 'it'].cartella}/${altra.slug}.html` : null;
      const file = `${L.cartella}/${v.slug}.html`;
      attese.add(file);
      inSitemap.push({ file, date: v.date });
      if (scrivi(file, pagina(v, lang, { successiva: ordinate[i - 1], precedente: ordinate[i + 1] }, gemella))) scritte++;
    });
  }

  // Pagine generate che non corrispondono più a una voce (voce tolta o slug cambiato a mano)
  const tolte = [];
  for (const lang of Object.keys(LINGUE)) {
    const dir = path.join(ROOT, LINGUE[lang].cartella);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
      const rel = `${LINGUE[lang].cartella}/${f}`;
      if (attese.has(rel)) continue;
      if (!fs.readFileSync(path.join(dir, f), 'utf8').includes(MARKER)) continue;
      fs.unlinkSync(path.join(dir, f));
      tolte.push(rel);
    }
  }

  const sitemapCambiata = aggiornaSitemap(inSitemap);
  return { pagine: attese.size, scritte, tolte, slugNuovi, sitemapCambiata };
}

module.exports = { genera, MARKER, LINGUE };

if (require.main === module) {
  const r = genera();
  console.log(`✓ Novità: ${r.pagine} pagine, ${r.scritte} scritte, ${r.tolte.length} tolte, ${r.slugNuovi} slug nuovi${r.sitemapCambiata ? ', sitemap aggiornata' : ''}.`);
  for (const t of r.tolte) console.log('  − ' + t);
}
