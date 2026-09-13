# Schema di una guida

Una guida = un file `content/guide/<id>.json`. La cartella `content/` è esclusa da GitHub Pages
(`_config.yml`): finché una guida non è `published` **non esiste alcun file pubblicabile**.

Validatore: `npm run check:guide`. Non passa, non si pubblica.

```jsonc
{
  "schemaVersion": 1,
  "id": "tc-produzione",              // stesso id della scheda in data/notizie-it.json
  "slug": "tax-credit-produzione",     // pagina: guida-<slug>.html
  "lang": "it",
  "status": "draft",                   // draft | review | published
  "title": "…",                        // <h1>
  "metaTitle": "… | Studio Legale Lo Foco",
  "metaDescription": "…",              // 80-160 caratteri
  "abstract": "…",                     // 1-3 frasi, apre la pagina
  "category": "tax-credit",
  "author": { "name": "Andrea Lo Foco", "role": "Avvocato", "url": "andrea-lo-foco.html" },
  "datePublished": "2026-09-20",
  "dateModified": "2026-09-20",
  "verifiedAt": "2026-09-20",          // quando il contenuto è stato riletto contro le fonti
  "sections": [
    {
      "id": "requisiti",
      "heading": "Requisiti di accesso",
      "paragraphs": [
        { "text": "…", "refs": ["di-225-2024"], "cite": "art. 13, c. 1, D.I. 225/2024" },
        { "text": "…senza dati regolati…", "refs": [] },
        { "text": "…", "refs": [], "noSourceReason": "descrizione di prassi, nessun dato normativo" }
      ],
      "list": ["voce", "voce"]          // opzionale
    }
  ],
  "faq": [ { "q": "…", "a": "…", "refs": ["di-225-2024"] } ],
  "sources": [
    {
      "id": "di-225-2024",
      "type": "dm",                     // legge | dm | dd | avviso | ue | prassi
      "citation": "D.I. MiC-MEF 10 luglio 2024, rep. n. 225, art. 13, comma 1",
      "short": "D.I. 225/2024",   // sigla usata nei richiami accanto al testo; la citazione piena resta in fondo
      "url": "https://cinema.cultura.gov.it/…pdf",
      "urlType": "primaria",           // primaria | istituzionale | stampa
      "accessedAt": "2026-09-12",
      "checkedAt": "2026-09-12"        // ultima verifica che la fonte è ancora quella
    }
  ],
  "related": ["contributi-selettivi"],
  "disclaimer": "…"                     // opzionale, default in pagina
}
```

## Regole imposte dal validatore

0. **`cite`** (opzionale) è l'etichetta del richiamo accanto al testo: serve a indicare articolo e comma puntuali. Senza `cite` si usa la sigla breve della fonte.
1. **Ogni `refs` risolve** a un `sources[].id`; **ogni fonte dichiarata è citata** almeno una volta.
2. **Ogni paragrafo con un dato regolato** (`%`, `€`, `art.`, `D.M.`, `D.I.`, `D.D.`, `rep.`, `comma`,
   una data, un anno a quattro cifre, «entro il») **deve avere `refs` non vuoto**, oppure un
   `noSourceReason` esplicito. Il controllo fallisce sul silenzio, non sulla prosa.
3. **Almeno una fonte `urlType: "primaria"`**, con host tra: `normattiva.it`, `gazzettaufficiale.it`,
   `eur-lex.europa.eu`, `cinema.cultura.gov.it`. Un atto istituzionale che non è la norma (un avviso,
   un comunicato) è `istituzionale`; una notizia di agenzia o di stampa specializzata è `stampa` e va
   usata solo per fatti di cronaca normativa non ancora documentati da un atto, dicendolo nel testo.
4. **Date**: formato `YYYY-MM-DD`; `dateModified >= datePublished`; `verifiedAt` non nel futuro;
   `checkedAt` delle fonti: avviso oltre 90 giorni, errore oltre 180.
5. **Lunghezza** della prosa: 800–2.000 parole (solo per `review` e `published`); oltre 1.600 il validatore avvisa che conviene dividere la guida.
6. `slug` in minuscolo con trattini; `status` tra i tre valori ammessi.

## Che cosa si pubblica e che cosa no

Il discrimine non è **quanta** informazione diamo, ma **se consegniamo un documento pronto all'uso**.
Le norme sono pubbliche e chiunque le scarica: quello che pubblichiamo non è l'informazione, è la
lettura dell'informazione, e la lettura non mette nessuno in condizione di fare da sé.

**Si pubblica** la regola e il punto in cui morde: termini perentori, incompatibilità, decadenze,
scelte da compiere prima di firmare un contratto o di costituire la società, vincoli che la sola
lettura dell'articolo non rivela. È ciò che distingue la guida di uno studio dal riassunto di un
blog, e rende evidente al lettore dove gli serve un parere invece di suggerirgli che non gli serve.

**Non si pubblica mai** il manufatto per cui il cliente paga: clausole e modelli contrattuali,
fac-simile di autodichiarazioni, moduli compilabili da allegare a una domanda, procedure passo-passo
sulla piattaforma DGCOL, responsi automatici di idoneità («hai diritto al 40%»).

Corollario deontologico, art. 35 CDF (informazione vera e non ingannevole): un responso di idoneità
dato a chi idoneo non è espone lo studio molto più di qualunque guida dettagliata. Nel dubbio si
descrive il requisito e si dice chi lo verifica.

**Misura di controllo.** `check:guide` avvisa quando meno di un terzo dei capoversi contiene un
avvertimento operativo. Non è un obiettivo da centrare né una percentuale da inseguire: è un
sintomo. Una guida molto sotto quella soglia sta scivolando verso il manuale. Riferimento misurato
il 13/09/2026: contributi selettivi 40% e 50%, tax credit produzione 22%.

## Flusso

| status | Dove finisce | Chi la vede |
|---|---|---|
| `draft` | da nessuna parte | solo chi ha il repo |
| `review` | `preview/` (ignorata da git, esclusa da Pages) | chi la apre in locale con `npm run dev` |
| `published` | `guida-<slug>.html` in root + sitemap | tutti |

Una guida si pubblica solo dopo rilettura contro il dossier in `content/fonti/`, affermazione per
affermazione.
