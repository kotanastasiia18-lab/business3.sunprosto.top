// Приймає заявки з усіх форм сайту і надсилає їх у Telegram-групу.
// Токен бота читається лише з Netlify Environment Variable TELEGRAM_BOT_TOKEN
// і ніколи не потрапляє у frontend-код.

declare const Netlify: { env: { get(key: string): string | undefined } }

const TELEGRAM_CHAT_ID = '-1004417886035'
const NOT_SET = 'не вказано'

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

// Людські назви форм для повідомлення у Telegram.
const FORM_LABELS: Record<string, string> = {
  price_calculator: 'Калькулятор вартості (розділ «Розрахуйте вартість»)',
  steps_master_visit: 'Безкоштовний виїзд майстра (розділ «5 кроків»)',
  final_cta: 'Залиште номер (розділ «Контакти»)',
  credit_quiz_qualified: 'Квіз кредитування — кваліфікований лід',
  credit_quiz_consultation: 'Квіз кредитування — консультація',
}

/** Обрізає та чистить значення, які прийшли з браузера. */
const clean = (value: unknown, maxLength = 300): string => {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ') // керуючі символи, щоб не ламали рядки повідомлення
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

const orNotSet = (value: string): string => (value.length > 0 ? value : NOT_SET)

export default async (req: Request): Promise<Response> => {
  const token = Netlify.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not configured — lead cannot be delivered')
    return Response.json({ ok: false, error: 'not_configured' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const phone = clean(body.phone, 40)
  if (phone.replace(/\D/g, '').length < 7) {
    return Response.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  }

  const name = clean(body.name, 120)
  const formKey = clean(body.form, 60)
  const page = clean(body.page, 500)

  const utm = UTM_KEYS.map((key) => orNotSet(clean(body[key], 200)))

  const text = [
    '🔥 Новий лід SunProsto',
    `👤 Ім'я: ${orNotSet(name)}`,
    `📞 Телефон: ${phone}`,
    `📋 Форма: ${FORM_LABELS[formKey] || orNotSet(formKey)}`,
    `🌐 Сторінка: ${orNotSet(page)}`,
    `📊 UTM Source: ${utm[0]}`,
    `📊 UTM Medium: ${utm[1]}`,
    `📊 UTM Campaign: ${utm[2]}`,
    `📊 UTM Content: ${utm[3]}`,
    `📊 UTM Term: ${utm[4]}`,
  ].join('\n')

  let telegramResponse: Response
  try {
    telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    })
  } catch (error) {
    console.error('Telegram request failed', error)
    return Response.json({ ok: false, error: 'telegram_unreachable' }, { status: 502 })
  }

  if (!telegramResponse.ok) {
    // Логуємо опис помилки від Telegram, але без токена в URL.
    const detail = await telegramResponse.text().catch(() => '')
    console.error(`Telegram sendMessage failed: ${telegramResponse.status} ${detail.slice(0, 500)}`)
    return Response.json({ ok: false, error: 'telegram_error' }, { status: 502 })
  }

  return Response.json({ ok: true })
}

export const config = {
  path: '/api/lead',
  method: ['POST'],
}
