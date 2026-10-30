/* Sistema Kontribuisaun F-FDTL — app telefone (PWA, offline)
 * Dadus rai iha telefone (localStorage). Exporta/Importa liu husi ficheiru .json / .xlsx
 */
'use strict';
const APP_VER = '1.0.0';
const POSTU = ["Alferes", "SubTen", "Ten", "2º Ten", "Capitão", "1º Ten", "Major", "Cap. Ten",
  "Ten. Coronel", "Cap. Fragata", "Coronel", "Cap. Mar-e-Guerra", "Brig. General", "Comodoro",
  "Maj. General", "Contra-Almirante", "Ten. General"];
const PELOTAUN = ["1º Pelotaun", "2º Pelotaun", "3º Pelotaun"];
const TIPU = ["Lia Mate", "Kazamento", "Dezastre", "Seluk"];
const K_DADUS = 'kontrib_ffdtl_rejistu_v1';
const K_CFG = 'kontrib_ffdtl_cfg_v1';

// ------------------------------------------------------------ Armazenamentu
const $ = id => document.getElementById(id);
function leJSON(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function graJSON(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) { alert('ERRU: la konsege grava dadus iha telefone (memória nakonu?). Halo Backup agora.'); return false; }
}
let DB = leJSON(K_DADUS, []);
let CFG = Object.assign({ operador: '', ultimuBackup: '', dispozitivu: '' }, leJSON(K_CFG, {}));
if (!CFG.dispozitivu) { CFG.dispozitivu = 'TLF-' + Math.random().toString(36).slice(2, 7).toUpperCase(); graJSON(K_CFG, CFG); }
const grava = () => graJSON(K_DADUS, DB);
const gravaCfg = () => graJSON(K_CFG, CFG);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });

// ------------------------------------------------------------ Utilidade
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = v => '$ ' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const limpa = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const chave = s => limpa(s).toLowerCase();
const ohin = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const dataBR = iso => iso ? iso.split('-').reverse().join('/') : '';
const agoraTxt = () => new Date().toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
const carimbu = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };
function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, ms); }
function opsaun(sel, lista, primeiru) {
  sel.innerHTML = (primeiru ? `<option value="">${esc(primeiru)}</option>` : '') + lista.map(v => `<option>${esc(v)}</option>`).join('');
}

// ------------------------------------------------------------ Navegasaun
let viewAtual = 'dash';
function hatudu(v) {
  viewAtual = v;
  document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== 'v-' + v);
  document.querySelectorAll('.bottom button').forEach(b => b.classList.toggle('ativu', b.dataset.v === v));
  window.scrollTo(0, 0);
  render();
}
document.querySelectorAll('.bottom button').forEach(b => b.addEventListener('click', () => hatudu(b.dataset.v)));

// ------------------------------------------------------------ Filtru
const F = { tipu: '', ba_se: '', pelotaun: '', postu: '', hosi: '', too: '' };
function filtra(lista) {
  return lista.filter(r =>
    (!F.tipu || r.tipu === F.tipu) && (!F.ba_se || r.ba_se === F.ba_se) &&
    (!F.pelotaun || r.pelotaun === F.pelotaun) && (!F.postu || r.postu === F.postu) &&
    (!F.hosi || (r.data && r.data >= F.hosi)) && (!F.too || (r.data && r.data <= F.too)));
}
function filtruTxt() {
  const p = [];
  if (F.tipu) p.push('Tipu: ' + F.tipu); if (F.ba_se) p.push('Ba se: ' + F.ba_se);
  if (F.pelotaun) p.push('Pelotaun: ' + F.pelotaun); if (F.postu) p.push('Postu: ' + F.postu);
  if (F.hosi) p.push('Hosi: ' + dataBR(F.hosi)); if (F.too) p.push('Too: ' + dataBR(F.too));
  return p.length ? p.join(' | ') : 'Dadus hotu (la iha filtru)';
}
[['fTipu', 'tipu'], ['fBaSe', 'ba_se'], ['fPel', 'pelotaun'], ['fPostu', 'postu'], ['fHosi', 'hosi'], ['fToo', 'too']]
  .forEach(([id, k]) => $(id).addEventListener('change', e => { F[k] = e.target.value; render(); }));
$('fLimpa').addEventListener('click', () => { Object.keys(F).forEach(k => F[k] = ''); enxeFiltru(); render(); });

const baSeLista = () => [...new Set(DB.map(r => r.ba_se).filter(Boolean))].sort((a, b) => a.localeCompare(b));
const naranLista = () => [...new Set(DB.map(r => r.naran).filter(Boolean))].sort((a, b) => a.localeCompare(b));
function enxeFiltru() {
  opsaun($('fTipu'), TIPU, 'Hotu'); opsaun($('fBaSe'), baSeLista(), 'Hotu');
  opsaun($('fPel'), PELOTAUN, 'Hotu'); opsaun($('fPostu'), POSTU, 'Hotu');
  $('fTipu').value = F.tipu; $('fBaSe').value = F.ba_se; $('fPel').value = F.pelotaun;
  $('fPostu').value = F.postu; $('fHosi').value = F.hosi; $('fToo').value = F.too;
}

// ------------------------------------------------------------ Estatístika
function estatistika(regs) {
  const est = { total: 0, n: regs.length, tipu: {}, pel: {}, postu: {}, baSe: {}, ema: {} };
  TIPU.forEach(t => est.tipu[t] = { total: 0, n: 0 });
  PELOTAUN.forEach(p => est.pel[p] = { total: 0, n: 0 });
  for (const r of regs) {
    const v = Number(r.kuantidade) || 0;
    est.total += v;
    const add = (obj, k) => { obj[k] = obj[k] || { total: 0, n: 0 }; obj[k].total += v; obj[k].n++; };
    add(est.tipu, r.tipu || 'Seluk'); add(est.pel, r.pelotaun || 'La iha');
    add(est.postu, r.postu || 'La iha'); add(est.baSe, r.ba_se || '-');
    const k = chave(r.naran);
    if (!est.ema[k]) est.ema[k] = { naran: limpa(r.naran), postu: r.postu || '', pelotaun: r.pelotaun || '', total: 0, n: 0, tipu: Object.fromEntries(TIPU.map(t => [t, 0])) };
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
  $('dPel').innerHTML = barras(Object.entries(est.pel).map(([k, v]) => ({ label: k, ...v })), est.total);
  $('dTop').innerHTML = barras(est.listaEma.slice(0, 10).map(e => ({ label: `${e.rank}. ${e.postu} ${e.naran}`, ...e })), est.total);
  $('dPostu').innerHTML = barras(est.listaPostu.filter(p => p.total > 0).map(p => ({ label: p.postu, ...p })), est.total);
  $('dEmaN').textContent = `(${est.nEma} membru)`;
  const q = chave($('emaBuka').value);
  const lst = est.listaEma.filter(e => !q || e.naran.toLowerCase().includes(q));
  $('dEma').innerHTML = lst.length ? `<table><thead><tr><th>#</th><th>Naran</th><th class="num">Rej.</th><th class="num">Total</th></tr></thead><tbody>${lst.map(e =>
    `<tr><td>${e.rank}</td><td>${esc(e.naran)}<div class="mini">${esc(e.postu)} · ${esc(e.pelotaun)}</div></td><td class="num">${e.n}</td><td class="num"><b>${usd(e.total)}</b></td></tr>`).join('')}</tbody></table>`
    : '<div class="vaziu">La iha dadus.</div>';
}
$('emaBuka').addEventListener('input', renderDash);

// ------------------------------------------------------------ FORMULÁRIU
let editaId = null;
opsaun($('iPostu'), POSTU, '— Hili Postu —');
opsaun($('iPel'), PELOTAUN, '— Hili Pelotaun —');
opsaun($('iTipu'), TIPU, '— Hili Tipu —');
$('iData').value = ohin();

function renderForm() {
  $('lNaran').innerHTML = naranLista().map(n => `<option value="${esc(n)}">`).join('');
  $('lBaSe').innerHTML = baSeLista().map(n => `<option value="${esc(n)}">`).join('');
  const ikus = [...DB].sort((a, b) => (b.kria_iha || '').localeCompare(a.kria_iha || '')).slice(0, 8);
  $('formIkus').innerHTML = ikus.length ? ikus.map(itemHTML).join('') : '<div class="vaziu">Seidauk iha rejistu.</div>';
  ligaItem($('formIkus'));
}
// Bainhira hili naran ne'ebé iha ona, prense Postu no Pelotaun automátiku
$('iNaran').addEventListener('change', () => {
  const k = chave($('iNaran').value);
  const r = [...DB].reverse().find(x => chave(x.naran) === k);
  if (r) { if (r.postu) $('iPostu').value = r.postu; if (r.pelotaun) $('iPel').value = r.pelotaun; }
});

$('form').addEventListener('submit', e => {
  e.preventDefault();
  const d = {
    data: $('iData').value, naran: limpa($('iNaran').value), postu: $('iPostu').value, pelotaun: $('iPel').value,
    tipu: $('iTipu').value, ba_se: limpa($('iBaSe').value), kuantidade: Math.round(parseFloat(String($('iKuant').value).replace(',', '.')) * 100) / 100,
    obs: $('iObs').value.trim()
  };
  const erru = [];
  if (!d.data) erru.push('Hili Data.');
  if (!d.naran) erru.push('Prense Naran Kompletu.');
  if (!POSTU.includes(d.postu)) erru.push('Hili Postu.');
  if (!PELOTAUN.includes(d.pelotaun)) erru.push('Hili Pelotaun.');
  if (!TIPU.includes(d.tipu)) erru.push('Hili Tipu Kontribuisaun.');
  if (!d.ba_se) erru.push("Prense 'Ba se?'.");
  if (!(d.kuantidade > 0)) erru.push('Kuantidade tenke boot liu $0.');
  $('formErru').hidden = !erru.length; $('formErru').innerHTML = erru.map(esc).join('<br>');
  if (erru.length) { $('formErru').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

  if (editaId) {
    const r = DB.find(x => x.id === editaId);
    Object.assign(r, d, { atualiza_iha: new Date().toISOString() });
    grava(); toast('✓ Rejistu atualiza ona'); kanselaEdita(); hatudu('lista'); return;
  }
  DB.push({ id: uid(), ...d, operador: CFG.operador || '', dispozitivu: CFG.dispozitivu, kria_iha: new Date().toISOString() });
  if (!grava()) { DB.pop(); return; }
  toast(`✓ Save: ${d.naran} — ${usd(d.kuantidade)}`);
  $('iNaran').value = ''; $('iKuant').value = ''; $('iObs').value = '';
  $('iNaran').focus();
  renderForm();
});

function edita(id) {
  const r = DB.find(x => x.id === id); if (!r) return;
  editaId = id;
  hatudu('form');
  $('formTit').textContent = 'Edita Rejistu';
  $('iData').value = r.data || ''; $('iNaran').value = r.naran; $('iPostu').value = r.postu || '';
  $('iPel').value = r.pelotaun || ''; $('iTipu').value = r.tipu || ''; $('iBaSe').value = r.ba_se;
  $('iKuant').value = r.kuantidade; $('iObs').value = r.obs || '';
  $('btnKansela').hidden = false;
}
function kanselaEdita() {
  editaId = null; $('formTit').textContent = 'Rejistu Kontribuisaun Foun'; $('btnKansela').hidden = true;
  $('iNaran').value = ''; $('iKuant').value = ''; $('iObs').value = ''; $('formErru').hidden = true;
}
$('btnKansela').addEventListener('click', () => { kanselaEdita(); hatudu('lista'); });
function hamoos(id) {
  const r = DB.find(x => x.id === id); if (!r) return;
  if (!confirm(`Hamoos rejistu?\n${r.naran} — ${usd(r.kuantidade)} (${r.tipu} ba ${r.ba_se})`)) return;
  DB = DB.filter(x => x.id !== id); grava(); toast('Rejistu hamoos ona'); render();
}

// ------------------------------------------------------------ LISTA
let limiteLista = 50;
function itemHTML(r) {
  return `<div class="item"><div class="inf"><div class="nm">${esc(r.postu)} ${esc(r.naran)}</div>
    <div class="det"><span class="tag">${esc(r.tipu)}</span> ba <b>${esc(r.ba_se)}</b> · ${esc(r.pelotaun || '-')}</div>
    <div class="det">${dataBR(r.data) || 'la iha data'}${r.operador ? ' · rejista: ' + esc(r.operador) : ''}${r.obs ? ' · ' + esc(r.obs) : ''}</div>
    <div class="ak"><button class="btn btn-s" data-ed="${esc(r.id)}">Edita</button><button class="btn btn-x" data-del="${esc(r.id)}">Hamoos</button></div></div>
    <div class="val">${usd(r.kuantidade)}</div></div>`;
}
function ligaItem(cont) {
  cont.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => edita(b.dataset.ed));
  cont.querySelectorAll('[data-del]').forEach(b => b.onclick = () => hamoos(b.dataset.del));
}
function renderLista() {
  const q = chave($('lBuka').value), t = $('lTipu').value;
  const lst = DB.filter(r => (!t || r.tipu === t) && (!q || chave(r.naran).includes(q) || chave(r.ba_se).includes(q)))
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
  return [i + 1, r.data ? new Date(r.data + 'T00:00:00') : '', r.naran, r.postu, r.pelotaun, r.tipu, r.ba_se, Number(r.kuantidade) || 0, r.obs || '', r.operador || '', r.id];
}
const HEAD_DET = ['Nu', 'Data', 'Naran Kompletu', 'Postu', 'Pelotaun', 'Tipu', 'Ba se?', 'Kuantidade (USD)', 'Obs', 'Operador', 'ID'];

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
    e.push(['Nu', 'Postu', 'Naran Kompletu', 'Pelotaun', ...TIPU, 'TOTAL (USD)', 'Nu. Rejistu']);
    est.listaEma.forEach(x => e.push([x.rank, x.postu, x.naran, x.pelotaun, ...TIPU.map(t => x.tipu[t] || 0), x.total, x.n]));
    e.push(['', '', 'TOTAL JERÁL', '', ...TIPU.map(t => est.tipu[t].total), est.total, est.n]);
    XLSX.utils.book_append_sheet(wb, folha(e, [6, 14, 40, 13, 12, 12, 12, 12, 15, 11], [4, 5, 6, 7, 8], 5), 'Total Kada Ema');

    const benef = est.listaBaSe.map(b => b.ba_se);
    const m = kab('MATRIZ KONTRIBUISAUN: MEMBRU x BENEFISIÁRIU');
    m.push(['Nu', 'Postu', 'Naran Kompletu', 'Pelotaun', ...benef, 'Total Kada Ema']);
    const mat = {};
    regs.forEach(r => { const k = chave(r.naran); mat[k] = mat[k] || {}; mat[k][r.ba_se] = (mat[k][r.ba_se] || 0) + (Number(r.kuantidade) || 0); });
    [...est.listaEma].sort((a, b) => a.naran.localeCompare(b.naran)).forEach((x, i) =>
      m.push([i + 1, x.postu, x.naran, x.pelotaun, ...benef.map(b => mat[chave(x.naran)][b] || 0), x.total]));
    m.push(['', '', 'SUB-TOTAL', '', ...est.listaBaSe.map(b => b.total), est.total]);
    XLSX.utils.book_append_sheet(wb, folha(m, [6, 12, 40, 13, ...benef.map(() => 14), 16], [...benef.map((_, i) => 4 + i), 4 + benef.length], 5), 'Matriz Ema x Ba se');
  }
  const d = soDetalhu ? [] : kab('DETALHU REJISTU KONTRIBUISAUN');
  const h = d.length;
  d.push(HEAD_DET);
  regs.forEach((r, i) => d.push(linhaDetalhu(r, i)));
  if (!soDetalhu) d.push(['', '', '', '', '', '', 'TOTAL', est.total]);
  const wsD = folha(d, [6, 12, 38, 14, 13, 12, 22, 15, 30, 18, 12], [7], h);
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
<div class="meta"><span><b>Filtru:</b> ${esc(filtruTxt())}</span><span><b>Jera iha:</b> ${agoraTxt()}${CFG.operador ? ' · ' + esc(CFG.operador) : ''}</span></div>
<h2>1. Sumáriu Jerál</h2><div class="kp"><div class="p"><span>Total Jerál</span><b>${usd(est.total)}</b></div>
<div><span>Total Rejistu</span><b>${est.n}</b></div><div><span>Membru</span><b>${est.nEma}</b></div><div><span>Média / Membru</span><b>${usd(est.media)}</b></div></div>
<div class="d"><div><h2>2. Tuir Tipu</h2>${tGrupu('Tipu', TIPU.map(t => ({ label: t, ...est.tipu[t] })))}</div>
<div><h2>3. Tuir Pelotaun</h2>${tGrupu('Pelotaun', Object.entries(est.pel).map(([k, v]) => ({ label: k, ...v })))}</div></div>
<div class="d"><div><h2>4. Tuir Benefisiáriu (Ba se?)</h2>${tGrupu('Ba se?', est.listaBaSe.map(b => ({ label: b.ba_se, ...b })))}</div>
<div><h2>5. Tuir Postu</h2>${tGrupu('Postu', est.listaPostu.map(p => ({ label: p.postu, ...p })))}</div></div>
<h2>6. Total Kontribuisaun Kada Membru</h2><div class="tw"><table><thead><tr><th>#</th><th>Postu</th><th>Naran Kompletu</th><th>Pelotaun</th>${TIPU.map(t => `<th class="num">${t}</th>`).join('')}<th class="num">Total</th><th class="num">Rej.</th></tr></thead><tbody>
${est.listaEma.map(e => `<tr><td>${e.rank}</td><td>${esc(e.postu)}</td><td>${esc(e.naran)}</td><td>${esc(e.pelotaun)}</td>${TIPU.map(t => `<td class="num">${e.tipu[t] ? usd(e.tipu[t]) : '—'}</td>`).join('')}<td class="num"><b>${usd(e.total)}</b></td><td class="num">${e.n}</td></tr>`).join('')}
</tbody><tfoot><tr><td colspan="4">TOTAL JERÁL</td>${TIPU.map(t => `<td class="num">${usd(est.tipu[t].total)}</td>`).join('')}<td class="num">${usd(est.total)}</td><td class="num">${est.n}</td></tr></tfoot></table></div>
<h2>7. Detalhu Rejistu</h2><div class="tw"><table><thead><tr><th>#</th><th>Data</th><th>Postu</th><th>Naran</th><th>Pel.</th><th>Tipu</th><th>Ba se?</th><th class="num">USD</th><th>Obs</th></tr></thead><tbody>
${regs.map((r, i) => `<tr><td>${i + 1}</td><td>${dataBR(r.data)}</td><td>${esc(r.postu)}</td><td>${esc(r.naran)}</td><td>${esc((r.pelotaun || '').slice(0, 2))}</td><td>${esc(r.tipu)}</td><td>${esc(r.ba_se)}</td><td class="num">${usd(r.kuantidade)}</td><td>${esc(r.obs)}</td></tr>`).join('')}
</tbody><tfoot><tr><td colspan="7">TOTAL</td><td class="num">${usd(est.total)}</td><td></td></tr></tfoot></table></div>
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

// ------------------------------------------------------------ EXPORTA / IMPORTA
function backupBlob() {
  const pak = { app: 'kontribuisaun-ffdtl', versaun: 1, exporta_iha: new Date().toISOString(), operador: CFG.operador, dispozitivu: CFG.dispozitivu, total_rejistu: DB.length, rejistu: DB };
  return new Blob([JSON.stringify(pak, null, 1)], { type: 'application/json' });
}
const nomeBackup = () => `Backup_Kontribuisaun_${(CFG.operador || CFG.dispozitivu).replace(/[^\w]+/g, '_')}_${carimbu()}.json`;
function markaBackup() { CFG.ultimuBackup = new Date().toISOString(); gravaCfg(); renderCfg(); }
$('eJsonDl').onclick = () => { download(backupBlob(), nomeBackup()); markaBackup(); toast('Backup download ona'); };
$('eJsonSh').onclick = async () => { if (await fahe(backupBlob(), nomeBackup(), 'Backup Kontribuisaun')) markaBackup(); };
$('eXlsx').onclick = () => { download(geraExcel(true), `Rejistu_Kontribuisaun_${carimbu()}.xlsx`); toast('Excel exporta ona'); };

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
  return {
    id: limpa(o.id) || '', data, naran: limpa(o.naran), postu: limpa(o.postu), pelotaun: pel,
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
    const ix = { data: col(/^data/), naran: col(/naran/), postu: col(/postu/), pelotaun: col(/pelotaun|pel\./), tipu: col(/tipu/), ba_se: col(/ba se/), kuantidade: col(/kuantidade/), obs: col(/^(\d+\.\s*)?obs/), operador: col(/operador/), id: col(/^id$/) };
    for (const r of rows.slice(hi + 1)) {
      const o = {}; for (const [k, i] of Object.entries(ix)) o[k] = i >= 0 ? r[i] : '';
      if (!limpa(o.naran) || /^total/i.test(limpa(o.naran))) continue;
      out.push(o);
    }
    if (out.length) break; // uza folha primeiru ne'ebé iha dadus
  }
  return out;
}
function importa(lista, modu, origem) {
  const regs = lista.map(normaliza).filter(r => r.naran && r.ba_se && r.kuantidade > 0);
  const invalidu = lista.length - regs.length;
  if (modu === 'substitui') {
    if (!confirm(`SUBSTITUI: dadus atuál (${DB.length} rejistu) sei hamoos no troka ho ${regs.length} rejistu husi ficheiru. Kontinua?`)) return null;
    DB = regs.map(r => ({ ...r, id: r.id || uid() })); grava();
    return { aumenta: DB.length, repete: 0, invalidu, origem };
  }
  const ids = new Set(DB.map(r => r.id)), imp = new Set(DB.map(impressaun));
  let aumenta = 0, repete = 0;
  for (const r of regs) {
    if ((r.id && ids.has(r.id)) || imp.has(impressaun(r))) { repete++; continue; }
    r.id = r.id || uid(); DB.push(r); ids.add(r.id); imp.add(impressaun(r)); aumenta++;
  }
  grava();
  return { aumenta, repete, invalidu, origem };
}
function hatuduRez(z) {
  if (!z) return;
  $('iRez').hidden = false;
  $('iRez').innerHTML = `✓ Importa husi <b>${esc(z.origem)}</b>: <b>${z.aumenta}</b> rejistu foun` +
    (z.repete ? `, ${z.repete} ignora (iha ona)` : '') + (z.invalidu ? `, ${z.invalidu} la válidu` : '') + `.<br>Total agora: ${DB.length} rejistu.`;
  renderCfg(); toast(`Importa: ${z.aumenta} rejistu foun`);
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
    hatuduRez(importa(lista, $('iModu').value, f.name));
  } catch (err) { alert('ERRU importa: ' + err.message); }
});
$('iCefo').onclick = async () => {
  try {
    const j = await (await fetch('data/cefo24.json')).json();
    hatuduRez(importa(j.rejistu, 'kombina', 'CEFO 24'));
  } catch (e) { alert('La konsege karrega dadus CEFO 24: ' + e.message); }
};
$('cHamoos').onclick = () => {
  const t = prompt(`Hamoos rejistu HOTU (${DB.length}) husi telefone ida-ne'e?\nHalo backup uluk!\n\nHakerek HAMOOS atu konfirma:`);
  if (t && t.trim().toUpperCase() === 'HAMOOS') { DB = []; grava(); renderCfg(); toast('Dadus hotu hamoos ona'); }
};
$('cOperador').addEventListener('input', e => { CFG.operador = e.target.value.trim(); gravaCfg(); });

function renderCfg() {
  $('cOperador').value = CFG.operador;
  const tot = DB.reduce((s, r) => s + (Number(r.kuantidade) || 0), 0);
  $('cInfo').innerHTML = `<b>${DB.length}</b> rejistu · Total <b>${usd(tot)}</b><br><span class="mini">ID telefone: ${esc(CFG.dispozitivu)}</span>`;
  if (CFG.ultimuBackup) {
    const dias = Math.floor((Date.now() - new Date(CFG.ultimuBackup)) / 864e5);
    $('cBackupInfo').textContent = `Backup ikus: ${new Date(CFG.ultimuBackup).toLocaleString('pt-PT')}` + (dias >= 7 ? ` — ⚠ liu ${dias} loron, halo backup foun!` : '');
  } else $('cBackupInfo').textContent = DB.length ? '⚠ Seidauk halo backup. Halo backup regularmente!' : '';
  $('appVer').textContent = APP_VER;
}

// ------------------------------------------------------------ Render jerál
function render() {
  if (viewAtual === 'dash') renderDash();
  else if (viewAtual === 'form') renderForm();
  else if (viewAtual === 'lista') renderLista();
  else if (viewAtual === 'rel') renderRel();
  else if (viewAtual === 'cfg') renderCfg();
}
// Sinkroniza bainhira tab seluk muda dadus
window.addEventListener('storage', e => { if (e.key === K_DADUS) { DB = leJSON(K_DADUS, []); render(); } });

// ------------------------------------------------------------ Instalasaun (PWA)
let promptInstala = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptInstala = e; $('btnInstall').hidden = false; });
$('btnInstall').onclick = async () => { if (!promptInstala) return; promptInstala.prompt(); await promptInstala.userChoice; promptInstala = null; $('btnInstall').hidden = true; };
window.addEventListener('appinstalled', () => { $('btnInstall').hidden = true; toast('✓ App instala ona'); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });

render();
