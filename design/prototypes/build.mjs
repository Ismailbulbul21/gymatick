// Builds the GYMATICK screen prototypes:
//   design/prototypes/artboards/*.dc.html   (design canvas artboards)
//   design/prototypes/artboards/canvas.json (layout)
//   public/__proto/*.html                   (plain previews, only with --preview)
// Usage: node design/prototypes/build.mjs [--preview]
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadIcons, ICON_NAMES } from './src/icons.mjs'
import { SCREENS, PAGES } from './src/registry.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, 'artboards')
const previewDir = path.resolve(here, '../../public/__proto')
const heightsFile = path.join(here, 'heights.json')
const withPreview = process.argv.includes('--preview')

await loadIcons(ICON_NAMES)
const { artboard } = await import('./src/components.mjs')

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
if (withPreview) mkdirSync(previewDir, { recursive: true })

const heights = existsSync(heightsFile) ? JSON.parse(readFileSync(heightsFile, 'utf8')) : {}
const layout = []
const cursor = {}

for (const s of SCREENS) {
  const { dc, preview } = artboard(await s.render())
  const stem = s.file.replace('.dc.html', '')
  writeFileSync(path.join(outDir, s.file), dc)
  if (withPreview) writeFileSync(path.join(previewDir, `${stem}.html`), preview)

  const h = s.h ?? Math.ceil((heights[stem] ?? 900) + 2)
  const c = (cursor[s.page] ??= { x: 0, y: 0, rowH: 0, col: 0 })
  if (s.newRow && c.col > 0) {
    c.x = 0
    c.y += c.rowH + 160
    c.rowH = 0
    c.col = 0
  }
  layout.push({ file: s.file, title: s.title, x: c.x, y: c.y, w: s.w, h, page: s.page })
  c.x += s.w + 120
  c.rowH = Math.max(c.rowH, h)
  c.col += 1
}

const canvas = {
  pages: PAGES,
  artboards: layout,
  launch: { view: 'canvas', page: PAGES[0].id },
}
writeFileSync(path.join(outDir, 'canvas.json'), JSON.stringify(canvas, null, 2))
if (withPreview) {
  const list = SCREENS.map((s) => ({ stem: s.file.replace('.dc.html', ''), w: s.w, fixed: s.h ?? null }))
  writeFileSync(path.join(previewDir, 'screens.json'), JSON.stringify(list))
  // measure.html loads every preview in an iframe at its frame width and reports content heights.
  writeFileSync(
    path.join(previewDir, 'measure.html'),
    `<!doctype html><html><body><pre id="out">measuring…</pre><script>
const list=${JSON.stringify(list)};
(async()=>{const res={};for(const s of list){const f=document.createElement('iframe');f.style.cssText='width:'+s.w+'px;height:900px;border:0;position:absolute;left:-99999px';f.src=s.stem+'.html';document.body.appendChild(f);await new Promise(r=>f.onload=r);await f.contentDocument.fonts.ready;await new Promise(r=>setTimeout(r,150));const root=f.contentDocument.body.firstElementChild;res[s.stem]=Math.ceil(root.getBoundingClientRect().height);f.remove();}document.getElementById('out').textContent=JSON.stringify(res);})();
</script></body></html>`,
  )
}
console.log(`Built ${SCREENS.length} artboards → ${path.relative(process.cwd(), outDir)}${withPreview ? ' (+ previews)' : ''}`)
