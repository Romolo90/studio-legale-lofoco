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

  if (scriptRe.test(content)) {
    return content.replace(scriptRe, `${newCookie}\n$1`);
  } else if (bodyCloseRe.test(content)) {
    return content.replace(bodyCloseRe, `\n${newCookie}\n$1`);
  }
  // fallback append at end of body content
  return content.replace(/<\/body>/i, `\n${newCookie}\n</body>`);
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

  const scriptRe = /(<script src=["'][^"']*script(\.min)?\.js["'][^>]*>[\s\S]*?<\/script>\s*<\/body>)/i;
  if (scriptRe.test(content)) {
    return content.replace(scriptRe, `\n${newFooter}\n$1`);
  }
  const bodyCloseRe = /(\s*<\/body>)/i;
  if (bodyCloseRe.test(content)) {
    return content.replace(bodyCloseRe, `\n${newFooter}\n$1`);
  }
  return content;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const filename = path.basename(filePath);
  const isEn = isEnglishFile(filename);
  const isHome = isHomeFile(filename);

  const newHeader = getHeaderPartial(isEn, isHome);
  const newFooter = getFooterPartial(isEn, isHome);
  const newCookie = isEn ? COOKIE_EN : COOKIE_IT;

  // Robust sanitization: clean artifacts from previous bad build runs (stray comments, duplicated blocks, concatenated tags)
  content = content.replace(/<!--\s*.*?(MAIN|CONTENT).*?-->\s*<header class="header">/gi, '<header class="header">');
  content = content.replace(/<!--\s*FINE COOKIE BANNER\s*-->/gi, '');
  // Remove stray top-level duplicate cookie-buttons (common pollution)
  content = content.replace(/<div class="cookie-buttons">\s*<button type="button" id="accept-cookies"[\s\S]*?Gestisci cookie<\/button>\s*<\/div>\s*<\/div>\s*(?=\s*<!--|<header|<main)/gi, '');
  content = content.replace(/<div class="cookie-buttons">\s*<button type="button" id="accept-cookies"[\s\S]*?Gestisci cookie<\/button>\s*<\/div>\s*(?=\s*<!--|<header|<main)/gi, '');

  let changed = false;

  // --- COOKIE ---
  const cookieResult = removeOldCookie(content);
  content = cookieResult.content;
  if (cookieResult.changed) changed = true;

  content = insertCookie(content, newCookie);
  changed = true; // we always ensure cookie is present

  // --- HEADER ---
  const headerResult = removeOldHeader(content);
  content = headerResult.content;
  if (headerResult.changed) changed = true;

  content = insertHeader(content, newHeader);
  changed = true;

  // --- FOOTER ---
  const footerResult = removeOldFooter(content);
  content = footerResult.content;
  if (footerResult.changed) changed = true;

  content = insertFooter(content, newFooter);
  changed = true;

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('  ✓ Synced chrome (cookie+header+footer) in', filename);
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

  // Always normalize stylesheet and script references based on mode
  console.log(`\n${production ? 'Production' : 'Development'} mode: normalizing asset references...`);
  let refsUpdated = 0;
  const cssRef = production ? 'style.min.css' : 'style.css';
  const jsRef = production ? 'script.min.js' : 'script.js';

  for (const f of htmlFiles) {
    const full = path.join(ROOT, f);
    let c = fs.readFileSync(full, 'utf8');
    const orig = c;

    c = c.replace(/href=["'][^"']*style(\.min)?\.css["']/g, `href="${cssRef}"`);
    c = c.replace(/src=["'][^"']*script(\.min)?\.js["']/g, `src="${jsRef}"`);

    if (c !== orig) {
      fs.writeFileSync(full, c, 'utf8');
      refsUpdated++;
    }
  }
  console.log(`  ✓ Asset references normalized in ${refsUpdated} file(s) (${production ? 'minified' : 'full'})`);

  // Production build: create a self-contained dist/ folder ready for deploy
  if (production) {
    const distDir = path.join(ROOT, 'dist');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir, { recursive: true });

    console.log('\nCreating production dist/ folder...');

    // Copy all HTML (now pointing to .min)
    for (const f of htmlFiles) {
      fs.copyFileSync(path.join(ROOT, f), path.join(distDir, f));
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
