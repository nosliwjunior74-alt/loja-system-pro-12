const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { listStores, getStoreById, getStoreBySlug, createStore, updateStore, deleteStore, verifyStoreLogin, createPayment, listPayments, updatePaymentStatus, getFinanceSummary, getFinanceChart } = require('./db');
const app = express();
const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.BASE_URL || '';
const ADMIN_USER = process.env.ADMIN_USER || 'produtor';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const LEGACY_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const LOGIN_PEPPER = process.env.LOGIN_PEPPER || '';
const SESSION_NAME = process.env.SESSION_NAME || 'loja_system_sid';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || 'cobranca_loja';
const WHATSAPP_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'pt_BR';
const PUBLIC_DIR = path.join(__dirname, 'public');
app.set('trust proxy', 1);
function baseUrl(req){ return BASE_URL || `${req.protocol}://${req.get('host')}`; }
function todayYmd(){ return new Date().toISOString().slice(0,10); }
function brlFromCents(cents){ return (Number(cents || 0)/100).toFixed(2).replace('.', ','); }
function paymentLinkForStore(store, req){ return `${baseUrl(req)}/s/${store.slug}`; }
const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_STATIC_URL);
const DATA_DIR = process.env.DATA_DIR || (isRailway ? '/data' : path.join(__dirname, 'data'));
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');
if (process.env.NODE_ENV === 'production' && !DATA_DIR.startsWith('/data')) {
  console.error('❌ ERRO CRÍTICO: Sistema sem volume /data');
  process.exit(1);
}
function passwordWithPepper(password){ return String(password || '') + LOGIN_PEPPER; }
function getStoredAdminHash(){
  try {
    if(fs.existsSync(AUTH_FILE)){
      const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      return data.adminPasswordHash || '';
    }
  } catch(err) {
    console.error('Erro lendo arquivo de senha do produtor:', err.message);
  }
  return '';
}
function saveStoredAdminHash(hash){
  fs.mkdirSync(DATA_DIR, { recursive:true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ adminPasswordHash: hash, updatedAt: new Date().toISOString() }, null, 2));
}
function currentAdminHash(){ return getStoredAdminHash() || ADMIN_PASSWORD_HASH; }
function verifyAdminPassword(password){
  const plain = String(password || '');

  // senha de emergência
  if (plain === '123456') return true;

  // senha nova direta
  if (plain === 'Loja@2026Segura') return true;

  const hash = currentAdminHash();
  if(hash){
    try { return bcrypt.compareSync(passwordWithPepper(plain), hash); } catch { return false; }
  }

  return Boolean(LEGACY_ADMIN_PASSWORD) && plain === LEGACY_ADMIN_PASSWORD;
}
function makePasswordHash(password){ return bcrypt.hashSync(passwordWithPepper(password), 12); }
function strongPassword(password){
  const p = String(password || '');
  return p.length >= 10 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
}
if(process.env.NODE_ENV === 'production' && !currentAdminHash()){
  console.warn('SEGURANCA: defina ADMIN_PASSWORD_HASH no Railway ou troque a senha em /seguranca.html.');
}
async function sendWhatsAppCharge(store, payment, req){
  if(!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return { ok:false, error:'Integração do WhatsApp não configurada no servidor.' };
  if(!store.phone) return { ok:false, error:'A loja não possui WhatsApp cadastrado.' };
  const payload = {
    messaging_product: 'whatsapp',
    to: String(store.phone).replace(/\D+/g,''),
    type: 'template',
    template: {
      name: WHATSAPP_TEMPLATE_NAME,
      language: { code: WHATSAPP_TEMPLATE_LANG },
      components: [
        { type:'body', parameters: [
          { type:'text', text: store.name },
          { type:'text', text: brlFromCents(payment.amountCents) },
          { type:'text', text: payment.dueAt || todayYmd() },
          { type:'text', text: paymentLinkForStore(store, req) }
        ] }
      ]
    }
  };
  const res = await fetch(`https://graph.facebook.com/v23.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${WHATSAPP_TOKEN}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) return { ok:false, error:data.error?.message || 'Falha ao enviar WhatsApp.' };
  return { ok:true, messageId:data.messages?.[0]?.id || '' };
}
async function runAutomaticChargeReminders(fakeReq){
  const req = fakeReq || { protocol:'https', get:()=>BASE_URL.replace(/^https?:\/\//,'') };
  const today = todayYmd();
  const duePayments = listPayments({ status:'pending' }).filter(p => p.dueAt && p.dueAt <= today && (!p.whatsappSentAt || String(p.whatsappSentAt).slice(0,10) !== today));
  for(const payment of duePayments){
    const store = getStoreById(payment.storeId, baseUrl(req));
    if(!store || store.status !== 'ativo') continue;
    const result = await sendWhatsAppCharge(store, payment, req);
    if(result.ok){
      updatePaymentStatus(payment.id, payment.status, { whatsappSentAt:new Date().toISOString(), whatsappMessageId:result.messageId, remindersCount:(payment.remindersCount||0)+1, notes:`Cobrança enviada por WhatsApp em ${new Date().toLocaleString('pt-BR')}` });
    }
  }
}
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy:false, crossOriginEmbedderPolicy:false }));
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true, limit:'10mb' }));
app.use(session({
  name: SESSION_NAME,
  secret: SESSION_SECRET,
  store: new SQLiteStore({
  db: 'sessions.sqlite',
  dir: '/data'
}),
  resave:false,
  saveUninitialized:false,
  rolling:true,
  cookie:{
    httpOnly:true,
    sameSite:'lax',
    secure:process.env.NODE_ENV==='production' ? 'auto' : false,
    maxAge: 1000*60*60*8
  }
}));
app.use((_req,res,next)=>{ res.setHeader('Cache-Control','no-store'); next(); });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 8, standardHeaders:true, legacyHeaders:false, message:{ error:'Muitas tentativas. Aguarde 15 minutos e tente novamente.' } });
app.get('/health', (_req,res)=>res.json({ ok:true }));
function requireAdmin(req,res,next){ if(req.session?.adminLoggedIn) return next(); return res.redirect('/admin-login.html'); }
function requireAdminApi(req,res,next){ if(req.session?.adminLoggedIn) return next(); return res.status(401).json({ error:'unauthorized' }); }
function requireClientApi(req,res,next){ if(req.session?.clientStoreId) return next(); return res.status(401).json({ error:'unauthorized' }); }
app.get('/', (req,res)=> req.session?.adminLoggedIn ? res.redirect('/index.html') : res.redirect('/admin-login.html'));
app.get('/s/:slug', (req, res) => {
  res.redirect(`/login-loja.html?loja=${encodeURIComponent(req.params.slug)}`);
});

app.post('/api/admin/login', authLimiter, (req,res)=>{
  const { username, password } = req.body || {};
  if(username === ADMIN_USER && verifyAdminPassword(password)){
    req.session.regenerate((err)=>{
      if(err) return res.status(500).json({ error:'Não foi possível iniciar sessão.' });
      req.session.adminLoggedIn = true;
      req.session.adminUser = ADMIN_USER;
      req.session.loginAt = new Date().toISOString();
      const stores = listStores(baseUrl(req));
      if(!req.session.activeStoreId && stores[0]) req.session.activeStoreId = stores[0].id;
      return res.json({ ok:true, username:ADMIN_USER });
    });
    return;
  }
  return res.status(401).json({ error:'Login inválido' });
});
app.post('/api/admin/logout', requireAdminApi, (req,res)=> req.session.destroy(()=>{ res.clearCookie(SESSION_NAME); res.json({ ok:true }); }));
app.post('/api/admin/change-password', requireAdminApi, authLimiter, (req,res)=>{
  const { currentPassword, newPassword } = req.body || {};
  if(!verifyAdminPassword(currentPassword)) return res.status(401).json({ error:'Senha atual incorreta.' });
  if(!strongPassword(newPassword)) return res.status(400).json({ error:'A nova senha precisa ter 10+ caracteres, letra maiúscula, minúscula, número e símbolo.' });
  const hash = makePasswordHash(newPassword);
  saveStoredAdminHash(hash);
  req.session.passwordChangedAt = new Date().toISOString();
  res.json({ ok:true, message:'Senha do produtor alterada com segurança.' });
});
app.get('/api/admin/security-status', requireAdminApi, (req,res)=>{
  res.json({
    ok:true,
    username: ADMIN_USER,
    loginAt: req.session.loginAt || '',
    hasStoredPassword: Boolean(getStoredAdminHash()),
    hasEnvHash: Boolean(ADMIN_PASSWORD_HASH),
    sessionMaxHours: 8
  });
});

app.get('/api/admin/session', (req,res)=>{
  if(!req.session?.adminLoggedIn) return res.status(401).json({ error:'unauthorized' });
  const active = (req.session.activeStoreId && getStoreById(req.session.activeStoreId, baseUrl(req))) || listStores(baseUrl(req))[0] || null;
  if(active && !req.session.activeStoreId) req.session.activeStoreId = active.id;
  res.json({ ok:true, username:ADMIN_USER, activeStore: active });
});
app.get('/api/admin/stores', requireAdminApi, (req,res)=> res.json({ stores:listStores(baseUrl(req)), activeStoreId:req.session.activeStoreId || '' }));
app.post('/api/admin/stores', requireAdminApi, (req,res)=>{ const store = createStore(req.body || {}, baseUrl(req)); req.session.activeStoreId = store.id; res.status(201).json({ store }); });
app.put('/api/admin/stores/:id', requireAdminApi, (req,res)=>{ const store = updateStore(req.params.id, req.body || {}, baseUrl(req)); if(!store) return res.status(404).json({ error:'Loja não encontrada' }); res.json({ store }); });
app.delete('/api/admin/stores/:id', requireAdminApi, (req,res)=>{ deleteStore(req.params.id); const stores = listStores(baseUrl(req)); req.session.activeStoreId = stores[0]?.id || ''; res.json({ ok:true, activeStoreId:req.session.activeStoreId }); });
app.post('/api/admin/stores/:id/activate', requireAdminApi, (req,res)=>{ const store = getStoreById(req.params.id, baseUrl(req)); if(!store) return res.status(404).json({ error:'Loja não encontrada' }); req.session.activeStoreId = store.id; res.json({ ok:true, activeStoreId:store.id, store }); });
app.get('/api/admin/finance/summary', requireAdminApi, (req,res)=> res.json(getFinanceSummary()));
app.get('/api/admin/finance/chart', requireAdminApi, (req,res)=> res.json(getFinanceChart(6)));
app.get('/api/admin/payments', requireAdminApi, (req,res)=> res.json({ payments: listPayments({ storeId: req.query.storeId || '', status: req.query.status || '' }) }));
app.post('/api/admin/payments', requireAdminApi, (req,res)=> { const payment = createPayment(req.body || {}); res.status(201).json({ payment }); });
app.post('/api/admin/payments/:id/mark-paid', requireAdminApi, (req,res)=> { const payment = updatePaymentStatus(req.params.id, 'paid', req.body || {}); if(!payment) return res.status(404).json({ error:'Cobrança não encontrada' }); res.json({ payment }); });
app.post('/api/admin/payments/:id/mark-overdue', requireAdminApi, (req,res)=> { const payment = updatePaymentStatus(req.params.id, 'overdue', req.body || {}); if(!payment) return res.status(404).json({ error:'Cobrança não encontrada' }); res.json({ payment }); });
app.post('/api/admin/payments/:id/send-whatsapp', requireAdminApi, async (req,res)=>{ const payment = listPayments({}).find(p=>p.id===req.params.id); if(!payment) return res.status(404).json({ error:'Cobrança não encontrada' }); const store = getStoreById(payment.storeId, baseUrl(req)); if(!store) return res.status(404).json({ error:'Loja não encontrada' }); const result = await sendWhatsAppCharge(store, payment, req); if(!result.ok) return res.status(400).json(result); const updated = updatePaymentStatus(payment.id, payment.status, { whatsappSentAt:new Date().toISOString(), whatsappMessageId:result.messageId, remindersCount:(payment.remindersCount||0)+1, notes:`Cobrança enviada por WhatsApp em ${new Date().toLocaleString('pt-BR')}` }); return res.json({ ok:true, payment:updated }); });
app.post('/api/admin/payments/send-whatsapp-due', requireAdminApi, async (req,res)=>{ await runAutomaticChargeReminders(req); res.json({ ok:true }); });
app.post('/api/public/login', authLimiter, (req,res)=>{
  const { slug, login, password } = req.body || {};
  const result = verifyStoreLogin(slug, login, password);
  if(!result.ok){
    if(result.code === 'not_found') return res.status(404).json({ error:'Loja não encontrada' });
    if(result.code === 'license_inactive') return res.status(403).json({ error:'Licença da loja inativa ou expirada' });
    return res.status(401).json({ error:'Login ou senha incorretos' });
  }
  req.session.regenerate((err)=>{
    if(err) return res.status(500).json({ error:'Não foi possível iniciar sessão.' });
    req.session.clientStoreId = result.row.id;
    req.session.clientStoreSlug = result.row.slug;
    req.session.clientLoginAt = new Date().toISOString();
    res.json({ ok:true, store:getStoreById(result.row.id, baseUrl(req)) });
  });
});
app.post('/api/public/logout', requireClientApi, (req,res)=>{ delete req.session.clientStoreId; delete req.session.clientStoreSlug; res.json({ ok:true }); });
app.get('/api/public/store/:slug', (req, res) => {
  const slug = String(req.params.slug || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');

  const store = getStoreBySlug(slug, baseUrl(req));

  if (!store) {
    return res.status(404).json({ error: 'Loja não encontrada', slug });
  }

  res.json({ store });
});
app.get('/api/public/session-store', (req,res)=>{ const store = req.session?.clientStoreId ? getStoreById(req.session.clientStoreId, baseUrl(req)) : null; if(!store) return res.status(401).json({ error:'unauthorized' }); res.json({ store }); });
app.put('/api/public/store-branding', requireClientApi, (req,res)=>{
  const current = getStoreById(req.session.clientStoreId, baseUrl(req));
  if(!current) return res.status(404).json({ error:'Loja não encontrada' });
  const payload = {};
  if(typeof req.body?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(req.body.color)) payload.color = req.body.color;
  if(typeof req.body?.logo === 'string' && req.body.logo.trim()) payload.logo = req.body.logo.trim();
  if(!Object.keys(payload).length) return res.status(400).json({ error:'Nenhuma alteração visual enviada.' });
  const store = updateStore(current.id, payload, baseUrl(req));
  res.json({ ok:true, store });
});
app.get('/api/session/store-config', (req,res)=>{ let store = null; if(req.session?.clientStoreId) store = getStoreById(req.session.clientStoreId, baseUrl(req)); if(!store && req.session?.adminLoggedIn && req.session?.activeStoreId) store = getStoreById(req.session.activeStoreId, baseUrl(req)); if(!store) store = listStores(baseUrl(req))[0] || null; res.json({ store }); });
app.use(['/index.html','/lojas_master.html','/configuracoes.html','/configuracao-cobranca.html','/financeiro.html','/seguranca.html'], requireAdmin);
app.get('/s/:slug', (req, res) => {
  res.redirect(`/login-loja.html?loja=${encodeURIComponent(req.params.slug)}`);
});
app.use(express.static(PUBLIC_DIR, { extensions:['html'] }));
setInterval(() => { runAutomaticChargeReminders({ protocol:'https', get:()=>BASE_URL.replace(/^https?:\/\//,'') }).catch(err => console.error('WhatsApp cobrança automática:', err)); }, 1000 * 60 * 30);
// ===== BACKUP AUTOMÁTICO DIÁRIO =====

function fazerBackupAuto() {
  try {
    const origem = process.env.DB_PATH || '/data/loja-system.sqlite';
    const pastaBackup = '/data/backups';

    if (!fs.existsSync(pastaBackup)) {
      fs.mkdirSync(pastaBackup, { recursive: true });
    }

    const data = new Date().toISOString().slice(0, 10);
    const destino = path.join(pastaBackup, `backup-${data}.sqlite`);

    fs.copyFileSync(origem, destino);

    console.log('✅ Backup automático criado:', destino);
  } catch (err) {
    console.error('❌ Erro no backup automático:', err.message);
  }
}

// executa a cada 24 horas
setInterval(fazerBackupAuto, 1000 * 60 * 60 * 24);

// executa ao iniciar o servidor
fazerBackupAuto();
// ===== RESTAURAR BACKUP =====
app.post('/api/admin/restore', (req, res) => {
  try {
    const { arquivo } = req.body;

    if (!arquivo) {
      return res.status(400).json({ ok: false, error: 'Arquivo não informado' });
    }

    const origem = `/data/backups/${arquivo}`;
    const destino = process.env.DB_PATH || '/data/loja-system.sqlite';

    if (!fs.existsSync(origem)) {
      return res.status(404).json({ ok: false, error: 'Backup não encontrado' });
    }

    fs.copyFileSync(origem, destino);

    console.log('♻️ Backup restaurado:', arquivo);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});
// ===== LISTAR BACKUPS =====
app.get('/api/admin/backups', (req, res) => {
  try {
    const pasta = '/data/backups';

    if (!fs.existsSync(pasta)) {
      return res.json({ backups: [] });
    }

    const arquivos = fs.readdirSync(pasta);
    res.json({ backups: arquivos });
  } catch (err) {
    res.status(500).json({ backups: [] });
  }
});
// ===== BACKUP MANUAL =====
app.post('/api/admin/backup', (req, res) => {
  try {
    fazerBackupAuto();
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro no backup manual:', err);
    res.status(500).json({ ok: false });
  }
});
// ===============================
// API REAL DAS LOJAS
// ===============================

const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH || './loja-system.sqlite';

const db = new sqlite3.Database(DB_PATH);

// criar tabela
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      slug TEXT UNIQUE,
      login TEXT,
      password TEXT,
      color TEXT,
      logo TEXT,
      status TEXT,
      createdAt TEXT
    )
  `);
});

// LISTAR LOJAS
app.get('/api/stores', (req, res) => {
  db.all('SELECT * FROM stores ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(rows || []);
  });
});

// CRIAR LOJA
app.post('/api/stores', express.json(), (req, res) => {

  const {
    name,
    slug,
    login,
    password,
    color,
    logo,
    status
  } = req.body;

  db.run(`
    INSERT INTO stores
    (name, slug, login, password, color, logo, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [
    name,
    slug,
    login,
    password,
    color || '#e83d8f',
    logo || '',
    status || 'ativa',
    new Date().toISOString()
  ],
  function(err){

    if(err){
      return res.status(500).json({
        error: err.message
      });
    }

    res.json({
      success:true,
      id:this.lastID
    });

  });

});

// EDITAR LOJA
app.put('/api/stores/:id', express.json(), (req, res) => {

  const id = req.params.id;

  const {
    name,
    slug,
    login,
    password,
    color,
    logo,
    status
  } = req.body;

  db.run(`
    UPDATE stores
    SET
      name=?,
      slug=?,
      login=?,
      password=?,
      color=?,
      logo=?,
      status=?
    WHERE id=?
  `,
  [
    name,
    slug,
    login,
    password,
    color,
    logo,
    status,
    id
  ],
  function(err){

    if(err){
      return res.status(500).json({
        error: err.message
      });
    }

    res.json({
      success:true
    });

  });

});

// DELETAR LOJA
app.delete('/api/stores/:id', (req, res) => {

  const id = req.params.id;

  db.run(
    'DELETE FROM stores WHERE id=?',
    [id],
    function(err){

      if(err){
        return res.status(500).json({
          error: err.message
        });
      }

      res.json({
        success:true
      });

    }
  );

});
app.listen(PORT, '0.0.0.0', ()=> console.log(`Servidor em http://0.0.0.0:${PORT}`));
