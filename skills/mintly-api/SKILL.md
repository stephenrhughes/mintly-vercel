---
name: mintly-api
description: Help developers integrate with the Mintly Bank Account Checker API.
when_to_use: Use when a developer wants to validate UK sort codes, account numbers, IBANs, or SWIFT/BIC codes using the Mintly API, or needs help setting up, writing client code, handling errors, or testing their integration against the sandbox.
---

# Mintly Bank Account Checker API — Integration Skill

**API version:** 1.2.1  
**OpenAPI spec:** https://www.mintly.uk/assets/swagger.yaml

## Base URLs

| Environment | Base URL |
|---|---|
| Production | `https://api.mintly.uk/bankAccount/v1` |
| Sandbox | `https://sandbox.mintly.uk/bankAccount/v1` |

Always develop and test against the **sandbox** first. Switch to production only when ready to go live.

---

## Authentication

All endpoints require an API key passed as a request header:

```
x-api-key: <your-api-key>
```

**Never hardcode your API key in source code.** Store it in an environment variable:

```bash
# .env.local  (add to .gitignore)
MINTLY_API_KEY=your_key_here
```

To verify your key works, call the `/identity` endpoint (see below).

---

## Sandbox test values

| Input | Value |
|---|---|
| Sort code | `424242` |
| Account number | `42424242` |
| BIC | `TEST4242XXX` |
| IBAN | `GB42SAND424242 42424242` |

All other values return 404 in the sandbox.

---

## Endpoints

### 1. Validate sort code
```
GET /sortcode/{sortCode}
```
Returns branch information if the sort code exists and is active.  
Sort code can contain dashes or spaces (e.g. `42-42-42` or `42 42 42`).

**Responses:** `200` valid · `404` not found · `400` bad input · `401` invalid key · `403` no key · `429` rate limited

---

### 2. Validate sort code + account number
```
GET /sortcode/{sortCode}/account/{accountNumber}
```
Validates the pair and runs a modulus check. Returns `ModulusCheckCompleted: true` when the check was performed, plus a `DerivedIban`.

**Responses:** same as above.

---

### 3. Validate SWIFT/BIC
```
GET /swift/{bic}
```
BIC must be 11 characters. Append `XXX` to an 8-character BIC.  
Coverage: UK, Ireland, EEA SEPA member banks only.

**Responses:** same as above.

---

### 4. Validate IBAN
```
GET /iban/{iban}
```
Full branch data returned for UK, Ireland, and Germany. Other countries return valid/invalid status only.  
IBAN can contain spaces (e.g. `GB42 SAND 4242 4242 4242`).

**Responses:** same as above.

---

### 5. Check identity / test API key
```
GET /identity
```
Returns `200` with `AuthId` if the key is valid. Use this during setup to confirm credentials.

---

## Response schemas

### Account (returned by all check endpoints)
```typescript
interface Account {
  Status: 'Valid' | 'Invalid' | 'Error'   // always present
  DerivedIban?: string                     // account requests only
  ModulusCheckCompleted?: boolean          // account / UK IBAN requests only
  BranchData?: Branch
}
```

### Branch
```typescript
interface Branch {
  Info: Info
  Address: Address
  PaymentTypes: PaymentTypes
  PaymentSchemeClosedDates: PaymentSchemeClosedDates
  Redirection: Redirection
}
```

### Info
```typescript
interface Info {
  SortCode?: string
  ShortOwningBank: string      // max 20 chars
  BranchName?: string          // max 30 chars
  BicField1: string            // max 8 chars
  BicField2?: string           // max 3 chars  e.g. "XXX"
  ShortBranchTitle?: string
  SupervisoryBody?: string     // A=PRA/FCA  B=other financial  C=Crown dependencies  D=other
  BranchMinorLocation?: string
  BranchMajorLocation?: string
}
```

### PaymentTypes
```typescript
interface PaymentTypes {
  DirectDebitAccepted: boolean
  DirectCreditAccepted: boolean
  DirectDebitInstructionsAccepted: boolean
  AuddisAccepted: boolean
  DividendInterestAccepted: boolean
  BacsAccepted: boolean
  ChapsAccepted: boolean
  IcsAccepted: boolean
  FasterPaymentAccepted: boolean
  SepaMember: boolean
  SepaDirectDebit: boolean
}
```

### Error
```typescript
interface MintlyError {
  Status: 'Error' | 'Invalid'
  Message: string
}
```

---

## TypeScript client (fetch, no extra dependencies)

```typescript
// mintly-client.ts
const MINTLY_BASE_URL = process.env.MINTLY_BASE_URL ?? 'https://sandbox.mintly.uk/bankAccount/v1'
const MINTLY_API_KEY  = process.env.MINTLY_API_KEY

if (!MINTLY_API_KEY) throw new Error('MINTLY_API_KEY environment variable is not set')

async function mintlyFetch<T>(path: string, retries = 3): Promise<T> {
  const url = `${MINTLY_BASE_URL}${path}`
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { 'x-api-key': MINTLY_API_KEY! },
    })

    if (res.status === 429) {
      if (attempt === retries) throw new Error('Mintly rate limit exceeded')
      await new Promise(r => setTimeout(r, 2 ** attempt * 1000))
      continue
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw Object.assign(new Error(body.Message ?? `HTTP ${res.status}`), { status: res.status, body })
    }

    return res.json() as Promise<T>
  }
  throw new Error('Unreachable')
}

export async function checkSortCode(sortCode: string) {
  return mintlyFetch<Account>(`/sortcode/${encodeURIComponent(sortCode)}`)
}

export async function checkAccount(sortCode: string, accountNumber: string) {
  return mintlyFetch<Account>(
    `/sortcode/${encodeURIComponent(sortCode)}/account/${encodeURIComponent(accountNumber)}`
  )
}

export async function checkBic(bic: string) {
  const normalised = bic.length === 8 ? `${bic}XXX` : bic
  return mintlyFetch<Account>(`/swift/${encodeURIComponent(normalised)}`)
}

export async function checkIban(iban: string) {
  return mintlyFetch<Account>(`/iban/${encodeURIComponent(iban)}`)
}

export async function checkIdentity() {
  return mintlyFetch<{ AuthId: string; Status: string }>('/identity')
}
```

---

## Error handling guide

| HTTP status | Meaning | Recommended action |
|---|---|---|
| `400` | Bad input — malformed sort code / BIC etc. | Validate input before calling the API; surface `Message` to the user |
| `401` | Invalid or expired API key | Check `MINTLY_API_KEY`; re-authenticate |
| `403` | No API key sent | Ensure `x-api-key` header is present |
| `404` | Sort code / BIC / IBAN not found or inactive | Treat as invalid; do not retry |
| `429` | Rate limited | Back off exponentially (see client above) |
| `500` | Unexpected server error | Log and retry once after a short delay |

---

## Security reminders

- Store the API key in an environment variable; never commit it to source control.
- Do not log sort codes, account numbers, or IBANs — these are PII.
- Treat all account data as in-memory only; do not persist raw values without a clear business need and appropriate data handling controls.
- Use the sandbox environment for all development and CI testing.

---

## Common tasks Claude can help with

When invoked with `/mintly-api`, ask Claude to:

- **Generate integration code** — "Write a Node.js function to validate a UK sort code"
- **Write tests** — "Write Jest tests for the Mintly client using the sandbox values"
- **Handle errors** — "Add proper error handling for 429 and 404 responses"
- **Check payment support** — "Show me how to check if a branch supports Faster Payments"
- **IBAN derivation** — "How do I get the derived IBAN from a sort code + account number check?"
- **Migrate environments** — "How do I switch from sandbox to production?"
