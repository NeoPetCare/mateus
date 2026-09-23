import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import pg from 'pg';

const scrypt = promisify(scryptCallback);
const { Pool } = pg;
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(rootDir, 'data');
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const sessions = new Map();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  ssl: isProduction ? { rejectUnauthorized: false } : undefined
});

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...securityHeaders(),
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function securityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' https://images.unsplash.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
}

async function ensureSchema() {
  const schema = await fs.readFile(path.join(rootDir, 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 4_194_304) throw new Error('PAYLOAD_TOO_LARGE');
  }
  if (!body) return {};
  return JSON.parse(body);
}

function cleanText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function publicUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

function parseCookies(req) {
  const cookies = {};
  for (const part of (req.headers.cookie || '').split(';').filter(Boolean)) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = '';
    }
  }
  return cookies;
}

async function currentUser(req) {
  const token = parseCookies(req).sid;
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [session.userId]);
  return result.rows[0] || null;
}

async function createPasswordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derivedKey).toString('hex')}`;
}

async function passwordMatches(password, storedHash) {
  const [salt, storedKey] = String(storedHash).split(':');
  if (!salt || !storedKey) return false;
  const derivedKey = Buffer.from(await scrypt(password, salt, 64));
  const expectedKey = Buffer.from(storedKey, 'hex');
  return expectedKey.length === derivedKey.length && timingSafeEqual(expectedKey, derivedKey);
}

function createId() {
  return randomBytes(16).toString('hex');
}

function rateLimit(req) {
  const address = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - 60_000;
  const entries = rateLimit.entries || new Map();
  const requests = (entries.get(address) || []).filter((time) => time > windowStart);
  requests.push(now);
  entries.set(address, requests);
  rateLimit.entries = entries;
  return requests.length <= 120;
}

async function handleApi(req, res, url) {
  if (!rateLimit(req)) return json(res, 429, { error: 'Muitas requisições. Tente novamente em instantes.' });

  if (req.method !== 'GET') {
    if (!String(req.headers['content-type'] || '').startsWith('application/json'))
      return json(res, 415, { error: 'A requisição deve usar application/json.' });

    const requestOrigin = req.headers.origin;
    const forwardedProtocol = req.headers['x-forwarded-proto'];
    const requestProtocol = isProduction && forwardedProtocol
      ? String(forwardedProtocol).split(',')[0].trim()
      : 'http';

    const expectedOrigin = `${requestProtocol}://${req.headers.host || 'localhost'}`;
    if (requestOrigin && requestOrigin !== expectedOrigin)
      return json(res, 403, { error: 'Origem não autorizada.' });
  }

  const user = await currentUser(req);

  if (req.method === 'GET' && url.pathname === '/api/health')
    return json(res, 200, { ok: true });

  if (req.method === 'GET' && url.pathname === '/api/me')
    return json(res, 200, { user: publicUser(user) });

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return json(res, error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400, { error: 'Corpo da requisição inválido.' });
  }

  // SIGNUP
  if (req.method === 'POST' && url.pathname === '/api/auth/signup') {
    const name = cleanText(body.name, 100);
    const email = cleanText(body.email, 254).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (name.length < 2 || !validEmail(email) || password.length < 8 || password.length > 128)
      return json(res, 400, { error: 'Informe nome, e-mail válido e senha de 8 a 128 caracteres.' });

    const existingUser = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount)
      return json(res, 409, { error: 'Este e-mail já está cadastrado.' });

    const newUser = {
      id: createId(),
      name,
      email,
      passwordHash: await createPasswordHash(password)
    };

    await pool.query(
      'INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)',
      [newUser.id, newUser.name, newUser.email, newUser.passwordHash]
    );

    const token = randomBytes(32).toString('hex');
    sessions.set(token, { userId: newUser.id, expiresAt: Date.now() + 86_400_000 });

    return json(
      res,
      201,
      { user: publicUser(newUser) },
      { 'Set-Cookie': `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${isProduction ? '; Secure' : ''}` }
    );
  }

  // LOGIN
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const email = cleanText(body.email, 254).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    const result = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    const account = result.rows[0];
    if (!account || !(await passwordMatches(password, account.password_hash)))
      return json(res, 401, { error: 'E-mail ou senha inválidos.' });

    const token = randomBytes(32).toString('hex');
    sessions.set(token, { userId: account.id, expiresAt: Date.now() + 86_400_000 });

    return json(
      res,
      200,
      { user: publicUser(account) },
      { 'Set-Cookie': `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${isProduction ? '; Secure' : ''}` }
    );
  }

  // LOGOUT
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = parseCookies(req).sid;
    if (token) sessions.delete(token);
    return json(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
  }

  // PARTNERS (POST)
  if (req.method === 'POST' && url.pathname === '/api/partners') {
    const partner = {
      name: cleanText(body.name, 150),
      service: cleanText(body.service, 150),
      contact: cleanText(body.contact, 150)
    };

    if (Object.values(partner).some(v => !v))
      return json(res, 400, { error: 'Preencha todos os campos da parceria.' });

    await pool.query(
      'INSERT INTO partners (id, name, service, contact) VALUES ($1, $2, $3, $4)',
      [
        createId(),
        partner.name,
        partner.service,
        partner.contact
      ]
    );

    return json(res, 201, { ok: true });
  }

  // ADOPTIONS
  if (req.method === 'POST' && url.pathname === '/api/adoptions') {
    const adoption = {
      pet_name: cleanText(body.pet_name, 100),
      pet_type: cleanText(body.pet_type, 50),
      adopter_name: cleanText(body.adopter_name, 100),
      adopter_email: cleanText(body.adopter_email, 254).toLowerCase(),
      message: cleanText(body.message, 1000)
    };

    if (Object.values(adoption).some(v => !v))
      return json(res, 400, { error: 'Preencha todos os campos.' });

    await pool.query(
      'INSERT INTO adoptions (id, pet_name, pet_type, adopter_name, adopter_email, message) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        createId(),
        adoption.pet_name,
        adoption.pet_type,
        adoption.adopter_name,
        adoption.adopter_email,
        adoption.message
      ]
    );

    return json(res, 201, { ok: true });
  }

  // REPORTS (GET)
  if (req.method === 'GET' && url.pathname === '/api/reports') {
    const result = await pool.query(`
      SELECT 
        id,
        report_type,
        pet_name,
        description,
        contact,
        created_at AS "createdAt"
      FROM reports
      ORDER BY created_at DESC
    `);

    return json(res, 200, { reports: result.rows });
  }

  // REPORTS (POST)
  if (req.method === 'POST' && url.pathname === '/api/reports') {
    const report = {
      report_type: cleanText(body.report_type, 20),
      pet_name: cleanText(body.pet_name, 100),
      description: cleanText(body.description, 1000),
      contact: cleanText(body.contact, 150)
    };

    if (Object.values(report).some(v => !v))
      return json(res, 400, { error: 'Preencha todos os campos da ocorrência.' });

    const result = await pool.query(
      'INSERT INTO reports (id, report_type, pet_name, description, contact) VALUES ($1, $2, $3, $4, $5) RETURNING id, report_type, pet_name, description, contact, created_at AS "createdAt"',
      [
        createId(),
        report.report_type,
        report.pet_name,
        report.description,
        report.contact
      ]
    );

    return json(res, 201, { report: result.rows[0] });
  }

  // PARTNERS (GET)
  if (req.method === 'GET' && url.pathname === '/api/partners') {
    const result = await pool.query(`
      SELECT 
        id,
        name,
        service,
        contact,
        created_at AS "createdAt"
      FROM partners
      ORDER BY created_at DESC
    `);

    return json(res, 200, { partners: result.rows });
  }

} // <-- FECHA handleApi (CORREÇÃO)

async function serveStatic(req, res, url) {
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.resolve(rootDir, `.${requestedPath}`);

  const rootPrefix = `${rootDir}${path.sep}`;
  const dataPrefix = `${dataDir}${path.sep}`;

  if (
    (filePath !== rootDir && !filePath.startsWith(rootPrefix)) ||
    filePath === dataDir ||
    filePath.startsWith(dataPrefix)
  ) {
    return json(res, 403, { error: 'Acesso negado.' });
  }

  try {
    const content = await fs.readFile(filePath);
    const extension = path.extname(filePath);

    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };

    res.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      ...securityHeaders()
    });

    res.end(content);
  } catch {
    json(res, 404, { error: 'Arquivo não encontrado.' });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url);

  } catch {
    json(res, 500, { error: 'Erro interno do servidor.' });
  }
});

const isDirectExecution =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  ensureSchema()
    .then(() => {
      server.listen(port, () => {
        console.log(`NeoPetCare em http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error('Não foi possível conectar ao PostgreSQL:', error.message);
    });
}
