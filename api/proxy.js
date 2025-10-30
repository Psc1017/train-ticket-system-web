export default async function handler(req, res) {
  // 允许 GET 请求从任意来源调用（用于浏览器跨域）
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const { url } = req.query
  if (!url || Array.isArray(url)) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  try {
    // 基础校验：仅允许 http/https
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Invalid protocol' })
    }

    // 服务器端拉取，绕过浏览器 CORS 限制
    const upstream = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json,text/plain;q=0.9,*/*;q=0.8' },
    })

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` })
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    res.setHeader('Content-Type', contentType)

    const body = await upstream.arrayBuffer()
    res.status(200).send(Buffer.from(body))
  } catch (err) {
    res.status(500).json({ error: 'Proxy fetch failed', message: err.message })
  }
}


