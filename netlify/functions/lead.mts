declare const Netlify: { env: { get(key: string): string | undefined } }

const TELEGRAM_CHAT_ID = '-1004417886035'
const NOT_SET = 'не вказано'
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
const UTM_LABELS: Record<string, string> = {
  utm_source: 'UTM Source',
  utm_medium: 'UTM Medium',
  utm_campaign: 'UTM Campaign',
  utm_content: 'UTM Content',
  utm_term: 'UTM Term',
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const field = (key: string, max: number) => {
    const raw = (body as Record<string, unknown>)[key]
    // Collapse newlines so a single field can never fake extra message lines.
    const value = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : ''
    return value ? value.slice(0, max) : ''
  }

  const phone = field('phone', 40)
  if (phone.replace(/\D/g, '').length < 9) {
    return Response.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  }

  const token = Netlify.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) {
    console.error('lead: TELEGRAM_BOT_TOKEN is not configured — lead could not be delivered')
    return Response.json({ ok: false, error: 'not_configured' }, { status: 500 })
  }

  const lines = [
    '🔥 Новий лід SunProsto',
    `👤 Ім'я: ${field('name', 100) || NOT_SET}`,
    `📞 Телефон: ${phone}`,
    `📋 Форма: ${field('form', 100) || NOT_SET}`,
    `🌐 Сторінка: ${field('page', 300) || NOT_SET}`,
    ...UTM_KEYS.map((key) => `📊 ${UTM_LABELS[key]}: ${field(key, 150) || NOT_SET}`),
  ]

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No parse_mode: the message is sent verbatim, so user input cannot break formatting.
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: lines.join('\n'),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(9000),
    })

    const result = await res.json().catch(() => null)
    if (!res.ok || !result?.ok) {
      console.error('lead: Telegram rejected the message', res.status, result?.description ?? '')
      return Response.json({ ok: false, error: 'telegram_error' }, { status: 502 })
    }
  } catch (err) {
    console.error('lead: Telegram request failed', err instanceof Error ? err.message : err)
    return Response.json({ ok: false, error: 'telegram_unreachable' }, { status: 502 })
  }

  return Response.json({ ok: true })
}

export const config = {
  path: '/api/lead',
}
