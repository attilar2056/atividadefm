const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 30871);
const PROGRAMAS_DIR = __dirname;
const ROOT_DIR = path.resolve(__dirname, '..');
const JSON_PATH = path.join(PROGRAMAS_DIR, 'comercial.json');
const ADMIN_HTML_PATH = path.join(PROGRAMAS_DIR, 'admin-comercial.html');
const UPLOADS_DIR = path.join(ROOT_DIR, 'assets', 'uploads');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const DEFAULT_DATA = {
  comerciais: [
    { id: 'canelinha', title: 'Projeto Canelinhas', image: 'assets/base/logo.png' },
    { id: 'gezin_regularizacao', title: 'Gezin Regularização', image: 'assets/base/logo.png' },
    { id: 'real_px_voz', title: 'Real PX Voz', image: 'assets/base/logo.png' },
    { id: 'real_pax_1', title: 'Real Pax 1', image: 'assets/base/logo.png' },
    { id: 'spot_hellos_auto_center', title: 'Hellos Auto Center', image: 'assets/base/logo.png' },
    { id: 'comercial_eletronica_jpa', title: 'Eletrônica JPA', image: 'assets/base/logo.png' },
    { id: 'faculdade_infrain', title: 'Faculdade Infrain', image: 'assets/base/logo.png' },
    { id: 'anuncie_nova', title: 'Anuncie Nova', image: 'assets/base/logo.png' }
  ]
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store'
  });
  res.end(text);
}

function safeJoin(baseDir, requestedPath) {
  const cleanPath = String(requestedPath || '/').replace(/\\/g, '/');
  const resolved = path.resolve(baseDir, '.' + cleanPath);
  if (!resolved.startsWith(baseDir)) return null;
  return resolved;
}

function readBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Arquivo muito grande. Limite de 25 MB.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function slugifyFileName(name) {
  return String(name || 'imagem')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '')
    .slice(0, 120) || 'imagem';
}

function normalizeId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getExtension(fileName, contentType) {
  const fromName = path.extname(fileName || '').toLowerCase();
  if (fromName) return fromName;
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/jpeg') return '.jpg';
  if (contentType === 'image/webp') return '.webp';
  if (contentType === 'image/gif') return '.gif';
  if (contentType === 'image/svg+xml') return '.svg';
  return '.bin';
}

function ensureCommercialFile() {
  fs.mkdirSync(PROGRAMAS_DIR, { recursive: true });
  if (!fs.existsSync(JSON_PATH)) {
    fs.writeFileSync(JSON_PATH, JSON.stringify(DEFAULT_DATA, null, 2) + '\n', 'utf8');
  }
}

function normalizeCommercialItem(item) {
  const id = normalizeId(item && item.id);
  const title = String(item && item.title || '').trim();
  const image = String(item && item.image || '').trim();
  if (!id) return null;
  return {
    id,
    title: title || id,
    image: image || 'assets/base/logo.png'
  };
}

function readCommercialFile() {
  ensureCommercialFile();
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const parsed = raw.trim() ? JSON.parse(raw) : DEFAULT_DATA;
  const source = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.comerciais)
      ? parsed.comerciais
      : Array.isArray(parsed.items)
        ? parsed.items
        : [];

  const seen = new Set();
  const comerciais = [];
  for (const item of source) {
    const normalized = normalizeCommercialItem(item);
    if (!normalized || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    comerciais.push(normalized);
  }

  comerciais.sort((a, b) => a.id.localeCompare(b.id, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  return { comerciais };
}

function saveCommercialFile(data) {
  const normalized = {
    comerciais: (Array.isArray(data && data.comerciais) ? data.comerciais : [])
      .map(normalizeCommercialItem)
      .filter(Boolean)
  };
  fs.writeFileSync(JSON_PATH, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
  return normalized;
}

function handleSaveItemPayload(payload) {
  const item = normalizeCommercialItem(payload);
  if (!item) throw new Error('Informe um ID válido para o comercial.');
  if (!item.title) throw new Error('Informe o nome que será exibido.');

  const current = readCommercialFile();
  const index = current.comerciais.findIndex((entry) => entry.id === item.id);
  if (index >= 0) current.comerciais[index] = item;
  else current.comerciais.push(item);

  return saveCommercialFile(current);
}

function handleDeleteItemPayload(payload) {
  const id = normalizeId(payload && payload.id);
  if (!id) throw new Error('ID inválido para excluir.');
  const current = readCommercialFile();
  current.comerciais = current.comerciais.filter((entry) => entry.id !== id);
  return saveCommercialFile(current);
}

function findExistingUploadByName(fileName) {
  const safeInput = String(fileName || '').trim().replace(/\\/g, '/');
  const ext = path.extname(safeInput).toLowerCase();
  const baseName = path.basename(safeInput, ext);
  const safeBaseName = slugifyFileName(baseName);
  const safeFileName = `${safeBaseName}${ext}`;

  if (!safeBaseName || !ext) return '';
  if (!fs.existsSync(UPLOADS_DIR)) return '';

  const directPath = path.join(UPLOADS_DIR, safeFileName);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return safeFileName;
  }

  const suffix = `_${safeBaseName}${ext}`.toLowerCase();
  const exactLower = safeFileName.toLowerCase();
  const entries = fs.readdirSync(UPLOADS_DIR).filter((entry) => {
    const entryLower = String(entry).toLowerCase();
    return entryLower === exactLower || entryLower.endsWith(suffix);
  });

  entries.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
  return entries[0] || '';
}

function detectExistingUploadReference(urlObj) {
  const candidates = [
    urlObj.searchParams.get('existingPath'),
    urlObj.searchParams.get('relativePath'),
    urlObj.searchParams.get('path'),
    urlObj.searchParams.get('image'),
    urlObj.searchParams.get('filename')
  ].filter(Boolean);

  for (const candidate of candidates) {
    const existing = findExistingUploadByName(candidate);
    if (existing) return existing;
  }
  return '';
}

async function handleUpload(req, res, urlObj) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const existingFileName = detectExistingUploadReference(urlObj);
    if (existingFileName) {
      sendJson(res, 200, {
        ok: true,
        reused: true,
        fileName: existingFileName,
        relativePath: `assets/uploads/${existingFileName}`
      });
      return;
    }

    const requestedName = urlObj.searchParams.get('filename') || 'imagem';
    const contentType = (req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim();
    const ext = getExtension(requestedName, contentType);
    const baseName = slugifyFileName(path.basename(requestedName, path.extname(requestedName)));

    const sameNameExisting = findExistingUploadByName(`${baseName}${ext}`);
    if (sameNameExisting) {
      sendJson(res, 200, {
        ok: true,
        reused: true,
        fileName: sameNameExisting,
        relativePath: `assets/uploads/${sameNameExisting}`
      });
      return;
    }

    const body = await readBody(req);
    if (!body.length) {
      sendJson(res, 400, { ok: false, error: 'Nenhum arquivo foi enviado.' });
      return;
    }

    const finalName = `${Date.now()}_${baseName}${ext}`;
    const outputPath = path.join(UPLOADS_DIR, finalName);
    fs.writeFileSync(outputPath, body);

    sendJson(res, 200, {
      ok: true,
      reused: false,
      fileName: finalName,
      relativePath: `assets/uploads/${finalName}`
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || 'Falha ao enviar a imagem.' });
  }
}

async function handleJsonRoute(req, res, callback, maxBytes = 5 * 1024 * 1024) {
  try {
    const body = await readBody(req, maxBytes);
    const payload = body.length ? JSON.parse(body.toString('utf8')) : {};
    const result = callback(payload);
    sendJson(res, 200, { ok: true, data: result });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || 'Requisição inválida.' });
  }
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      sendText(res, 404, 'Arquivo não encontrado.');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

ensureCommercialFile();

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const pathname = urlObj.pathname;

  if (req.method === 'GET' && (pathname === '/' || pathname === '/admin' || pathname === '/admin-comercial.html')) {
    serveFile(res, ADMIN_HTML_PATH);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/admin/state') {
    try {
      sendJson(res, 200, { ok: true, data: readCommercialFile() });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: 'Não foi possível carregar os comerciais.' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/admin/save-item') {
    await handleJsonRoute(req, res, handleSaveItemPayload);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/admin/delete-item') {
    await handleJsonRoute(req, res, handleDeleteItemPayload);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/upload') {
    await handleUpload(req, res, urlObj);
    return;
  }

  if (req.method === 'GET' && (pathname === '/api/comercial' || pathname === '/api/comerciais')) {
    try {
      sendJson(res, 200, readCommercialFile());
    } catch (error) {
      sendJson(res, 500, { ok: false, error: 'Não foi possível ler o comercial.json.' });
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/comercial.json') {
    serveFile(res, JSON_PATH);
    return;
  }

  if (req.method === 'GET') {
    const mappedPath = safeJoin(ROOT_DIR, pathname);
    if (mappedPath) {
      serveFile(res, mappedPath);
      return;
    }
  }

  sendText(res, 404, 'Rota não encontrada.');
});

server.listen(PORT, HOST, () => {
  console.log(`Painel dos comerciais disponível em http://${HOST}:${PORT}`);
  console.log(`JSON usado: ${JSON_PATH}`);
  console.log(`Uploads em: ${UPLOADS_DIR}`);
});
