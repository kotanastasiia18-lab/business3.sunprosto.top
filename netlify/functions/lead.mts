// Приймає заявки з усіх форм сайту і надсилає їх у Telegram-групу.
// Токен бота читається ТІЛЬКИ з Netlify Environment Variable TELEGRAM_BOT_TOKEN.

const CHAT_ID = '-1004417886035'
const NOT_SET = 'не вказано'

const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

const UTM_LABELS: Record<string, string> = {
  utm_source: 'UTM Source',
  utm_medium: 'UTM Medium',
  utm_campaign: 'UTM Campaign',
  utm_content: 'UTM Content',
  utm_term: 'UTM Term',
}

// Нормалізує значення з тіла запиту: згортає переноси рядків, щоб вони не ламали формат повідомлення.
function clean(value: unknown, max = 200): string {
  if (typeof value !== 'string') return ''
  return value.split(/\s+/).join(' ').trim().slice(0, max)
}

function orNotSet(value: string): string {
  return value === '' ? NOT_SET : value
}

export default async (req: Request) => {
  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const phone = clean(payload.phone, 40)

  // Телефон обов'язковий — щонайменше 9 цифр.
  if ((phone.match(/\d/g) || []).length < 9) {
    return Response.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not configured')
    return Response.json({ ok: false, error: 'not_configured' }, { status: 500 })
  }

  const lines = [
    '🔥 Новий лід SunProsto',
    `👤 Ім'я: ${orNotSet(clean(payload.name, 120))}`,
    `📞 Телефон: ${phone}`,
    `📋 Форма: ${orNotSet(clean(payload.form, 120))}`,
    `🌐 Сторінка: ${orNotSet(clean(payload.page, 500))}`,
    ...UTM_FIELDS.map((field) => `📊 ${UTM_LABELS[field]}: ${orNotSet(clean(payload[field], 200))}`),
  ]

  // Без parse_mode — текст від користувача не потребує екранування.
  const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: lines.join('\n'),
      disable_web_page_preview: true,
    }),
  }).catch((err: unknown) => {
    console.error('Telegram request failed:', err instanceof Error ? err.message : err)
    return null
  })

  if (!tg || !tg.ok) {
    // Логуємо статус і опис помилки Telegram, але ніколи не токен.
    let detail = tg ? `status ${tg.status}` : 'network error'
    if (tg) {
      const body = (await tg.json().catch(() => null)) as { description?: string } | null
      if (body && body.description) detail += `: ${body.description}`
    }
    console.error('Telegram sendMessage failed -', detail)
    return Response.json({ ok: false, error: 'telegram_failed' }, { status: 502 })
  }

  return Response.json({ ok: true })
}

export const config = {
  path: '/api/lead',
  method: ['POST'],
}
