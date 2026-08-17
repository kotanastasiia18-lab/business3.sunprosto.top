// Приймає заявки з усіх форм сайту і надсилає їх у Telegram-групу.
// Токен бота читається лише з Netlify Environment Variable TELEGRAM_BOT_TOKEN
// і ніколи не потрапляє у frontend-код.

// Chat ID Telegram-групи, куди надсилаються ліди (не є секретом).
// Задано явно, а не через env, бо наявна змінна TELEGRAM_CHAT_ID вказує на неіснуючий чат.
const CHAT_ID = '-1004417886035'

const NOT_SET = 'не вказано'

// Обрізаємо і прибираємо керуючі символи, щоб повідомлення залишалось одним блоком.
const clean = (value: unknown, max = 300): string => {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max)
}

const orNotSet = (value: unknown, max = 300): string => clean(value, max) || NOT_SET

export default async (req: Request) => {
  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const name = clean(payload.name, 120)
  const phone = clean(payload.phone, 40)

  // Телефон — єдине обов'язкове поле, так само як і у валідації на фронтенді.
  if (phone.replace(/\D/g, '').length < 7) {
    return Response.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  }

  const utm = (payload.utm && typeof payload.utm === 'object' ? payload.utm : {}) as Record<string, unknown>

  const text = [
    '🔥 Новий лід SunProsto',
    `👤 Ім'я: ${name || NOT_SET}`,
    `📞 Телефон: ${phone}`,
    `📋 Форма: ${orNotSet(payload.form, 120)}`,
    `🌐 Сторінка: ${orNotSet(payload.page, 500)}`,
    `📊 UTM Source: ${orNotSet(utm.utm_source, 200)}`,
    `📊 UTM Medium: ${orNotSet(utm.utm_medium, 200)}`,
    `📊 UTM Campaign: ${orNotSet(utm.utm_campaign, 200)}`,
    `📊 UTM Content: ${orNotSet(utm.utm_content, 200)}`,
    `📊 UTM Term: ${orNotSet(utm.utm_term, 200)}`,
  ].join('\n')

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not configured')
    return Response.json({ ok: false, error: 'not_configured' }, { status: 500 })
  }

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Без parse_mode — текст надсилається як є, тому імена зі спецсимволами не ламають повідомлення.
      body: JSON.stringify({ chat_id: CHAT_ID, text, disable_web_page_preview: true }),
    })

    if (!tg.ok) {
      // description від Telegram не містить токена — його безпечно логувати.
      const detail = await tg.text().catch(() => '')
      console.error('Telegram sendMessage failed', tg.status, detail.slice(0, 500))
      return Response.json({ ok: false, error: 'telegram_error' }, { status: 502 })
    }
  } catch (err) {
    console.error('Telegram request error', err instanceof Error ? err.message : err)
    return Response.json({ ok: false, error: 'telegram_unreachable' }, { status: 502 })
  }

  return Response.json({ ok: true })
}

export const config = {
  path: '/api/lead',
  method: 'POST',
}
