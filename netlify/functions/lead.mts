// Receives lead submissions from the SunProsto landing page forms and forwards
// them to the sales Telegram group. The bot token lives only in the
// TELEGRAM_BOT_TOKEN environment variable — never in the frontend bundle.

const TELEGRAM_CHAT_ID = '-1004417886035'
const NOT_PROVIDED = 'не вказано'

// Fields arrive from a public page, so they are untrusted. Newlines are stripped
// so a crafted name cannot forge extra lines in the Telegram message, and every
// value is length-capped well below Telegram's 4096-char limit.
const clean = (value: unknown, max = 200): string => {
  if (typeof value !== 'string') return ''
  const flat = value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

const orFallback = (value: string): string => value || NOT_PROVIDED

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not configured — lead was not delivered')
    return Response.json({ ok: false, error: 'not_configured' }, { status: 500 })
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const phone = clean(payload.phone, 40)
  if (phone.replace(/\D/g, '').length < 7) {
    return Response.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  }

  const message = [
    '🔥 Новий лід SunProsto',
    `👤 Ім'я: ${orFallback(clean(payload.name, 120))}`,
    `📞 Телефон: ${phone}`,
    `📋 Форма: ${orFallback(clean(payload.form, 120))}`,
    `🌐 Сторінка: ${orFallback(clean(payload.page, 500))}`,
    `📊 UTM Source: ${orFallback(clean(payload.utm_source, 120))}`,
    `📊 UTM Medium: ${orFallback(clean(payload.utm_medium, 120))}`,
    `📊 UTM Campaign: ${orFallback(clean(payload.utm_campaign, 120))}`,
    `📊 UTM Content: ${orFallback(clean(payload.utm_content, 120))}`,
    `📊 UTM Term: ${orFallback(clean(payload.utm_term, 120))}`,
  ].join('\n')

  try {
    // Plain text on purpose: no parse_mode means user input can never break the
    // message by containing Markdown or HTML characters.
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        disable_web_page_preview: true,
      }),
    })

    if (!tg.ok) {
      // Log the Telegram API description (safe) but never the request URL/token.
      const detail = await tg.text().catch(() => '')
      console.error(`Telegram sendMessage failed with ${tg.status}: ${detail.slice(0, 500)}`)
      return Response.json({ ok: false, error: 'telegram_error' }, { status: 502 })
    }
  } catch (err) {
    console.error('Telegram request threw:', err instanceof Error ? err.message : err)
    return Response.json({ ok: false, error: 'telegram_unreachable' }, { status: 502 })
  }

  return Response.json({ ok: true })
}

export const config = {
  path: '/api/lead',
  method: ['POST'],
}
