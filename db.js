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
  `);
}
ensureTables();
function maybeAddColumn(table, column, typeDef){
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
  if(!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
}
maybeAddColumn('stores','custom_domain','TEXT');
maybeAddColumn('payments','notes','TEXT');
maybeAddColumn('payments','whatsapp_sent_at','TEXT');
maybeAddColumn('payments','whatsapp_message_id','TEXT');
maybeAddColumn('payments','reminders_count','INTEGER DEFAULT 0');
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
    email: synced.email || '', phone: synced.phone || '', login: synced.login, status: synced.status, plan: synced.plan || 'premium', expiresAt: synced.expires_at || '',
    licenseKey: synced.license_key || '', customDomain: synced.custom_domain || '', createdAt: synced.created_at, updatedAt: synced.updated_at || '',
  };
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
function getStoreById(id, baseUrl=''){ return rowToStore(db.prepare('SELECT * FROM stores WHERE id = ?').get(id), baseUrl); }
function getStoreBySlug(slug, baseUrl=''){ return rowToStore(db.prepare('SELECT * FROM stores WHERE slug = ?').get(slug), baseUrl); }
function getStoreRowBySlug(slug){ const row = db.prepare('SELECT * FROM stores WHERE slug = ?').get(slug); return row ? (syncStoreLicense(row.id), db.prepare('SELECT * FROM stores WHERE id = ?').get(row.id)) : null; }
function getStoreRowById(id){ const row = db.prepare('SELECT * FROM stores WHERE id = ?').get(id); return row ? (syncStoreLicense(row.id), db.prepare('SELECT * FROM stores WHERE id = ?').get(row.id)) : null; }
function createStore(payload, baseUrl=''){
  const id = nanoid(); const now = new Date().toISOString(); const slug = uniqueSlug(payload.slug || payload.name || 'loja');
  const expiresAt = payload.expiresAt || addDays(todayStr(), 30); const licenseKey = generateLicenseKey(id, slug, expiresAt);
  db.prepare(`INSERT INTO stores (id,slug,name,sub,color,logo,email,phone,login,password_hash,status,plan,expires_at,license_key,custom_domain,created_at,updated_at)
  VALUES (@id,@slug,@name,@sub,@color,@logo,@email,@phone,@login,@password_hash,@status,@plan,@expires_at,@license_key,@custom_domain,@created_at,@updated_at)`).run({
    id, slug, name: payload.name || 'Sua Loja', sub: payload.sub || 'Dashboard Integrado Multi-Loja', color: payload.color || '#e33d8f', logo: payload.logo || 'assets/default-logo.svg',
    email: payload.email || '', phone: payload.phone || '', login: payload.login || 'admin', password_hash: hashPassword(payload.password || crypto.randomBytes(12).toString('base64url')),
    status: payload.status === 'inativo' ? 'inativo' : (payload.status === 'degustacao' ? 'degustacao' : 'ativo'), plan: payload.plan || 'premium', expires_at: expiresAt || null, license_key: licenseKey,
    custom_domain: payload.customDomain || '', created_at: now, updated_at: now
  });
  createPayment({storeId:id, gateway:'manual', method:'pix', kind:'subscription', amountCents:cents(payload.amountCents || 9900), status:'pending', dueAt: payload.initialDueAt || todayStr(), notes:'Cobrança inicial automática'});
  return getStoreById(id, baseUrl);
}
function updateStore(id, payload, baseUrl=''){
  const current = getStoreRowById(id); if (!current) return null;
  const slug = uniqueSlug(payload.slug || current.slug || current.name, id);
  const expiresAt = payload.expiresAt !== undefined ? payload.expiresAt : (current.expires_at || '');
  const licenseKey = generateLicenseKey(id, slug, expiresAt);
  const passwordHash = payload.password ? hashPassword(payload.password) : current.password_hash;
  db.prepare(`UPDATE stores SET slug=@slug,name=@name,sub=@sub,color=@color,logo=@logo,email=@email,phone=@phone,login=@login,password_hash=@password_hash,status=@status,plan=@plan,expires_at=@expires_at,license_key=@license_key,custom_domain=@custom_domain,updated_at=@updated_at WHERE id=@id`).run({
    id, slug, name: payload.name ?? current.name, sub: payload.sub ?? current.sub, color: payload.color ?? current.color, logo: payload.logo ?? current.logo,
    email: payload.email ?? current.email, phone: payload.phone ?? current.phone, login: payload.login ?? current.login, password_hash: passwordHash,
    status: payload.status === 'inativo' ? 'inativo' : (payload.status === 'degustacao' ? 'degustacao' : (payload.status ?? current.status)), plan: payload.plan ?? current.plan,
    expires_at: expiresAt || null, license_key: licenseKey, custom_domain: payload.customDomain ?? current.custom_domain, updated_at: new Date().toISOString()
  });
  return getStoreById(id, baseUrl);
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
function ensureSeedStore(){
  const count = db.prepare('SELECT COUNT(*) c FROM stores').get().c;
  if (!count && process.env.SEED_DEMO_STORE === 'true') {
    createStore({ name:'Sua Loja', slug:'sua-loja', login:'admin', password:process.env.SEED_DEMO_PASSWORD || crypto.randomBytes(12).toString('base64url'), sub:'Dashboard Integrado Multi-Loja' });
  }
}
ensureSeedStore();
module.exports = { db, slugify, uniqueSlug, listStores, getStoreById, getStoreBySlug, getStoreRowById, getStoreRowBySlug, createStore, updateStore, deleteStore, verifyStoreLogin, licenseStatus: rawLicenseStatus, generateLicenseKey, createPayment, listPayments, updatePaymentStatus, getFinanceSummary, getFinanceChart, syncStoreLicense };
