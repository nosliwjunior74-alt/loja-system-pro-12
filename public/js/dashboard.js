const buttons = document.querySelectorAll('.menu-btn');
const frame = document.getElementById('appFrame');
const title = document.getElementById('currentTitle');
const topbarSub = document.getElementById('topbarSub');
function activateButtonForUrl(url){ buttons.forEach(b => b.classList.toggle('active', b.dataset.url === url)); }
buttons.forEach(btn => { btn.addEventListener('click', () => { activateButtonForUrl(btn.dataset.url); frame.src = btn.dataset.url; title.textContent = btn.textContent.trim(); }); });
window.addEventListener('message', (ev) => { if (ev?.data?.type === 'set-title' && ev.data.title) title.textContent = ev.data.title; if (ev?.data?.type === 'set-subtitle' && ev.data.subtitle && topbarSub) topbarSub.textContent = ev.data.subtitle; if (ev?.data?.type === 'branding-updated') { frame.contentWindow?.location?.reload?.(); window.location.reload(); } if (ev?.data?.type === 'open-url' && ev.data.url) { frame.src = ev.data.url; activateButtonForUrl(ev.data.url); } });
const logoutBtn = document.getElementById('logoutAdminBtn'); if (logoutBtn) { logoutBtn.addEventListener('click', async () => { try{ await fetch('/api/admin/logout', { method: 'POST' }); location.href = '/admin-login.html'; } catch(e){ alert('Modo local: não há sessão online para encerrar.'); } }); }
