/**
 * Приймає заявки з форм сайту і пересилає їх у Telegram.
 *
 * Токен бота та ID чату читаються зі змінних оточення Netlify (Netlify.env)
 * і ніколи не потрапляють у клієнтський код:
 *   TELEGRAM_BOT_TOKEN — токен, виданий @BotFather
 *   TELEGRAM_CHAT_ID   — ID чату/групи (можна кілька через кому)
 */

type LeadPayload = Record<string, unknown>

const FORM_LABELS: Record<string, string> = {
  price_calculator: 'Калькулятор — «Розрахуйте вартість вашої станції»',
  steps_master_visit: 'Виїзд майстра — секція «5 кроків до запуску»',
  final_cta: 'Фінальна форма — «Залиште номер»',
  credit_quiz_qualified: 'Квіз — кредитна програма',
  credit_quiz_consultation: 'Квіз — консультація',
}

const FIELD_LABELS: Record<string, string> = {
  name: "Ім'я",
  phone: 'Телефон',
  email: 'Email',
  comment: 'Коментар',
  page: 'Сторінка',
  ref: 'Джерело переходу',
  utm_source: 'utm_source',
  utm_medium: 'utm_medium',
  utm_campaign: 'utm_campaign',
  utm_content: 'utm_content',
  utm_term: 'utm_term',
}

// Поля, які не дублюємо у блоці «інші» — вони вже виведені окремо.
const PRIMARY_FIELDS = new Set(['name', 'phone', 'form'])

const clean = (value: unknown, max = 300): string => {
  if (typeof value === 'number' || typeof value === 'boolean') value = String(value)
  if (typeof value !== 'string') return ''
  // прибираємо керуючі символи, щоб у повідомлення не потрапило сміття
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max)
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const buildMessage = (lead: LeadPayload, meta: { ip: string; country: string }): string => {
  const name = clean(lead.name, 120)
  const phone = clean(lead.phone, 40)
  const formKey = clean(lead.form, 60)
  const formLabel = FORM_LABELS[formKey] || formKey || 'Невідома форма'

  const time = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())

  const lines = [
    '<b>🔔 Нова заявка з сайту SunProsto</b>',
    '',
    `👤 <b>Ім'я:</b> ${escapeHtml(name || '— не вказано —')}`,
    `📞 <b>Телефон:</b> ${escapeHtml(phone)}`,
    `📋 <b>Форма:</b> ${escapeHtml(formLabel)}`,
    `🕒 <b>Час (Київ):</b> ${escapeHtml(time)}`,
  ]

  // Будь-які інші заповнені поля, які прийшли з форми.
  for (const [key, rawValue] of Object.entries(lead)) {
    if (PRIMARY_FIELDS.has(key)) continue
    const value = clean(rawValue)
    if (!value) continue
    const label = FIELD_LABELS[key] || key
    lines.push(`• <b>${escapeHtml(label)}:</b> ${escapeHtml(value)}`)
  }

  if (meta.country) lines.push(`🌍 <b>Країна:</b> ${escapeHtml(meta.country)}`)
  if (meta.ip) lines.push(`💻 <b>IP:</b> ${escapeHtml(meta.ip)}`)

  return lines.join('\n')
}

export default async (
  req: Request,
  context: { ip?: string; geo?: { country?: { code?: string } } },
) => {
  const token = Netlify.env.get('TELEGRAM_BOT_TOKEN')
  const chatIds = (Netlify.env.get('TELEGRAM_CHAT_ID') || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  let lead: LeadPayload
  try {
    const raw = await req.text()
    if (raw.length > 8000) {
      return Response.json({ ok: false, error: 'payload_too_large' }, { status: 413 })
    }
    lead = JSON.parse(raw || '{}')
    if (!lead || typeof lead !== 'object' || Array.isArray(lead)) throw new Error('not an object')
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const digits = clean(lead.phone, 40).replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) {
    return Response.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  }

  if (!token || chatIds.length === 0) {
    // Клієнту деталей конфігурації не показуємо, але лишаємо слід у логах функції.
    console.error('Telegram is not configured: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID')
    return Response.json({ ok: false, error: 'not_configured' }, { status: 503 })
  }

  const text = buildMessage(lead, {
    ip: context?.ip || '',
    country: context?.geo?.country?.code || '',
  })

  const results = await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        })
        if (!res.ok) {
          const body = (await res.text()).slice(0, 300)
          console.error(`Telegram sendMessage failed (${res.status}): ${body}`)
          return false
        }
        return true
      } catch (error) {
        console.error('Telegram request error:', error instanceof Error ? error.message : 'unknown')
        return false
      }
    }),
  )

  const delivered = results.filter(Boolean).length
  if (delivered === 0) {
    return Response.json({ ok: false, error: 'delivery_failed' }, { status: 502 })
  }

  return Response.json({ ok: true, delivered })
}

export const config = {
  path: '/api/lead',
  method: 'POST',
}
