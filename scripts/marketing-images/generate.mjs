// Autonomous marketing-image generator (Epic 26 people photography).
//
// Calls Nano Banana Pro (gemini-3-pro-image) via the Gemini generateContent
// API, decodes the returned image, optimizes to WebP, and writes it. Run with
// the key loaded from .env.local:
//
//   node --env-file=.env.local scripts/marketing-images/generate.mjs \
//     --prompt "..." --out public/images/marketing/people/foo.webp [--ar 4:3] [--size 2K]
//
// The key is read from process.env.GEMINI_API_KEY and never logged or committed.

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const STYLE = '' // (locked style is baked into the prompt by the caller/manifest)

const argv = process.argv.slice(2)
const arg = (flag, def) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : def
}

const prompt = arg('--prompt')
const out = arg('--out')
const aspectRatio = arg('--ar', '4:3')
const imageSize = arg('--size', '2K')
const model = arg('--model', 'gemini-3-pro-image')

if (!prompt || !out) {
  console.error('usage: --prompt "..." --out path.webp [--ar 4:3] [--size 2K]')
  process.exit(1)
}
const key = process.env.GEMINI_API_KEY
if (!key) {
  console.error(
    'GEMINI_API_KEY not set (run with: node --env-file=.env.local ...)'
  )
  process.exit(1)
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const res = await fetch(url, {
  method: 'POST',
  headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: STYLE + prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio, imageSize },
    },
  }),
})

const json = await res.json()
if (!res.ok || json.error) {
  console.error(
    'API error:',
    res.status,
    JSON.stringify(json.error || json, null, 2)
  )
  process.exit(1)
}

const parts = json.candidates?.[0]?.content?.parts || []
const img = parts.find((p) => p.inlineData?.data)
if (!img) {
  console.error(
    'no image in response. parts:',
    JSON.stringify(parts).slice(0, 400)
  )
  process.exit(1)
}

const raw = Buffer.from(img.inlineData.data, 'base64')
fs.mkdirSync(path.dirname(out), { recursive: true })
await sharp(raw).webp({ quality: 90 }).toFile(out)
// PNG review copy alongside (for visual QC; not for production).
const review = out.replace(/\.webp$/, '.review.png')
await sharp(raw).png().toFile(review)
const meta = await sharp(raw).metadata()
console.log(
  `✓ ${out}  (${meta.width}x${meta.height}, ${img.inlineData.mimeType})`
)
console.log(`  review: ${review}`)
