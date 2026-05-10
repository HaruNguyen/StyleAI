import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

const STYLE_PROMPTS: Record<string, string> = {
  auto: 'fashion photography, professional photo, beautiful lighting',
  editorial: 'editorial fashion photography, magazine cover quality, Vogue style, high fashion',
  street: 'street style fashion photography, urban, candid natural pose, trendy',
  cinematic: 'cinematic fashion photography, dramatic moody lighting, film still, artistic',
  luxury: 'luxury high fashion photography, designer outfit, elegant sophisticated pose',
  casual: 'casual chic fashion photography, effortless natural style, warm tones, lifestyle',
  culture: 'cultural fashion photography, local traditional style, authentic location, vibrant',
}

interface Analysis {
  scene: string
  style: string
  prompt: string
}

function buildPrompt(style: string, analysis: Analysis | null, customPrompt: string): string {
  const scene = analysis?.scene ? `in ${analysis.scene}` : 'in a beautiful location'

  if (customPrompt.trim()) {
    return `fashion photography of a person ${scene}, ${customPrompt}, professional photo, 8k, beautiful lighting, high quality`
  }

  if (style === 'auto' && analysis?.prompt) {
    return `${analysis.prompt}, 8k resolution, high quality`
  }

  const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.editorial
  return `${styleDesc} of a person ${scene}, 8k resolution, beautiful lighting, high quality`
}

export async function POST(req: NextRequest) {
  try {
    const { faceUrl, style, analysis, customPrompt } = await req.json()

    if (!faceUrl) {
      return NextResponse.json({ error: 'No face image provided' }, { status: 400 })
    }

    const prompt = buildPrompt(style, analysis, customPrompt)
    const negativePrompt =
      'ugly, deformed, mutated, bad anatomy, extra fingers, blurry, low quality, watermark, text, distorted face'

    console.log('Creating prediction with prompt:', prompt.slice(0, 100))

    const prediction = await replicate.predictions.create({
      model: 'zsxkib/instant-id',
      input: {
        image: faceUrl,
        prompt,
        negative_prompt: negativePrompt,
        num_inference_steps: 30,
        guidance_scale: 5.0,
        ip_adapter_scale: 0.8,
        controlnet_conditioning_scale: 0.8,
        width: 832,
        height: 1216,
      },
    })

    console.log('Prediction created:', prediction.id)
    return NextResponse.json({ predictionId: prediction.id })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Generate error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
