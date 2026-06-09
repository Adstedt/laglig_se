/* eslint-disable no-console */
/**
 * One-off: generates photorealistic headshot avatars for the demo workspace team
 * via the OpenAI image API. Saves PNGs to public/demo-team/.
 * Run: pnpm tsx scripts/gen-avatars.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

const KEY = process.env.OPENAI_API_KEY
if (!KEY) {
  console.error('OPENAI_API_KEY missing')
  process.exit(1)
}

const STYLE =
  'Professional corporate LinkedIn-style headshot, head and shoulders, face centered and looking at the camera, friendly natural expression, soft even studio lighting, plain light neutral grey background, business-casual attire, sharp focus, photorealistic, high quality.'

const PEOPLE = [
  {
    file: 'anna',
    prompt: `${STYLE} A Scandinavian woman in her mid-40s with shoulder-length blonde hair, subtle confident smile.`,
  },
  {
    file: 'sofia',
    prompt: `${STYLE} A woman in her early 30s with dark brown hair in a low bun, warm welcoming smile.`,
  },
  {
    file: 'erik',
    prompt: `${STYLE} A man in his early 50s with short greying hair and light stubble, calm assured expression.`,
  },
  {
    file: 'johan',
    prompt: `${STYLE} A man in his mid-30s with short dark hair and a neat short beard, approachable smile.`,
  },
  {
    file: 'maria',
    prompt: `${STYLE} A woman in her early 40s with auburn hair to her shoulders, glasses, friendly professional expression.`,
  },
]

async function generate(prompt: string): Promise<string | null> {
  // Primary: gpt-image-1
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
        quality: 'medium',
        n: 1,
      }),
    })
    const json = await res.json()
    if (json?.data?.[0]?.b64_json) return json.data[0].b64_json
    console.warn('  gpt-image-1 failed:', JSON.stringify(json).slice(0, 220))
  } catch (e) {
    console.warn('  gpt-image-1 error:', (e as Error).message)
  }
  // Fallback: dall-e-3
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json',
        n: 1,
      }),
    })
    const json = await res.json()
    if (json?.data?.[0]?.b64_json) return json.data[0].b64_json
    console.error('  dall-e-3 failed:', JSON.stringify(json).slice(0, 220))
  } catch (e) {
    console.error('  dall-e-3 error:', (e as Error).message)
  }
  return null
}

async function main() {
  for (const p of PEOPLE) {
    console.log(`Generating ${p.file}…`)
    const b64 = await generate(p.prompt)
    if (!b64) {
      console.error(`  ✗ ${p.file} — no image`)
      continue
    }
    const out = resolve(process.cwd(), 'public/demo-team', `${p.file}.png`)
    writeFileSync(out, Buffer.from(b64, 'base64'))
    console.log(`  ✓ saved ${out}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
