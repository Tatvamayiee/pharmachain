# Medicine Master Database — provenance & recreation

The validation service (`server/services/drugDatabaseService.cjs`) loads the
master dataset lazily from `server/ml/reference/medicine-master.json`
(~149 MB, built artifact — **not committed to Git**, too large).

## Source

| Field | Value |
|---|---|
| Dataset | **Indian Medicine Dataset** |
| URL | https://github.com/junioralive/Indian-Medicine-Dataset |
| File | `DATA/indian_medicine_data.csv` (31.8 MB, 253,973 rows) |
| License | **MIT (c) 2024 JuniorAlive** — verified from the repo's `LICENSE` |
| Snapshot | 2024 repo `main`; imported 2026-09-25 |

Fields per row: `name, price, Is_discontinued, manufacturer, type, pack_size_label, short_composition1…`

## Build / recreate

```
node scripts/data/import-medicine-master.cjs [--limit N] [--max-mb 40]
```

Pipeline: CSV → RFC-4180 parse → schema mapping → name normalization
(dose-form stripping) → composition parsing (`{salt, strength}` pairs) →
strength normalization → **dedup by normalized brand name** → provenance
written onto **every record** (`source`, `sourceVersion`, `sourceId`,
`license`, `importedAt`) + dataset manifest.

Aliases come **only** from real composition equivalences (brand ↔ salt),
never invented. The curated in-code formulary (`REFERENCE_MEDICINES`)
remains authoritative; the master **extends** it.

## On the deployed backend

The master JSON is not in Git. Build it once from any machine with
outbound network:

```
node scripts/data/import-medicine-master.cjs
```

The importer writes `server/ml/reference/medicine-master.json`. The current
Render blueprint has no persistent disk, so provision this generated artifact
as part of a durable deployment/release process; do not rely on a Render shell
filesystem surviving a restart or deploy.

Until the file exists on the host, validation falls back to the curated
formulary and `/ml-training-status` honestly reports
`medicineMaster.available=false`.

## Current counts (2026-09-25 import)

```
Total medicine records:    249,163  (14 curated + 249,149 imported)
Aliases:                   14,908 composition-derived
Duplicate records removed: 4,824
Discontinued (flagged):    7,905
```
