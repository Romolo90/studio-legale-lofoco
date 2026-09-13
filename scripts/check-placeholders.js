#!/usr/bin/env node
/**
 * check-placeholders.js — segnaposti di modello finiti in pagina.
 *
 * Il 13 settembre 2026 dodici schede su diciannove hanno mostrato il testo
 * "${footerBase}" al posto dell'etichetta: il ripiego era scritto fra apici dentro
 * l'espressione del modello e diventava una stringa letterale. Nessun altro controllo
 * poteva accorgersene, perché l'HTML resta valido e il build idempotente: per una
 * macchina "${footerBase}" è testo legittimo. L'ha trovato l'avvocato leggendo la pagina.
 *
 * Cerca nel documento, esclusi gli script eseguibili (che contengono modelli legittimi),
 * i segni di un modello non risolto: "${", e le parole "undefined" e "NaN" che compaiono
 * quando un campo manca. I blocchi JSON-LD restano controllati: lì un segnaposto
 * diventa un dato strutturato sbagliato.
 *
 * Uso: npm run check:placeholders
 *      node scripts/check-placeholders.js <cartella>
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !f.startsWith('.'));

const SEGNI = [
  { re: /\$\{/g, nome: 'segnaposto ${' },
  { re: /\bundefined\b/g, nome: 'la parola "undefined"' },
  { re: /\bNaN\b/g, nome: 'la parola "NaN"' },
];

const errori = [];

for (const f of files) {
  const grezzo = fs.readFileSync(path.join(ROOT, f), 'utf8');
  // via gli script eseguibili; i JSON-LD (type="application/ld+json") restano
  const documento = grezzo.replace(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, '');
  for (const { re, nome } of SEGNI) {
    for (const m of documento.matchAll(re)) {
      const contesto = documento.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, ' ').trim();
      errori.push(`${f}: ${nome} → "…${contesto}…"`);
    }
  }
}

if (errori.length) {
  console.error(`\n❌ ${errori.length} segnaposti non risolti nelle pagine:\n`);
  for (const e of errori) console.error('  • ' + e);
  console.error('\nUn modello ha scritto in pagina il proprio codice invece del valore.');
  process.exit(1);
}
console.log(`✓ Nessun segnaposto non risolto su ${files.length} pagine.`);
