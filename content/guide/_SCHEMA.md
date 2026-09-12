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
        { "text": "…", "refs": ["di-225-2024"] },
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
      "url": "https://cinema.cultura.gov.it/…pdf",
      "urlType": "primaria",           // primaria | istituzionale
      "accessedAt": "2026-09-12",
      "checkedAt": "2026-09-12"        // ultima verifica che la fonte è ancora quella
    }
  ],
  "related": ["contributi-selettivi"],
  "disclaimer": "…"                     // opzionale, default in pagina
}
```

## Regole imposte dal validatore

1. **Ogni `refs` risolve** a un `sources[].id`; **ogni fonte dichiarata è citata** almeno una volta.
2. **Ogni paragrafo con un dato regolato** (`%`, `€`, `art.`, `D.M.`, `D.I.`, `D.D.`, `rep.`, `comma`,
   una data, un anno a quattro cifre, «entro il») **deve avere `refs` non vuoto**, oppure un
   `noSourceReason` esplicito. Il controllo fallisce sul silenzio, non sulla prosa.
3. **Almeno una fonte `urlType: "primaria"`**, con host tra: `normattiva.it`, `gazzettaufficiale.it`,
   `eur-lex.europa.eu`, `cinema.cultura.gov.it`.
4. **Date**: formato `YYYY-MM-DD`; `dateModified >= datePublished`; `verifiedAt` non nel futuro;
   `checkedAt` delle fonti: avviso oltre 90 giorni, errore oltre 180.
5. **Lunghezza** della prosa: 800–1.200 parole (solo per `review` e `published`).
6. `slug` in minuscolo con trattini; `status` tra i tre valori ammessi.

## Flusso

| status | Dove finisce | Chi la vede |
|---|---|---|
| `draft` | da nessuna parte | solo chi ha il repo |
| `review` | `preview/` (ignorata da git, esclusa da Pages) | chi la apre in locale con `npm run dev` |
| `published` | `guida-<slug>.html` in root + sitemap | tutti |

Una guida si pubblica solo dopo rilettura contro il dossier in `content/fonti/`, affermazione per
affermazione.
