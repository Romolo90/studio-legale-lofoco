#!/usr/bin/env node
/**
 * Simple partials injector / sync for Studio Legale Lo Foco site.
 * Usage:
 *   node scripts/build.js            # syncs common parts into all root *.html
 *   npm run build:html
 *
 * Handles:
 * - Cookie banner + preferences (IT/EN)
 * - Header (home vs sub-page variants, IT/EN)
 * - Footer (common + home with dogecoin, IT/EN)
 *
 * Edit only the files in partials/ then re-run the build.
 * This keeps the deployed HTML files consistent while reducing duplication.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PARTIALS_DIR = path.join(ROOT, 'partials');

function readPartial(name) {
  const p = path.join(PARTIALS_DIR, name);
  if (!fs.existsSync(p)) {
    console.error('Missing partial:', p);
    process.exit(1);
  }
  return fs.readFileSync(p, 'utf8');
}

const COOKIE_IT = readPartial('cookie-it.html');
const COOKIE_EN = readPartial('cookie-en.html');

// Header variants
const HEADER_SUB_IT = readPartial('header-sub-it.html');
const HEADER_HOME_IT = readPartial('header-home-it.html');
const HEADER_SUB_EN = readPartial('header-sub-en.html');
const HEADER_HOME_EN = readPartial('header-home-en.html');

// Footer variants
const FOOTER = readPartial('footer.html');
const FOOTER_HOME = readPartial('footer-home.html');
const FOOTER_EN = readPartial('footer-en.html');
const FOOTER_HOME_EN = readPartial('footer-home-en.html');

// Data for pre-rendering insights (news + resources) for SEO (static HTML in source)
const DATA_IT_PATH = path.join(ROOT, 'data', 'notizie-it.json');
const DATA_EN_PATH = path.join(ROOT, 'data', 'notizie-en.json');

let cachedDataIT = null;
let cachedDataEN = null;

function loadInsightsData(isEn) {
  const p = isEn ? DATA_EN_PATH : DATA_IT_PATH;
  const cache = isEn ? 'cachedDataEN' : 'cachedDataIT';
  if (global[cache]) return global[cache];
  if (!fs.existsSync(p)) {
    console.warn('  ! Insights data not found:', p);
    return { newsItems: [], articles: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    global[cache] = raw;
    return raw;
  } catch (e) {
    console.warn('  ! Failed to parse insights data:', p, e.message);
    return { newsItems: [], articles: [] };
  }
}

function formatDateStatic(iso) {
  // Simple static date format (matches client but without locale variance in build)
  const d = new Date(iso);
  const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function renderNewsStatic(newsItems, isEn) {
  if (!newsItems || !newsItems.length) return '';
  return newsItems.map(item => `
        <article class="news-item">
          <span class="date">${formatDateStatic(item.date)}</span>
          <div class="title">${item.title}</div>
          <p class="context">${item.context}</p>
          <div class="meta">
            <span class="source">${item.source}</span>
            <a href="${item.link}" target="_blank" rel="noopener noreferrer">Leggi l'avviso ufficiale →</a>
          </div>
        </article>`).join('\n');
}

function renderResourcesStatic(articles, isEn) {
  if (!articles || !articles.length) return '';
  const footerBase = isEn ? 'Read more' : 'Approfondisci';
  const aria = isEn ? 'Open detail: ' : 'Apri dettaglio: ';
  // Initial static render: all items (client JS will enhance with filters/search).
  // Cleaned: removed "Implicazioni operative (studio)" section entirely + date badges (agg./updated)
  // for uniform card look across all resources. errorsToAvoid (if present) still shown in modal.
  return articles.map(a => {
    const cat = (a.category || 'all').replace('-', ' ');
    const tags = a.tags && a.tags.length ? a.tags.map(t => `<span class="tag">${t}</span>`).join('') : '';
    return `
        <div class="resource-card" data-id="${a.id}" data-category="${a.category || ''}" tabindex="0" role="button" aria-label="${aria}${a.title}">
          <div class="card-header">
            <span class="category-tag">${cat}</span>
            ${tags}
          </div>
          <h3>${a.title}</h3>
          <p class="summary">${a.summary}</p>
          <div class="card-footer">${footerBase}</div>
        </div>`;
  }).join('\n');
}

function injectInsightsStatic(content, filename) {
  const isEn = /-en\.html$/.test(filename);
  const isInsights = /notizie(-en)?\.html$/.test(filename);
  if (!isInsights) return { content, changed: false };

  const data = loadInsightsData(isEn);
  const newsHtml = renderNewsStatic(data.newsItems || [], isEn);
  const resHtml = renderResourcesStatic(data.articles || [], isEn);

  let changed = false;
  let out = content;

  // Robust marker-based injection (much safer than matching to first </div>)
  const newsMarkerRe = /(<!--\s*STATIC-NEWS-START\s*-->)([\s\S]*?)(<!--\s*STATIC-NEWS-END\s*-->)/i;
  if (newsMarkerRe.test(out) && newsHtml) {
    out = out.replace(newsMarkerRe, `$1\n${newsHtml}\n$3`);
    changed = true;
  }

  const resMarkerRe = /(<!--\s*STATIC-RESOURCES-START\s*-->)([\s\S]*?)(<!--\s*STATIC-RESOURCES-END\s*-->)/i;
  if (resMarkerRe.test(out) && resHtml) {
    out = out.replace(resMarkerRe, `$1\n${resHtml}\n$3`);
    changed = true;
  }

  // Optionally inject a lightweight JSON-LD ItemList for the resources (SEO).
  // IDEMPOTENT: first strip any previously-injected insights JSON-LD block(s),
  // then insert exactly one. (The old guard tested for the literal "InsightsResources",
  // which never matched the emitted `data-insights-resources` marker, so the block was
  // appended on every build — accumulating dozens of duplicate <script> tags.)
  const existingLdRe = /\n?[ \t]*<script type="application\/ld\+json" data-insights-resources="true">[\s\S]*?<\/script>\n?/gi;
  if (existingLdRe.test(out)) {
    out = out.replace(existingLdRe, '');
    changed = true;
  }
  if (data.articles && data.articles.length) {
    const listLd = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'name': isEn ? 'Insights & Resources - Studio Legale Lo Foco' : 'Approfondimenti e Risorse - Studio Legale Lo Foco',
      'numberOfItems': data.articles.length,
      'itemListElement': data.articles.slice(0, 12).map((a, idx) => ({
        '@type': 'ListItem',
        'position': idx + 1,
        'item': {
          '@type': 'Article',
          'name': a.title,
          'description': a.summary,
          'url': `https://studiolegalelofoco.com/${filename}#${a.id}`
        }
      }))
    };
    const ldScript = `\n<script type="application/ld+json" data-insights-resources="true">\n${JSON.stringify(listLd, null, 2)}\n</script>\n`;
    // Insert before the page-specific inline script or before </main>
    if (out.includes('</main>')) {
      out = out.replace(/<\/main>/i, `${ldScript}</main>`);
    } else if (out.includes('<script>')) {
      out = out.replace(/<script>/i, `${ldScript}<script>`);
    }
    changed = true;
  }

  return { content: out, changed };
}

function isEnglishFile(filename) {
  return /-en\.html$/.test(filename);
}

function isHomeFile(filename) {
  return /^index(-en)?\.html$/.test(filename);
}

function getHeaderPartial(isEn, isHome) {
  if (isEn) return isHome ? HEADER_HOME_EN : HEADER_SUB_EN;
  return isHome ? HEADER_HOME_IT : HEADER_SUB_IT;
}

function getFooterPartial(isEn, isHome) {
  if (isEn) return isHome ? FOOTER_HOME_EN : FOOTER_EN;
  return isHome ? FOOTER_HOME : FOOTER;
}

/**
 * Remove old cookie blocks (handles full + banner-only cases)
 */
function removeOldCookie(content) {
  let changed = false;
  const fullRe = /[\s\t]*<div id="cookie-banner"[\s\S]*?<div id="cookie-preferences"[\s\S]*?<\/div>\s*/i;
  if (fullRe.test(content)) {
    content = content.replace(fullRe, '');
    changed = true;
  }
  const bannerOnlyRe = /[\s\t]*<div id="cookie-banner"[\s\S]*?<\/div>\s*(?:<!--[^>]*-->)?\s*/i;
  if (bannerOnlyRe.test(content)) {
    content = content.replace(bannerOnlyRe, '');
    changed = true;
  }
  return { content, changed };
}

/**
 * Insert cookie near the end of body (before scripts or </body>) so it doesn't appear "in alto" in source view.
 * This is cleaner for view-source and avoids any perception of it being part of header.
 */
function insertCookie(content, newCookie) {
  const scriptRe = /(<script src=["'][^"']*script(\.min)?\.js["'][^>]*>)/i;
  const bodyCloseRe = /(\s*<\/body>)/i;
  // Force the injected block's *first* line to start at column 0 (stable, clean in view-source)
  // while preserving the relative indentation of inner lines as written in the partial.
  // Only strip leading ws from the very start of the block string.
  const cookieBlock = newCookie.replace(/^[ \t]+/, '');

  if (scriptRe.test(content)) {
    return content.replace(scriptRe, `\n${cookieBlock}\n$1`);
  } else if (bodyCloseRe.test(content)) {
    return content.replace(bodyCloseRe, `\n${cookieBlock}\n$1`);
  }
  // fallback append at end of body content
  return content.replace(/<\/body>/i, `\n${cookieBlock}\n</body>`);
}

/**
 * Remove old header block (from <header class="header"> ... </header>)
 */
function removeOldHeader(content) {
  const headerRe = /[\s\t]*<header class="header">[\s\S]*?<\/header>\s*/i;
  if (headerRe.test(content)) {
    return { content: content.replace(headerRe, ''), changed: true };
  }
  return { content, changed: false };
}

/**
 * Remove old footer block
 */
function removeOldFooter(content) {
  const footerRe = /[\s\t]*<footer>[\s\S]*?<\/footer>\s*/i;
  if (footerRe.test(content)) {
    return { content: content.replace(footerRe, ''), changed: true };
  }
  return { content, changed: false };
}

/**
 * Insert header after the cookie block (or after <body> / skip if no cookie yet)
 */
function insertHeader(content, newHeader) {
  // Try to insert right before the first <main or after the last inserted cookie / skip
  const mainRe = /(<main[^>]*>)/i;
  if (mainRe.test(content)) {
    return content.replace(mainRe, `${newHeader}\n$1`);
  }
  // Fallback: after body or skip
  const skipLinkRe = /(<a[^>]+class=["'][^"']*skip-link[^"']*["'][^>]*>[\s\S]*?<\/a>\s*)/i;
  const bodyOpenRe = /(<body[^>]*>\s*)/i;
  if (skipLinkRe.test(content)) {
    return content.replace(skipLinkRe, `$1\n${newHeader}\n`);
  }
  if (bodyOpenRe.test(content)) {
    return content.replace(bodyOpenRe, `$1\n${newHeader}\n`);
  }
  return content;
}

/**
 * Insert footer cleanly before the scripts / </body>
 */
function insertFooter(content, newFooter) {
  // Remove any leftover stray partial comments from previous insertions
  content = content.replace(/<!--\s*(HEADER|FOOTER)\s*-->\s*/gi, '');

  // Force the injected block's *first* line to start at column 0 (stable, clean in view-source)
  // while preserving relative inner indentation from the partial.
  const footerBlock = newFooter.replace(/^[ \t]+/, '');

  // Use the *same simple anchor* as insertCookie: right before the external script include.
  // This keeps placement deterministic and avoids capturing varying spans of inline scripts/cookie.
  const scriptRe = /(<script src=["'][^"']*script(\.min)?\.js["'][^>]*>)/i;
  if (scriptRe.test(content)) {
    return content.replace(scriptRe, `\n${footerBlock}\n$1`);
  }
  const bodyCloseRe = /(\s*<\/body>)/i;
  if (bodyCloseRe.test(content)) {
    return content.replace(bodyCloseRe, `\n${footerBlock}\n$1`);
  }
  return content;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const filename = path.basename(filePath);
  const isEn = isEnglishFile(filename);
  const isHome = isHomeFile(filename);

  const newHeader = getHeaderPartial(isEn, isHome);
  const newFooter = getFooterPartial(isEn, isHome);
  const newCookie = isEn ? COOKIE_EN : COOKIE_IT;

  // === MULTI-PASS NUKE: ensure *zero* copies of our managed chrome before any insert.
  // Repeat until stable so that even if previous bad state had 2-3 copies (causing dup ids),
  // we start from a clean slate and insert exactly one.
  const nuke = () => {
    let changed = false;
    const before = content;
    // Very aggressive full-block removal for cookies (multi-line, tolerant of junk/attrs/wrappers from bad past states)
    content = content.replace(/<div[^>]*id=["']?cookie-banner["']?[^>]*>[\s\S]*?<div[^>]*id=["']?cookie-preferences["']?[^>]*>[\s\S]*?<\/div>\s*(?:<\/div>)?\s*/gi, '');
    content = content.replace(/<div[^>]*id=["']?cookie-banner["']?[^>]*>[\s\S]*?<\/div>\s*/gi, '');
    content = content.replace(/<div[^>]*id=["']?cookie-preferences["']?[^>]*>[\s\S]*?<\/div>\s*/gi, '');
    content = content.replace(/<header class=["']?header["']?[^>]*>[\s\S]*?<\/header>/gi, '');
    content = content.replace(/<footer>[\s\S]*?<\/footer>/gi, '');
    content = content.replace(/<div[^>]*class=["'][^"']*cookie-buttons[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
    content = content.replace(/<!--\s*(?:HEADER|FOOTER|COOKIE|BANNER|FINESTRINA| PREFERENZE|COOKIE PREFERENCES).*?-->\s*/gi, '');
    // catch any remaining fragments with the button texts
    content = content.replace(/<button[^>]*id=["']?accept-cookies["']?[^>]*>[\s\S]*?<\/button>/gi, '');
    content = content.replace(/<button[^>]*id=["']?manage-cookies["']?[^>]*>[\s\S]*?<\/button>/gi, '');
    // extra specific for the persistent junk patterns seen in files
    content = content.replace(/<\/main><div class=["']?cookie-buttons["']?[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, '</main>');
    // collapse excessive blanks between inline script and insertion point (prevents visual/source space between main and footer on notizie etc)
    content = content.replace(/(<\/script>)\n{3,}(?=\s*<footer>|<script src=["'][^"']*script)/gi, '$1\n\n');
    if (content !== before) changed = true;
    return changed;
  };
  while (nuke()) { /* repeat */ }

  // === AGGRESSIVE PRE-CLEANUP: purge pollution from past bad builds/sed (stray closers, misplaced chrome) ===
  // Strip stray </footer> and excess </div> right after </main> (these cause "stray end tag" + close-order errors)
  content = content.replace(/<\/main>\s*<\/footer>\s*/gi, '</main>\n');
  content = content.replace(/<\/main>\s*(?:<\/div>\s*){1,6}/gi, '</main>\n');
  // Also catch cases with newlines/ws variations after main before stray closers
  content = content.replace(/<\/main>\s*\n\s*<\/footer>\s*/gi, '</main>\n');
  content = content.replace(/<\/main>\s*\n\s*(?:<\/div>\s*){1,6}/gi, '</main>\n');

  // Catch junk stray closers that appear after page inline </script> but before cookie (seen in notizie etc)
  content = content.replace(/<\/script>\s*<\/footer>\s*/gi, '</script>\n');
  content = content.replace(/<\/script>\s*(?:<\/div>\s*){1,4}(?=\s*<div id=["']?cookie-banner)/gi, '</script>\n');
  // Targeted cleanup for repeated lone stray </div> blocks between in-page scripts and footer (pollution from notizie/index past edits)
  content = content.replace(/<\/script>[\s\S]{0,2000}?((?:\s*<\/div>\s*){2,})[\s\S]{0,500}?(?=<footer>)/gi, '</script>\n$1'); // temp marker, will strip below
  content = content.replace(/(<script src=["'][^"']*script[^"']*["']>[\s\S]*?<\/script>)\s*(?:<\/div>\s*){2,}/gi, '$1\n');
  // Collapse any excessive blank lines / whitespace between end of inline page script and the insertion point (footer/cookie before external script.js)
  content = content.replace(/(<\/script>)\n{3,}(?=\s*<footer>)/gi, '$1\n\n');
  content = content.replace(/(<\/script>)\n{3,}(?=\s*<script src=["'][^"']*script)/gi, '$1\n\n');
  content = content.replace(/(<\/script>)\s*\n+\s*(?=<footer>|<script src=["'][^"']*script)/gi, '$1\n\n');

  // Purge stray </footer> right before cookie banner (handles ws + comments in between)
  content = content.replace(/\s*<\/footer>\s*(?=\s*<div id=["']?cookie-banner)/gi, '\n');

  // Remove full old footer blocks (defense in depth, before later remove)
  content = content.replace(/[\s\t]*<footer>[\s\S]*?<\/footer>\s*/gi, '');

  // Remove old header blocks early
  content = content.replace(/[\s\t]*<header class=["']?header["']?[^>]*>[\s\S]*?<\/header>\s*/gi, '');

  // Robust cookie block removal (flexible on attrs/quotes, span banner+prefs, even if preceded by junk closers from pollution)
  content = content.replace(/(?:<\/div>\s*){0,4}<div[^>]*id=["']?cookie-banner["']?[^>]*>[\s\S]*?<div[^>]*id=["']?cookie-preferences["']?[^>]*>[\s\S]*?<\/div>\s*/gi, '');
  content = content.replace(/(?:<\/div>\s*){0,4}<div[^>]*id=["']?cookie-banner["']?[^>]*>[\s\S]*?<\/div>\s*/gi, '');
  content = content.replace(/<div[^>]*id=["']?cookie-preferences["']?[^>]*>[\s\S]*?<\/div>\s*/gi, '');
  content = content.replace(/<div[^>]*class=["'][^"']*cookie-buttons[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');

  // Strip leftover cookie / banner comments (various languages)
  content = content.replace(/<!--\s*(?:COOKIE|BANNER| PREFERENZE| FINESTRINA|END COOKIE).*?-->/gi, '');

  // Legacy comment concat artifacts
  content = content.replace(/<!--\s*.*?(MAIN|CONTENT).*?-->\s*<header class="header">/gi, '<header class="header">');
  content = content.replace(/<!--\s*(?:FINE|END).*?COOKIE.*?(?:BANNER)?\s*-->/gi, '');
  content = content.replace(/<!--\s*(?:COOKIE BANNER| BANNER COOKIE).*?-->/gi, '');
  content = content.replace(/<!--\s*(?:COOKIE|BANNER).*?-->/gi, '');

  // === END PRE-CLEANUP ===

  // In-place zone refresh for chrome (preferred path for stability).
  // If the markers (header class, footer tag, cookie ids) are present, we replace *only the zone content*
  // with the fresh partial. This keeps the exact location, surrounding whitespace and file bytes
  // outside the zone identical, so repeated builds on unchanged partials are true no-ops.
  const headerZoneRe = /<header class=["']?header["']?[^>]*>[\s\S]*?<\/header>/i;
  let headerRefreshed = false;
  if (headerZoneRe.test(content)) {
    content = content.replace(headerZoneRe, newHeader);
    headerRefreshed = true;
  }
  const footerZoneRe = /<footer>[\s\S]*?<\/footer>/i;
  let footerRefreshed = false;
  if (footerZoneRe.test(content)) {
    content = content.replace(footerZoneRe, newFooter);
    footerRefreshed = true;
  }
  // Cookie zone: banner + prefs as a unit (tolerant)
  const cookieZoneRe = /<div[^>]*id=["']?cookie-banner["']?[^>]*>[\s\S]*?<div[^>]*id=["']?cookie-preferences["']?[^>]*>[\s\S]*?<\/div>\s*(?:<\/div>)?/i;
  let cookieRefreshed = false;
  if (cookieZoneRe.test(content)) {
    content = content.replace(cookieZoneRe, newCookie);
    cookieRefreshed = true;
  }

  // Note: we intentionally do *not* run broad "remove any remaining cookie" here after zone refresh,
  // because it would nuke the zone we just put. The pre-cleanup and zone refresh are sufficient for normal cases;
  // the fallback removeOld + insert below only run for !Refreshed components.

  // --- HEADER (top of body) ---
  if (!headerRefreshed) {
    const headerResult = removeOldHeader(content);
    content = headerResult.content;

    content = insertHeader(content, newHeader);
  }

  // --- FOOTER then COOKIE (bottom of body, before scripts; canonical order for stable inserts) ---
  if (!footerRefreshed) {
    const footerResult = removeOldFooter(content);
    content = footerResult.content;

    content = insertFooter(content, newFooter);
  }

  if (!cookieRefreshed) {
    const cookieResult = removeOldCookie(content);
    content = cookieResult.content;

    content = insertCookie(content, newCookie);
  }

  // Strip trailing whitespace (keeps sources clean, reduces html-validate no-trailing-whitespace noise)
  content = content.replace(/[ \t]+$/gm, '');

  // === INSIGHTS PRE-RENDER (SEO): inject static news/resources lists + JSON-LD for notizie*.html
  // This ensures crawlers see real keyword-rich content even if client JS enhances later.
  const insightsResult = injectInsightsStatic(content, filename);
  if (insightsResult.changed) {
    content = insightsResult.content;
  }

  // Strip trailing whitespace again AFTER insights injection (the static HTML
  // generated by renderResourcesStatic / renderNewsStatic uses indented template
  // literals that can leave trailing spaces on lines).
  content = content.replace(/[ \t]+$/gm, '');

  // Collapse runs of 3+ blank lines into a single blank line. The regex-based
  // inserts above can leave variable amounts of vertical whitespace; without this
  // normalization the build accumulates blank lines on every run (non-idempotent).
  content = content.replace(/\n{3,}/g, '\n\n');

  // Only write if the content actually differs from what was on disk.
  // This makes repeated builds on an up-to-date tree a true no-op for the HTML files.
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    const notes = [];
    if (insightsResult.changed) notes.push('insights-static');
    console.log('  ✓ Synced chrome (cookie+header+footer)' + (notes.length ? ' + ' + notes.join('+') : '') + ' in', filename);
    return true;
  }
  return false;
}

function main() {
  const production = process.argv.includes('--prod') || process.argv.includes('--production') || process.env.NODE_ENV === 'production';

  console.log('Building / syncing partials into HTML files...\n');

  const htmlFiles = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html') && !f.startsWith('.'));

  let updated = 0;
  for (const f of htmlFiles) {
    const full = path.join(ROOT, f);
    if (processFile(full)) updated++;
  }

  // Production build: create a self-contained dist/ folder ready for deploy.
  // IMPORTANT: We *never* mutate the refs in the *root* HTML files to minified versions.
  // The committed sources in the repo always reference the full style.css / script.js
  // so that a fresh clone + `npm run dev` / python server "just works".
  // Min-ref versions are only produced inside dist/ for deployment.
  if (production) {
    const distDir = path.join(ROOT, 'dist');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir, { recursive: true });

    console.log('\nCreating production dist/ folder...');

    // Copy HTML but rewrite asset refs to .min *only for the dist/ copies*
    for (const f of htmlFiles) {
      let c = fs.readFileSync(path.join(ROOT, f), 'utf8');
      c = c.replace(/href=["'][^"']*style(\.min)?\.css["']/g, 'href="style.min.css"');
      c = c.replace(/src=["'][^"']*script(\.min)?\.js["']/g, 'src="script.min.js"');
      fs.writeFileSync(path.join(distDir, f), c, 'utf8');
    }

    // Copy essential assets (images, pdf, data, favicon, manifest, etc.)
    const assetsToCopy = [
      'image', 'pdf', 'data', 'favicon.svg', 'manifest.json', 
      'robots.txt', 'sitemap.xml', 'ads.txt', 'CNAME'
    ];
    for (const asset of assetsToCopy) {
      const src = path.join(ROOT, asset);
      const dest = path.join(distDir, asset);
      if (fs.existsSync(src)) {
        if (fs.statSync(src).isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    }

    // Explicitly copy the minified files (they are normally gitignored)
    const minCss = path.join(ROOT, 'style.min.css');
    const minJs = path.join(ROOT, 'script.min.js');
    if (fs.existsSync(minCss)) fs.copyFileSync(minCss, path.join(distDir, 'style.min.css'));
    if (fs.existsSync(minJs)) fs.copyFileSync(minJs, path.join(distDir, 'script.min.js'));

    console.log('  ✓ dist/ folder created with minified assets. Ready to deploy (e.g. upload dist/ or point your host to it).');
  }

  // Final safeguard: *always* leave the root HTML files (the ones committed to the repo)
  // referencing the full non-minified assets. This keeps the working tree clean for git
  // regardless of whether a prod or dev build was run, and makes fresh clones immediately
  // usable with the dev server without requiring a build step first.
  let rootRefsNormalized = 0;
  for (const f of htmlFiles) {
    const full = path.join(ROOT, f);
    let c = fs.readFileSync(full, 'utf8');
    const orig = c;
    c = c.replace(/href=["'][^"']*style(\.min)?\.css["']/g, 'href="style.css"');
    c = c.replace(/src=["'][^"']*script(\.min)?\.js["']/g, 'src="script.js"');
    if (c !== orig) {
      fs.writeFileSync(full, c, 'utf8');
      rootRefsNormalized++;
    }
  }
  if (rootRefsNormalized > 0) {
    console.log(`  ✓ Root HTML asset refs normalized back to full (non-min) in ${rootRefsNormalized} file(s).`);
  }

  console.log(`\nDone. Updated ${updated} file(s).`);
  if (!production) {
    console.log('Tip: edit only files inside partials/, then run `npm run build:html` before deploying.');
    console.log('For production build with minified CSS/JS: `npm run build`');
  }
}

if (require.main === module) {
  main();
}

module.exports = { processFile }; // for tests if wanted later
