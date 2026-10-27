#!/usr/bin/env node
/**
 * check-scadenze.js — le frasi del sito che invecchiano (content/scadenze-sito.json).
 *
 * Uso: npm run check:scadenze
 *      node scripts/check-scadenze.js --giorni 14   (anticipo sulle date da rivedere, default 7)
 *
 * Per ogni voce dice se la frase c'è ancora, se la data da rivedere è vicina o passata,
 * e quale evento si aspetta. Non blocca mai (esce 0), salvo registro illeggibile: una
 * data nel calendario non deve far fallire la CI di un commit che non c'entra.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REGISTRO = path.join(ROOT, 'content', 'scadenze-sito.json');

const spazi = (s) => s.replace(/\s+/g, ' ');

function oggiIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function piuGiorni(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const it = (iso) => iso.split('-').reverse().join('/');

// Restituisce { scadute, vicine, sparite, attese }: liste di righe già pronte da stampare.
function controllaScadenze({ giorni = 7, oggi = oggiIso() } = {}) {
  const reg = JSON.parse(fs.readFileSync(REGISTRO, 'utf8'));
  const esito = { scadute: [], vicine: [], sparite: [], attese: [] };
  const limite = piuGiorni(oggi, giorni);

  for (const v of reg.voci || []) {
    const etichetta = `${v.id} (${v.file})`;
    if (v.file && v.testo) {
      const p = path.join(ROOT, v.file);
      const testo = fs.existsSync(p) ? spazi(fs.readFileSync(p, 'utf8')) : '';
      if (!testo.includes(spazi(v.testo))) {
        esito.sparite.push(`${etichetta}: la frase non c'è più, la voce va aggiornata o tolta dal registro`);
        continue;
      }
    }
    const natura = v.natura ? `, ${v.natura}` : '';
    if (v.rivedere && v.rivedere <= oggi) {
      esito.scadute.push(`${etichetta}: da rivedere dal ${it(v.rivedere)}${natura} — ${v.azione || v.quando}`);
    } else if (v.rivedere && v.rivedere <= limite) {
      esito.vicine.push(`${etichetta}: da rivedere il ${it(v.rivedere)}${natura} — ${v.azione || v.quando}`);
    } else {
      esito.attese.push(`${etichetta}: ${v.rivedere ? `rivedere il ${it(v.rivedere)}${natura}; ` : ''}evento atteso, ${v.quando}`);
    }
  }
  return esito;
}

function stampa(esito, { compatto = false } = {}) {
  const blocchi = [
    ['⏰ Da rivedere ora', esito.scadute],
    ['⏳ Da rivedere a breve', esito.vicine],
    ['⚠︎ Registro da aggiornare', esito.sparite],
  ];
  if (!compatto) blocchi.push(['· In attesa di un evento', esito.attese]);
  let righe = 0;
  for (const [titolo, voci] of blocchi) {
    if (!voci.length) continue;
    console.log(`${titolo}:`);
    for (const r of voci) console.log('  • ' + r);
    righe += voci.length;
  }
  if (!righe) console.log('✓ Nessuna frase a scadenza da rivedere.');
}

module.exports = { controllaScadenze, stampa };

if (require.main === module) {
  const i = process.argv.indexOf('--giorni');
  const giorni = i > -1 ? Number(process.argv[i + 1]) : 7;
  try {
    stampa(controllaScadenze({ giorni }));
  } catch (e) {
    console.error(`❌ Registro delle scadenze illeggibile (${REGISTRO}): ${e.message}`);
    process.exit(1);
  }
}
