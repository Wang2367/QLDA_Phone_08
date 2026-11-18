import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const directory = resolve('dist')
const html = await readFile(resolve(directory, 'index.html'), 'utf8')
const scriptTag = /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/
const styleTag = /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/
const scriptPath = html.match(scriptTag)?.[1]
const stylePath = html.match(styleTag)?.[1]

if (!scriptPath || !stylePath) {
  throw new Error('Build PhoneFlow before exporting the standalone HTML.')
}

const [script, style] = await Promise.all([
  readFile(resolve(directory, scriptPath), 'utf8'),
  readFile(resolve(directory, stylePath), 'utf8'),
])
const standalone = html
  .replace(scriptTag, () => '<script type="module">\n' + script.replace(/<\/script/gi, '<\\/script') + '\n</script>')
  .replace(styleTag, () => '<style>\n' + style + '\n</style>')
await writeFile(resolve(directory, 'PhoneFlow.html'), standalone, 'utf8')
console.log('Created dist/PhoneFlow.html')

