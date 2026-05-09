// Image generation via Replicate's FLUX schnell.
// Kept under `fal.ts` / `falGenerate` to avoid churn in the route handler.
// Free tier: Replicate gives ~$5/month credit per verified GitHub account,
// which covers ~1500 generations at $0.003/image.
import Replicate from 'replicate'

const FLUX_SCHNELL = 'black-forest-labs/flux-schnell' as const

let client: Replicate | null = null

function getClient(): Replicate {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is not set')
  }
  if (!client) client = new Replicate()
  return client
}

export async function falGenerate(
  prompt: string,
  seed: number,
): Promise<{ imageUrl: string; seed: number }> {
  const replicate = getClient()

  const out = await replicate.run(FLUX_SCHNELL, {
    input: {
      prompt,
      seed,
      num_outputs: 1,
      aspect_ratio: '1:1',
      output_format: 'webp',
      output_quality: 80,
      go_fast: true,
    },
  })

  // Replicate's run() returns FileOutput[] for image models. FileOutput
  // has a `.url()` method and is also stringifiable to its hosted URL.
  // Older SDK versions return string[]. Handle both.
  const first = Array.isArray(out) ? out[0] : out
  if (!first) {
    throw new Error('flux/schnell returned no output')
  }

  const fileLike = first as { url?: () => unknown }
  const imageUrl =
    typeof first === 'string'
      ? first
      : typeof fileLike.url === 'function'
      ? String(fileLike.url())
      : String(first)

  if (!imageUrl || !imageUrl.startsWith('http')) {
    throw new Error('flux/schnell returned unexpected shape')
  }

  return { imageUrl, seed }
}
