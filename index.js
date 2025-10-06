// index.js
// Node 18+ recommended (global fetch + AbortController).
import express from 'express';

const app = express();
app.use(express.json({ limit: '200kb' })); // small request body limit
const PORT = process.env.PORT || 3000;

/**
 * Provided validator (unchanged).
 */
function isValidWebhookUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // Only allow HTTPS URLs - Chux note - I changed it to HTTP for the demo
    if (url.protocol !== 'http:') {
      return false;
    }
    
    // Prevent local network access (SSRF protection)
    const hostname = url.hostname.toLowerCase();
    
    // Block localhost and common local addresses
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '[::1]',
      '[::ffff:127.0.0.1]'
    ];
    
    if (blockedHosts.includes(hostname)) {
      return false;
    }
    
    // Block private IP ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    
    if (match) {
      const octets = match.slice(1).map(Number);
      
      
      // 172.16.0.0/12
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;
      
      // 192.168.0.0/16
      if (octets[0] === 192 && octets[1] === 168) return false;
      
      // 169.254.0.0/16 (link-local)
      if (octets[0] === 169 && octets[1] === 254) return false;
    }
    
    // Block metadata endpoints (AWS, GCP, Azure)
    const blockedDomains = [
      'metadata.google.internal',
      'metadata.goog',
      '169.254.169.254'
    ];
    
    if (blockedDomains.some(domain => hostname.includes(domain))) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Simple fetch with timeout and response-size cap.
 * NOTE: This does NOT perform any DNS resolution checks — intentional.
 */
async function fetchWithLimits(url, opts = {}) {
  const MAX_BYTES = 256 * 1024; // 256 KB returned to client
  const TIMEOUT_MS = 5000; // 5s timeout

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      ...opts,
      signal: controller.signal
    });

    // Read text (may be truncated)
    const text = await response.text().catch(() => '');

    const truncated = text.slice(0, MAX_BYTES);

    // convert headers to a plain object
    const headers = {};
    for (const [k, v] of response.headers.entries()) headers[k] = v;

    return { status: response.status, headers, body: truncated };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Fetch timed out');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}


app.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body ?? {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing "url" in JSON body.' });
    }

    // Apply only the provided validator
    if (!isValidWebhookUrl(url)) {
      return res.status(400).json({ ok: false, error: 'URL failed server-side validation.' });
    }

    // Perform fetch (no DNS/IP checks)
    let result;
    try {
      result = await fetchWithLimits(url);
    } catch (err) {
      return res.status(502).json({ ok: false, error: 'Fetch failed: ' + String(err.message) });
    }

    return res.json({
      ok: true,
      fetchedUrl: url,
      status: result.status,
      headers: result.headers,
      body_snippet: result.body
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message) });
  }
});


app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>SSRF Lab — Submit URL</title>
<style>
  :root{ --bg:#0f1724; --card:#0b1220; --accent:#60a5fa; --muted:#94a3b8; --danger:#ef4444; color-scheme:dark; font-family:Inter,ui-sans-serif,system-ui,Segoe UI,Roboto,'Helvetica Neue',Arial;}
  body{margin:0;min-height:100vh;background:linear-gradient(180deg,#071024 0%, #001428 100%);display:flex;align-items:center;justify-content:center;padding:24px}
  .card{width:900px;max-width:100%;background:linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));border-radius:12px;padding:22px;box-shadow:0 8px 30px rgba(2,6,23,0.7);display:grid;grid-template-columns:1fr 460px;gap:20px;align-items:start}
  .left{padding:6px}
  h1{margin:0 0 8px;font-size:20px;color:var(--accent)}
  p.lead{margin:0 0 16px;color:var(--muted)}
  .form-row{display:flex;gap:8px;align-items:center}
  input[type=text]{flex:1;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:#e6eef8;font-size:14px;outline:none}
  button{padding:10px 14px;border-radius:10px;border:0;background:linear-gradient(90deg,var(--accent),#3b82f6);color:#022;font-weight:700;cursor:pointer}
  button[disabled]{opacity:0.5;cursor:not-allowed}
  .note{margin-top:12px;color:var(--muted);font-size:13px}
  .right{background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));padding:12px;border-radius:10px;min-height:220px;overflow:auto}
  .meta{font-size:13px;color:var(--muted);margin-bottom:8px}
  pre{background:rgba(0,0,0,0.28);padding:12px;border-radius:8px;color:#dbeafe;overflow:auto;font-size:13px;line-height:1.35}
  .error{color:var(--danger);font-weight:600;margin-top:8px}
  .success{color:#86efac;font-weight:600;margin-top:8px}
  footer{grid-column:1/-1;margin-top:12px;color:var(--muted);font-size:13px;text-align:center}
  @media (max-width:900px){
    .card{grid-template-columns:1fr; padding:16px}
    .right{order:2}
  }
</style>
</head>
<body>
  <main class="card" role="main" aria-live="polite">
    <section class="left">
      <h1>SSRF Lab — Fetch Proxy</h1>
      <p class="lead">Enter a URL (HTTP only). The server validates using <code>isValidWebhookUrl</code>. If the server accepts it, the server fetches the URL and returns a short response preview.</p>

      <form id="fetchForm" autocomplete="off">
        <div class="form-row">
          <input id="urlInput" name="url" type="text" placeholder="https://example.com/path" aria-label="URL to fetch" required />
          <button id="sendBtn" type="submit">Fetch</button>
        </div>

        <p class="note">The server performs only the configured validation function — no hostname resolution is performed. Use this lab in an isolated environment only.</p>
        <div id="statusMsg" aria-live="polite"></div>
      </form>
    </section>

    <aside class="right">
      <div class="meta">Response preview</div>
      <div id="responseBox">
        <pre id="respPre">No response yet. Submit a URL to see a status, headers and a small body snippet.</pre>
      </div>
    </aside>

    <footer>
      <small>Lab note: responses are truncated and time-limited for safety (5s timeout, limited bytes).</small>
    </footer>
  </main>

<script>
  const form = document.getElementById('fetchForm');
  const input = document.getElementById('urlInput');
  const respPre = document.getElementById('respPre');
  const statusMsg = document.getElementById('statusMsg');
  const sendBtn = document.getElementById('sendBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusMsg.textContent = '';
    respPre.textContent = 'Loading...';
    sendBtn.disabled = true;

    const url = (input.value || '').trim();
    if (!url) {
      statusMsg.textContent = 'Please enter a URL.';
      sendBtn.disabled = false;
      respPre.textContent = 'No response yet.';
      return;
    }

    try {
      const resp = await fetch('/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await resp.json().catch(() => ({ ok:false, error: 'Invalid JSON in response' }));

      if (!resp.ok || data.ok === false) {
        statusMsg.innerHTML = '<span class="error">Error: ' + (data.error || resp.statusText || 'Unknown') + '</span>';
        respPre.textContent = JSON.stringify(data, null, 2);
      } else {
        statusMsg.innerHTML = '<span class="success">Fetched: ' + data.fetchedUrl + ' (HTTP ' + data.status + ')</span>';
        // Build a readable preview
        const preview = {
          status: data.status,
          headers: data.headers,
          body_snippet: data.body_snippet ? data.body_snippet.slice(0, 8192) : ''
        };
        respPre.textContent = JSON.stringify(preview, null, 2);
      }
    } catch (err) {
      statusMsg.innerHTML = '<span class="error">Network or server error: ' + (err.message || err) + '</span>';
      respPre.textContent = String(err);
    } finally {
      sendBtn.disabled = false;
    }
  });
</script>
</body>
</html>`);
});

app.listen(3000, () => {
  console.log('SSRF lab (frontend) listening on port', 3000);
});
