# Rotina 1.2

App pessoal de hábitos e metas. Funciona no browser (PWA), sem contas e sem servidores:
os dados ficam guardados no próprio telemóvel (localStorage).

## Ficheiros (todos na raiz do repositório)

`index.html`, `style.css`, `manifest.json`, `sw.js` (funcionamento offline), `young-serif.woff2`, os 3 ícones
e os scripts, carregados por esta ordem:

| Ficheiro | Para quê |
|---|---|
| `core.js` | constantes, utilitários, estado, migração de dados (v1, v2 e v3) |
| `rules.js` | regras: versões de meta, modos, ciclo do ginásio, estados e totais |
| `stats.js` | streaks, padrões, sono, cruzamentos, revisões, CSV |
| `charts.js` | gráficos em SVG |
| `views.js` | ecrãs (Hoje, Histórico, Análise, Metas, Dados) |
| `sheets.js` | folhas de edição (meta, categoria, modo, período) |
| `library.js` | metas sugeridas (catálogo editável: lista `CATALOG`) |
| `app.js` | ações, eventos e arranque |

## Como se mexe no código

- Mudar o aspeto: `style.css` (cores no topo, em `:root`).
- Mudar uma regra (por exemplo, como se avalia o ciclo): `rules.js`.
- Acrescentar uma análise: `stats.js` (cálculo) e `views.js` (ecrã).
- Depois de qualquer alteração, muda o número em `sw.js` (`const CACHE = 'rotina-vN'`) para a app atualizar nos telemóveis.

## Dados

Os dados têm um número de versão (`v`) e são migrados automaticamente ao abrir a app. Antes de migrar dados
antigos, a app guarda uma cópia (Dados, "Voltar à cópia anterior à atualização").
A tabela CSV (Dados) usa `;` como separador e vírgula decimal. Em Python: `pd.read_csv(f, sep=';', decimal=',')`.
