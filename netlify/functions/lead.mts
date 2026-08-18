// Receives lead submissions from the site forms and forwards them to the
// SunProsto Telegram group. The bot token is read from the
// TELEGRAM_BOT_TOKEN environment variable and never reaches the browser.

const TELEGRAM_CHAT_ID = '-1004417886035'
const NOT_SET = 'не вказано'
const UTM_FIELDS = [
  ['utm_source', 'UTM Source'],
  ['utm_medium', 'UTM Medium'],
  ['utm_campaign', 'UTM Campaign'],
  ['utm_content', 'UTM Content'],
  ['utm_term', 'UTM Term'],
] as const

// Keep the values short and single-line so a submission can never be used to
// forge extra lines in the Telegram message.
function clean(value: unknown, max = 200): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)
}

function orDefault(value: string): string {
  return value === '' ? NOT_SET : value
}

export default async (req: Request) => {
  let payload: Record<string, unknown>
  try {
    payload = (await req.json()) as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const name = clean(payload.name, 100)
  const phone = clean(payload.phone, 40)
  const form = clean(payload.form, 80)
  const page = clean(payload.page, 300)

  if (phone.replace(/\D/g, '').length < 7) {
    return Response.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not configured')
    return Response.json({ ok: false, error: 'not_configured' }, { status: 500 })
  }

  const lines = [
    '🔥 Новий лід SunProsto',
    `👤 Ім'я: ${orDefault(name)}`,
    `📞 Телефон: ${phone}`,
    `📋 Форма: ${orDefault(form)}`,
    `🌐 Сторінка: ${orDefault(page)}`,
    ...UTM_FIELDS.map(([key, label]) => `📊 ${label}: ${orDefault(clean(payload[key], 150))}`),
  ]

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: lines.join('\n'),
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      // Log the status only — the response body can echo back the bot token.
      console.error('Telegram sendMessage failed with status', res.status)
      return Response.json({ ok: false, error: 'telegram_error' }, { status: 502 })
    }
  } catch (err) {
    console.error('Telegram request failed', err instanceof Error ? err.message : err)
    return Response.json({ ok: false, error: 'telegram_unreachable' }, { status: 502 })
  }

  return Response.json({ ok: true })
}

export const config = {
  path: '/api/lead',
  method: ['POST'],
}
