---
name: eiscd-api
description: Help developers integrate with the Mintly EISCD API to download Extended Industry Sort Code Directory data files on the weekly or monthly plan.
when_to_use: Use when a developer wants to download the full EISCD dataset on the weekly or monthly plan, fetch weekly delta files, process sort code directory data in text/CSV/XML/Excel format, migrate an integration from v1 to v2, or schedule automated EISCD data refreshes using the Mintly API.
---

# Mintly EISCD API — Integration Skill

## Which API are you on?

There are three EISCD references. They differ in **base URL**, in **which endpoints exist**,
and — most importantly — in **how failures are reported**. Establish which one applies
before writing any code.

| Plan | Version | Base URL | Docs | OpenAPI spec |
|---|---|---|---|---|
| Weekly | **v2** (current) | `https://api.mintly.uk/eiscd/v2` | [/eiscd-docs](https://www.mintly.uk/eiscd-docs) | [eiscd-openapi-weekly-v2.yaml](https://www.mintly.uk/assets/eiscd-openapi-weekly-v2.yaml) |
| Weekly | v1 (legacy) | `https://api.mintly.uk/eiscd` | [/eiscd-docs/weekly/v1](https://www.mintly.uk/eiscd-docs/weekly/v1) | [eiscd-openapi.yaml](https://www.mintly.uk/assets/eiscd-openapi.yaml) |
| Monthly | **v2** (only version) | `https://api.mintly.uk/eiscd-base/v2` | [/eiscd-docs/monthly/v2](https://www.mintly.uk/eiscd-docs/monthly/v2) | [eiscd-openapi-monthly-v2.yaml](https://www.mintly.uk/assets/eiscd-openapi-monthly-v2.yaml) |

**Rules for choosing:**

- **Default to v2.** It is the current release for both plans.
- **If the plan or version is not established, ask.** Do not guess — v1 and v2 report
  failures in incompatible ways, and code written for one silently mishandles the other.
- **The monthly plan has no v1**, and no delta files.
- Existing code is a strong signal: a base URL ending `/eiscd` with no `/v2` is v1.

---

## What is the EISCD?

The Extended Industry Sort Code Directory (EISCD) is the authoritative dataset of all UK bank branches and their sort codes, maintained by Vocalink. It includes branch details, payment scheme participation, and redirection data.

Use this API to:
- Seed a local database with the full EISCD
- Keep it in sync with weekly delta updates (weekly plan)
- Refresh a full snapshot on a monthly cycle (monthly plan)
- Process sort code data in your preferred format (text, CSV, XML, Excel)

---

## Base URLs

```
https://api.mintly.uk/eiscd/v2         # weekly plan, v2 — current
https://api.mintly.uk/eiscd            # weekly plan, v1 — legacy
https://api.mintly.uk/eiscd-base/v2    # monthly plan, v2
```

There is no sandbox environment. All requests are against production data.

---

## Authentication

All endpoints require an API key passed as a request header:

```
x-api-key: <your-api-key>
```

**Keys are issued per plan.** A weekly key will not fetch monthly files, and a monthly key
will not fetch weekly files — pair each key with the base URL for its own plan. The version
does not change the key: the same weekly key works against both `/eiscd` and `/eiscd/v2`.

**Never hardcode your API key in source code.** Store it in an environment variable:

```bash
# .env.local  (add to .gitignore)
MINTLY_EISCD_API_KEY=your_weekly_key_here           # weekly plan
MINTLY_EISCD_MONTHLY_API_KEY=your_monthly_key_here  # monthly plan
```

Most integrations use one plan and therefore need only one of these.

---

## Endpoints

### Full base files (latest snapshot)

Available on **both** the weekly and monthly plans, at that plan's base URL.

| Endpoint | Format | Approx size | Spec |
|---|---|---|---|
| `GET /eiscd-text.zip` | Tab-delimited text | ~850 KB | [Vocalink tab-delimited spec](https://www.vocalink.com/media/thfivwco/extended-iscd-tech-spec-tab-delimited-v280.pdf) |
| `GET /eiscd-csv.zip` | CSV | ~750 KB | Same as tab-delimited with comma delimiter |
| `GET /eiscd-xml.zip` | XML | ~2 MB | [Vocalink XML spec](https://www.vocalink.com/media/kkeemoy1/extended-iscd-specification-xml-v190.pdf) |
| `GET /eiscd-xlsx.zip` | Excel (XLSX) | ~7 MB | Same fields as tab-delimited |

All base file endpoints return an `application/zip` binary response with no path parameters.

---

### Weekly delta file — **weekly plan only**

```
GET /delta-files/{year}/{week}/eiscd-delta.txt
```

Returns a text file of all changes since the previous week's EISCD. One change per line.

**Not available on the monthly plan.** Requesting it with a monthly key returns `404`. If a
monthly customer needs weekly changes, they need the weekly plan — point them at
[/eiscd-docs](https://www.mintly.uk/eiscd-docs) rather than writing a workaround.

**Path parameters:**

| Parameter | Format | Example |
|---|---|---|
| `year` | 4-digit year | `2025` |
| `week` | ISO-8601 week number, prefixed `week-` | `week-18` |

**Delta file format** is identical to the tab-delimited base file, with an **additional column in position 0** that identifies each record as `NEW`, `UPDATED`, or `DELETED`.

---

## Data refresh and quotas

**Weekly plan.** New files are published every **Friday from 12:00 GMT**. Data should be considered valid from the **following Monday**.

**Monthly plan.** The underlying EISCD is refreshed weekly at source, but the plan's quota is
intended for **one download per calendar month** — whichever snapshot you take is the one
published at that point. The quota is enforced with some headroom rather than cutting off at
exactly one, and `429` is what you get once it is spent.

So, for the monthly plan: schedule **one** fetch per month. Retrying after a genuine failure
is fine and well within the headroom. Do not poll, and do not re-download to "check for
changes" — a `429` from a spent quota does not clear until the next month, so treating it as
an ordinary retryable rate limit will just burn attempts.

---

## Error handling

**This is the part that differs between versions.** Use the section matching the version you
established above.

### v2 — weekly v2 and monthly v2 (default)

Failures use real HTTP status codes, with a JSON body:

```json
{
  "Status": "Invalid",
  "Message": "File not found"
}
```

`Status` is `"Error"` or `"Invalid"`; `Message` is a short description. Both fields are
always present on a failure.

| HTTP status | Meaning | Recommended action |
|---|---|---|
| `200` | Success — body is the file | — |
| `403` | Key missing, invalid, or disabled. Also check you are not using the other plan's key | Check the `x-api-key` header and that the key matches this base URL's plan |
| `404` | File not available — either it does not exist, or it is not part of your plan. Also returned for a delta request on the monthly plan, and possibly for the other plan's key | Check the year/week values and that the endpoint exists on your plan |
| `429` | Rate limited, or monthly quota spent | Back off exponentially. On the monthly plan, treat a spent quota as "wait for next month", not as a retry loop |
| `500` | Unexpected server error | Retry once after a short delay; alert if it persists |

A file that does not exist and a file outside your plan **both return `404` and are
deliberately indistinguishable** — do not try to tell them apart.

### v1 — weekly only (legacy)

v1 does **not** use `4xx` for a missing file. It returns `200` with an XML error body.

| HTTP status | Meaning | Recommended action |
|---|---|---|
| `403` | No key, or key invalid/expired | Check `MINTLY_EISCD_API_KEY`; ensure `x-api-key` header is set |
| `429` | Rate limited | Back off exponentially and retry |
| `500` | Unexpected server error | Retry once after a short delay; alert if persists |
| `200` + XML body | S3 file not found (delta only) | Check year/week values; file may not exist yet |

**Note:** a `200` response can still contain an S3 error in XML if the requested week/year
combination does not exist. On v1 you must check the `Content-Type` header, or parse the
response body for the `<Error>` element, before treating a `200` as success.

---

## TypeScript client (fetch, no extra dependencies)

For **v2** — both plans. Pass the base URL and key for the plan you are on.

```typescript
// eiscd-client.ts
type EiscdError = { Status: string; Message: string }

export function createEiscdClient(baseUrl: string, apiKey: string) {
  if (!apiKey) throw new Error('EISCD API key is not set')

  async function eiscdFetch(path: string, retries = 3): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { 'x-api-key': apiKey },
      })

      if (res.ok) return res

      // Rate limited, or the monthly quota is spent. The body says which.
      if (res.status === 429) {
        if (attempt === retries) throw new Error(await describe(res))
        await new Promise(r => setTimeout(r, 2 ** attempt * 1000))
        continue
      }

      // 403 and 404 are terminal — retrying will not help.
      throw new Error(await describe(res))
    }
    throw new Error('Unreachable')
  }

  /** v2 always sends a JSON {Status, Message} body on failure. */
  async function describe(res: Response): Promise<string> {
    try {
      const body = (await res.json()) as EiscdError
      return `EISCD ${res.status}: ${body.Status} — ${body.Message}`
    } catch {
      return `EISCD request failed: HTTP ${res.status}`
    }
  }

  return {
    /** Full EISCD snapshot as a zip. Returns the Response for streaming. */
    downloadTextZip: () => eiscdFetch('/eiscd-text.zip'),
    downloadCsvZip:  () => eiscdFetch('/eiscd-csv.zip'),
    downloadXmlZip:  () => eiscdFetch('/eiscd-xml.zip'),
    downloadXlsxZip: () => eiscdFetch('/eiscd-xlsx.zip'),

    /**
     * Weekly delta file. Weekly plan only — 404 on the monthly plan.
     * @param year e.g. 2025
     * @param week ISO week number, e.g. 18
     */
    downloadDelta: async (year: number, week: number): Promise<string> => {
      const res = await eiscdFetch(`/delta-files/${year}/week-${week}/eiscd-delta.txt`)
      return res.text()
    },
  }
}

// Weekly plan — base files and deltas, with the weekly key.
export const weekly = createEiscdClient(
  'https://api.mintly.uk/eiscd/v2',
  process.env.MINTLY_EISCD_API_KEY!,
)

// Monthly plan — base files only, with the monthly key. `downloadDelta` is
// deliberately not re-exported: there are no delta files on this plan, so
// calling it would only ever produce a 404.
const monthlyClient = createEiscdClient(
  'https://api.mintly.uk/eiscd-base/v2',
  process.env.MINTLY_EISCD_MONTHLY_API_KEY!,
)

export const monthly = {
  downloadTextZip: monthlyClient.downloadTextZip,
  downloadCsvZip:  monthlyClient.downloadCsvZip,
  downloadXmlZip:  monthlyClient.downloadXmlZip,
  downloadXlsxZip: monthlyClient.downloadXlsxZip,
}
```

### v1 differences (legacy)

Use the same client against `https://api.mintly.uk/eiscd`, with two changes. Do **not** apply
these to v2 — a v2 `404` has no XML body to find, and the sniff would mask real errors.

```typescript
// 1. A 200 is not proof of success: check for an XML error body first.
async function assertNotS3Error(res: Response): Promise<Response> {
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('xml')) {
    throw new Error(`Delta file not found (S3 error): ${await res.text()}`)
  }
  return res
}

// 2. Failures carry no JSON body, so report the status alone.
const describeV1 = (res: Response) => `EISCD request failed: HTTP ${res.status}`
```

---

## Saving a zip to disk (Node.js)

```typescript
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

async function saveZip(fetcher: () => Promise<Response>, outputPath: string) {
  const res = await fetcher()
  if (!res.body) throw new Error('No response body')
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(outputPath))
  console.log(`Saved → ${outputPath}`)
}

// Usage
await saveZip(weekly.downloadCsvZip, './eiscd-latest.zip')
```

---

## Processing delta records

Weekly plan only. Each line in the delta file has the change type prepended:

```
NEW\t<tab-delimited fields...>
UPDATED\t<tab-delimited fields...>
DELETED\t<tab-delimited fields...>
```

```typescript
function parseDeltaLine(line: string) {
  const [changeType, ...fields] = line.split('\t')
  return { changeType, fields }   // changeType: 'NEW' | 'UPDATED' | 'DELETED'
}
```

---

## Scheduling updates

### Weekly plan — incremental

The delta file for a given ISO week becomes available on **Friday from 12:00 GMT**:

1. On Friday afternoon, call `downloadDelta(year, isoWeek)` for the current week
2. Apply `NEW` and `UPDATED` records as upserts to your local store
3. Apply `DELETED` records as deletions
4. Fall back to the full base file (`downloadCsvZip` / `downloadTextZip`) for initial seeding or after missing multiple weeks

### Monthly plan — full replace

There are no delta files, so each refresh is a whole snapshot:

1. Once a month, download one base file
2. Load it into a staging table, then swap it in — replace rather than merge, since without
   deltas you cannot know which records were deleted
3. Keep the previous snapshot until the new one is verified
4. Pick a fixed day of the month rather than reacting to the Friday source refresh; the
   quota is monthly, not weekly

---

## Migrating from v1 to v2

Only the error contract changes. Endpoints, path parameters and file formats are identical,
so a migration is confined to the request setup and the failure path:

| | v1 | v2 |
|---|---|---|
| Base URL (weekly) | `https://api.mintly.uk/eiscd` | `https://api.mintly.uk/eiscd/v2` |
| Failed download status | `200` | `403`, `404`, `429` or `500` |
| Error body | XML | JSON (`Status`, `Message`) |

Steps:

1. Change the base URL to add `/v2`. The API key is unchanged.
2. Delete the `Content-Type` sniff and any `<Error>` parsing — on v2 a `200` is always the file.
3. Handle failures on status: `res.ok`, then parse the JSON body for a message.
4. Treat `404` as "file not available", covering both a missing file and one outside your plan.

v1 remains available and unchanged, with no deprecation date, so this migration can be done
when convenient.

---

## Security reminders

- Store the API key in an environment variable; never commit it to source control.
- Keys are per plan — keep the weekly and monthly keys in separate variables so the wrong one cannot be sent to the wrong base URL.
- The EISCD contains branch-level data only — no personally identifiable information — but treat the API key as a credential.
- Stream large zip files to disk rather than buffering them fully in memory.

---

## Common tasks Claude can help with

When invoked with `/eiscd-api`, ask Claude to:

- **Seed a database** — "Write a Node.js script to download the EISCD CSV and import it into PostgreSQL"
- **Process deltas** — "Write a function to apply a weekly delta file to a local sort code table"
- **Schedule sync** — "Set up a cron job to download the EISCD delta every Friday afternoon"
- **Refresh a monthly snapshot** — "Write a monthly job that downloads the full EISCD and swaps it into my sort code table"
- **Migrate to v2** — "Update my EISCD client from v1 to v2 error handling"
- **Parse the data** — "Show me how to parse the tab-delimited EISCD text file in TypeScript"
- **Handle errors** — "How do I tell a missing delta file from an auth problem on v2?"
