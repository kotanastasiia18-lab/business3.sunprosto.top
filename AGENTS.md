# AGENTS.md

Context for AI agents working on this repository.

## What this is

A single-page marketing site for **SunProsto** (solar power stations for business),
written entirely in Ukrainian. It is a plain static site — no framework, no build
step, no `package.json`, no dependencies.

## Layout

```
public/index.html   the entire site: markup + <style> + <script> + base64 images
netlify.toml        publish = "public"; no build command
```

`public/index.html` is ~2.8 MB because every photo is inlined as a base64 data URI.
Do not try to read the whole file into context — it is mostly base64. Work on it
with targeted `grep`/`Edit` on the markup you need. Useful anchors when searching:
`class="stag"`, `class="stitle"`, `<section`, `id="mobMenu"`, `id="floatWidget"`.

If the site ever needs new imagery, prefer real files under `public/` plus the
Netlify Image CDN over adding more base64 — the current inlining is inherited from
the original hand-built page, not a deliberate pattern to extend.

## Page sections and their ids

Order in the document, with the id every navigation link depends on:

| Section | id | Heading |
| --- | --- | --- |
| Hero | `top` | — |
| Projects | `projects` | Наші об'єкти |
| Services | `services` | Наші послуги |
| Cost calculator / lead form | `calc` | Розрахуйте вартість вашої станції |
| Reviews | — | Відгуки клієнтів |
| 5 steps | `steps` | 5 кроків до запуску |
| Contact CTA | `contact` | Залиште номер |

Navigation exists in two places and they must stay in sync with the ids above:
the desktop `<nav>` and the mobile menu `<div class="mob-menu" id="mobMenu">`.
**Every in-page link must point at an id that exists** — the original file shipped
`#adv`, `#calc` and `#faq` links with no matching sections, which silently did
nothing when tapped. There is still no "Переваги" (advantages) section and no FAQ
section; if either is requested, add the section first, then the menu item.

## Conventions

- Ukrainian copy throughout, including new UI text.
- Inline styles and a single `<style>` block; CSS custom properties such as
  `var(--lb)` are defined in that block — reuse them instead of new hex values.
- Contact clicks push a `contact_click` event with a `contact_type` into
  `window.dataLayer` (GTM). Keep that on any new phone/Telegram/Viber/email link.
- External links use `target="_blank" rel="noopener"`.
- Real business contact data lives in the markup: phone `+380631405782`,
  email `sunprosto9@gmail.com`, Instagram `@sunprosto`. Don't invent alternatives.

## Lead delivery

Every lead form on the page routes through `sendLead(name, phone, formName)` in the
main `<script>` block, which POSTs JSON to `/api/lead`
(`netlify/functions/lead.mts`). That function formats the lead and posts it to a
Telegram group via the Bot API.

- The bot token comes **only** from the `TELEGRAM_BOT_TOKEN` environment variable —
  never put it in `public/index.html`.
- The destination chat id is a constant in `lead.mts`. Note there is also an unused
  `TELEGRAM_CHAT_ID` env var on the site holding a different value; the function
  deliberately does not read it.
- `getUTM()` reads the five `utm_*` params from the URL, mirrors them into
  `sessionStorage` so they survive in-page navigation, and falls back to the string
  `не вказано`. Any new form must go through `sendLead` to inherit this.
- Sending a lead is separate from analytics: the `generate_lead` dataLayer push
  stays exactly where it was. A failed send pushes `lead_send_error` instead of
  interfering with it.

Two blocks of JavaScript reference markup that is **not** in the page: the
`PRICES` / `.cp-btn` power calculator and the `.cq-wrap` credit quiz. Both guard
for missing elements so they are inert, not broken. Their submit handlers are
already wired to `sendLead`, so restoring either section's markup is enough to make
it deliver leads.
