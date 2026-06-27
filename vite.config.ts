import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// The source of truth for problem data lives at <root>/data/striver_sheet.json
// (written by scripts/sync.py and committed by GitHub Actions). It is intentionally
// NOT inside public/. This small plugin makes that single file available to the
// frontend in both dev (served at /data/*) and build (copied into dist/data/*),
// so there is never a second copy to keep in sync.
function striverData(): Plugin {
  const dataDir = path.resolve(__dirname, 'data')
  return {
    name: 'striver-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const file = path.join(dataDir, (req.url || '').split('?')[0])
        if (!file.startsWith(dataDir) || !fs.existsSync(file)) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        fs.createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      const out = path.resolve(__dirname, 'dist', 'data')
      if (!fs.existsSync(dataDir)) return
      fs.mkdirSync(out, { recursive: true })
      for (const f of fs.readdirSync(dataDir)) {
        fs.copyFileSync(path.join(dataDir, f), path.join(out, f))
      }
    },
  }
}

// Relative base so the build works under any GitHub Pages project path
// (https://<user>.github.io/<repo>/) without hardcoding the repo name.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react(), striverData()],
}))
