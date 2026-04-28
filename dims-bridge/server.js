// DIMS Bridge — local HTTP -> TCP shim for ZKTeco / eSSL biometric devices.
//
// Why this exists:
//   Browsers cannot open raw TCP sockets to LAN devices, so the DIMS HRMS web app
//   cannot pull punches directly from a biometric machine. This service runs on any
//   PC in the same LAN as the device, talks TCP to the device on its behalf, and
//   exposes the result as a normal HTTP/JSON endpoint the browser can call.
//
// Endpoint:
//   GET /punches?ip=<deviceIp>&port=<devicePort>&commKey=<key>&deviceType=<type>&from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Returns:
//   { records: [{ empCode, date, punchIn, punchOut, status }, ...], rawCount: N }
//
// Run:
//   npm install
//   node server.js          (or: npm start)
//   The DIMS Bridge URL in the web app's Device Configuration should be:
//     http://localhost:8182

const express = require('express');
const cors = require('cors');
const ZKLib = require('node-zklib');

const PORT = parseInt(process.env.PORT || '8182', 10);

const app = express();
app.use(cors());
app.use(express.json());

// Health check / banner
app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'DIMS Bridge',
    version: '1.0.0',
    endpoints: ['/punches?ip=...&port=4370&commKey=0&from=YYYY-MM-DD&to=YYYY-MM-DD'],
  });
});

function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function fmtTime(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

function describeError(e) {
  if (!e) return 'unknown error';
  if (e.message) return e.message;
  if (e.err && e.err.message) return e.err.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch (_) { return String(e); }
}

// Group raw timestamped punches by (userId, day) and pick first/last as in/out.
function aggregatePunches(rawPunches, fromDate, toDate) {
  const buckets = new Map();
  for (const p of rawPunches) {
    const t = new Date(p.recordTime || p.timestamp || p.time);
    if (isNaN(t.getTime())) continue;
    if (t < fromDate || t > toDate) continue;
    const userId = String(p.deviceUserId != null ? p.deviceUserId : (p.userSn != null ? p.userSn : (p.uid != null ? p.uid : (p.empCode != null ? p.empCode : '')))).trim();
    if (!userId) continue;
    const date = fmtDate(t);
    const key = userId + '|' + date;
    if (!buckets.has(key)) buckets.set(key, { userId: userId, date: date, times: [] });
    buckets.get(key).times.push(t);
  }
  const records = [];
  for (const b of buckets.values()) {
    b.times.sort(function (a, c) { return a - c; });
    records.push({
      empCode: b.userId,
      date: b.date,
      punchIn: fmtTime(b.times[0]),
      punchOut: b.times.length > 1 ? fmtTime(b.times[b.times.length - 1]) : '',
      status: 'Present',
    });
  }
  records.sort(function (a, b) { return a.date === b.date ? a.empCode.localeCompare(b.empCode) : a.date.localeCompare(b.date); });
  return records;
}

app.get('/punches', async function (req, res) {
  const ip = String(req.query.ip || '192.168.1.201');
  const port = parseInt(String(req.query.port || '4370'), 10);
  const commKey = parseInt(String(req.query.commKey || '0'), 10) || 0;
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');

  if (!from || !to) {
    return res.status(400).json({ error: 'from and to date params required (YYYY-MM-DD)' });
  }
  const fromDate = new Date(from + 'T00:00:00');
  const toDate = new Date(to + 'T23:59:59');
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return res.status(400).json({ error: 'invalid date format; expected YYYY-MM-DD' });
  }

  console.log('[' + new Date().toISOString() + '] /punches ip=' + ip + ' port=' + port + ' from=' + from + ' to=' + to);

  const zk = new ZKLib(ip, port, 8000, 4000);
  let logs;
  try {
    await zk.createSocket();
  } catch (e) {
    return res.status(502).json({
      error: 'Cannot connect to device at ' + ip + ':' + port,
      detail: describeError(e),
      hint: 'Verify the device is powered on, on the same LAN, and that no firewall is blocking port ' + port + '.',
    });
  }

  try {
    logs = await zk.getAttendances();
  } catch (e) {
    try { await zk.disconnect(); } catch (_) {}
    return res.status(502).json({
      error: 'Connected to device but failed to read attendance logs',
      detail: describeError(e),
      hint: 'Some devices need a comm key (set it in the web app Device Configuration). Comm key is currently: ' + commKey,
    });
  }

  try { await zk.disconnect(); } catch (_) {}

  const raw = Array.isArray(logs && logs.data) ? logs.data : [];
  const records = aggregatePunches(raw, fromDate, toDate);
  res.json({ records: records, rawCount: raw.length });
});

// Useful for one-off "is the device reachable" checks from the browser.
app.get('/info', async function (req, res) {
  const ip = String(req.query.ip || '192.168.1.201');
  const port = parseInt(String(req.query.port || '4370'), 10);
  const zk = new ZKLib(ip, port, 5000, 4000);
  try {
    await zk.createSocket();
    const info = await zk.getInfo();
    await zk.disconnect();
    res.json({ ok: true, info: info });
  } catch (e) {
    try { await zk.disconnect(); } catch (_) {}
    res.status(502).json({ ok: false, error: describeError(e) });
  }
});

// Server-side proxy to api.etimeoffice.com — used as a CORS fallback when the
// browser blocks direct calls. The query string carries the user's credentials;
// they're forwarded once and not stored anywhere on disk.
app.get('/etime/inout', async function (req, res) {
  const corp = String(req.query.corporateId || '');
  const user = String(req.query.username || '');
  const pwd = String(req.query.password || '');
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  const empcode = String(req.query.empcode || 'ALL');
  if (!corp || !user || !pwd) return res.status(400).json({ error: 'corporateId, username, password required' });
  if (!from || !to) return res.status(400).json({ error: 'from and to required (DD/MM/YYYY)' });
  const auth = Buffer.from(corp + ':' + user + ':' + pwd + ':true').toString('base64');
  const url = 'https://api.etimeoffice.com/api/DownloadInOutPunchData?Empcode=' +
    encodeURIComponent(empcode) + '&FromDate=' + encodeURIComponent(from) + '&ToDate=' + encodeURIComponent(to);
  try {
    const r = await fetch(url, { headers: { 'Authorization': 'Basic ' + auth } });
    const text = await r.text();
    res.status(r.status).type('application/json').send(text);
  } catch (e) {
    res.status(502).json({ error: 'Failed to reach eTimeOffice cloud', detail: describeError(e) });
  }
});

app.get('/etime/punches', async function (req, res) {
  const corp = String(req.query.corporateId || '');
  const user = String(req.query.username || '');
  const pwd = String(req.query.password || '');
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  const empcode = String(req.query.empcode || 'ALL');
  if (!corp || !user || !pwd) return res.status(400).json({ error: 'corporateId, username, password required' });
  if (!from || !to) return res.status(400).json({ error: 'from and to required (DD/MM/YYYY_HH:mm)' });
  const auth = Buffer.from(corp + ':' + user + ':' + pwd + ':true').toString('base64');
  const url = 'https://api.etimeoffice.com/api/DownloadPunchData?Empcode=' +
    encodeURIComponent(empcode) + '&FromDate=' + encodeURIComponent(from) + '&ToDate=' + encodeURIComponent(to);
  try {
    const r = await fetch(url, { headers: { 'Authorization': 'Basic ' + auth } });
    const text = await r.text();
    res.status(r.status).type('application/json').send(text);
  } catch (e) {
    res.status(502).json({ error: 'Failed to reach eTimeOffice cloud', detail: describeError(e) });
  }
});

// Employee master proxy. eTimeOffice doesn't publicly document the employee
// endpoint, so the browser tries several common names and returns the first
// 200 with a parseable employee array. The bridge mirrors that behavior here
// (used as a CORS fallback when the browser can't reach api.etimeoffice.com
// directly).
app.get('/etime/employees', async function (req, res) {
  const corp = String(req.qu