# Testes do Sugestor de Classificação

O sugestor roda só no navegador (`index.html`) e não envia o teor para lugar nenhum.
Esta pasta guarda uma bateria de manifestações fictícias para medir o sugestor e evitar
que um ajuste nas regras quebre outro caso sem ninguém perceber.

## Como rodar

Precisa só do Node.js (não há dependências para instalar).

```bash
node tests/rodar.js
```

```bash
node tests/rodar.js -v
```

```bash
node tests/rodar.js "texto da manifestação"
```

- O primeiro comando mostra o placar e as falhas.
- `-v` mostra a sugestão dada para cada caso.
- Com um texto entre aspas, analisa só esse teor e mostra o raciocínio: evidências, ressalvas e tags.

O script também confere o léxico: toda regra precisa apontar para um subassunto que exista na
árvore, toda tag precisa existir no catálogo e nenhum subassunto pode ficar sem regra.

## Os casos (`casos.js`)

São 266 manifestações escritas como chegam à Ouvidoria: vindas do cidadão pelo Fala.BR, de
servidores e terceirizados, ou transcritas pela equipe a partir de telefone, e-mail ou
atendimento presencial. Elas incluem erros de digitação, textos longos e formais, frases
curtas e assuntos de outros órgãos.

| Conjunto | Casos | Para que serve |
|---|---|---|
| `dev` | 112 | Usado para escrever as regras (inclui os 12 casos práticos do simulador) |
| `val` | 49 | Escrito antes do motor novo; também acabou orientando ajustes |
| `cego` | 50 | Escrito com o motor congelado, para medir o acerto em texto nunca visto |
| `cego2` | 55 | Segundo lote inédito, escrito depois de ajustar o léxico com base no `cego` |

Para incluir um caso real, anonimize o teor e acrescente uma linha no fim de `casos.js`,
informando a classificação correta em `e`.

## Resultados

**Primeira rodada nos lotes inéditos.** Esta é a melhor estimativa de como o sugestor se
comporta com manifestações novas:

| | Sugestor antigo | Sugestor novo, 1ª rodada |
|---|---|---|
| `cego`: classificação principal correta | 19 de 50 | 33 de 50 |
| `cego2`: classificação principal correta | 17 de 55 | 34 de 55 |
| Sugestões com confiança "alta" que estavam erradas | 18 de 97 (19%), na bateria toda | 1 de 45 (2%), nos dois lotes inéditos |

Depois de cada rodada, os erros viraram ajustes no léxico. Hoje os 266 casos passam. Esse
resultado, porém, mede regras ajustadas em cima dos próprios casos: com manifestações novas,
espere algo mais próximo da primeira rodada, com acerto na faixa de 60–65% na primeira
sugestão. Nesses casos, a confiança "alta" quase sempre está certa. Quando a confiança é
média ou baixa, confira o teor.

O ganho mais importante não está no acerto bruto, e sim em quando o sugestor aceita dar
confiança "alta". Quando não tem certeza, ele diz isso e explica por quê.

## Quando a sugestão falha

A falha mais comum é **"sem sugestão" em um caso que tinha classe**. Isso acontece quando o
teor descreve o fato com palavras que ainda não estão no léxico. Para corrigir:

1. Rode `node tests/rodar.js "o texto"` para ver o que foi reconhecido.
2. Acrescente o termo ao conceito certo em `SG_CONCEITOS` (no `index.html`). A sintaxe dos padrões está explicada no comentário no topo do motor.
3. Acrescente o texto como caso em `casos.js` e rode a bateria inteira.
