#!/usr/bin/env node
/*
 * Confere o Sugestor de Classificação contra os casos de tests/casos.js.
 *
 *   node tests/rodar.js          resumo + falhas
 *   node tests/rodar.js -v       também mostra a sugestão de cada caso
 *   node tests/rodar.js "texto"  analisa um teor avulso e mostra o raciocínio
 *
 * Lê o motor direto do index.html (não há cópia do código aqui).
 */
const fs = require('fs'), vm = require('vm'), path = require('path');

function carregarMotor() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('classificationTree'));
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, value: '', innerHTML: '', innerText: '', textContent: '', style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, addEventListener() {}, focus() {}, querySelectorAll() { return []; } });
  const ctx = { console, setTimeout() {}, document: { getElementById: el, addEventListener() {}, body: el('body'), documentElement: el('html'), querySelectorAll() { return []; } }, window: { addEventListener() {}, matchMedia() { return { matches: false }; }, innerWidth: 1280 }, localStorage: { getItem() { return null; }, setItem() {} }, sessionStorage: { getItem() { return null; }, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { analisar: (t) => vm.runInContext('analyzeManifestation', ctx)(t), ctx };
}

const { analisar, ctx } = carregarMotor();
const args = process.argv.slice(2);
const verboso = args.includes('-v');
const avulso = args.find(a => !a.startsWith('-'));

function descrever(r) {
  if (r.vazio) return `  (sem sugestão)${r.tagsTexto.length ? '  tags: ' + r.tagsTexto.join(', ') : ''}`;
  return r.candidates.map((c, i) => `  ${i ? ' alt' : 'TOPO'} ${c.score.toFixed(2)} ${c.nivel.padEnd(5)} ${c.a} › ${c.s}`).join('\n');
}

if (avulso) {
  const r = analisar(avulso);
  console.log(descrever(r));
  console.log('  leitura:', JSON.stringify(r.leitura));
  if (r.pergunta) console.log('  pergunta:', r.pergunta);
  r.candidates.forEach(c => {
    console.log(`\n  ${c.a} › ${c.s}`);
    c.motivos.forEach(m => console.log(`    + ${m.texto}  [${m.trechos.map(t => t.t).join(' | ')}]`));
    c.ressalvas.forEach(x => console.log(`    - ${x}`));
    if (c.porque.length) console.log(`    ~ ${c.porque.join('; ')}`);
    console.log(`    tags: ${[...c.selectedTags].join(', ')}`);
  });
  process.exit(0);
}

// 1. Integridade do léxico: toda classe e toda tag citadas nas regras existem na árvore/catálogo.
const erros = vm.runInContext(`(() => {
  const erros = [], nomes = new Set(globalTags.map(g => g.nome));
  const existe = (a, s) => classificationTree.some(x => x.id === a && x.subassuntos.includes(s));
  SG_REGRAS.forEach(r => { if (!existe(r.a, r.s)) erros.push('classe fora da árvore: ' + r.a + ' › ' + r.s); r.fixas.forEach(t => { if (!nomes.has(t)) erros.push('tag fixa fora do catálogo: ' + t); }); });
  Object.entries(SG_ASSEDIO).forEach(([k, d]) => { const [a, s] = k.split('|'); if (!existe(a, s)) erros.push('classe fora da árvore: ' + k); d.fixas.forEach(t => { if (!nomes.has(t)) erros.push('tag fixa fora do catálogo: ' + t); }); });
  SG_TAGS.forEach(d => { if (!nomes.has(d.t)) erros.push('tag fora do catálogo: ' + d.t); });
  SG_ENTIDADES.forEach(e => { if (e[2] && !nomes.has(e[2])) erros.push('tag de entidade fora do catálogo: ' + e[2]); });
  classificationTree.forEach(x => x.subassuntos.forEach(s => { if (!SG_REGRAS.some(r => r.a === x.id && r.s === s) && !SG_ASSEDIO[x.id + '|' + s]) erros.push('subassunto sem regra: ' + x.id + ' › ' + s); }));
  return erros;
})()`, ctx);
if (erros.length) { console.log('PROBLEMAS NO LÉXICO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exitCode = 1; }

// 2. Casos
const casos = require('./casos.js');
const igual = (c, p) => c && p && c.a === p[0] && c.s === p[1];
const placar = {}, falhas = [];
for (const k of casos) {
  const r = analisar(k.t), topo = r.candidates[0], problemas = [];
  if (k.nenhum && topo) problemas.push(`não deveria sugerir; sugeriu ${topo.a} › ${topo.s} (${topo.score})`);
  if (k.e && ![k.e, ...(k.alt || [])].some(p => igual(topo, p))) problemas.push(`esperado ${k.e.join(' › ')}; veio ${topo ? `${topo.a} › ${topo.s} (${topo.score})` : 'NADA'}`);
  (k.nao || []).forEach(a => r.candidates.filter(c => c.a === a).forEach(c => problemas.push(`não deveria aparecer ${c.a} › ${c.s} (${c.score})`)));
  if (k.semAlta && topo && topo.nivel === 'alta') problemas.push('confiança alta em caso ambíguo');
  if (k.tags) { const marcadas = topo ? [...topo.selectedTags] : r.tagsTexto; k.tags.forEach(t => { if (!marcadas.includes(t)) problemas.push(`tag ausente: ${t}`); }); }
  const p = placar[k.c] || (placar[k.c] = { ok: 0, n: 0, alta: 0, altaErrada: 0 });
  p.n++; if (!problemas.length) p.ok++; else falhas.push({ k, problemas, r });
  if (topo && topo.nivel === 'alta') { p.alta++; if (problemas.some(x => !x.startsWith('tag ausente'))) p.altaErrada++; }
  if (verboso) console.log(`${problemas.length ? '✗' : '✓'} [${k.c}] ${k.t.slice(0, 110)}\n${descrever(r)}`);
}

console.log('\nResultado');
Object.entries(placar).forEach(([c, p]) => console.log(`  ${c.padEnd(4)} ${p.ok}/${p.n} corretos · ${p.alta} com confiança alta, ${p.altaErrada} deles errados`));
if (falhas.length) {
  console.log(`\nFalhas (${falhas.length})`);
  falhas.forEach(f => console.log(`- [${f.k.c}] ${f.k.t.slice(0, 100)}\n${f.problemas.map(x => '     ' + x).join('\n')}\n${descrever(f.r)}`));
  process.exitCode = 1;
}
