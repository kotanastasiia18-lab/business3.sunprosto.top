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

All lead forms post to `netlify/functions/lead.mts` (routed at `/api/lead`), which
relays them to a Telegram group. The bot token comes from the `TELEGRAM_BOT_TOKEN`
environment variable and must never be placed in the markup; the chat id is a
constant in the function.

Every form goes through one shared `submitForm(okId, phoneId, formName, nameId)`
helper in the first `<script>` block. To add a form, give the name and phone inputs
ids and call that helper — don't hand-roll another inline handler. The helper also
owns phone validation, the confirmation box, the UTM payload and the existing
`generate_lead` `dataLayer` push, which must keep firing unchanged for GA4/Ads.

UTM values (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`)
are read from the URL on submit, cached first-touch in `sessionStorage` under
`sp_utm`, and fall back to `не вказано` server-side.

## Known gap

The `<style>` and `<script>` blocks still carry a credit quiz (`.cq-wrap`, `cqs1`…)
and a package-price calculator (`PRICES`, `.cp-btn` radios, `cpr*` result ids) whose
markup is not in the page. Both are null-guarded so they throw nothing, and both are
already wired for lead delivery — if those sections are restored, they work as-is.
