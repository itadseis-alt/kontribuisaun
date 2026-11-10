/* Sistema Kontribuisaun F-FDTL — v2 (servidor sentrál Supabase)
 * - Ema hotu bele HAREE (dashboard, lista, relatóriu) maski la iha konta
 * - Konta (kria husi admin) mak bele REJISTA / EDITA
 * - La iha internet: rejistu rai iha telefone (fila) no haruka automátiku depois
 */
'use strict';
const APP_VER = '2.0.0';
const POSTU = ["Alferes", "SubTen", "Ten", "2º Ten", "Capitão", "1º Ten", "Major", "Cap. Ten",
  "Ten. Coronel", "Cap. Fragata", "Coronel", "Cap. Mar-e-Guerra", "Brig. General", "Comodoro",
  "Maj. General", "Contra-Almirante", "Ten. General"];
const PELOTAUN = ["1º Pelotaun", "2º Pelotaun", "3º Pelotaun"];
const TIPU = ["Lia Mate", "Kazamento", "Dezastre", "Seluk"];
const COMP = ["QG", "CFT", "CFN", "FAG", "CAL", "Seluk"];
const K_CACHE = 'kontrib_ffdtl_cache_v2';     // kópia lokal husi servidor (atu haree offline)
const K_FILA = 'kontrib_ffdtl_fila_v2';       // operasaun pendente (offline)
const K_CFG = 'kontrib_ffdtl_cfg_v2';
const K_V1 = 'kontrib_ffdtl_rejistu_v1';      // dadus versaun antigu (1.x) iha telefone
const CAMPU = ['id', 'data', 'naran', 'postu', 'pelotaun', 'comp', 'tipu', 'ba_se', 'kuantidade', 'obs', 'operador', 'dispozitivu', 'kria_iha'];

// ------------------------------------------------------------ Armazenamentu lokal
const $ = id => document.getElementById(id);
function leJSON(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function graJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
const cache0 = leJSON(K_CACHE, {});
let SERV = Array.isArray(cache0.rejistu) ? cache0.rejistu : [];   // dadus servidor
let ULTIMA_SYNC = cache0.atualiza_iha || '';
let FILA = leJSON(K_FILA, []);                                     // [{op, rec|id, t}]
let FALHA = [];                                                    // operasaun ne'ebé servidor rejeita
let DB = [];                                                       // SERV + FILA (hatudu)
let CFG = Object.assign({ dispozitivu: '', perfil: null }, leJSON(K_CFG, {}));
if (!CFG.dispozitivu) CFG.dispozitivu = 'TLF-' + Math.random().toString(36).slice(2, 7).toUpperCase();
const gravaCfg = () => graJSON(K_CFG, CFG); gravaCfg();
const gravaFila = () => graJSON(K_FILA, FILA);
const gravaCache = () => graJSON(K_CACHE, { rejistu: SERV, atualiza_iha: ULTIMA_SYNC });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });

function kalkulaDB() {
  const m = new Map(SERV.map(r => [r.id, r]));
  for (const o of FILA) {
    if (o.op === 'insert') m.set(o.rec.id, { ...o.rec, _pendente: true });
    else if (o.op === 'update') m.set(o.rec.id, { ...(m.get(o.rec.id) || {}), ...o.rec, _pendente: true });
    else if (o.op === 'delete') m.delete(o.id);
  }
  DB = [...m.values()];
}
kalkulaDB();

// ------------------------------------------------------------ Utilidade
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = v => '$ ' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const limpa = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const chave = s => limpa(s).toLowerCase();
const ohin = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const dataBR = iso => iso ? iso.split('-').reverse().join('/') : '';
const agoraTxt = () => new Date().toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
const oraTxt = iso => iso ? new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '-';
const carimbu = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };
function toast(msg, ms = 2800) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, ms); }
function opsaun(sel, lista, primeiru) {
  sel.innerHTML = (primeiru ? `<option value="">${esc(primeiru)}</option>` : '') + lista.map(v => `<option>${esc(v)}</option>`).join('');
}

// ------------------------------------------------------------ Servidor (Supabase)
const KONFIG = window.KONFIG || {};
const KONFIGURADU = !!(KONFIG.SUPABASE_URL && KONFIG.SUPABASE_ANON_KEY && !/XXXX/.test(KONFIG.SUPABASE_URL) && !/COLE_AQUI/.test(KONFIG.SUPABASE_ANON_KEY));
const sb = KONFIGURADU && window.supabase ? window.supabase.createClient(KONFIG.SUPABASE_URL, KONFIG.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kontrib_ffdtl_auth' } }) : null;
let SESAUN = null;   // { user, perfil }
const eAtivu = () => !!(SESAUN && SESAUN.perfil && SESAUN.perfil.ativu);
const eAdmin = () => eAtivu() && SESAUN.perfil.role === 'admin';
const meuId = () => SESAUN ? SESAUN.user.id : null;
const nomeOperador = () => SESAUN ? (SESAUN.perfil.naran || SESAUN.perfil.username) : '';
const podeEdita = r => eAtivu() && (eAdmin() || r.kria_husi === meuId());
const eRede = err => !navigator.onLine || /fetch|network|Load failed|timeout|NetworkError/i.test(String(err && (err.message || err)));
const msgErru = err => {
  const m = String(err && (err.message || err) || '');
  if (/row-level security|permission denied/i.test(m)) return 'La iha permisaun (konta la ativu?).';
  if (/JWT|token/i.test(m)) return 'Sesaun remata. Halo login fali.';
  return m;
};


// ------------------------------------------------------------ Navegasaun
let viewAtual = 'dash';
function hatudu(v) {
  if (v === 'form' && !eAtivu()) { toast('Presiza login atu rejista.'); v = 'konta'; }
  viewAtual = v;
  document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== 'v-' + v);
  document.querySelectorAll('.bottom button').forEach(b => b.classList.toggle('ativu', b.dataset.v === v));
  window.scrollTo(0, 0);
  render();
}
document.querySelectorAll('.bottom button').forEach(b => b.addEventListener('click', () => hatudu(b.dataset.v)));

// ------------------------------------------------------------ Filtru
const F = { tipu: '', ba_se: '', pelotaun: '', postu: '', comp: '', hosi: '', too: '' };
function filtra(lista) {
  return lista.filter(r =>
    (!F.tipu || r.tipu === F.tipu) && (!F.ba_se || r.ba_se === F.ba_se) &&
    (!F.pelotaun || r.pelotaun === F.pelotaun) && (!F.postu || r.postu === F.postu) &&
    (!F.comp || (F.comp === 'La iha' ? !r.comp : r.comp === F.comp)) &&
    (!F.hosi || (r.data && r.data >= F.hosi)) && (!F.too || (r.data && r.data <= F.too)));
}
function filtruTxt() {
  const p = [];
  if (F.tipu) p.push('Tipu: ' + F.tipu); if (F.ba_se) p.push('Ba se: ' + F.ba_se);
  if (F.pelotaun) p.push('Pelotaun: ' + F.pelotaun); if (F.postu) p.push('Postu: ' + F.postu);
  if (F.comp) p.push('Comp/Unidade: ' + F.comp);
  if (F.hosi) p.push('Hosi: ' + dataBR(F.hosi)); if (F.too) p.push('Too: ' + dataBR(F.too));
  return p.length ? p.join(' | ') : 'Dadus hotu (la iha filtru)';
}
[['fTipu', 'tipu'], ['fBaSe', 'ba_se'], ['fPel', 'pelotaun'], ['fPostu', 'postu'], ['fComp', 'comp'], ['fHosi', 'hosi'], ['fToo', 'too']]
  .forEach(([id, k]) => $(id).addEventListener('change', e => { F[k] = e.target.value; render(); }));
$('fLimpa').addEventListener('click', () => { Object.keys(F).forEach(k => F[k] = ''); enxeFiltru(); render(); });

const baSeLista = () => [...new Set(DB.map(r => r.ba_se).filter(Boolean))].sort((a, b) => a.localeCompare(b));
const naranLista = () => [...new Set(DB.map(r => r.naran).filter(Boolean))].sort((a, b) => a.localeCompare(b));
function enxeFiltru() {
  opsaun($('fTipu'), TIPU, 'Hotu'); opsaun($('fBaSe'), baSeLista(), 'Hotu');
  opsaun($('fPel'), PELOTAUN, 'Hotu'); opsaun($('fPostu'), POSTU, 'Hotu');
  opsaun($('fComp'), DB.some(r => !r.comp) ? [...COMP, 'La iha'] : COMP, 'Hotu');
  $('fTipu').value = F.tipu; $('fBaSe').value = F.ba_se; $('fPel').value = F.pelotaun;
  $('fPostu').value = F.postu; $('fComp').value = F.comp; $('fHosi').value = F.hosi; $('fToo').value = F.too;
}

// ------------------------------------------------------------ Estatístika
function estatistika(regs) {
  const est = { total: 0, n: regs.length, tipu: {}, pel: {}, postu: {}, comp: {}, baSe: {}, ema: {} };
  TIPU.forEach(t => est.tipu[t] = { total: 0, n: 0 });
  PELOTAUN.forEach(p => est.pel[p] = { total: 0, n: 0 });
  COMP.forEach(c => est.comp[c] = { total: 0, n: 0 });
  for (const r of regs) {
    const v = Number(r.kuantidade) || 0;
    est.total += v;
    const add = (obj, k) => { obj[k] = obj[k] || { total: 0, n: 0 }; obj[k].total += v; obj[k].n++; };
    add(est.tipu, r.tipu || 'Seluk'); add(est.pel, r.pelotaun || 'La iha');
    add(est.postu, r.postu || 'La iha'); add(est.baSe, r.ba_se || '-'); add(est.comp, r.comp || 'La iha');
    const k = chave(r.naran);
    if (!est.ema[k]) est.ema[k] = { naran: limpa(r.naran), postu: r.postu || '', pelotaun: r.pelotaun || '', comp: r.comp || '', total: 0, n: 0, tipu: Object.fromEntries(TIPU.map(t => [t, 0])) };
    const e = est.ema[k]; e.total += v; e.n++; e.tipu[r.tipu] = (e.tipu[r.tipu] || 0) + v;
  }
  est.listaEma = Object.values(est.ema).sort((a, b) => b.total - a.total || a.naran.localeCompare(b.naran));
  est.listaEma.forEach((e, i) => e.rank = i + 1);
  est.listaBaSe = Object.entries(est.baSe).map(([k, v]) => ({ ba_se: k, ...v })).sort((a, b) => b.total - a.total);
  est.listaPostu = Object.entries(est.postu).map(([k, v]) => ({ postu: k, ...v }))
    .sort((a, b) => (POSTU.indexOf(a.postu) + 1 || 99) - (POSTU.indexOf(b.postu) + 1 || 99));
  est.nEma = est.listaEma.length;
  est.media = est.nEma ? est.total / est.nEma : 0;
  return est;
}
function barras(itens, total) {
  if (!itens.length || !total) return '<div class="vaziu">Seidauk iha dadus.</div>';
  const max = Math.max(...itens.map(i => i.total), 1);
  return itens.map(i => `<div class="bar-row"><div class="lin"><span>${esc(i.label)}</span><b>${usd(i.total)}</b></div>
    <div class="trilu"><i style="width:${(100 * i.total / max).toFixed(1)}%"></i></div>
    <div class="sub">${i.n} rejistu · ${(100 * i.total / total).toFixed(1)}%</div></div>`).join('');
}

// ------------------------------------------------------------ DASHBOARD
function renderDash() {
  enxeFiltru();
  const est = estatistika(filtra(DB));
  $('filtruResumu').textContent = Object.values(F).some(Boolean) ? '· ' + filtruTxt() : '';
  $('kTotal').textContent = usd(est.total);
  $('kRej').textContent = `${est.n} rejistu`;
  $('kEma').textContent = est.nEma;
  $('kMedia').textContent = usd(est.media);
  $('kBaSe').textContent = est.listaBaSe.length;
  $('dTipu').innerHTML = barras(TIPU.map(t => ({ label: t, ...est.tipu[t] })), est.total);
  $('dBaSe').innerHTML = barras(est.listaBaSe.map(b => ({ label: b.ba_se, ...b })), est.total);
  $('dComp').innerHTML = barras(Object.entries(est.comp).filter(([k, v]) => COMP.includes(k) || v.n).map(([k, v]) => ({ label: k, ...v })), est.total);
  $('dPel').innerHTML = barras(Object.entries(est.pel).map(([k, v]) => ({ label: k, ...v })), est.total);
  $('dTop').innerHTML = barras(est.listaEma.slice(0, 10).map(e => ({ label: `${e.rank}. ${e.postu} ${e.naran}`, ...e })), est.total);
  $('dPostu').innerHTML = barras(est.listaPostu.filter(p => p.total > 0).map(p => ({ label: p.postu, ...p })), est.total);
  $('dEmaN').textContent = `(${est.nEma} membru)`;
  const q = chave($('emaBuka').value);
  const lst = est.listaEma.filter(e => !q || e.naran.toLowerCase().includes(q));
  $('dEma').innerHTML = lst.length ? `<table><thead><tr><th>#</th><th>Naran</th><th class="num">Rej.</th><th class="num">Total</th></tr></thead><tbody>${lst.map(e =>
    `<tr><td>${e.rank}</td><td>${esc(e.naran)}<div class="mini">${esc(e.postu)} · ${esc(e.comp || '-')} · ${esc(e.pelotaun)}</div></td><td class="num">${e.n}</td><td class="num"><b>${usd(e.total)}</b></td></tr>`).join('')}</tbody></table>`
    : '<div class="vaziu">La iha dadus.</div>';
}
$('emaBuka').addEventListener('input', renderDash);


// ------------------------------------------------------------ FORMULÁRIU
let editaId = null;
opsaun($('iPostu'), POSTU, '— Hili Postu —');
opsaun($('iPel'), PELOTAUN, '— Hili Pelotaun —');
opsaun($('iTipu'), TIPU, '— Hili Tipu —');
opsaun($('iComp'), COMP, '— Hili Comp/Unidade —');
$('iData').value = ohin();

function renderForm() {
  $('lNaran').innerHTML = naranLista().map(n => `<option value="${esc(n)}">`).join('');
  $('lBaSe').innerHTML = baSeLista().map(n => `<option value="${esc(n)}">`).join('');
  const ikus = DB.filter(r => r.kria_husi === meuId()).sort((a, b) => (b.kria_iha || '').localeCompare(a.kria_iha || '')).slice(0, 8);
  $('formIkus').innerHTML = ikus.length ? ikus.map(itemHTML).join('') : '<div class="vaziu">Seidauk iha rejistu.</div>';
  ligaItem($('formIkus'));
}
$('iNaran').addEventListener('change', () => {
  const k = chave($('iNaran').value);
  const r = [...DB].sort((a, b) => (a.kria_iha || '').localeCompare(b.kria_iha || '')).reverse().find(x => chave(x.naran) === k);
  if (r) { if (r.postu) $('iPostu').value = r.postu; if (r.pelotaun) $('iPel').value = r.pelotaun; if (r.comp) $('iComp').value = r.comp; }
});

$('form').addEventListener('submit', e => {
  e.preventDefault();
  if (!eAtivu()) { toast('Presiza login.'); hatudu('konta'); return; }
  const d = {
    data: $('iData').value, naran: limpa($('iNaran').value), postu: $('iPostu').value, pelotaun: $('iPel').value, comp: $('iComp').value,
    tipu: $('iTipu').value, ba_se: limpa($('iBaSe').value), kuantidade: Math.round(parseFloat(String($('iKuant').value).replace(',', '.')) * 100) / 100,
    obs: $('iObs').value.trim()
  };
  const erru = [];
  if (!d.data) erru.push('Hili Data.');
  if (!d.naran) erru.push('Prense Naran Kompletu.');
  if (!POSTU.includes(d.postu)) erru.push('Hili Postu.');
  if (!PELOTAUN.includes(d.pelotaun)) erru.push('Hili Pelotaun.');
  if (!COMP.includes(d.comp)) erru.push('Hili Comp/Unidade.');
  if (!TIPU.includes(d.tipu)) erru.push('Hili Tipu Kontribuisaun.');
  if (!d.ba_se) erru.push("Prense 'Ba se?'.");
  if (!(d.kuantidade > 0)) erru.push('Kuantidade tenke boot liu $0.');
  $('formErru').hidden = !erru.length; $('formErru').innerHTML = erru.map(esc).join('<br>');
  if (erru.length) { $('formErru').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

  if (editaId) {
    const r = DB.find(x => x.id === editaId);
    if (!r || !podeEdita(r)) { toast('La iha permisaun atu edita.'); return; }
    // se rejistu seidauk to'o servidor, atualiza de'it operasaun insert iha fila
    const ins = FILA.find(o => o.op === 'insert' && o.rec.id === editaId);
    if (ins) Object.assign(ins.rec, d); else FILA.push({ op: 'update', rec: { id: editaId, ...d }, t: Date.now() });
    gravaFila(); kalkulaDB(); toast('✓ Rejistu atualiza ona'); kanselaEdita(); sinkroniza(); hatudu('lista'); return;
  }
  const rec = { id: uid(), ...d, operador: nomeOperador(), dispozitivu: CFG.dispozitivu, kria_iha: new Date().toISOString(), kria_husi: meuId() };
  FILA.push({ op: 'insert', rec, t: Date.now() }); gravaFila(); kalkulaDB();
  toast(`✓ Save: ${d.naran} — ${usd(d.kuantidade)}${navigator.onLine ? '' : ' (offline: sei haruka depois)'}`);
  $('iNaran').value = ''; $('iKuant').value = ''; $('iObs').value = '';
  $('iNaran').focus();
  renderForm(); sinkroniza();
});

function edita(id) {
  const r = DB.find(x => x.id === id); if (!r || !podeEdita(r)) return;
  editaId = id;
  hatudu('form');
  $('formTit').textContent = 'Edita Rejistu';
  $('iData').value = r.data || ''; $('iNaran').value = r.naran; $('iPostu').value = r.postu || '';
  $('iPel').value = r.pelotaun || ''; $('iComp').value = r.comp || ''; $('iTipu').value = r.tipu || ''; $('iBaSe').value = r.ba_se;
  $('iKuant').value = r.kuantidade; $('iObs').value = r.obs || '';
  $('btnKansela').hidden = false;
}
function kanselaEdita() {
  editaId = null; $('formTit').textContent = 'Rejistu Kontribuisaun Foun'; $('btnKansela').hidden = true;
  $('iNaran').value = ''; $('iKuant').value = ''; $('iObs').value = ''; $('formErru').hidden = true;
}
$('btnKansela').addEventListener('click', () => { kanselaEdita(); hatudu('lista'); });
function hamoos(id) {
  const r = DB.find(x => x.id === id); if (!r || !podeEdita(r)) return;
  if (!confirm(`Hamoos rejistu?\n${r.naran} — ${usd(r.kuantidade)} (${r.tipu} ba ${r.ba_se})`)) return;
  const iIns = FILA.findIndex(o => o.op === 'insert' && o.rec.id === id);
  if (iIns >= 0) FILA = FILA.filter(o => !(o.rec && o.rec.id === id));   // seidauk to'o servidor: kansela de'it
  else FILA.push({ op: 'delete', id, t: Date.now() });
  gravaFila(); kalkulaDB(); toast('Rejistu hamoos ona'); sinkroniza(); render();
}

// ------------------------------------------------------------ LISTA
let limiteLista = 50;
function itemHTML(r) {
  const ak = podeEdita(r) ? `<div class="ak"><button class="btn btn-s" data-ed="${esc(r.id)}">Edita</button><button class="btn btn-x" data-del="${esc(r.id)}">Hamoos</button></div>` : '';
  return `<div class="item"><div class="inf"><div class="nm">${esc(r.postu)} ${esc(r.naran)}</div>
    <div class="det"><span class="tag">${esc(r.tipu)}</span> ba <b>${esc(r.ba_se)}</b> · ${esc(r.comp || 'Comp: -')} · ${esc(r.pelotaun || '-')}</div>
    <div class="det">${dataBR(r.data) || 'la iha data'}${r.operador ? ' · rejista: ' + esc(r.operador) : ''}${r.obs ? ' · ' + esc(r.obs) : ''}</div>
    ${r._pendente ? '<div class="pend">⏳ Seidauk haruka ba servidor</div>' : ''}${ak}</div>
    <div class="val">${usd(r.kuantidade)}</div></div>`;
}
function ligaItem(cont) {
  cont.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => edita(b.dataset.ed));
  cont.querySelectorAll('[data-del]').forEach(b => b.onclick = () => hamoos(b.dataset.del));
}
function renderLista() {
  $('lSohauWrap').hidden = !eAtivu();
  const q = chave($('lBuka').value), t = $('lTipu').value, sohau = eAtivu() && $('lSohau').checked;
  const lst = DB.filter(r => (!t || r.tipu === t) && (!sohau || r.kria_husi === meuId()) && (!q || chave(r.naran).includes(q) || chave(r.ba_se).includes(q)))
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.kria_iha || '').localeCompare(a.kria_iha || ''));
  const tot = lst.reduce((s, r) => s + (Number(r.kuantidade) || 0), 0);
  $('lResumu').textContent = `${lst.length} rejistu · Total ${usd(tot)}`;
  $('lItens').innerHTML = lst.length ? lst.slice(0, limiteLista).map(itemHTML).join('') : '<div class="vaziu">La iha rejistu.</div>';
  $('lMais').hidden = lst.length <= limiteLista;
  ligaItem($('lItens'));
}
opsaun($('lTipu'), TIPU, 'Tipu hotu');
$('lBuka').addEventListener('input', () => { limiteLista = 50; renderLista(); });
$('lTipu').addEventListener('change', () => { limiteLista = 50; renderLista(); });
$('lSohau').addEventListener('change', () => { limiteLista = 50; renderLista(); });
$('lMais').addEventListener('click', () => { limiteLista += 100; renderLista(); });

// ------------------------------------------------------------ Entrega ficheiru (download / share)
function download(blob, nome) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
async function fahe(blob, nome, titulu) {
  const file = new File([blob], nome, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: titulu, text: titulu }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  toast('Telefone ne\'e la suporta "Fahe" — halo download.'); download(blob, nome); return false;
}

// ------------------------------------------------------------ RELATÓRIU EXCEL
const FMT = '"$"#,##0.00';
function folha(aoa, larg, usdCols = [], headerRow = 0) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = larg.map(w => ({ wch: w }));
  const rg = XLSX.utils.decode_range(ws['!ref']);
  for (let R = headerRow + 1; R <= rg.e.r; R++) for (const C of usdCols) {
    const c = ws[XLSX.utils.encode_cell({ r: R, c: C })]; if (c && c.t === 'n') c.z = FMT;
  }
  return ws;
}
const kab = tit => [['FALINTIL-FDTL · QUARTEL GENERAL, FATUHADA, DILI'], [tit], ['Filtru: ' + filtruTxt()], ['Jera iha: ' + agoraTxt()], []];
function linhaDetalhu(r, i) {
  return [i + 1, r.data ? new Date(r.data + 'T00:00:00') : '', r.naran, r.postu, r.pelotaun, r.comp || '', r.tipu, r.ba_se, Number(r.kuantidade) || 0, r.obs || '', r.operador || '', r.id];
}
const HEAD_DET = ['Nu', 'Data', 'Naran Kompletu', 'Postu', 'Pelotaun', 'Comp/Unidade', 'Tipu', 'Ba se?', 'Kuantidade (USD)', 'Obs', 'Operador', 'ID'];

function geraExcel(soDetalhu) {
  const regs = soDetalhu ? [...DB] : filtra(DB);
  regs.sort((a, b) => (a.data || '').localeCompare(b.data || '') || a.naran.localeCompare(b.naran));
  const est = estatistika(regs);
  const wb = XLSX.utils.book_new();
  if (!soDetalhu) {
    const s = kab('RELATÓRIU KONTRIBUISAUN — SUMÁRIU JERÁL');
    s.push(['Total Kontribuisaun Jerál', est.total], ['Total Rejistu', est.n], ['Membru ne\'ebé kontribui', est.nEma],
      ['Benefisiáriu (Ba se)', est.listaBaSe.length], ['Média kada Membru', est.media], []);
    const blok = (tit, lbl, itens) => {
      s.push([tit], [lbl, 'Nu. Rejistu', 'Total (USD)', '%']);
      itens.forEach(i => s.push([i.label, i.n, i.total, est.total ? i.total / est.total : 0]));
      s.push(['TOTAL', est.n, est.total, 1], []);
    };
    blok('TUIR TIPU', 'Tipu', TIPU.map(t => ({ label: t, ...est.tipu[t] })));
    blok('TUIR COMP/UNIDADE', 'Comp/Unidade', Object.entries(est.comp).filter(([k, v]) => COMP.includes(k) || v.n).map(([k, v]) => ({ label: k, ...v })));
    blok('TUIR PELOTAUN', 'Pelotaun', Object.entries(est.pel).map(([k, v]) => ({ label: k, ...v })));
    blok('TUIR POSTU', 'Postu', est.listaPostu.map(p => ({ label: p.postu, ...p })));
    blok('TUIR BENEFISIÁRIU (BA SE?)', 'Ba se?', est.listaBaSe.map(b => ({ label: b.ba_se, ...b })));
    const ws = folha(s, [34, 14, 16, 10], [1, 2], 0);
    // formatu % no USD
    const rg = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 0; R <= rg.e.r; R++) {
      const c3 = ws[XLSX.utils.encode_cell({ r: R, c: 3 })]; if (c3 && c3.t === 'n') c3.z = '0.0%';
      const c1 = ws[XLSX.utils.encode_cell({ r: R, c: 1 })]; const l = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
      if (c1 && c1.t === 'n' && !(l && /Total Kontribuisaun|Média/.test(l.v))) delete c1.z;
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Sumariu');

    const e = kab('TOTAL KONTRIBUISAUN KADA MEMBRU');
    e.push(['Nu', 'Postu', 'Naran Kompletu', 'Pelotaun', 'Comp/Unidade', ...TIPU, 'TOTAL (USD)', 'Nu. Rejistu']);
    est.listaEma.forEach(x => e.push([x.rank, x.postu, x.naran, x.pelotaun, x.comp, ...TIPU.map(t => x.tipu[t] || 0), x.total, x.n]));
    e.push(['', '', 'TOTAL JERÁL', '', '', ...TIPU.map(t => est.tipu[t].total), est.total, est.n]);
    XLSX.utils.book_append_sheet(wb, folha(e, [6, 14, 40, 13, 13, 12, 12, 12, 12, 15, 11], [5, 6, 7, 8, 9], 5), 'Total Kada Ema');

    const benef = est.listaBaSe.map(b => b.ba_se);
    const m = kab('MATRIZ KONTRIBUISAUN: MEMBRU x BENEFISIÁRIU');
    m.push(['Nu', 'Postu', 'Naran Kompletu', 'Pelotaun', 'Comp/Unidade', ...benef, 'Total Kada Ema']);
    const mat = {};
    regs.forEach(r => { const k = chave(r.naran); mat[k] = mat[k] || {}; mat[k][r.ba_se] = (mat[k][r.ba_se] || 0) + (Number(r.kuantidade) || 0); });
    [...est.listaEma].sort((a, b) => a.naran.localeCompare(b.naran)).forEach((x, i) =>
      m.push([i + 1, x.postu, x.naran, x.pelotaun, x.comp, ...benef.map(b => mat[chave(x.naran)][b] || 0), x.total]));
    m.push(['', '', 'SUB-TOTAL', '', '', ...est.listaBaSe.map(b => b.total), est.total]);
    XLSX.utils.book_append_sheet(wb, folha(m, [6, 12, 40, 13, 13, ...benef.map(() => 14), 16], [...benef.map((_, i) => 5 + i), 5 + benef.length], 5), 'Matriz Ema x Ba se');
  }
  const d = soDetalhu ? [] : kab('DETALHU REJISTU KONTRIBUISAUN');
  const h = d.length;
  d.push(HEAD_DET);
  regs.forEach((r, i) => d.push(linhaDetalhu(r, i)));
  if (!soDetalhu) d.push(['', '', '', '', '', '', '', 'TOTAL', est.total]);
  const wsD = folha(d, [6, 12, 38, 14, 13, 13, 12, 22, 15, 30, 18, 12], [8], h);
  const rgD = XLSX.utils.decode_range(wsD['!ref']);
  for (let R = h + 1; R <= rgD.e.r; R++) { const c = wsD[XLSX.utils.encode_cell({ r: R, c: 1 })]; if (c && c.t === 'd' || (c && c.t === 'n')) c.z = 'dd/mm/yyyy'; }
  XLSX.utils.book_append_sheet(wb, wsD, soDetalhu ? 'Rejistu' : 'Detalhu Rejistu');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ------------------------------------------------------------ RELATÓRIU HTML
function geraHTML() {
  const regs = filtra(DB).sort((a, b) => (a.ba_se || '').localeCompare(b.ba_se || '') || a.naran.localeCompare(b.naran));
  const est = estatistika(regs);
  const pc = v => est.total ? (100 * v / est.total).toFixed(1) + '%' : '0%';
  const bar = v => `<div class="bar"><span style="width:${est.total ? 100 * v / est.total : 0}%"></span></div>`;
  const tGrupu = (lbl, itens) => `<table><thead><tr><th>${lbl}</th><th class="num">Rej.</th><th class="num">Total</th><th>%</th></tr></thead><tbody>${itens.map(i => `<tr><td>${esc(i.label)}</td><td class="num">${i.n}</td><td class="num">${usd(i.total)}</td><td>${bar(i.total)}<small>${pc(i.total)}</small></td></tr>`).join('')}</tbody><tfoot><tr><td>TOTAL</td><td class="num">${est.n}</td><td class="num">${usd(est.total)}</td><td>100%</td></tr></tfoot></table>`;
  return `<!doctype html><html lang="tet"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatóriu Kontribuisaun ${new Date().toLocaleDateString('pt-PT')}</title><style>
:root{--v:#2f4a2b;--v2:#3f6139;--k:#e6ecdf;--o:#b8962e}*{box-sizing:border-box}
body{font-family:"Segoe UI",Roboto,Arial,sans-serif;color:#1d1f1b;margin:0;background:#fff;font-size:12.5px;line-height:1.4}
.f{max-width:1050px;margin:0 auto;padding:24px 18px}
.kab{text-align:center;border-bottom:3px double var(--v);padding-bottom:12px;margin-bottom:14px}
.kab .l1{font-size:16px;font-weight:800;color:var(--v)}.kab .l2{font-size:11px;color:#555}.kab h1{font-size:17px;margin:10px 0 2px}
.meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:11px;color:#555}
h2{font-size:14px;color:var(--v);border-left:4px solid var(--o);padding-left:8px;margin:22px 0 8px}
.kp{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.kp div{border:1px solid #cfd4c8;border-radius:6px;padding:8px 10px}
.kp div.p{background:var(--v);color:#fff}.kp span{display:block;font-size:10px;text-transform:uppercase;opacity:.8}.kp b{font-size:18px}
.d{display:grid;grid-template-columns:1fr 1fr;gap:18px}
table{width:100%;border-collapse:collapse}th{background:var(--v);color:#fff;padding:6px 7px;text-align:left;font-size:11.5px}
td{padding:5px 7px;border-bottom:1px solid #e3e6de}tbody tr:nth-child(even){background:#f6f7f3}
tfoot td{font-weight:700;background:var(--k);border-top:2px solid var(--v)}
.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.bar{height:7px;background:var(--k);border-radius:4px;min-width:50px}.bar span{display:block;height:100%;background:var(--v2);border-radius:4px}
.tw{overflow-x:auto}.as{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:46px;text-align:center}
.as div div{border-top:1px solid #333;margin-top:56px;padding-top:4px}
@media(max-width:700px){.kp{grid-template-columns:1fr 1fr}.d{grid-template-columns:1fr}}
@media print{th,.kp .p,tfoot td,.bar span{-webkit-print-color-adjust:exact;print-color-adjust:exact}.f{padding:0}tr{break-inside:avoid}@page{size:A4;margin:12mm}}
</style></head><body><div class="f">
<div class="kab"><div class="l1">FALINTIL-FORSA DEFEZA TIMOR-LESTE</div><div class="l2">QUARTEL GENERAL, FATUHADA, DILI</div>
<h1>RELATÓRIU KONTRIBUISAUN</h1><div>Lia Mate, Kazamento, Dezastre no Seluk</div></div>
<div class="meta"><span><b>Filtru:</b> ${esc(filtruTxt())}</span><span><b>Jera iha:</b> ${agoraTxt()}${nomeOperador() ? ' · ' + esc(nomeOperador()) : ''}</span></div>
<h2>1. Sumáriu Jerál</h2><div class="kp"><div class="p"><span>Total Jerál</span><b>${usd(est.total)}</b></div>
<div><span>Total Rejistu</span><b>${est.n}</b></div><div><span>Membru</span><b>${est.nEma}</b></div><div><span>Média / Membru</span><b>${usd(est.media)}</b></div></div>
<div class="d"><div><h2>2. Tuir Tipu</h2>${tGrupu('Tipu', TIPU.map(t => ({ label: t, ...est.tipu[t] })))}</div>
<div><h2>3. Tuir Comp/Unidade</h2>${tGrupu('Comp/Unidade', Object.entries(est.comp).filter(([k, v]) => COMP.includes(k) || v.n).map(([k, v]) => ({ label: k, ...v })))}</div></div>
<div class="d"><div><h2>4. Tuir Pelotaun</h2>${tGrupu('Pelotaun', Object.entries(est.pel).map(([k, v]) => ({ label: k, ...v })))}</div>
<div><h2>5. Tuir Postu</h2>${tGrupu('Postu', est.listaPostu.map(p => ({ label: p.postu, ...p })))}</div></div>
<h2>6. Tuir Benefisiáriu (Ba se?)</h2>${tGrupu('Ba se?', est.listaBaSe.map(b => ({ label: b.ba_se, ...b })))}
<h2>7. Total Kontribuisaun Kada Membru</h2><div class="tw"><table><thead><tr><th>#</th><th>Postu</th><th>Naran Kompletu</th><th>Pelotaun</th><th>Comp/Unid.</th>${TIPU.map(t => `<th class="num">${t}</th>`).join('')}<th class="num">Total</th><th class="num">Rej.</th></tr></thead><tbody>
${est.listaEma.map(e => `<tr><td>${e.rank}</td><td>${esc(e.postu)}</td><td>${esc(e.naran)}</td><td>${esc(e.pelotaun)}</td><td>${esc(e.comp)}</td>${TIPU.map(t => `<td class="num">${e.tipu[t] ? usd(e.tipu[t]) : '—'}</td>`).join('')}<td class="num"><b>${usd(e.total)}</b></td><td class="num">${e.n}</td></tr>`).join('')}
</tbody><tfoot><tr><td colspan="5">TOTAL JERÁL</td>${TIPU.map(t => `<td class="num">${usd(est.tipu[t].total)}</td>`).join('')}<td class="num">${usd(est.total)}</td><td class="num">${est.n}</td></tr></tfoot></table></div>
<h2>8. Detalhu Rejistu</h2><div class="tw"><table><thead><tr><th>#</th><th>Data</th><th>Postu</th><th>Naran</th><th>Pel.</th><th>Comp/Unid.</th><th>Tipu</th><th>Ba se?</th><th class="num">USD</th><th>Obs</th></tr></thead><tbody>
${regs.map((r, i) => `<tr><td>${i + 1}</td><td>${dataBR(r.data)}</td><td>${esc(r.postu)}</td><td>${esc(r.naran)}</td><td>${esc((r.pelotaun || '').slice(0, 2))}</td><td>${esc(r.comp)}</td><td>${esc(r.tipu)}</td><td>${esc(r.ba_se)}</td><td class="num">${usd(r.kuantidade)}</td><td>${esc(r.obs)}</td></tr>`).join('')}
</tbody><tfoot><tr><td colspan="8">TOTAL</td><td class="num">${usd(est.total)}</td><td></td></tr></tfoot></table></div>
<div class="as"><div>Prepara husi,<div>Naran / Postu</div></div><div>Aprova husi,<div>Komandante</div></div></div>
</div></body></html>`;
}

function renderRel() {
  const regs = filtra(DB);
  $('rFiltru').textContent = filtruTxt();
  $('rResumu').textContent = `${regs.length} rejistu · Total ${usd(regs.reduce((s, r) => s + (Number(r.kuantidade) || 0), 0))}`;
}
const nomeRel = ext => `Relatoriu_Kontribuisaun_${carimbu()}.${ext}`;
$('rXlsxDl').onclick = () => { download(geraExcel(false), nomeRel('xlsx')); toast('Relatóriu Excel jera ona'); };
$('rXlsxSh').onclick = () => fahe(geraExcel(false), nomeRel('xlsx'), 'Relatóriu Kontribuisaun');
$('rHtmlDl').onclick = () => { download(new Blob([geraHTML()], { type: 'text/html' }), nomeRel('html')); toast('Relatóriu HTML jera ona'); };
$('rHtmlSh').onclick = () => fahe(new Blob([geraHTML()], { type: 'text/html' }), nomeRel('html'), 'Relatóriu Kontribuisaun');
$('rHaree').onclick = () => { $('relFrame').srcdoc = geraHTML(); $('dlgRel').showModal(); };
$('dlgFecha').onclick = () => $('dlgRel').close();
$('dlgPrint').onclick = () => { try { $('relFrame').contentWindow.print(); } catch (e) { toast('Uza Download HTML no imprime husi navegador.'); } };


// ------------------------------------------------------------ Normaliza dadus importa
const impressaun = r => [r.data || '', chave(r.naran), chave(r.ba_se), r.tipu, Number(r.kuantidade).toFixed(2), chave(r.obs)].join('|');
function normaliza(o) {
  const mapaPel = { '1': '1º Pelotaun', '2': '2º Pelotaun', '3': '3º Pelotaun' };
  let pel = limpa(o.pelotaun); if (mapaPel[pel]) pel = mapaPel[pel];
  let data = o.data;
  if (data instanceof Date && !isNaN(data)) data = new Date(data - data.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  else if (typeof data === 'number') data = new Date(Math.round((data - 25569) * 864e5)).toISOString().slice(0, 10);
  else if (typeof data === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(data.trim())) { const [d, m, y] = data.trim().split('/'); data = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
  else data = typeof data === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data) ? data.slice(0, 10) : '';
  const k = parseFloat(String(o.kuantidade ?? '').replace(/[$,\s]/g, ''));
  const cRaw = limpa(o.comp).toUpperCase();
  const comp = !cRaw || cRaw === 'N/A' ? '' : (COMP.find(c => c.toUpperCase() === cRaw) || 'Seluk');
  return {
    id: limpa(o.id) || '', data, naran: limpa(o.naran), postu: limpa(o.postu), pelotaun: pel, comp,
    tipu: TIPU.includes(limpa(o.tipu)) ? limpa(o.tipu) : 'Seluk', ba_se: limpa(o.ba_se),
    kuantidade: isNaN(k) ? 0 : Math.round(k * 100) / 100, obs: limpa(o.obs), operador: limpa(o.operador),
    dispozitivu: o.dispozitivu || '', kria_iha: o.kria_iha || new Date().toISOString(), atualiza_iha: o.atualiza_iha || ''
  };
}
function leExcel(buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const out = [];
  for (const nm of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nm], { header: 1, defval: '', raw: true });
    const hi = rows.slice(0, 15).findIndex(r => r.some(c => /naran/i.test(String(c))) && r.some(c => /kuantidade/i.test(String(c))));
    if (hi < 0) continue;
    const H = rows[hi].map(c => String(c).toLowerCase());
    const col = re => H.findIndex(h => re.test(h));
    const ix = { data: col(/^data/), naran: col(/naran/), postu: col(/postu/), pelotaun: col(/pelotaun|pel\./), comp: col(/comp|unid/), tipu: col(/tipu/), ba_se: col(/ba se/), kuantidade: col(/kuantidade/), obs: col(/^(\d+\.\s*)?obs/), operador: col(/operador/), id: col(/^id$/) };
    for (const r of rows.slice(hi + 1)) {
      const o = {}; for (const [k, i] of Object.entries(ix)) o[k] = i >= 0 ? r[i] : '';
      if (!limpa(o.naran) || /^total/i.test(limpa(o.naran))) continue;
      out.push(o);
    }
    if (out.length) break; // uza folha primeiru ne'ebé iha dadus
  }
  return out;
}

// ------------------------------------------------------------ SINKRONIZASAUN ho servidor
const doServ = r => ({ ...r, data: r.data || '', kuantidade: Number(r.kuantidade) || 0, postu: r.postu || '', pelotaun: r.pelotaun || '', comp: r.comp || '', obs: r.obs || '', operador: r.operador || '' });
const paraServ = r => { const o = {}; for (const k of CAMPU) if (r[k] !== undefined) o[k] = r[k]; o.data = r.data || null; return o; };
const EDITAVEL = ['data', 'naran', 'postu', 'pelotaun', 'comp', 'tipu', 'ba_se', 'kuantidade', 'obs'];
const paraServUpd = r => { const o = {}; for (const k of EDITAVEL) if (r[k] !== undefined) o[k] = r[k]; o.data = r.data || null; return o; };

let carregando = false, sincronizando = false;
function estadu(txt, classe) {
  const b = $('btnSync'); b.textContent = txt; b.className = 'pill' + (classe ? ' ' + classe : '');
  const n = FILA.length;
  $('bannerPendente').hidden = !n && !FALHA.length;
  $('bannerPendente').innerHTML = (n ? `⏳ ${n} operasaun seidauk haruka ba servidor (sei haruka automátiku bainhira iha internet).` : '') +
    (FALHA.length ? `<br>⚠ ${FALHA.length} operasaun servidor rejeita: ${esc(FALHA[FALHA.length - 1].erru)} <a href="#" id="lnkFalha">limpa</a>` : '');
  const l = $('lnkFalha'); if (l) l.onclick = ev => { ev.preventDefault(); FALHA = []; estadu(b.textContent); };
}
function atualizaEstadu() {
  if (!sb) return estadu('Offline (la konfigura)', 'off');
  if (!navigator.onLine) return estadu(`Offline${FILA.length ? ' · ' + FILA.length + ' pendente' : ''}`, 'off');
  if (carregando || sincronizando) return estadu('⟳ Atualiza...', 'gira');
  estadu(`⟳ ${ULTIMA_SYNC ? new Date(ULTIMA_SYNC).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : 'Atualiza'}${FILA.length ? ' · ' + FILA.length + ' pendente' : ''}`);
}

async function carregaServidor(silensiu) {
  if (!sb || carregando) return;
  carregando = true; atualizaEstadu();
  try {
    const PAG = 1000, tudu = [];
    for (let from = 0; ; from += PAG) {
      const { data, error } = await sb.from('kontribuisaun').select('*').order('kria_iha', { ascending: true }).order('id').range(from, from + PAG - 1);
      if (error) throw error;
      tudu.push(...data);
      if (data.length < PAG) break;
    }
    SERV = tudu.map(doServ); ULTIMA_SYNC = new Date().toISOString(); gravaCache(); kalkulaDB();
  } catch (e) {
    if (!silensiu && !eRede(e)) toast('Erru servidor: ' + msgErru(e));
  } finally { carregando = false; atualizaEstadu(); render(); }
}

async function sinkroniza() {
  if (!sb || !eAtivu() || sincronizando || !FILA.length || !navigator.onLine) { atualizaEstadu(); return; }
  sincronizando = true; atualizaEstadu();
  let mudou = false;
  try {
    while (FILA.length) {
      const o = FILA[0]; let res;
      if (o.op === 'insert') res = await sb.from('kontribuisaun').upsert(paraServ(o.rec), { onConflict: 'id', ignoreDuplicates: true });
      else if (o.op === 'update') res = await sb.from('kontribuisaun').update(paraServUpd(o.rec)).eq('id', o.rec.id).select('id');
      else res = await sb.from('kontribuisaun').delete().eq('id', o.id).select('id');
      if (res.error) {
        if (eRede(res.error)) break;                         // sei koko fali depois
        FALHA.push({ ...o, erru: msgErru(res.error) });
      } else if (o.op !== 'insert' && Array.isArray(res.data) && !res.data.length) {
        FALHA.push({ ...o, erru: 'La iha permisaun ka rejistu la iha ona.' });
      }
      FILA.shift(); gravaFila(); mudou = true;
    }
  } finally { sincronizando = false; }
  if (mudou) await carregaServidor(true); else atualizaEstadu();
}

$('btnSync').onclick = async () => { await sinkroniza(); await carregaServidor(); };
window.addEventListener('online', async () => { await sinkroniza(); carregaServidor(true); });
window.addEventListener('offline', atualizaEstadu);
document.addEventListener('visibilitychange', () => { if (!document.hidden && navigator.onLine) { sinkroniza(); carregaServidor(true); } });
setInterval(() => { if (!document.hidden && navigator.onLine) carregaServidor(true); }, 60000);

// ------------------------------------------------------------ LOGIN / KONTA
async function kargaPerfil() {
  if (!sb) { SESAUN = null; return; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { SESAUN = null; CFG.perfil = null; gravaCfg(); return; }
  const { data: p, error } = await sb.from('perfil').select('*').eq('id', session.user.id).maybeSingle();
  if (error && eRede(error) && CFG.perfil && CFG.perfil.id === session.user.id) { SESAUN = { user: session.user, perfil: CFG.perfil }; return; }
  if (!p || !p.ativu) {
    await sb.auth.signOut(); SESAUN = null; CFG.perfil = null; gravaCfg();
    toast(p ? 'Konta ida-ne\'e la ativu. Kontaktu admin.' : 'Konta la iha perfil. Kontaktu admin.', 4000);
    return;
  }
  SESAUN = { user: session.user, perfil: p }; CFG.perfil = p; gravaCfg();
}
const emailHusi = u => u.includes('@') ? u.trim().toLowerCase() : `${u.trim().toLowerCase()}@${KONFIG.DOMINIU_EMAIL || 'kontribuisaun.local'}`;
$('loginBox').addEventListener('submit', async e => {
  e.preventDefault();
  if (!sb) { alert('Sistema seidauk konfigura (config.js).'); return; }
  const u = $('lgUser').value, s = $('lgSenha').value;
  $('lgErru').hidden = true; $('lgBtn').disabled = true; $('lgBtn').textContent = 'Hein...';
  try {
    const { error } = await sb.auth.signInWithPassword({ email: emailHusi(u), password: s });
    if (error) throw error;
    await kargaPerfil();
    if (eAtivu()) { $('lgSenha').value = ''; toast(`Bem-vindu, ${nomeOperador()}`); await sinkroniza(); await carregaServidor(true); }
  } catch (err) {
    $('lgErru').hidden = false;
    $('lgErru').textContent = eRede(err) ? 'La iha internet. Login presiza internet.' : (/invalid/i.test(err.message) ? 'Username ka senha la loos.' : msgErru(err));
  } finally { $('lgBtn').disabled = false; $('lgBtn').textContent = 'Tama'; atualizaUI(); render(); }
});
$('btnSai').onclick = async () => {
  if (FILA.length && !confirm(`Iha ${FILA.length} operasaun seidauk haruka ba servidor. Se sai agora, sei haruka bainhira login fali iha telefone ida-ne'e. Sai nafatin?`)) return;
  if (sb) await sb.auth.signOut().catch(() => { });
  SESAUN = null; CFG.perfil = null; gravaCfg(); kanselaEdita(); atualizaUI(); hatudu('dash'); toast('Sai ona');
};

function atualizaUI() {
  const ativu = eAtivu();
  $('navForm').hidden = !ativu;
  $('navKonta').querySelector('span').textContent = ativu ? 'Konta' : 'Login';
  $('topSub').textContent = ativu ? `${nomeOperador()} · ${SESAUN.perfil.role}` : 'Haree de\'it — login atu rejista';
  $('bannerKonfig').hidden = !!sb;
  atualizaEstadu();
}

// ------------------------------------------------------------ MIGRASAUN dadus versaun antigu (1.x)
function dadusV1() { const v = leJSON(K_V1, []); return Array.isArray(v) ? v : []; }
function renderMigra() {
  const v1 = dadusV1();
  $('migraBox').hidden = !v1.length;
  if (!v1.length) return;
  $('migraInfo').innerHTML = `Iha <b>${v1.length}</b> rejistu husi versaun antigu rai iha telefone ida-ne'e. ` +
    (eAtivu() ? 'Envia ba servidor atu ema hotu bele haree. Rejistu ne\'ebé iha ona iha servidor la duplika.' : '<b>Halo login</b> atu envia sira ba servidor.');
  $('btnMigra').hidden = !eAtivu();
}
$('btnMigra').onclick = async () => {
  const v1 = dadusV1();
  const z = await enviaLote(v1, 'telefone (versaun antigu)');
  if (z && !z.erru) {
    graJSON(K_V1 + '_backup_' + carimbu(), v1); localStorage.removeItem(K_V1);
    renderMigra();
  }
};

// ------------------------------------------------------------ IMPORTA (ba servidor)
async function enviaLote(lista, origem) {
  if (!sb || !eAtivu()) { toast('Presiza login.'); return null; }
  if (!navigator.onLine) { alert('Importa presiza internet.'); return null; }
  await carregaServidor(true);
  const regs = lista.map(normaliza).filter(r => r.naran && r.ba_se && r.kuantidade > 0 && TIPU.includes(r.tipu));
  const invalidu = lista.length - regs.length;
  const ids = new Set(DB.map(r => r.id)), imp = new Set(DB.map(impressaun));
  const novu = [];
  for (const r of regs) {
    if ((r.id && ids.has(r.id)) || imp.has(impressaun(r))) continue;
    r.id = r.id || uid(); ids.add(r.id); imp.add(impressaun(r));
    if (!r.operador) r.operador = nomeOperador();
    novu.push(r);
  }
  const repete = regs.length - novu.length;
  $('iRez').hidden = false; $('iRez').className = 'ok'; $('iRez').textContent = `Haruka ${novu.length} rejistu...`;
  let env = 0;
  try {
    for (let i = 0; i < novu.length; i += 500) {
      const { error } = await sb.from('kontribuisaun').upsert(novu.slice(i, i + 500).map(paraServ), { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
      env += Math.min(500, novu.length - i);
    }
  } catch (e) {
    $('iRez').className = 'erru';
    $('iRez').textContent = `Erru depois haruka ${env} rejistu: ${msgErru(e)}. Koko fali (la duplika).`;
    await carregaServidor(true);
    return { erru: true };
  }
  await carregaServidor(true);
  $('iRez').innerHTML = `✓ Importa husi <b>${esc(origem)}</b>: <b>${env}</b> rejistu foun` +
    (repete ? `, ${repete} ignora (iha ona)` : '') + (invalidu ? `, ${invalidu} la válidu` : '') + `.<br>Total iha servidor: ${SERV.length} rejistu.`;
  toast(`Importa: ${env} rejistu foun`);
  return { env, repete, invalidu };
}
$('iBtn').onclick = () => $('iFile').click();
$('iFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    let lista;
    if (/\.json$/i.test(f.name) || f.type === 'application/json') {
      const j = JSON.parse(await f.text());
      lista = Array.isArray(j) ? j : j.rejistu;
      if (!Array.isArray(lista)) throw new Error('Ficheiru JSON la iha formatu backup Kontribuisaun.');
    } else {
      lista = leExcel(new Uint8Array(await f.arrayBuffer()));
      if (!lista.length) throw new Error('La hetan koluna "Naran" no "Kuantidade" iha ficheiru Excel.');
    }
    await enviaLote(lista, f.name);
  } catch (err) { alert('ERRU importa: ' + err.message); }
});
$('iCefo').onclick = async () => {
  try { const j = await (await fetch('data/cefo24.json')).json(); await enviaLote(j.rejistu, 'CEFO 24'); }
  catch (e) { alert('La konsege karrega dadus CEFO 24: ' + e.message); }
};

// ------------------------------------------------------------ EXPORTA
function backupBlob() {
  const pak = { app: 'kontribuisaun-ffdtl', versaun: 2, exporta_iha: new Date().toISOString(), exporta_husi: nomeOperador() || 'publiku', total_rejistu: DB.length, rejistu: DB.map(r => { const o = { ...r }; delete o._pendente; return o; }) };
  return new Blob([JSON.stringify(pak, null, 1)], { type: 'application/json' });
}
$('eJsonDl').onclick = () => { download(backupBlob(), `Backup_Kontribuisaun_${carimbu()}.json`); toast('Backup download ona'); };
$('eXlsx').onclick = () => { download(geraExcel(true), `Rejistu_Kontribuisaun_${carimbu()}.xlsx`); toast('Excel exporta ona'); };
$('cLimpaCache').onclick = async () => {
  if (FILA.length) { alert(`Iha ${FILA.length} operasaun seidauk haruka. Liga internet no hein to'o haruka uluk.`); return; }
  if (!confirm('Hamoos kópia lokal? Dadus iha servidor la lakon; sei karrega fali.')) return;
  SERV = []; ULTIMA_SYNC = ''; gravaCache(); kalkulaDB(); await carregaServidor(); renderKonta();
};

// ------------------------------------------------------------ ADMIN: jestaun utilizador
async function chamaFuncao(body) {
  const { data, error } = await sb.functions.invoke('admin-utilizador', { body: { ...body, dominiu: KONFIG.DOMINIU_EMAIL || 'kontribuisaun.local' } });
  if (error) {
    let m = error.message;
    try { const j = await error.context.json(); if (j && j.erru) m = j.erru; } catch (e) { }
    if (/Failed to send|not found|404/i.test(m)) m = 'Funsaun "admin-utilizador" seidauk instala iha Supabase (haree Guia).';
    throw new Error(m);
  }
  if (data && data.erru) throw new Error(data.erru);
  return data;
}
async function renderAdmin() {
  $('adminBox').hidden = !eAdmin();
  if (!eAdmin()) return;
  const { data, error } = await sb.from('perfil').select('*').order('role').order('username');
  if (error) { $('userLista').innerHTML = `<p class="erru">${esc(msgErru(error))}</p>`; return; }
  const contagem = {}; SERV.forEach(r => { if (r.kria_husi) contagem[r.kria_husi] = (contagem[r.kria_husi] || 0) + 1; });
  $('userLista').innerHTML = `<p class="mini" style="margin-top:12px">${data.length} konta</p>` + data.map(u => {
    const eu = u.id === meuId();
    return `<div class="user-row"><div class="top-l"><div><b>${esc(u.naran || u.username)}</b><div class="mini">👤 ${esc(u.username)} · ${contagem[u.id] || 0} rejistu</div></div>
      <div>${u.role === 'admin' ? '<span class="tag adm">admin</span>' : '<span class="tag">operador</span>'} ${u.ativu ? '' : '<span class="tag off">la ativu</span>'}</div></div>
      ${eu ? '<div class="mini" style="margin-top:6px">(ita-nia konta)</div>' : `<div class="ak">
        <select data-role="${u.id}"><option value="operador" ${u.role === 'operador' ? 'selected' : ''}>Operador</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select>
        <button class="btn btn-s" data-ativu="${u.id}" data-v="${u.ativu ? 0 : 1}">${u.ativu ? 'Dezativa' : 'Ativa'}</button>
        <button class="btn btn-s" data-senha="${u.id}" data-n="${esc(u.username)}">Troka senha</button>
        <button class="btn btn-x" data-hamoos="${u.id}" data-n="${esc(u.username)}">Hamoos</button></div>`}</div>`;
  }).join('');
  const box = $('userLista');
  box.querySelectorAll('[data-role]').forEach(s => s.onchange = async () => {
    const { data: r, error } = await sb.from('perfil').update({ role: s.value }).eq('id', s.dataset.role).select('id');
    toast(error || !r.length ? 'Erru: ' + msgErru(error || 'la muda') : 'Role muda ona'); renderAdmin();
  });
  box.querySelectorAll('[data-ativu]').forEach(b => b.onclick = async () => {
    const { data: r, error } = await sb.from('perfil').update({ ativu: b.dataset.v === '1' }).eq('id', b.dataset.ativu).select('id');
    toast(error || !r.length ? 'Erru: ' + msgErru(error || 'la muda') : (b.dataset.v === '1' ? 'Konta ativa ona' : 'Konta dezativa ona')); renderAdmin();
  });
  box.querySelectorAll('[data-senha]').forEach(b => b.onclick = async () => {
    const s = prompt(`Senha foun ba "${b.dataset.n}" (mínimu 6):`); if (!s) return;
    try { await chamaFuncao({ asaun: 'troka_senha', id: b.dataset.senha, senha: s }); toast('Senha troka ona'); } catch (e) { alert(e.message); }
  });
  box.querySelectorAll('[data-hamoos]').forEach(b => b.onclick = async () => {
    if (!confirm(`Hamoos konta "${b.dataset.n}"? Rejistu sira ne'ebé nia halo sei mantein.`)) return;
    try { await chamaFuncao({ asaun: 'hamoos', id: b.dataset.hamoos }); toast('Konta hamoos ona'); renderAdmin(); } catch (e) { alert(e.message); }
  });
}
$('novoUser').addEventListener('submit', async e => {
  e.preventDefault();
  $('nuErru').hidden = true;
  const body = { asaun: 'kria', username: $('nuUser').value.trim().toLowerCase(), naran: $('nuNaran').value.trim(), senha: $('nuSenha').value, role: $('nuRole').value };
  if (!/^[a-z0-9._-]{3,30}$/.test(body.username)) { $('nuErru').hidden = false; $('nuErru').textContent = 'Username: 3-30 letra ki\'ik, numeru, . _ - (la iha espasu).'; return; }
  if (body.senha.length < 6) { $('nuErru').hidden = false; $('nuErru').textContent = 'Senha mínimu karakter 6.'; return; }
  try {
    await chamaFuncao(body);
    toast(`✓ Konta "${body.username}" kria ona`);
    $('novoUser').reset(); $('novoUserBox').open = false; renderAdmin();
  } catch (err) { $('nuErru').hidden = false; $('nuErru').textContent = err.message; }
});

// ------------------------------------------------------------ KONTA (render)
function renderKonta() {
  const ativu = eAtivu();
  $('loginBox').hidden = ativu; $('kontaBox').hidden = !ativu;
  $('importBox').hidden = !ativu; $('iCefo').hidden = !eAdmin();
  if (ativu) {
    const p = SESAUN.perfil, meus = DB.filter(r => r.kria_husi === meuId()).length;
    $('kInfo').innerHTML = `<b>${esc(p.naran || p.username)}</b><br><span class="mini">👤 ${esc(p.username)} · ${p.role === 'admin' ? 'Administrador' : 'Operador'} · ${meus} rejistu halo husi ita</span>`;
  }
  renderMigra(); renderAdmin();
  const tot = DB.reduce((s, r) => s + (Number(r.kuantidade) || 0), 0);
  $('cInfo').innerHTML = `${DB.length} rejistu (${usd(tot)}) · atualiza ikus: ${oraTxt(ULTIMA_SYNC)}<br>Pendente: ${FILA.length} · ID telefone: ${esc(CFG.dispozitivu)}`;
  $('appVer').textContent = APP_VER;
}

// ------------------------------------------------------------ Render jerál
function render() {
  if (viewAtual === 'dash') { renderDash(); $('dAtualiza').textContent = ULTIMA_SYNC ? `Dadus servidor atualiza iha ${oraTxt(ULTIMA_SYNC)}` : ''; }
  else if (viewAtual === 'form') renderForm();
  else if (viewAtual === 'lista') renderLista();
  else if (viewAtual === 'rel') renderRel();
  else if (viewAtual === 'konta') renderKonta();
}

// ------------------------------------------------------------ Instalasaun (PWA)
let promptInstala = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptInstala = e; $('btnInstall').hidden = false; });
$('btnInstall').onclick = async () => { if (!promptInstala) return; promptInstala.prompt(); await promptInstala.userChoice; promptInstala = null; $('btnInstall').hidden = true; };
window.addEventListener('appinstalled', () => { $('btnInstall').hidden = true; toast('✓ App instala ona'); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const tinhaControlador = !!navigator.serviceWorker.controller;
  let jaRecarrega = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (tinhaControlador && !jaRecarrega) { jaRecarrega = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(() => { });
}

// ------------------------------------------------------------ Hahú
(async function hahu() {
  atualizaUI(); render();
  if (!sb) return;
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && SESAUN) { SESAUN = null; atualizaUI(); render(); } });
  try { await kargaPerfil(); } catch (e) { }
  atualizaUI(); render();
  await sinkroniza();
  await carregaServidor(true);
})();
