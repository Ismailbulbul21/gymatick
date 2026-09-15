// Starts the Vite dev server, or explains what to do when port 5173 is already taken
// (usually because GYMATICK is already running in another window).
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { fileURLToPath } from 'node:url'

const PORT = 5173

const portInUse = () =>
  new Promise((resolve) => {
    const socket = createConnection({ port: PORT, host: 'localhost' })
    socket.setTimeout(1000)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => resolve(false))
  })

if (await portInUse()) {
  console.log(`
  Port ${PORT} is already in use, so GYMATICK is probably running already.

  Open http://localhost:${PORT} in your browser, or close the other copy
  (another terminal window, or the preview inside Claude) and run npm run dev again.
`)
  process.exit(0)
}

const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const child = spawn(process.execPath, [vite, ...process.argv.slice(2)], { stdio: 'inherit' })
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
