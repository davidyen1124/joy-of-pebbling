import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// Files in public/ keep their names from one build to the next, and a browser may keep its copy of one
// for a while (how long is the host's decision: GitHub Pages sets the cache headers, the site cannot). So
// a returning visitor can have an old copy of the studio beside today's code, which once stopped the page
// dead. Each folder gets a stamp made from its contents, and the code asks for "file?v=stamp"
// (src/asset.js): change a file and its address changes with it.
function stamp(dir) {
  const h = createHash('sha1')
  const walk = (d) => {
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f)
      if (fs.statSync(p).isDirectory()) walk(p)
      else {
        h.update(f)
        h.update(fs.readFileSync(p))
      }
    }
  }
  if (fs.existsSync(dir)) walk(dir)
  return h.digest('hex').slice(0, 10)
}

export default defineConfig(() => ({
  // Relative base so the same build works at a domain root or under a sub-path
  // such as GitHub Pages' https://<user>.github.io/<repo>/.
  base: './',
  define: {
    __STAMP__: JSON.stringify(Object.fromEntries(['models', 'plates', 'sfx', 'voice'].map((d) => [d, stamp(`public/${d}`)]))),
  },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  server: { host: '127.0.0.1' },
}))
