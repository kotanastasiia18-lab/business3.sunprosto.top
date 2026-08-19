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

All three lead forms (calculator, "виїзд майстра" in the steps section, final CTA)
call `sendLead()` in `public/index.html`, which POSTs JSON to `/api/lead`. That path
is served by `netlify/functions/lead.mts`, which formats the lead and sends it to
Telegram. Keep the existing behaviour on the client: validation, the confirmation
state and the `generate_lead` `dataLayer` push all still happen locally, and the
POST is fire-and-forget so a failing request never blocks the confirmation.

The function needs two environment variables, and neither may ever appear in the
client bundle:

| Variable | Meaning |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | token from @BotFather |
| `TELEGRAM_CHAT_ID` | destination chat/group id; comma-separated for several |

Without them the endpoint answers `503 not_configured` and logs a hint.

## Mobile CSS

The `<style>` block right before `</body>` holds the narrow-screen fixes and is the
last stylesheet in the document, so it wins on cascade order. Two things it guards
against, both of which broke the page below ~430 px before:

- the header row (logo + phone + CTA + burger) did not fit, and the burger was
  pushed completely off screen — the desktop CTA button is hidden under 768 px;
- `.cta-lead-wrap` is switched to `display:flex` by the `.open` class, which makes
  the `grid-template-columns:1fr` mobile rule dead — the column direction has to be
  set on the flex container instead.

Keep every rule there inside `@media(max-width:767px)` (or narrower) so the desktop
layout stays untouched.
