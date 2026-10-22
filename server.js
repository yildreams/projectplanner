// Zero-dependency server: static files + plan persistence (data/plan.json)
const http = require('http'), fs = require('fs'), path = require('path');
const { buildXlsx } = require('./public/xlsx');
const PUB = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data', 'plan.json');
const PORT = process.env.PORT || 3000;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };

http.createServer((q, s) => {
  if (q.url === '/api/export' && q.method === 'POST') {
    let b = '';
    q.on('data', c => { b += c; if (b.length > 4e6) q.destroy(); });
    q.on('end', () => {
      try {
        const buf = buildXlsx(JSON.parse(b));
        s.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Length': buf.length });
        s.end(buf);
      } catch (e) { s.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); s.end(String(e.message || e)); }
    });
    return;
  }
  if (q.url.startsWith('/api/plan')) {
    if (q.method === 'GET') {
      return fs.readFile(DATA, (e, d) => {
        if (e) { s.writeHead(404); return s.end(); }
        s.writeHead(200, { 'Content-Type': 'application/json' }); s.end(d);
      });
    }
    if (q.method === 'PUT') {
      let b = '';
      q.on('data', c => { b += c; if (b.length > 2e6) q.destroy(); });
      q.on('end', () => {
        try {
          JSON.parse(b);
          fs.mkdirSync(path.dirname(DATA), { recursive: true });
          fs.writeFileSync(DATA, b);
          s.writeHead(204); s.end();
        } catch { s.writeHead(400); s.end(); }
      });
      return;
    }
  }
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(PUB, path.normalize(p));
  if (!f.startsWith(PUB)) { s.writeHead(403); return s.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { s.writeHead(404); return s.end('Not found'); }
    s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    s.end(d);
  });
}).listen(PORT, () => console.log('Project planner running at http://localhost:' + PORT));
