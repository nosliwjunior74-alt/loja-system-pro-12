const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db: activeDb, listStores, getStoreById, getStoreBySlug, createStore, updateStore, setStorePassword, deleteStore, verifyStoreLogin, createPayment, listPayments, updatePaymentStatus, getFinanceSummary, getFinanceChart } = require('./db');
const app = express();
const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.BASE_URL || '';
const ADMIN_USER = process.env.ADMIN_USER || 'produtor';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const LOGIN_PEPPER = process.env.LOGIN_PEPPER || '';
const SESSION_NAME = process.env.SESSION_NAME || 'loja_system_sid';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('ERRO CRITICO: SESSION_SECRET nao configurado em producao.');
  process.exit(1);
}
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

const hash = currentAdminHash();
  if(hash){
    try { return bcrypt.compareSync(passwordWithPepper(plain), hash); } catch { return false; }
  }

  return false;
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
app.post('/api/admin/stores/:id/reset-password', requireAdminApi, (req,res)=>{
  const store = getStoreById(req.params.id, baseUrl(req));

  if(!store){
    return res.status(404).json({
      error:'Loja n?o encontrada'
    });
  }

  const password = String(req.body?.password || '');
  const forcePasswordChange = req.body?.forcePasswordChange !== false;

  if(!strongPassword(password)){
    return res.status(400).json({
      error:'A nova senha precisa ter 10+ caracteres, letra mai?scula, min?scula, n?mero e s?mbolo.'
    });
  }

  const updated = setStorePassword(
    req.params.id,
    password,
    forcePasswordChange
  );

  if(!updated){
    return res.status(500).json({
      error:'N?o foi poss?vel redefinir a senha.'
    });
  }

  return res.json({
    ok:true,
    forcePasswordChange:Boolean(forcePasswordChange)
  });
});

app.delete('/api/admin/stores/:id', requireAdminApi, (req,res)=>{ deleteStore(req.params.id); const stores = listStores(baseUrl(req)); req.session.activeStoreId = stores[0]?.id || ''; res.json({ ok:true, activeStoreId:req.session.activeStoreId }); });
app.post('/api/admin/stores/:id/activate', requireAdminApi, (req,res)=>{ const store = getStoreById(req.params.id, baseUrl(req)); if(!store) return res.status(404).json({ error:'Loja não encontrada' }); req.session.activeStoreId = store.id; res.json({ ok:true, activeStoreId:store.id, store }); });
app.post('/api/admin/stores/:id/select', requireAdminApi, (req,res)=>{
  const store = getStoreById(req.params.id, baseUrl(req));

  if(!store){
    return res.status(404).json({
      error:'Loja não encontrada'
    });
  }

  req.session.activeStoreId = store.id;

  res.json({
    ok:true,
    activeStoreId: store.id
  });
});
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
    if(result.code === 'not_found'){
      return res.status(404).json({ error:'Loja n\u00e3o encontrada' });
    }

    if(result.code === 'license_inactive'){
      return res.status(403).json({
        error:'Licen\u00e7a da loja inativa ou expirada'
      });
    }

    return res.status(401).json({
      error:'Login ou senha incorretos'
    });
  }

  const producerSession =
    req.session?.adminLoggedIn === true;

  const producerAdminUser =
    req.session?.adminUser || '';

  const producerLoginAt =
    req.session?.loginAt || '';

  const mustChangePassword =
    Boolean(result.row.force_password_change);

  req.session.regenerate((err)=>{
    if(err){
      return res.status(500).json({
        error:'N\u00e3o foi poss\u00edvel iniciar sess\u00e3o.'
      });
    }

    if(producerSession){
      req.session.adminLoggedIn = true;
      req.session.adminUser =
        producerAdminUser || ADMIN_USER;
      req.session.loginAt =
        producerLoginAt || new Date().toISOString();
      req.session.activeStoreId =
        result.row.id;
    }

    if(mustChangePassword){

      req.session.pendingPasswordChangeStoreId =
        result.row.id;

      req.session.pendingPasswordChangeStoreSlug =
        result.row.slug;

      req.session.pendingPasswordChangeAt =
        new Date().toISOString();

    }
    else{

      req.session.clientStoreId =
        result.row.id;

      req.session.clientStoreSlug =
        result.row.slug;

      req.session.clientLoginAt =
        new Date().toISOString();

    }

    req.session.save((saveErr)=>{
      if(saveErr){
        return res.status(500).json({
          error:'N\u00e3o foi poss\u00edvel salvar a sess\u00e3o.'
        });
      }

      return res.json({
        ok:true,
        mustChangePassword,
        store:getStoreById(
          result.row.id,
          baseUrl(req)
        )
      });
    });
  });
});


app.post('/api/public/change-password-required', authLimiter, (req,res)=>{

  const storeId =
    req.session?.pendingPasswordChangeStoreId;

  if(!storeId){
    return res.status(401).json({
      error:'Sess\u00e3o de troca de senha inv\u00e1lida ou expirada.'
    });
  }

  const pendingPasswordChangeAt =
    Date.parse(
      String(
        req.session?.pendingPasswordChangeAt || ''
      )
    );

  const pendingPasswordExpired =
    !Number.isFinite(pendingPasswordChangeAt) ||
    (
      Date.now() - pendingPasswordChangeAt >
      15 * 60 * 1000
    );

  if(pendingPasswordExpired){

    delete req.session.pendingPasswordChangeStoreId;
    delete req.session.pendingPasswordChangeStoreSlug;
    delete req.session.pendingPasswordChangeAt;

    return res.status(401).json({
      error:'Sessao de troca de senha expirada. Faca login novamente.'
    });
  }

  const store =
    getStoreById(storeId, baseUrl(req));

  if(!store){
    return res.status(404).json({
      error:'Loja n\u00e3o encontrada.'
    });
  }

  const newPassword =
    String(req.body?.newPassword || '');

  if(!strongPassword(newPassword)){
    return res.status(400).json({
      error:'A nova senha precisa ter 10+ caracteres, letra mai\u00fascula, min\u00fascula, n\u00famero e s\u00edmbolo.'
    });
  }

  const updated =
    setStorePassword(
      storeId,
      newPassword,
      false
    );

  if(!updated){
    return res.status(500).json({
      error:'N\u00e3o foi poss\u00edvel alterar a senha.'
    });
  }

  req.session.clientStoreId =
    storeId;

  req.session.clientStoreSlug =
    store.slug;

  req.session.clientLoginAt =
    new Date().toISOString();

  delete req.session.pendingPasswordChangeStoreId;
  delete req.session.pendingPasswordChangeStoreSlug;
  delete req.session.pendingPasswordChangeAt;

  req.session.save((saveErr)=>{
    if(saveErr){
      return res.status(500).json({
        error:'N\u00e3o foi poss\u00edvel concluir a nova sess\u00e3o.'
      });
    }

    return res.json({
      ok:true,
      store:getStoreById(
        storeId,
        baseUrl(req)
      )
    });
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

res.json({
  store: {
    id: store.id,
    slug: store.slug,
    name: store.name || '',
    sub: store.sub || '',
    color: store.color || '#e33d8f',
    logo: store.logo || 'assets/default-logo.svg',
    phone: store.phone || '',
    status: store.status || 'inativo',
    licenseStatus: store.licenseStatus || '',
    expiresAt: store.expiresAt || '',
    publicLink: store.publicLink || '',
    supportConfig: store.supportConfig || {},
    estoque: store.estoque || [],
    looks: store.looks || [],
    products: store.products || [],
    roupas: store.roupas || []
  }
});
});
app.get('/api/public/session-store', (req,res)=>{
  const targetStoreId =
    (req.session?.adminLoggedIn && req.session?.activeStoreId)
      ? req.session.activeStoreId
      : req.session?.clientStoreId;

  if(!targetStoreId){
    return res.status(401).json({
      error:'unauthorized'
    });
  }

  const store =
    getStoreById(
      targetStoreId,
      baseUrl(req)
    );

  if(!store){
    return res.status(401).json({
      error:'unauthorized'
    });
  }

  return res.json({
    store
  });
});
app.put('/api/public/store-branding', (req,res)=>{
  const targetStoreId =
    (req.session?.adminLoggedIn && req.session?.activeStoreId)
      ? req.session.activeStoreId
      : req.session?.clientStoreId;

  if(!targetStoreId) return res.status(401).json({ error:'unauthorized' });

  const current = getStoreById(targetStoreId, baseUrl(req));
  if(!current) return res.status(404).json({ error:'Loja não encontrada' });
 const payload = {};

if(typeof req.body?.color === 'string')
  payload.color = req.body.color;

if (typeof req.body?.logo === 'string') {
    const logo = req.body.logo.trim();

    if (
        logo.startsWith('data:image/') &&
        logo.length < 500000
    ) {
        payload.logo = logo;
    }
}

if(typeof req.body?.phone === 'string'){
  payload.phone = req.body.phone.trim().slice(0, 30);
}

if(
  req.body?.supportConfig &&
  typeof req.body.supportConfig === 'object' &&
  !Array.isArray(req.body.supportConfig)
){
  const atual =
    current.supportConfig &&
    typeof current.supportConfig === 'object' &&
    !Array.isArray(current.supportConfig)
      ? current.supportConfig
      : {};

  const recebido = req.body.supportConfig;
  const nextSupport = { ...atual };

  const camposTexto = [
    'greeting',
    'purchaseMessage',
    'address',
    'hours',
    'chatTitle'
  ];

  for(const campo of camposTexto){
    if(typeof recebido[campo] === 'string'){
      nextSupport[campo] =
        recebido[campo]
          .trim()
          .slice(0, 1000);
    }
  }

  if(typeof recebido.chatEnabled === 'boolean'){
    nextSupport.chatEnabled = recebido.chatEnabled;
  }

  if(Array.isArray(recebido.quickReplies)){
    nextSupport.quickReplies =
      recebido.quickReplies
        .slice(0, 12)
        .map(item => ({
          question: String(item?.question || '').trim().slice(0, 160),
          answer: String(item?.answer || '').trim().slice(0, 800)
        }))
        .filter(item => item.question && item.answer);
  }

  payload.supportConfig = nextSupport;
}
if(Array.isArray(req.body?.estoque))
  payload.estoque = req.body.estoque;

if(Array.isArray(req.body?.products))
  payload.products = req.body.products;

if(Array.isArray(req.body?.looks))
  payload.looks = req.body.looks;

if(Array.isArray(req.body?.roupas))
  payload.roupas = req.body.roupas;
  if(!Object.keys(payload).length) return res.status(400).json({ error:'Nenhuma alteração visual enviada.' });
  const store = updateStore(current.id, payload, baseUrl(req));
  res.json({ ok:true, store });
});
app.get('/api/session/store-config', (req,res)=>{ let store = null; if(req.session?.adminLoggedIn && req.session?.activeStoreId) store = getStoreById(req.session.activeStoreId, baseUrl(req)); if(!store && req.session?.clientStoreId) store = getStoreById(req.session.clientStoreId, baseUrl(req)); if(!store) store = listStores(baseUrl(req))[0] || null; res.json({ store }); });
app.use(['/index.html','/lojas_master.html','/configuracoes.html','/configuracao-cobranca.html','/financeiro.html','/seguranca.html'], requireAdmin);
app.get('/s/:slug', (req, res) => {
  res.redirect(`/login-loja.html?loja=${encodeURIComponent(req.params.slug)}`);
});
app.use(express.static(PUBLIC_DIR, { extensions:['html'] }));
setInterval(() => { runAutomaticChargeReminders({ protocol:'https', get:()=>BASE_URL.replace(/^https?:\/\//,'') }).catch(err => console.error('WhatsApp cobrança automática:', err)); }, 1000 * 60 * 30);
// ===== BACKUP AUTOMÁTICO DIÁRIO =====

// ===== BACKUP INDIVIDUAL POR LOJA =====

async function fazerBackupLojaIndividual(storeId) {
  const id = String(storeId || '').trim();

  if (!id) {
    throw new Error('ID da loja nao informado');
  }

  // Usa os registros brutos do banco para preservar todos os campos,
  // inclusive configuracoes, estoque, produtos, senha em hash e preferencias.
  const storeRow = activeDb
    .prepare('SELECT * FROM stores WHERE id = ?')
    .get(id);

  if (!storeRow) {
    const err = new Error('Loja nao encontrada');
    err.code = 'STORE_NOT_FOUND';
    throw err;
  }

  const paymentRows = activeDb
    .prepare(
      'SELECT * FROM payments WHERE store_id = ? ORDER BY created_at ASC'
    )
    .all(id);

  const pastaRaiz = path.join(DATA_DIR, 'store-backups');
  const pastaLoja = path.join(pastaRaiz, id);

  fs.mkdirSync(pastaLoja, { recursive: true });

  const criadoEm = new Date().toISOString();
  const carimbo = criadoEm.replace(/[:.]/g, '-');

  const arquivo =
    `store-backup-${carimbo}.json`;

  const destino = path.join(pastaLoja, arquivo);
  const temporario = `${destino}.tmp`;

  const snapshot = {
    format: 'provador-pro-v12-store-backup',
    version: 1,
    createdAt: criadoEm,

    storeId: storeRow.id,
    storeSlug: storeRow.slug || '',
    storeName: storeRow.name || '',

    counts: {
      payments: paymentRows.length
    },

    store: storeRow,
    payments: paymentRows
  };

  // Grava primeiro em arquivo temporario e so depois publica o backup.
  fs.writeFileSync(
    temporario,
    JSON.stringify(snapshot, null, 2),
    'utf8'
  );

  fs.renameSync(temporario, destino);

  console.log(
    'Backup individual da loja criado:',
    storeRow.name,
    destino
  );

  return {
    arquivo,
    destino,
    storeId: storeRow.id,
    storeName: storeRow.name,
    createdAt: criadoEm,
    paymentsCount: paymentRows.length
  };
}


// ===== ROTA: BACKUP INDIVIDUAL DA LOJA =====

app.post('/api/admin/stores/:id/backup', requireAdminApi, async (req, res) => {
  try {
    const result = await fazerBackupLojaIndividual(req.params.id);

    return res.json({
      ok: true,
      backup: {
        arquivo: result.arquivo,
        storeId: result.storeId,
        storeName: result.storeName,
        createdAt: result.createdAt,
        paymentsCount: result.paymentsCount
      }
    });

  } catch (err) {
    if (err && err.code === 'STORE_NOT_FOUND') {
      return res.status(404).json({
        ok: false,
        error: 'Loja nao encontrada'
      });
    }

    console.error('Erro criando backup individual da loja:', err);

    return res.status(500).json({
      ok: false,
      error: 'Nao foi possivel criar o backup da loja'
    });
  }
});


// ===== ROTA: HISTORICO DE BACKUPS DA LOJA =====

app.get('/api/admin/stores/:id/backups', requireAdminApi, (req, res) => {
  try {
    const id = String(req.params.id || '').trim();

    const store = activeDb
      .prepare('SELECT id, name, slug FROM stores WHERE id = ?')
      .get(id);

    if (!store) {
      return res.status(404).json({
        ok: false,
        error: 'Loja nao encontrada'
      });
    }

    const pastaLoja = path.join(
      DATA_DIR,
      'store-backups',
      id
    );

    if (!fs.existsSync(pastaLoja)) {
      return res.json({
        ok: true,
        storeId: store.id,
        storeName: store.name,
        backups: []
      });
    }

    const backups = fs
      .readdirSync(pastaLoja, { withFileTypes: true })
      .filter(item =>
        item.isFile() &&
        /^store-backup-\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/.test(item.name)
      )
      .map(item => {
        const full = path.join(pastaLoja, item.name);
        const stat = fs.statSync(full);

        return {
          arquivo: item.name,
          tamanho: stat.size,
          criadoEm: stat.mtime.toISOString()
        };
      })
      .sort(
        (a, b) =>
          String(b.criadoEm).localeCompare(
            String(a.criadoEm)
          )
      );

    return res.json({
      ok: true,
      storeId: store.id,
      storeName: store.name,
      backups
    });

  } catch (err) {
    console.error(
      'Erro listando backups individuais da loja:',
      err
    );

    return res.status(500).json({
      ok: false,
      error: 'Nao foi possivel listar os backups da loja'
    });
  }
});


// ===== RESTAURACAO INDIVIDUAL DA LOJA =====

function nomeBackupLojaSeguro(nome) {
  return (
    typeof nome === 'string' &&
    /^store-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/.test(nome) &&
    path.basename(nome) === nome
  );
}


app.post(
  '/api/admin/stores/:id/backups/:arquivo/restore',
  requireAdminApi,
  async (req, res) => {

    try {

      const id = String(req.params.id || '').trim();
      const arquivo = String(req.params.arquivo || '').trim();

      if (!id) {
        return res.status(400).json({
          ok: false,
          error: 'ID da loja nao informado'
        });
      }

      if (!nomeBackupLojaSeguro(arquivo)) {
        return res.status(400).json({
          ok: false,
          error: 'Nome de backup invalido'
        });
      }

      const lojaAtual = activeDb
        .prepare('SELECT * FROM stores WHERE id = ?')
        .get(id);

      if (!lojaAtual) {
        return res.status(404).json({
          ok: false,
          error: 'Loja nao encontrada'
        });
      }

      const pastaLoja = path.join(
        DATA_DIR,
        'store-backups',
        id
      );

      const caminhoBackup = path.join(
        pastaLoja,
        arquivo
      );

      if (!fs.existsSync(caminhoBackup)) {
        return res.status(404).json({
          ok: false,
          error: 'Backup nao encontrado'
        });
      }

      const stat = fs.statSync(caminhoBackup);

      if (!stat.isFile() || stat.size > 50 * 1024 * 1024) {
        return res.status(400).json({
          ok: false,
          error: 'Arquivo de backup invalido'
        });
      }

      let snapshot;

      try {
        snapshot = JSON.parse(
          fs.readFileSync(caminhoBackup, 'utf8')
        );
      } catch (e) {
        return res.status(400).json({
          ok: false,
          error: 'Backup corrompido ou invalido'
        });
      }

      if (
        !snapshot ||
        snapshot.format !== 'provador-pro-v12-store-backup' ||
        Number(snapshot.version) !== 1 ||
        !snapshot.store ||
        String(snapshot.storeId || '') !== id ||
        String(snapshot.store.id || '') !== id ||
        !Array.isArray(snapshot.payments)
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Este backup nao pertence a loja selecionada'
        });
      }

      for (const payment of snapshot.payments) {

        if (
          !payment ||
          !payment.id ||
          String(payment.store_id || '') !== id
        ) {
          return res.status(400).json({
            ok: false,
            error: 'Backup contem cobranca de outra loja'
          });
        }
      }

      // Impede que um slug antigo restaurado colida com outra loja.
      if (snapshot.store.slug) {

        const conflitoSlug = activeDb
          .prepare(
            'SELECT id FROM stores WHERE slug = ? AND id <> ?'
          )
          .get(snapshot.store.slug, id);

        if (conflitoSlug) {
          return res.status(409).json({
            ok: false,
            error: 'O slug deste backup esta sendo usado por outra loja'
          });
        }
      }

      // Cria ponto de retorno antes de qualquer alteracao.
      const backupEmergencia =
        await fazerBackupLojaIndividual(id);

      const colunasStore = activeDb
        .prepare('PRAGMA table_info(stores)')
        .all()
        .map(item => item.name);

      const colunasPagamento = activeDb
        .prepare('PRAGMA table_info(payments)')
        .all()
        .map(item => item.name);

      const colunasRestaurarStore =
        colunasStore.filter(
          coluna =>
            coluna !== 'id' &&
            Object.prototype.hasOwnProperty.call(
              snapshot.store,
              coluna
            )
        );

      if (colunasRestaurarStore.length === 0) {
        return res.status(400).json({
          ok: false,
          error: 'Backup nao possui dados restauraveis da loja'
        });
      }

      const restaurar = activeDb.transaction(() => {

        const setStore = colunasRestaurarStore
          .map(coluna => `"${coluna}" = ?`)
          .join(', ');

        const valoresStore = colunasRestaurarStore
          .map(coluna => snapshot.store[coluna]);

        activeDb
          .prepare(
            `UPDATE stores SET ${setStore} WHERE id = ?`
          )
          .run(
            ...valoresStore,
            id
          );

        // Substitui SOMENTE as cobrancas da loja restaurada.
        activeDb
          .prepare(
            'DELETE FROM payments WHERE store_id = ?'
          )
          .run(id);

        for (const payment of snapshot.payments) {

          const conflitoPagamento = activeDb
            .prepare(
              'SELECT store_id FROM payments WHERE id = ?'
            )
            .get(payment.id);

          if (
            conflitoPagamento &&
            String(conflitoPagamento.store_id) !== id
          ) {
            const erro = new Error(
              'ID de cobranca pertence a outra loja'
            );
            erro.code = 'PAYMENT_CONFLICT';
            throw erro;
          }

          const colunas = colunasPagamento.filter(
            coluna =>
              Object.prototype.hasOwnProperty.call(
                payment,
                coluna
              )
          );

          if (
            !colunas.includes('id') ||
            !colunas.includes('store_id')
          ) {
            const erro = new Error(
              'Cobranca incompleta no backup'
            );
            erro.code = 'INVALID_PAYMENT';
            throw erro;
          }

          const nomes = colunas
            .map(coluna => `"${coluna}"`)
            .join(', ');

          const placeholders = colunas
            .map(() => '?')
            .join(', ');

          const valores = colunas.map(
            coluna =>
              coluna === 'store_id'
                ? id
                : payment[coluna]
          );

          activeDb
            .prepare(
              `INSERT INTO payments (${nomes}) VALUES (${placeholders})`
            )
            .run(...valores);
        }
      });

      restaurar();

      req.session.activeStoreId = id;

      const lojaRestaurada =
        getStoreById(id, baseUrl(req));

      console.log(
        'Loja restaurada individualmente:',
        lojaRestaurada?.name || id,
        arquivo
      );

      return res.json({
        ok: true,
        message: 'Loja restaurada com sucesso',
        store: lojaRestaurada,
        restoredFrom: arquivo,
        emergencyBackup: backupEmergencia.arquivo,
        paymentsRestored: snapshot.payments.length
      });

    } catch (err) {

      console.error(
        'Erro restaurando backup individual da loja:',
        err
      );

      if (
        err &&
        (
          err.code === 'PAYMENT_CONFLICT' ||
          err.code === 'INVALID_PAYMENT'
        )
      ) {
        return res.status(409).json({
          ok: false,
          error: err.message
        });
      }

      return res.status(500).json({
        ok: false,
        error: 'Nao foi possivel restaurar esta loja'
      });
    }
  }
);


// ===== BACKUP GLOBAL SQLITE =====

async function fazerBackupAuto() {
  try {
    const pastaBackup = path.join(DATA_DIR, 'backups');

    if (!fs.existsSync(pastaBackup)) {
      fs.mkdirSync(pastaBackup, { recursive: true });
    }

    const data = new Date().toISOString().slice(0, 10);
    const destino = path.join(pastaBackup, `backup-${data}.sqlite`);

    await activeDb.backup(destino);

    console.log('? Backup SQLite autom?tico criado:', destino);
    return destino;
  } catch (err) {
    console.error('? Erro no backup SQLite autom?tico:', err.message);
    throw err;
  }
}

// executa a cada 24 horas
setInterval(() => {
  fazerBackupAuto().catch(() => {});
}, 1000 * 60 * 60 * 24);

// executa ao iniciar o servidor
fazerBackupAuto().catch(() => {});
// ===== RESTAURAR BACKUP =====

function nomeBackupSeguro(arquivo) {
  return typeof arquivo === 'string' &&
    /^backup-\d{4}-\d{2}-\d{2}\.sqlite$/.test(arquivo);
}

app.post('/api/admin/restore', requireAdminApi, async (req, res) => {
  try {
    const { arquivo } = req.body;

    if (!nomeBackupSeguro(arquivo)) {
      return res.status(400).json({
        ok: false,
        error: 'Arquivo de backup invalido'
      });
    }

    const BetterSqlite3 = require('better-sqlite3');
    const pastaBackup = path.join(DATA_DIR, 'backups');
    const origem = path.join(pastaBackup, arquivo);
    const destino = process.env.DB_PATH || path.join(DATA_DIR, 'loja-system.sqlite');
    const temporario = path.join(DATA_DIR, 'restore-pendente.sqlite');

    if (!fs.existsSync(origem)) {
      return res.status(404).json({
        ok: false,
        error: 'Backup nao encontrado'
      });
    }

    // 1. Validar integridade do backup antes de qualquer alteracao
    const testeDb = new BetterSqlite3(origem, {
      readonly: true,
      fileMustExist: true
    });

    const integridade = testeDb.pragma('integrity_check', { simple: true });

    const tabelas = testeDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all().map(r => r.name);

    testeDb.close();

    if (integridade !== 'ok') {
      return res.status(400).json({
        ok: false,
        error: 'Backup SQLite com falha de integridade'
      });
    }

    if (!tabelas.includes('stores') || !tabelas.includes('payments')) {
      return res.status(400).json({
        ok: false,
        error: 'Backup nao pertence ao banco principal da V12'
      });
    }

    // 2. Criar backup de emergencia do estado atual
    const agora = new Date()
      .toISOString()
      .replace(/[:.]/g, '-');

    const emergencia = path.join(
      pastaBackup,
      `EMERGENCIA-AUTO-ANTES-RESTORE-${agora}.sqlite`
    );

    await activeDb.backup(emergencia);

    // 3. Preparar a copia que sera restaurada
    fs.copyFileSync(origem, temporario);

    console.log('Restore preparado:', arquivo);
    console.log('Backup de emergencia:', emergencia);

    // 4. Responder primeiro ao navegador
    res.json({
      ok: true,
      arquivo,
      emergencia: path.basename(emergencia),
      restartRequired: true
    });

    // 5. Somente depois da resposta, fechar e trocar o banco
    res.on('finish', () => {
      setTimeout(() => {
        const antigo = `${destino}.antes-restore`;

        try {
          activeDb.close();

          for (const auxiliar of [`${destino}-wal`, `${destino}-shm`]) {
            if (fs.existsSync(auxiliar)) {
              fs.rmSync(auxiliar, { force: true });
            }
          }

          if (fs.existsSync(antigo)) {
            fs.rmSync(antigo, { force: true });
          }

          if (fs.existsSync(destino)) {
            fs.renameSync(destino, antigo);
          }

          try {
            fs.renameSync(temporario, destino);
          } catch (erroTroca) {
            if (fs.existsSync(antigo) && !fs.existsSync(destino)) {
              fs.renameSync(antigo, destino);
            }
            throw erroTroca;
          }

          if (fs.existsSync(antigo)) {
            fs.rmSync(antigo, { force: true });
          }

          console.log('RESTORE SQLITE CONCLUIDO:', arquivo);
          console.log('Servidor sera encerrado para reabrir o banco restaurado.');

          process.exit(0);

        } catch (err) {
          console.error('ERRO CRITICO NO RESTORE:', err);
          process.exit(1);
        }
      }, 500);
    });

  } catch (err) {
    console.error('Erro preparando restauracao:', err);

    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: err.message
      });
    }
  }
});

// ===== LISTAR BACKUPS =====
app.get('/api/admin/backups', requireAdminApi, (req, res) => {
  try {
    const pasta = path.join(DATA_DIR, 'backups');

    if (!fs.existsSync(pasta)) {
      return res.json({ backups: [] });
    }

    const arquivos = fs.readdirSync(pasta, { withFileTypes: true })
      .filter(item =>
        item.isFile() &&
        nomeBackupSeguro(item.name)
      )
      .map(item => item.name)
      .sort()
      .reverse();

    res.json({ backups: arquivos });

  } catch (err) {
    console.error('Erro listando backups:', err);
    res.status(500).json({ backups: [] });
  }
});

// ===== BACKUP MANUAL =====
app.post('/api/admin/backup', requireAdminApi, async (req, res) => {
  try {
    const destino = await fazerBackupAuto();
    res.json({ ok: true, arquivo: path.basename(destino) });
  } catch (err) {
    console.error('Erro no backup manual:', err);
    res.status(500).json({ ok: false, error: err.message });
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
