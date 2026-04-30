// Vercel serverless function — proxies eTimeOffice API to avoid browser CORS
export default async function handler(req, res) {
  // Allow the Vercel app to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { from, to, empcode = 'ALL', auth } = req.query;

  if (!auth) {
    res.status(400).json({ error: 'Missing auth parameter' });
    return;
  }
  if (!from || !to) {
    res.status(400).json({ error: 'Missing from/to date parameters' });
    return;
  }

  const targetUrl = `https://api.etimeoffice.com/api/DownloadInOutPunchData?Empcode=${encodeURIComponent(empcode)}&FromDate=${encodeURIComponent(from)}&ToDate=${encodeURIComponent(to)}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': 'Basic ' + auth,
        'Accept': 'application/json',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    res.status(response.status);
    if (contentType.includes('application/json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
      res.setHeader('Content-Type', 'application/json');
    } else {
      res.setHeader('Content-Type', 'text/plain');
    }
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: 'Proxy fetch failed: ' + err.message });
  }
}
