# Scam Shield — Evidence Enrichment Plan

*Goal: every verdict is backed by verifiable evidence from authoritative sources, with each claim tagged `verified` (a fact from a real source) vs `assessment` (AI reasoning). We do NOT claim 100% certainty — we cite proof and stay honest about the rest.*

---

## Core principle
Don't validate "scams" abstractly. **Extract the concrete entities from any input, validate each against real data sources, then have Claude synthesize an evidence-cited verdict.** Almost every scam reduces to a handful of primitives.

Pipeline: **extract → validate (parallel) → synthesize with citations.**

---

## Entity → validators map

### URLs / domains (biggest everyday vector)
| Check | Source | Key? | Fact it establishes |
|---|---|---|---|
| Known phishing/malware | Google Safe Browsing v4 | free key ✅ | authoritative blocklist hit |
| Known-bad URL | URLhaus (abuse.ch) | none | malware/phishing listing |
| Aggregate scanners | VirusTotal v3 | free key (optional) | N engines flag it |
| Domain age | RDAP (rdap.org) → WHOIS fallback | none | registered N days ago |
| Brand↔domain mismatch | deterministic (claimed brand vs eTLD+1) | none | "Royal Mail" ≠ royalmail.com |
| Homograph / typosquat | deterministic (punycode, edit-distance to known brands) | none | look-alike domain |
| URL structure | deterministic (raw IP host, `@` trick, excessive subdomains, shortener) | none | structural red flags |
| Redirect/shortener expansion | HTTP HEAD follow | none | true destination |

### Crypto token / contract
| Check | Source | Key? |
|---|---|---|
| Honeypot / rug / tax / mint / blacklist / owner | GoPlus token_security | none (free) |
| OKX token risk | `onchainos security token-scan` | uses wallet session |
| On-chain facts (verified source, liquidity, holders, age) | OKX DEX API | OKX keys |

### Crypto wallet address
| Check | Source | Key? |
|---|---|---|
| Malicious address | GoPlus address_security | none |
| OKX address/phishing risk | `onchainos security` | wallet session |
| Sanctions | OFAC SDN crypto address list (public) | none |
| Address poisoning | deterministic look-alike | none |

### Crypto dApp / drainer site
- `onchainos security dapp-scan` + all URL checks above.

### Email
- SPF/DKIM/DMARC pass/fail **if raw headers provided** (deterministic).
- Sender domain age (RDAP) + display-name↔domain mismatch.
- Run URL checks on every link in the body.

### Phone / SMS
- Extract any URLs → URL checks (strong).
- Number pattern / known-scam-template match (medium).
- Public scam-number lists (thin) — best-effort.

### Plain text / DM (social engineering)
- No database exists for novel manipulation → **AI assessment**, clearly tagged.
- Still extract + validate any URL/address/email/phone inside.

### Screenshot / image
- Claude vision reads the image → extract entities → run all validators above → synthesize.

---

## Honesty policy (non-negotiable)
- A verdict of **SCAM** may be asserted strongly when evidence confirms it.
- **SAFE never means "proven safe"** — absence of a flag is not proof. Unresolved/insufficient → CAUTION.
- Every red flag carries a `source` and a `kind: verified | assessment`.
- Listing copy says **"evidence-backed risk guidance,"** never "100% accurate."

---

## Build order (all of it)
1. **URL validators** — Safe Browsing + RDAP domain age + brand/homograph/structure + shortener expansion + URLhaus. *(highest everyday impact)*
2. **Crypto validators** — GoPlus token + address security + OKX `security` scan + OFAC list.
3. **Email** — SPF/DKIM/DMARC (headers) + link checks + sender mismatch.
4. **Entity extraction** — regex primitives + Claude-vision path for screenshots.
5. **Two-pass engine** — extract → run validators in parallel → Claude synthesizes evidence-cited verdict (new schema fields: `evidence[]` with `{claim, source, kind, detail}`).
6. **Optional/phase-2** — VirusTotal (needs key), phone-number DBs, file-hash scanning.

Keys needed: `GOOGLE_SAFE_BROWSING_API_KEY` (have it), OKX keys (have), optional `VIRUSTOTAL_API_KEY`. GoPlus / URLhaus / RDAP / OFAC = keyless.
