const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_STATIC_URL);
const DATA_DIR = process.env.DATA_DIR || (isRailway ? '/data' : path.join(__dirname, 'data'));
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'loja-system.sqlite');
function nanoid(){ return crypto.randomUUID().replace(/-/g, '').slice(0, 21); }
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'troque-a-chave-da-licenca';
function slugify(value){
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'loja';
}
function hashPassword(password){ return bcrypt.hashSync(password, 10); }
function comparePassword(password, hash){ return bcrypt.compareSync(password, hash); }
function todayStr(d=new Date()){ return d.toISOString().slice(0,10); }
function addDays(dateStr, days){ const d = dateStr ? new Date(dateStr+'T00:00:00') : new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function cents(v){ return Math.max(0, Math.round(Number(v || 0))); }
function generateLicenseKey(storeId, slug, expiresAt){
  const base = `${storeId}|${slug}|${expiresAt || ''}`;
  const sig = crypto.createHmac('sha256', LICENSE_SECRET).update(base).digest('hex').slice(0, 16).toUpperCase();
  return `LSP-${sig.slice(0,4)}-${sig.slice(4,8)}-${sig.slice(8,12)}-${sig.slice(12,16)}`;
}
function rawLicenseStatus(store){
  if (store.status === 'degustacao') return 'em degustação';
  if (store.status !== 'ativo') return 'inativa';
  if (!store.expires_at) return 'ativa';
  const now = new Date();
  const exp = new Date(store.expires_at + 'T23:59:59');
  return exp >= now ? 'ativa' : 'expirada';
}
function ensureTables(){
  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      sub TEXT,
      color TEXT,
      logo TEXT,
      email TEXT,
      phone TEXT,
      login TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ativo',
      plan TEXT NOT NULL DEFAULT 'premium',
      expires_at TEXT,
      license_key TEXT,
      custom_domain TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
   
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      gateway TEXT NOT NULL DEFAULT 'manual',
      method TEXT NOT NULL DEFAULT 'pix',
      kind TEXT NOT NULL DEFAULT 'subscription',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'BRL',
      status TEXT NOT NULL DEFAULT 'pending',
      due_at TEXT,
      paid_at TEXT,
      external_id TEXT,
      notes TEXT,
      whatsapp_sent_at TEXT,
      whatsapp_message_id TEXT,
      reminders_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY(store_id) REFERENCES stores(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_payments_store_id ON payments(store_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

    CREATE TABLE IF NOT EXISTS ai_usage_monthly (
      store_id TEXT NOT NULL,
      period TEXT NOT NULL,
      requests INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (store_id, period),
      FOREIGN KEY(store_id) REFERENCES stores(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ai_usage_period
      ON ai_usage_monthly(period);
  `);
   try { db.exec("ALTER TABLE stores ADD COLUMN estoque TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE stores ADD COLUMN products TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE stores ADD COLUMN looks TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE stores ADD COLUMN roupas TEXT"); } catch(e) {}
}
ensureTables();
// ===== CHECKOUTS SEPARADOS: PRODUTOR E LOJISTAS =====
db.exec(`
  CREATE TABLE IF NOT EXISTS producer_checkout_orders (
    id TEXT PRIMARY KEY,
    checkout_token TEXT UNIQUE NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_email TEXT,
    buyer_phone TEXT,
    buyer_cpf_cnpj TEXT,
    store_name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'premium',
    amount_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL',
    gateway TEXT NOT NULL DEFAULT 'test',
    method TEXT NOT NULL DEFAULT 'pix',
    status TEXT NOT NULL DEFAULT 'pending',
    external_id TEXT,
    checkout_url TEXT,
    created_store_id TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY(created_store_id) REFERENCES stores(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_producer_checkout_status
    ON producer_checkout_orders(status);

  CREATE INDEX IF NOT EXISTS idx_producer_checkout_external
    ON producer_checkout_orders(external_id);

  CREATE TABLE IF NOT EXISTS customer_orders (
    id TEXT PRIMARY KEY,
    checkout_token TEXT UNIQUE NOT NULL,
    store_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    items_json TEXT NOT NULL DEFAULT '[]',
    amount_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL',
    gateway TEXT NOT NULL DEFAULT 'test',
    method TEXT NOT NULL DEFAULT 'pix',
    status TEXT NOT NULL DEFAULT 'pending',
    external_id TEXT,
    checkout_url TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY(store_id) REFERENCES stores(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_customer_orders_store
    ON customer_orders(store_id);

  CREATE INDEX IF NOT EXISTS idx_customer_orders_status
    ON customer_orders(status);

  CREATE INDEX IF NOT EXISTS idx_customer_orders_external
    ON customer_orders(external_id);
`);
// ===== PLANOS EDITAVEIS DO PRODUTOR =====
db.exec(`
  CREATE TABLE IF NOT EXISTS producer_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    monthly_amount_cents INTEGER NOT NULL DEFAULT 0,
    annual_amount_cents INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_producer_plans_active
    ON producer_plans(active);
`);

const seedPlanNow = new Date().toISOString();
const insertProducerPlan = db.prepare(`
  INSERT OR IGNORE INTO producer_plans
  (id,name,monthly_amount_cents,annual_amount_cents,active,sort_order,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,?)
`);
insertProducerPlan.run('simples','Simples',9700,79700,1,1,seedPlanNow,seedPlanNow);
insertProducerPlan.run('profissional','Profissional',19700,149700,1,2,seedPlanNow,seedPlanNow);
insertProducerPlan.run('premium','Premium',29700,259700,1,3,seedPlanNow,seedPlanNow);

function maybeAddColumn(table, column, typeDef){
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
  if(!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
}
maybeAddColumn('stores','custom_domain','TEXT');
maybeAddColumn('stores','support_config','TEXT');
maybeAddColumn('stores','cpf','TEXT');
maybeAddColumn('stores','cnpj','TEXT');

maybeAddColumn('stores','cep','TEXT');
maybeAddColumn('stores','address','TEXT');
maybeAddColumn('stores','address_number','TEXT');
maybeAddColumn('stores','address_complement','TEXT');
maybeAddColumn('stores','neighborhood','TEXT');
maybeAddColumn('stores','city','TEXT');
maybeAddColumn('stores','state','TEXT');

maybeAddColumn('stores','contract_date','TEXT');
maybeAddColumn('stores','license_start_date','TEXT');
maybeAddColumn('stores','contract_value_cents','INTEGER DEFAULT 0');
maybeAddColumn('stores','contract_status','TEXT DEFAULT "ativo"');
maybeAddColumn('stores','force_password_change','INTEGER DEFAULT 0');
maybeAddColumn('stores','producer_payment_methods',"TEXT DEFAULT '[\"pix\"]'");
maybeAddColumn('stores','customer_payment_methods',"TEXT DEFAULT '[]'");
maybeAddColumn('payments','notes','TEXT');
maybeAddColumn('payments','whatsapp_sent_at','TEXT');
maybeAddColumn('payments','whatsapp_message_id','TEXT');
maybeAddColumn('payments','reminders_count','INTEGER DEFAULT 0');
// CAMPOS EXTRAS DOS CHECKOUTS
maybeAddColumn('producer_checkout_orders','installments','INTEGER DEFAULT 1');
maybeAddColumn('producer_checkout_orders','secondary_method','TEXT DEFAULT ""');
maybeAddColumn('producer_checkout_orders','secondary_amount_cents','INTEGER DEFAULT 0');
maybeAddColumn('producer_checkout_orders','payment_details_json','TEXT DEFAULT "{}"');

maybeAddColumn('customer_orders','installments','INTEGER DEFAULT 1');
maybeAddColumn('customer_orders','secondary_method','TEXT DEFAULT ""');
maybeAddColumn('customer_orders','secondary_amount_cents','INTEGER DEFAULT 0');
maybeAddColumn('customer_orders','payment_details_json','TEXT DEFAULT "{}"');
maybeAddColumn('producer_checkout_orders','billing_cycle','TEXT DEFAULT "monthly"');
maybeAddColumn('stores','billing_cycle','TEXT DEFAULT "monthly"');

function uniqueSlug(base, ignoreId=''){
  let slug = slugify(base);
  let out = slug, count=2;
  const existsStmt = db.prepare('SELECT id FROM stores WHERE slug = ?');
  while (true){
    const found = existsStmt.get(out);
    if (!found || found.id === ignoreId) return out;
    out = `${slug}-${count++}`;
  }
}
function syncStoreLicense(storeId){
  const row = db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId);
  if(!row) return null;
  let status = row.status;
  if (row.expires_at) {
    const exp = new Date(row.expires_at + 'T23:59:59');
    if (exp < new Date()) status = 'inativo';
  }
  const overdueCount = db.prepare("SELECT COUNT(*) c FROM payments WHERE store_id = ? AND status = 'overdue'").get(storeId).c;
  if (overdueCount > 0 && row.expires_at) {
    const exp = new Date(row.expires_at + 'T23:59:59');
    if (exp < new Date()) status = 'inativo';
  }
  if (status !== row.status) db.prepare('UPDATE stores SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), storeId);
  return db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId);
}
function rowToStore(row, baseUrl=''){
  if (!row) return null;
  const synced = syncStoreLicense(row.id) || row;
  const store = {
    id: synced.id, slug: synced.slug, name: synced.name, sub: synced.sub || '', color: synced.color || '#e33d8f', logo: synced.logo || 'assets/default-logo.svg',
    email: synced.email || '', phone: synced.phone || '', cpf: synced.cpf || '', cnpj: synced.cnpj || '',
    cep: synced.cep || '', address: synced.address || '', addressNumber: synced.address_number || '',
    addressComplement: synced.address_complement || '', neighborhood: synced.neighborhood || '',
    city: synced.city || '', state: synced.state || '',
    contractDate: synced.contract_date || '',
    licenseStartDate: synced.license_start_date || '',
    contractValueCents: synced.contract_value_cents || 0,
    contractStatus: synced.contract_status || 'ativo',
    forcePasswordChange: Boolean(synced.force_password_change),
    login: synced.login, status: synced.status, plan: synced.plan || 'premium',
    billingCycle: synced.billing_cycle || 'monthly',
    expiresAt: synced.expires_at || '',
    licenseKey: synced.license_key || '', customDomain: synced.custom_domain || '', createdAt: synced.created_at, updatedAt: synced.updated_at || '',
  };
  try {
    const producerMethods =
      JSON.parse(synced.producer_payment_methods || '["pix"]');

    store.producerPaymentMethods =
      Array.isArray(producerMethods)
        ? producerMethods
        : ['pix'];

  } catch(e) {
    store.producerPaymentMethods = ['pix'];
  }

  try {
    const customerMethods =
      JSON.parse(synced.customer_payment_methods || '[]');

    store.customerPaymentMethods =
      Array.isArray(customerMethods)
        ? customerMethods
        : [];

  } catch(e) {
    store.customerPaymentMethods = [];
  }

  try {
    const cfg = JSON.parse(synced.support_config || '{}');
    store.supportConfig =
      cfg && typeof cfg === 'object' && !Array.isArray(cfg)
        ? cfg
        : {};
  } catch(e) {
    store.supportConfig = {};
  }

  store.estoque = JSON.parse(synced.estoque || '[]');
store.products = JSON.parse(synced.products || '[]');
store.looks = JSON.parse(synced.looks || '[]');
store.roupas = JSON.parse(synced.roupas || '[]');
  store.licenseStatus = rawLicenseStatus(synced);
  const origin = baseUrl || '';
  store.publicLink = store.customDomain ? `https://${store.customDomain}` : (origin ? `${origin}/s/${store.slug}` : `/s/${store.slug}`);
  return store;
}
function paymentRowToView(row){
  if(!row) return null;
  return {
    id: row.id, storeId: row.store_id, gateway: row.gateway, method: row.method, kind: row.kind,
    amountCents: row.amount_cents, amount: (row.amount_cents/100).toFixed(2), currency: row.currency,
    status: row.status, dueAt: row.due_at || '', paidAt: row.paid_at || '', externalId: row.external_id || '', notes: row.notes || '',
    whatsappSentAt: row.whatsapp_sent_at || '', whatsappMessageId: row.whatsapp_message_id || '', remindersCount: row.reminders_count || 0,
    createdAt: row.created_at, updatedAt: row.updated_at || ''
  };
}
function listStores(baseUrl=''){ return db.prepare('SELECT * FROM stores ORDER BY created_at DESC').all().map(r=>rowToStore(r, baseUrl)); }
function getStoreById(id, baseUrl=''){
  const row = db.prepare(
    'SELECT * FROM stores WHERE id = ?'
  ).get(id);

  if(!row) return null;

  const store = rowToStore(row, baseUrl);


store.estoque = parseSafe(row.estoque);
store.looks = parseSafe(row.looks);
store.products = parseSafe(row.products);
store.roupas = parseSafe(row.roupas);
  return store;
}
 function parseSafe(v){
  try{
    let r = JSON.parse(v || '[]');

    if(typeof r === 'string'){
      r = JSON.parse(r);
    }

    return Array.isArray(r) ? r : [];
  }catch{
    return [];
  }
}

function getStoreBySlug(slug, baseUrl=''){
  const row = db.prepare(
    'SELECT * FROM stores WHERE slug = ?'
  ).get(slug);

  if(!row) return null;

  const store = rowToStore(row, baseUrl);

store.estoque = parseSafe(row.estoque);
store.looks = parseSafe(row.looks);
store.products = parseSafe(row.products);
store.roupas = parseSafe(row.roupas);

  return store;
}
function getStoreRowBySlug(slug){ const row = db.prepare('SELECT * FROM stores WHERE slug = ?').get(slug); return row ? (syncStoreLicense(row.id), db.prepare('SELECT * FROM stores WHERE id = ?').get(row.id)) : null; }
function getStoreRowById(id){ const row = db.prepare('SELECT * FROM stores WHERE id = ?').get(id); return row ? (syncStoreLicense(row.id), db.prepare('SELECT * FROM stores WHERE id = ?').get(row.id)) : null; }
function createStore(payload, baseUrl=''){
  const id = nanoid(); const now = new Date().toISOString(); const slug = uniqueSlug(payload.slug || payload.name || 'loja');
  const expiresAt = payload.expiresAt || addDays(todayStr(), 30); const licenseKey = generateLicenseKey(id, slug, expiresAt);
  db.prepare(`INSERT INTO stores (
id,
slug,
name,
sub,
color,
logo,
email,
phone,
cpf,
cnpj,
cep,
address,
address_number,
address_complement,
neighborhood,
city,
state,
contract_date,
license_start_date,
contract_value_cents,
contract_status,
producer_payment_methods,
customer_payment_methods,
login,
password_hash,
status,
plan,
billing_cycle,
expires_at,
license_key,
custom_domain,
support_config,
estoque,
products,
looks,
roupas,
created_at,
updated_at
)
  VALUES (
@id,@slug,@name,@sub,@color,@logo,@email,@phone,@cpf,@cnpj,
@cep,@address,@address_number,@address_complement,@neighborhood,@city,@state,
@contract_date,@license_start_date,@contract_value_cents,@contract_status,
@producer_payment_methods,@customer_payment_methods,@login,
@password_hash,@status,@plan,@billing_cycle,@expires_at,@license_key,
@custom_domain,
@support_config,
@estoque,
@products,
@looks,
@roupas,
@created_at,
@updated_at
)`).run({
    id, slug, name: payload.name || 'Sua Loja', sub: payload.sub || 'Dashboard Integrado Multi-Loja', color: payload.color || '#e33d8f', logo: payload.logo || 'assets/default-logo.svg',
    email: payload.email || '', phone: payload.phone || '', cpf: payload.cpf || '', cnpj: payload.cnpj || '',
    cep: payload.cep || '',
    address: payload.address || '',
    address_number: payload.addressNumber || '',
    address_complement: payload.addressComplement || '',
    neighborhood: payload.neighborhood || '',
    city: payload.city || '',
    state: payload.state || '',
    contract_date: payload.contractDate || '',
    license_start_date: payload.licenseStartDate || '',
    contract_value_cents: Math.max(0, Math.round(Number(payload.contractValueCents || 0))),
    contract_status: ['ativo','pendente','suspenso','cancelado','encerrado'].includes(payload.contractStatus)
      ? payload.contractStatus
      : 'ativo',
    producer_payment_methods: JSON.stringify(
      Array.isArray(payload.producerPaymentMethods)
        ? payload.producerPaymentMethods
        : ['pix']
    ),
    customer_payment_methods: JSON.stringify(
      Array.isArray(payload.customerPaymentMethods)
        ? payload.customerPaymentMethods
        : []
    ),
    login: payload.login || 'admin', password_hash: hashPassword(payload.password || crypto.randomBytes(12).toString('base64url')),
    status: payload.status === 'inativo' ? 'inativo' : (payload.status === 'degustacao' ? 'degustacao' : 'ativo'),
    plan: payload.plan || 'premium',
    billing_cycle: ['monthly','annual'].includes(payload.billingCycle) ? payload.billingCycle : 'monthly',
    expires_at: expiresAt || null, license_key: licenseKey,
    custom_domain: payload.customDomain || '', support_config: JSON.stringify(payload.supportConfig || {}), estoque: JSON.stringify(payload.estoque || []),
products: JSON.stringify(payload.products || []),
looks: JSON.stringify(payload.looks || []),
roupas: JSON.stringify(payload.roupas || []), created_at: now, updated_at: now
  });
  if(payload.createInitialPayment !== false){
    createPayment({storeId:id, gateway:'manual', method:'pix', kind:'subscription', amountCents:cents(payload.amountCents || 9900), status:'pending', dueAt: payload.initialDueAt || todayStr(), notes:'Cobrança inicial automática'});
  }
  return getStoreById(id, baseUrl);
}
function updateStore(id, payload, baseUrl=''){
  const current = getStoreRowById(id); if (!current) return null;
  const slug = uniqueSlug(payload.slug || current.slug || current.name, id);
  const expiresAt = payload.expiresAt !== undefined ? payload.expiresAt : (current.expires_at || '');
  const licenseKey = generateLicenseKey(id, slug, expiresAt);
  const passwordHash = payload.password ? hashPassword(payload.password) : current.password_hash;
  db.prepare(`UPDATE stores SET slug=@slug,name=@name,sub=@sub,color=@color,logo=@logo,email=@email,phone=@phone,cpf=@cpf,cnpj=@cnpj,cep=@cep,address=@address,address_number=@address_number,address_complement=@address_complement,neighborhood=@neighborhood,city=@city,state=@state,contract_date=@contract_date,license_start_date=@license_start_date,contract_value_cents=@contract_value_cents,contract_status=@contract_status,producer_payment_methods=@producer_payment_methods,customer_payment_methods=@customer_payment_methods,login=@login,password_hash=@password_hash,status=@status,plan=@plan,billing_cycle=@billing_cycle,expires_at=@expires_at,license_key=@license_key,custom_domain=@custom_domain,support_config=@support_config,
estoque=@estoque,
products=@products,
looks=@looks,
roupas=@roupas,
updated_at=@updated_at WHERE id=@id`).run({
    id, slug, name: payload.name ?? current.name, sub: payload.sub ?? current.sub, color: payload.color ?? current.color, logo: payload.logo ?? current.logo,
    email: payload.email ?? current.email, phone: payload.phone ?? current.phone, cpf: payload.cpf ?? current.cpf ?? '', cnpj: payload.cnpj ?? current.cnpj ?? '',
    cep: payload.cep ?? current.cep ?? '',
    address: payload.address ?? current.address ?? '',
    address_number: payload.addressNumber ?? current.address_number ?? '',
    address_complement: payload.addressComplement ?? current.address_complement ?? '',
    neighborhood: payload.neighborhood ?? current.neighborhood ?? '',
    city: payload.city ?? current.city ?? '',
    state: payload.state ?? current.state ?? '',
    contract_date: payload.contractDate ?? current.contract_date ?? '',
    license_start_date: payload.licenseStartDate ?? current.license_start_date ?? '',
    contract_value_cents: payload.contractValueCents !== undefined
      ? Math.max(0, Math.round(Number(payload.contractValueCents) || 0))
      : (current.contract_value_cents ?? 0),
    contract_status: payload.contractStatus !== undefined
      ? (
          ['ativo','pendente','suspenso','cancelado','encerrado'].includes(payload.contractStatus)
            ? payload.contractStatus
            : 'ativo'
        )
      : (current.contract_status || 'ativo'),
    producer_payment_methods:
      payload.producerPaymentMethods !== undefined
        ? JSON.stringify(
            Array.isArray(payload.producerPaymentMethods)
              ? payload.producerPaymentMethods
              : []
          )
        : (current.producer_payment_methods ?? '["pix"]'),
    customer_payment_methods:
      payload.customerPaymentMethods !== undefined
        ? JSON.stringify(
            Array.isArray(payload.customerPaymentMethods)
              ? payload.customerPaymentMethods
              : []
          )
        : (current.customer_payment_methods ?? '[]'),
    login: payload.login ?? current.login, password_hash: passwordHash,
    status: payload.status === 'inativo' ? 'inativo' : (payload.status === 'degustacao' ? 'degustacao' : (payload.status ?? current.status)),
    plan: payload.plan ?? current.plan,
    billing_cycle: ['monthly','annual'].includes(payload.billingCycle)
      ? payload.billingCycle
      : (current.billing_cycle || 'monthly'),
    expires_at: expiresAt || null, license_key: licenseKey, custom_domain: payload.customDomain ?? current.custom_domain,
support_config: payload.supportConfig !== undefined ? JSON.stringify(payload.supportConfig || {}) : (current.support_config ?? '{}'),
   
estoque: payload.estoque !== undefined ? JSON.stringify(payload.estoque) : (current.estoque ?? `[]`),
products: payload.products !== undefined ? JSON.stringify(payload.products) : (current.products ?? `[]`),
looks: payload.looks !== undefined ? JSON.stringify(payload.looks) : (current.looks ?? `[]`),
roupas: payload.roupas !== undefined ? JSON.stringify(payload.roupas) : (current.roupas ?? `[]`),
updated_at: new Date().toISOString(),
id,
baseUrl
  });
  return getStoreById(id, baseUrl);
}
function setStorePassword(id, password, forcePasswordChange=false){
  const current = getStoreRowById(id);
  if(!current) return null;

  const newPassword = String(password || '');
  if(!newPassword) return null;

  db.prepare(
    'UPDATE stores SET password_hash = ?, force_password_change = ?, updated_at = ? WHERE id = ?'
  ).run(
    hashPassword(newPassword),
    forcePasswordChange ? 1 : 0,
    new Date().toISOString(),
    id
  );

  return getStoreById(id);
}

function deleteStore(id){ db.prepare('DELETE FROM stores WHERE id = ?').run(id); }
function verifyStoreLogin(slug, login, password){
  const row = getStoreRowBySlug(slug); if (!row) return { ok:false, code:'not_found' };
  const license = rawLicenseStatus(row);
  if (license !== 'ativa' && license !== 'em degustação') return { ok:false, code:'license_inactive' };
  if (row.login !== login) return { ok:false, code:'bad_credentials' };
  if (!comparePassword(password, row.password_hash)) return { ok:false, code:'bad_credentials' };
  return { ok:true, row };
}
function createPayment(payload){
  const id = nanoid(); const now = new Date().toISOString();
  db.prepare(`INSERT INTO payments (id,store_id,gateway,method,kind,amount_cents,currency,status,due_at,paid_at,external_id,notes,whatsapp_sent_at,whatsapp_message_id,reminders_count,created_at,updated_at)
  VALUES (@id,@store_id,@gateway,@method,@kind,@amount_cents,@currency,@status,@due_at,@paid_at,@external_id,@notes,@whatsapp_sent_at,@whatsapp_message_id,@reminders_count,@created_at,@updated_at)`).run({
    id, store_id: payload.storeId, gateway: payload.gateway || 'manual', method: payload.method || 'pix', kind: payload.kind || 'subscription',
    amount_cents: cents(payload.amountCents), currency: payload.currency || 'BRL', status: payload.status || 'pending', due_at: payload.dueAt || todayStr(),
    paid_at: payload.paidAt || null, external_id: payload.externalId || '', notes: payload.notes || '', whatsapp_sent_at: payload.whatsappSentAt || null, whatsapp_message_id: payload.whatsappMessageId || '', reminders_count: payload.remindersCount || 0, created_at: now, updated_at: now
  });
  return paymentRowToView(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
}
function listPayments(filters={}){
  const clauses=[]; const params={};
  if(filters.storeId){ clauses.push('store_id = @storeId'); params.storeId = filters.storeId; }
  if(filters.status){ clauses.push('status = @status'); params.status = filters.status; }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  return db.prepare(`SELECT * FROM payments ${where} ORDER BY created_at DESC`).all(params).map(paymentRowToView);
}
function updatePaymentStatus(id, status, extra={}){
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id); if(!row) return null;
  const nextStatus = status || row.status; const now = new Date().toISOString();
  const paidAt = nextStatus === 'paid' ? (extra.paidAt || now) : (extra.paidAt !== undefined ? extra.paidAt : row.paid_at);
  db.prepare('UPDATE payments SET status = ?, paid_at = ?, due_at = ?, external_id = ?, notes = ?, whatsapp_sent_at = ?, whatsapp_message_id = ?, reminders_count = ?, updated_at = ? WHERE id = ?').run(
    nextStatus, paidAt || null, extra.dueAt !== undefined ? extra.dueAt : row.due_at, extra.externalId !== undefined ? extra.externalId : row.external_id,
    extra.notes !== undefined ? extra.notes : row.notes, extra.whatsappSentAt !== undefined ? extra.whatsappSentAt : row.whatsapp_sent_at,
    extra.whatsappMessageId !== undefined ? extra.whatsappMessageId : row.whatsapp_message_id, extra.remindersCount !== undefined ? extra.remindersCount : row.reminders_count, now, id
  );
  const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  if(nextStatus === 'paid'){
    const store = getStoreRowById(updated.store_id);
    const start = store && store.expires_at && new Date(store.expires_at+'T23:59:59') > new Date() ? store.expires_at : todayStr();
    const nextExpiry = addDays(start, 30);
    updateStore(updated.store_id, { status:'ativo', expiresAt: nextExpiry });
  }
  if(nextStatus === 'overdue') syncStoreLicense(updated.store_id);
  return paymentRowToView(updated);
}
// ===== FUNCOES DOS CHECKOUTS SEPARADOS =====
function safeJsonObject(value){
  try{
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }catch(e){
    return {};
  }
}

function producerCheckoutRowToView(row){
  if(!row) return null;
  return {
    id: row.id,
    checkoutToken: row.checkout_token,
    buyerName: row.buyer_name,
    buyerEmail: row.buyer_email || '',
    buyerPhone: row.buyer_phone || '',
    buyerCpfCnpj: row.buyer_cpf_cnpj || '',
    storeName: row.store_name,
    plan: row.plan,
    billingCycle: row.billing_cycle || 'monthly',
    amountCents: row.amount_cents,
    currency: row.currency,
    gateway: row.gateway,
    method: row.method,
    status: row.status,
    externalId: row.external_id || '',
    checkoutUrl: row.checkout_url || '',
    createdStoreId: row.created_store_id || '',
    installments: row.installments || 1,
    secondaryMethod: row.secondary_method || '',
    secondaryAmountCents: row.secondary_amount_cents || 0,
    paymentDetails: safeJsonObject(row.payment_details_json),
    paidAt: row.paid_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || ''
  };
}

function createProducerCheckoutOrder(payload={}){
  const id = nanoid();
  const now = new Date().toISOString();
  const checkoutToken = String(payload.checkoutToken || (nanoid()+nanoid()));
  db.prepare(`INSERT INTO producer_checkout_orders (
    id,checkout_token,buyer_name,buyer_email,buyer_phone,buyer_cpf_cnpj,
    store_name,plan,billing_cycle,amount_cents,currency,gateway,method,status,external_id,
    checkout_url,created_store_id,paid_at,created_at,updated_at,installments,
    secondary_method,secondary_amount_cents,payment_details_json
  ) VALUES (
    @id,@checkout_token,@buyer_name,@buyer_email,@buyer_phone,@buyer_cpf_cnpj,
    @store_name,@plan,@billing_cycle,@amount_cents,@currency,@gateway,@method,@status,@external_id,
    @checkout_url,@created_store_id,@paid_at,@created_at,@updated_at,@installments,
    @secondary_method,@secondary_amount_cents,@payment_details_json
  )`).run({
    id,
    checkout_token: checkoutToken,
    buyer_name: String(payload.buyerName || '').trim(),
    buyer_email: String(payload.buyerEmail || '').trim(),
    buyer_phone: String(payload.buyerPhone || '').trim(),
    buyer_cpf_cnpj: String(payload.buyerCpfCnpj || '').trim(),
    store_name: String(payload.storeName || '').trim(),
    plan: String(payload.plan || 'premium'),
    billing_cycle: String(payload.billingCycle || 'monthly'),
    amount_cents: cents(payload.amountCents),
    currency: String(payload.currency || 'BRL'),
    gateway: String(payload.gateway || 'test'),
    method: String(payload.method || 'pix'),
    status: String(payload.status || 'pending'),
    external_id: payload.externalId ? String(payload.externalId) : null,
    checkout_url: payload.checkoutUrl ? String(payload.checkoutUrl) : null,
    created_store_id: payload.createdStoreId ? String(payload.createdStoreId) : null,
    paid_at: payload.paidAt || null,
    created_at: now,
    updated_at: now,
    installments: Math.max(1, Number(payload.installments || 1) || 1),
    secondary_method: String(payload.secondaryMethod || ''),
    secondary_amount_cents: cents(payload.secondaryAmountCents),
    payment_details_json: JSON.stringify(payload.paymentDetails || {})
  });
  return producerCheckoutRowToView(
    db.prepare('SELECT * FROM producer_checkout_orders WHERE id = ?').get(id)
  );
}

function getProducerCheckoutOrderById(id){
  return producerCheckoutRowToView(
    db.prepare('SELECT * FROM producer_checkout_orders WHERE id = ?').get(id)
  );
}

function getProducerCheckoutOrderByToken(token){
  return producerCheckoutRowToView(
    db.prepare('SELECT * FROM producer_checkout_orders WHERE checkout_token = ?').get(token)
  );
}

function getProducerCheckoutOrderByExternalId(externalId){
  return producerCheckoutRowToView(
    db.prepare('SELECT * FROM producer_checkout_orders WHERE external_id = ? ORDER BY created_at DESC LIMIT 1').get(externalId)
  );
}

function updateProducerCheckoutOrder(id, patch={}){
  const row = db.prepare('SELECT * FROM producer_checkout_orders WHERE id = ?').get(id);
  if(!row) return null;
  const now = new Date().toISOString();
  const next = {
    status: patch.status !== undefined ? String(patch.status) : row.status,
    external_id: patch.externalId !== undefined ? (patch.externalId ? String(patch.externalId) : null) : row.external_id,
    checkout_url: patch.checkoutUrl !== undefined ? (patch.checkoutUrl ? String(patch.checkoutUrl) : null) : row.checkout_url,
    created_store_id: patch.createdStoreId !== undefined ? (patch.createdStoreId ? String(patch.createdStoreId) : null) : row.created_store_id,
    paid_at: patch.paidAt !== undefined ? patch.paidAt : row.paid_at,
    gateway: patch.gateway !== undefined ? String(patch.gateway) : row.gateway,
    method: patch.method !== undefined ? String(patch.method) : row.method,
    billing_cycle: patch.billingCycle !== undefined ? String(patch.billingCycle || 'monthly') : (row.billing_cycle || 'monthly'),
    installments: patch.installments !== undefined ? Math.max(1, Number(patch.installments) || 1) : row.installments,
    secondary_method: patch.secondaryMethod !== undefined ? String(patch.secondaryMethod || '') : row.secondary_method,
    secondary_amount_cents: patch.secondaryAmountCents !== undefined ? cents(patch.secondaryAmountCents) : row.secondary_amount_cents,
    payment_details_json: patch.paymentDetails !== undefined ? JSON.stringify(patch.paymentDetails || {}) : row.payment_details_json,
    updated_at: now,
    id
  };
  db.prepare(`UPDATE producer_checkout_orders SET
    status=@status, external_id=@external_id, checkout_url=@checkout_url,
    created_store_id=@created_store_id, paid_at=@paid_at, gateway=@gateway,
    method=@method, billing_cycle=@billing_cycle, installments=@installments, secondary_method=@secondary_method,
    secondary_amount_cents=@secondary_amount_cents,
    payment_details_json=@payment_details_json, updated_at=@updated_at
    WHERE id=@id`).run(next);
  return getProducerCheckoutOrderById(id);
}


/* ===== NOTIFICACOES POS-PAGAMENTO DO CHECKOUT DO PRODUTOR ===== */

function normalizeProducerNotificationChannel(channel){
  const value = String(channel || '').trim().toLowerCase();

  if(value !== 'email' && value !== 'whatsapp'){
    throw new Error('Canal de notificacao invalido.');
  }

  return value;
}

function readProducerPostPaymentNotifications(paymentDetails){
  const details =
    paymentDetails &&
    typeof paymentDetails === 'object' &&
    !Array.isArray(paymentDetails)
      ? { ...paymentDetails }
      : {};

  const current =
    details.postPaymentNotifications &&
    typeof details.postPaymentNotifications === 'object' &&
    !Array.isArray(details.postPaymentNotifications)
      ? { ...details.postPaymentNotifications }
      : {};

  return {
    details,
    notifications: current
  };
}

function claimProducerCheckoutActivationNotification(orderId, channel){
  const safeChannel =
    normalizeProducerNotificationChannel(channel);

  const claim = db.transaction(() => {
    const row = db.prepare(
      'SELECT * FROM producer_checkout_orders WHERE id = ?'
    ).get(orderId);

    if(!row){
      return {
        claimed:false,
        reason:'order_not_found'
      };
    }

    const order =
      producerCheckoutRowToView(row);

    if(order.status !== 'paid' || !order.createdStoreId){
      return {
        claimed:false,
        reason:'store_not_activated',
        order
      };
    }

    const {
      details,
      notifications
    } = readProducerPostPaymentNotifications(
      order.paymentDetails
    );

    const previous =
      notifications[safeChannel] &&
      typeof notifications[safeChannel] === 'object' &&
      !Array.isArray(notifications[safeChannel])
        ? { ...notifications[safeChannel] }
        : {};

    if(previous.status === 'sent' || previous.sentAt){
      return {
        claimed:false,
        reason:'already_sent',
        order
      };
    }

    if(previous.status === 'sending' && previous.claimedAt){
      const claimedAtMs =
        Date.parse(previous.claimedAt);

      if(
        Number.isFinite(claimedAtMs) &&
        Date.now() - claimedAtMs < 10 * 60 * 1000
      ){
        return {
          claimed:false,
          reason:'in_progress',
          order
        };
      }
    }

    // Evita novas tentativas a cada consulta de status/webhook.
    // Depois de uma falha, aguarda 30 minutos antes de tentar novamente.
    if(previous.status === 'failed' && previous.failedAt){
      const failedAtMs = Date.parse(previous.failedAt);
      const retryCooldownMs = 30 * 60 * 1000;

      if(
        Number.isFinite(failedAtMs) &&
        Date.now() - failedAtMs < retryCooldownMs
      ){
        return {
          claimed:false,
          reason:'retry_cooldown',
          retryAt:new Date(failedAtMs + retryCooldownMs).toISOString(),
          order
        };
      }
    }

    const now =
      new Date().toISOString();

    notifications[safeChannel] = {
      ...previous,
      status:'sending',
      claimedAt:now,
      attempts:
        Math.max(0, Number(previous.attempts || 0)) + 1,
      lastError:''
    };

    details.postPaymentNotifications =
      notifications;

    db.prepare(`
      UPDATE producer_checkout_orders
      SET payment_details_json = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(details),
      now,
      order.id
    );

    return {
      claimed:true,
      reason:'claimed',
      order:getProducerCheckoutOrderById(order.id)
    };
  });

  return claim.immediate();
}

function completeProducerCheckoutActivationNotification(
  orderId,
  channel,
  result={}
){
  const safeChannel =
    normalizeProducerNotificationChannel(channel);

  const complete = db.transaction(() => {
    const row = db.prepare(
      'SELECT * FROM producer_checkout_orders WHERE id = ?'
    ).get(orderId);

    if(!row){
      return {
        ok:false,
        reason:'order_not_found'
      };
    }

    const order =
      producerCheckoutRowToView(row);

    const {
      details,
      notifications
    } = readProducerPostPaymentNotifications(
      order.paymentDetails
    );

    const previous =
      notifications[safeChannel] &&
      typeof notifications[safeChannel] === 'object' &&
      !Array.isArray(notifications[safeChannel])
        ? { ...notifications[safeChannel] }
        : {};

    if(previous.status === 'sent' || previous.sentAt){
      return {
        ok:true,
        reused:true,
        order
      };
    }

    const now =
      new Date().toISOString();

    notifications[safeChannel] = {
      ...previous,
      status:'sent',
      sentAt:now,
      messageId:String(
        result.messageId ||
        previous.messageId ||
        ''
      ),
      lastError:''
    };

    details.postPaymentNotifications =
      notifications;

    db.prepare(`
      UPDATE producer_checkout_orders
      SET payment_details_json = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(details),
      now,
      order.id
    );

    return {
      ok:true,
      reused:false,
      order:getProducerCheckoutOrderById(order.id)
    };
  });

  return complete.immediate();
}

function failProducerCheckoutActivationNotification(
  orderId,
  channel,
  result={}
){
  const safeChannel =
    normalizeProducerNotificationChannel(channel);

  const fail = db.transaction(() => {
    const row = db.prepare(
      'SELECT * FROM producer_checkout_orders WHERE id = ?'
    ).get(orderId);

    if(!row){
      return {
        ok:false,
        reason:'order_not_found'
      };
    }

    const order =
      producerCheckoutRowToView(row);

    const {
      details,
      notifications
    } = readProducerPostPaymentNotifications(
      order.paymentDetails
    );

    const previous =
      notifications[safeChannel] &&
      typeof notifications[safeChannel] === 'object' &&
      !Array.isArray(notifications[safeChannel])
        ? { ...notifications[safeChannel] }
        : {};

    if(previous.status === 'sent' || previous.sentAt){
      return {
        ok:true,
        reused:true,
        order
      };
    }

    const now =
      new Date().toISOString();

    notifications[safeChannel] = {
      ...previous,
      status:'failed',
      failedAt:now,
      lastError:String(
        result.error ||
        'Falha no envio da notificacao.'
      ).slice(0, 1000)
    };

    details.postPaymentNotifications =
      notifications;

    db.prepare(`
      UPDATE producer_checkout_orders
      SET payment_details_json = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(details),
      now,
      order.id
    );

    return {
      ok:true,
      reused:false,
      order:getProducerCheckoutOrderById(order.id)
    };
  });

  return fail.immediate();
}


function activatePaidProducerCheckoutStore(orderId, baseUrl=''){
  const activate = db.transaction(()=>{
    const rawOrder =
      db.prepare(
        'SELECT * FROM producer_checkout_orders WHERE id = ?'
      ).get(orderId);

    if(!rawOrder){
      return {
        ok:false,
        code:'order_not_found'
      };
    }

    const order =
      producerCheckoutRowToView(rawOrder);

    if(order.status !== 'paid'){
      return {
        ok:false,
        code:'order_not_paid',
        order
      };
    }

    // Protecao contra Webhook repetido:
    // se a loja ja foi criada para este pedido,
    // apenas devolvemos a mesma loja.
    if(order.createdStoreId){
      return {
        ok:true,
        reused:true,
        store:getStoreById(
          order.createdStoreId,
          baseUrl
        ),
        order
      };
    }

    const paidDate =
      order.paidAt
        ? todayStr(new Date(order.paidAt))
        : todayStr();

    const billingCycle =
      order.billingCycle === 'annual'
        ? 'annual'
        : 'monthly';

    const expiresAt =
      addDays(
        paidDate,
        billingCycle === 'annual'
          ? 365
          : 30
      );

    const documentDigits =
      String(order.buyerCpfCnpj || '')
        .replace(/\D/g, '');

    // Senha interna aleatoria.
    // O cliente definira a senha definitiva
    // pelo fluxo seguro de primeiro acesso.
    const internalPassword =
      crypto.randomBytes(32)
        .toString('base64url');

    const store =
      createStore(
        {
          name:order.storeName,
          email:order.buyerEmail || '',
          phone:order.buyerPhone || '',
          cpf:
            documentDigits.length === 11
              ? order.buyerCpfCnpj
              : '',
          cnpj:
            documentDigits.length === 14
              ? order.buyerCpfCnpj
              : '',
          contractDate:paidDate,
          licenseStartDate:paidDate,
          contractValueCents:
            Number(order.amountCents || 0),
          contractStatus:'ativo',
          login:
            order.buyerEmail ||
            'admin',
          password:internalPassword,
          status:'ativo',
          plan:order.plan || 'premium',
          billingCycle,
          expiresAt,
          amountCents:
            Number(order.amountCents || 0),

          // O pagamento inicial ja foi confirmado
          // pelo Mercado Pago.
          createInitialPayment:false
        },
        baseUrl
      );

    if(!store?.id){
      throw new Error(
        'Loja nao foi criada para o checkout pago.'
      );
    }

    // Mesmo com senha interna aleatoria,
    // mantemos a protecao de primeiro acesso ativa.
    db.prepare(
      `UPDATE stores
       SET force_password_change = 1,
           updated_at = ?
       WHERE id = ?`
    ).run(
      new Date().toISOString(),
      store.id
    );

    const paymentExternalId =
      String(
        order.paymentDetails
          ?.mercadoPagoPaymentId ||
        order.externalId ||
        ''
      );

    createPayment({
      storeId:store.id,
      gateway:'mercadopago',
      method:order.method || 'pix',
      kind:'subscription',
      amountCents:
        Number(order.amountCents || 0),
      currency:order.currency || 'BRL',
      status:'paid',
      dueAt:paidDate,
      paidAt:
        order.paidAt ||
        new Date().toISOString(),
      externalId:paymentExternalId,
      notes:
        'Assinatura inicial paga pelo checkout do Produtor.'
    });

    const paymentDetails = {
      ...(order.paymentDetails || {}),
      storeActivatedAt:
        new Date().toISOString(),
      storeActivationSource:
        'mercadopago_producer_checkout',
      firstAccessRequired:true
    };

    const updatedOrder =
      updateProducerCheckoutOrder(
        order.id,
        {
          createdStoreId:store.id,
          paymentDetails
        }
      );

    return {
      ok:true,
      reused:false,
      store:getStoreById(
        store.id,
        baseUrl
      ),
      order:updatedOrder
    };
  });

  return activate.immediate();
}

function customerOrderRowToView(row){
  if(!row) return null;
  let items = [];
  try{
    const parsed = JSON.parse(row.items_json || '[]');
    items = Array.isArray(parsed) ? parsed : [];
  }catch(e){}
  return {
    id: row.id,
    checkoutToken: row.checkout_token,
    storeId: row.store_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email || '',
    customerPhone: row.customer_phone || '',
    items,
    amountCents: row.amount_cents,
    currency: row.currency,
    gateway: row.gateway,
    method: row.method,
    status: row.status,
    externalId: row.external_id || '',
    checkoutUrl: row.checkout_url || '',
    installments: row.installments || 1,
    secondaryMethod: row.secondary_method || '',
    secondaryAmountCents: row.secondary_amount_cents || 0,
    paymentDetails: safeJsonObject(row.payment_details_json),
    paidAt: row.paid_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || ''
  };
}

function createCustomerOrder(payload={}){
  const id = nanoid();
  const now = new Date().toISOString();
  const checkoutToken = String(payload.checkoutToken || (nanoid()+nanoid()));
  db.prepare(`INSERT INTO customer_orders (
    id,checkout_token,store_id,customer_name,customer_email,customer_phone,
    items_json,amount_cents,currency,gateway,method,status,external_id,checkout_url,
    paid_at,created_at,updated_at,installments,secondary_method,
    secondary_amount_cents,payment_details_json
  ) VALUES (
    @id,@checkout_token,@store_id,@customer_name,@customer_email,@customer_phone,
    @items_json,@amount_cents,@currency,@gateway,@method,@status,@external_id,@checkout_url,
    @paid_at,@created_at,@updated_at,@installments,@secondary_method,
    @secondary_amount_cents,@payment_details_json
  )`).run({
    id,
    checkout_token: checkoutToken,
    store_id: String(payload.storeId || ''),
    customer_name: String(payload.customerName || '').trim(),
    customer_email: String(payload.customerEmail || '').trim(),
    customer_phone: String(payload.customerPhone || '').trim(),
    items_json: JSON.stringify(Array.isArray(payload.items) ? payload.items : []),
    amount_cents: cents(payload.amountCents),
    currency: String(payload.currency || 'BRL'),
    gateway: String(payload.gateway || 'test'),
    method: String(payload.method || 'pix'),
    status: String(payload.status || 'pending'),
    external_id: payload.externalId ? String(payload.externalId) : null,
    checkout_url: payload.checkoutUrl ? String(payload.checkoutUrl) : null,
    paid_at: payload.paidAt || null,
    created_at: now,
    updated_at: now,
    installments: Math.max(1, Number(payload.installments || 1) || 1),
    secondary_method: String(payload.secondaryMethod || ''),
    secondary_amount_cents: cents(payload.secondaryAmountCents),
    payment_details_json: JSON.stringify(payload.paymentDetails || {})
  });
  return customerOrderRowToView(
    db.prepare('SELECT * FROM customer_orders WHERE id = ?').get(id)
  );
}

function getCustomerOrderById(id){
  return customerOrderRowToView(
    db.prepare('SELECT * FROM customer_orders WHERE id = ?').get(id)
  );
}

function getCustomerOrderByToken(token){
  return customerOrderRowToView(
    db.prepare('SELECT * FROM customer_orders WHERE checkout_token = ?').get(token)
  );
}

function getCustomerOrderByExternalId(externalId){
  return customerOrderRowToView(
    db.prepare('SELECT * FROM customer_orders WHERE external_id = ? ORDER BY created_at DESC LIMIT 1').get(externalId)
  );
}

function updateCustomerOrder(id, patch={}){
  const row = db.prepare('SELECT * FROM customer_orders WHERE id = ?').get(id);
  if(!row) return null;
  const now = new Date().toISOString();
  const next = {
    status: patch.status !== undefined ? String(patch.status) : row.status,
    external_id: patch.externalId !== undefined ? (patch.externalId ? String(patch.externalId) : null) : row.external_id,
    checkout_url: patch.checkoutUrl !== undefined ? (patch.checkoutUrl ? String(patch.checkoutUrl) : null) : row.checkout_url,
    paid_at: patch.paidAt !== undefined ? patch.paidAt : row.paid_at,
    gateway: patch.gateway !== undefined ? String(patch.gateway) : row.gateway,
    method: patch.method !== undefined ? String(patch.method) : row.method,
    installments: patch.installments !== undefined ? Math.max(1, Number(patch.installments) || 1) : row.installments,
    secondary_method: patch.secondaryMethod !== undefined ? String(patch.secondaryMethod || '') : row.secondary_method,
    secondary_amount_cents: patch.secondaryAmountCents !== undefined ? cents(patch.secondaryAmountCents) : row.secondary_amount_cents,
    payment_details_json: patch.paymentDetails !== undefined ? JSON.stringify(patch.paymentDetails || {}) : row.payment_details_json,
    updated_at: now,
    id
  };
  db.prepare(`UPDATE customer_orders SET
    status=@status, external_id=@external_id, checkout_url=@checkout_url,
    paid_at=@paid_at, gateway=@gateway, method=@method, installments=@installments,
    secondary_method=@secondary_method, secondary_amount_cents=@secondary_amount_cents,
    payment_details_json=@payment_details_json, updated_at=@updated_at
    WHERE id=@id`).run(next);
  return getCustomerOrderById(id);
}

function listCustomerOrdersByStore(storeId){
  return db.prepare(
    'SELECT * FROM customer_orders WHERE store_id = ? ORDER BY created_at DESC'
  ).all(storeId).map(customerOrderRowToView);
}
function getFinanceSummary(){
  const sum = (status) => db.prepare('SELECT COALESCE(SUM(amount_cents),0) t FROM payments WHERE status = ?').get(status).t || 0;
  const paid = sum('paid'); const pending = sum('pending'); const overdue = sum('overdue');
  const counts = db.prepare(`SELECT 
    COUNT(*) totalStores,
    SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) activeStores,
    SUM(CASE WHEN status = 'inativo' THEN 1 ELSE 0 END) inactiveStores
    FROM stores`).get();
  const thisMonth = db.prepare("SELECT COALESCE(SUM(amount_cents),0) t FROM payments WHERE status = 'paid' AND substr(COALESCE(paid_at, created_at),1,7)=substr(date('now'),1,7)").get().t || 0;
  return {
    totalStores: counts.totalStores || 0,
    activeStores: counts.activeStores || 0,
    inactiveStores: counts.inactiveStores || 0,
    paidCents: paid, pendingCents: pending, overdueCents: overdue, monthPaidCents: thisMonth,
    paid: (paid/100).toFixed(2), pending:(pending/100).toFixed(2), overdue:(overdue/100).toFixed(2), monthPaid:(thisMonth/100).toFixed(2)
  };
}
function getFinanceChart(months = 6){
  const labels = []; const paid = []; const pending = []; const overdue = []; const now = new Date();
  for(let i = months - 1; i >= 0; i--){
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0,7);
    labels.push(d.toLocaleDateString('pt-BR',{month:'short', year:'2-digit'}));
    paid.push((db.prepare("SELECT COALESCE(SUM(amount_cents),0) t FROM payments WHERE status='paid' AND substr(COALESCE(paid_at, created_at),1,7)=?").get(key).t || 0)/100);
    pending.push((db.prepare("SELECT COALESCE(SUM(amount_cents),0) t FROM payments WHERE status='pending' AND substr(COALESCE(due_at, created_at),1,7)=?").get(key).t || 0)/100);
    overdue.push((db.prepare("SELECT COALESCE(SUM(amount_cents),0) t FROM payments WHERE status='overdue' AND substr(COALESCE(due_at, created_at),1,7)=?").get(key).t || 0)/100);
  }
  return { labels, paid, pending, overdue };
}

function currentAiPeriod(){
  return new Date().toISOString().slice(0, 7);
}

function getAiUsageMonthly(storeId, period = currentAiPeriod()){
  const safeStoreId = String(storeId || '').trim();
  const safePeriod = String(period || currentAiPeriod()).trim().slice(0, 7);

  if(!safeStoreId){
    return {
      storeId:'',
      period:safePeriod,
      requests:0,
      inputTokens:0,
      outputTokens:0,
      totalTokens:0
    };
  }

  const row = db.prepare(`
    SELECT
      store_id,
      period,
      requests,
      input_tokens,
      output_tokens,
      total_tokens,
      updated_at
    FROM ai_usage_monthly
    WHERE store_id = ? AND period = ?
  `).get(safeStoreId, safePeriod);

  if(!row){
    return {
      storeId:safeStoreId,
      period:safePeriod,
      requests:0,
      inputTokens:0,
      outputTokens:0,
      totalTokens:0,
      updatedAt:''
    };
  }

  return {
    storeId:row.store_id,
    period:row.period,
    requests:Number(row.requests || 0),
    inputTokens:Number(row.input_tokens || 0),
    outputTokens:Number(row.output_tokens || 0),
    totalTokens:Number(row.total_tokens || 0),
    updatedAt:row.updated_at || ''
  };
}

function recordAiUsage(
  storeId,
  {
    period = currentAiPeriod(),
    requests = 1,
    inputTokens = 0,
    outputTokens = 0,
    totalTokens
  } = {}
){
  const safeStoreId = String(storeId || '').trim();

  if(!safeStoreId){
    throw new Error('storeId obrigatorio para registrar consumo da IA.');
  }

  const safePeriod = String(period || currentAiPeriod()).trim().slice(0, 7);
  const safeRequests = Math.max(0, Math.trunc(Number(requests) || 0));
  const safeInput = Math.max(0, Math.trunc(Number(inputTokens) || 0));
  const safeOutput = Math.max(0, Math.trunc(Number(outputTokens) || 0));
  const safeTotal = Math.max(
    0,
    Math.trunc(
      totalTokens !== undefined
        ? Number(totalTokens) || 0
        : safeInput + safeOutput
    )
  );

  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO ai_usage_monthly (
      store_id,
      period,
      requests,
      input_tokens,
      output_tokens,
      total_tokens,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)

    ON CONFLICT(store_id, period)
    DO UPDATE SET
      requests = requests + excluded.requests,
      input_tokens = input_tokens + excluded.input_tokens,
      output_tokens = output_tokens + excluded.output_tokens,
      total_tokens = total_tokens + excluded.total_tokens,
      updated_at = excluded.updated_at
  `).run(
    safeStoreId,
    safePeriod,
    safeRequests,
    safeInput,
    safeOutput,
    safeTotal,
    now
  );

  return getAiUsageMonthly(safeStoreId, safePeriod);
}

function ensureSeedStore(){
  const count = db.prepare('SELECT COUNT(*) c FROM stores').get().c;
  if (!count && process.env.SEED_DEMO_STORE === 'true') {
    createStore({ name:'Sua Loja', slug:'sua-loja', login:'admin', password:process.env.SEED_DEMO_PASSWORD || crypto.randomBytes(12).toString('base64url'), sub:'Dashboard Integrado Multi-Loja' });
  }
}
// ===== FUNCOES DOS PLANOS EDITAVEIS DO PRODUTOR =====
function producerPlanRowToView(row){
  if(!row) return null;
  return {
    id: row.id,
    name: row.name,
    monthlyAmountCents: Number(row.monthly_amount_cents || 0),
    annualAmountCents: Number(row.annual_amount_cents || 0),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function listProducerPlans(){
  return db.prepare(
    'SELECT * FROM producer_plans ORDER BY sort_order ASC, id ASC'
  ).all().map(producerPlanRowToView);
}

function getProducerPlan(id){
  const row = db.prepare(
    'SELECT * FROM producer_plans WHERE id = ?'
  ).get(String(id || '').trim().toLowerCase());
  return producerPlanRowToView(row);
}

function updateProducerPlan(id, payload={}){
  const planId = String(id || '').trim().toLowerCase();
  const row = db.prepare(
    'SELECT * FROM producer_plans WHERE id = ?'
  ).get(planId);

  if(!row) return null;

  const monthlyAmountCents =
    payload.monthlyAmountCents !== undefined
      ? cents(payload.monthlyAmountCents)
      : Number(row.monthly_amount_cents || 0);

  const annualAmountCents =
    payload.annualAmountCents !== undefined
      ? cents(payload.annualAmountCents)
      : Number(row.annual_amount_cents || 0);

  const active =
    payload.active !== undefined
      ? (payload.active ? 1 : 0)
      : Number(row.active || 0);

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE producer_plans
    SET monthly_amount_cents = ?,
        annual_amount_cents = ?,
        active = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    monthlyAmountCents,
    annualAmountCents,
    active,
    now,
    planId
  );

  return getProducerPlan(planId);
}

ensureSeedStore();
module.exports = { db, slugify, uniqueSlug, listStores, getStoreById, getStoreBySlug, getStoreRowById, getStoreRowBySlug, createStore, updateStore, setStorePassword, deleteStore, verifyStoreLogin, licenseStatus: rawLicenseStatus, generateLicenseKey, createPayment, listPayments, updatePaymentStatus, createProducerCheckoutOrder, getProducerCheckoutOrderById, getProducerCheckoutOrderByToken, getProducerCheckoutOrderByExternalId, updateProducerCheckoutOrder, claimProducerCheckoutActivationNotification, completeProducerCheckoutActivationNotification, failProducerCheckoutActivationNotification, activatePaidProducerCheckoutStore, createCustomerOrder, getCustomerOrderById, getCustomerOrderByToken, getCustomerOrderByExternalId, updateCustomerOrder, listCustomerOrdersByStore, listProducerPlans, getProducerPlan, updateProducerPlan, getFinanceSummary, getFinanceChart, syncStoreLicense, currentAiPeriod, getAiUsageMonthly, recordAiUsage };
