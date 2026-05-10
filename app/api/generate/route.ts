import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

const STYLE_PROMPTS: Record<string, string> = {
  auto: '',
  editorial: 'editorial fashion photography, magazine cover quality, high fashion, professional model pose, Vogue style',
  street: 'street style fashion photography, urban background, candid natural pose, trendy outfit, VSCO aesthetic',
  cinematic: 'cinematic fashion photography, dramatic moody lighting, film still, artistic composition, shallow depth of field',
  luxury: 'luxury high fashion photography, designer outfit, elegant sophisticated pose, premium quality, elite fashion',
  casual: 'casual chic fashion photography, effortless natural style, warm tones, lifestyle photography, relaxed pose',
  culture: 'cultural fashion photography, local traditional style, authentic location, vibrant colors, story-driven',
}

interface Analysis {
  scene: string
  style: string
  prompt: string
}

function buildPrompt(
  style: string,
  analysis: Analysis | null,
  customPrompt: string,
): string {
  if (customPrompt.trim()) {
    const scene = analysis?.scene ? `in ${analysis.scene}` : ''
    return `fashion photography of a beautiful person ${scene}, ${customPrompt}, professional photo, 8k resolution, beautiful lighting, perfect composition, high quality`
  }

  if (style === 'auto' && analysis?.prompt) {
    return `${analysis.prompt}, 8k resolution, high quality, perfect composition, professional fashion photography`
  }

  const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.editorial
  const scene = analysis?.scene ? `in ${analysis.scene}` : 'in a beautiful location'
  return `fashion photography of a beautiful person ${scene}, ${styleDesc}, 8k resolution, high quality, beautiful lighting, perfect composition`
}

export async function POST(req: NextRequest) {
  try {
    const { faceUrl, style, analysis, customPrompt } = await req.json()

    if (!faceUrl) {
      return NextResponse.json({ error: 'No face URL provided' }, { status: 400 })
    }

    const prompt = buildPrompt(style, analysis, customPrompt)
    const negativePrompt =
      'ugly, deformed, mutated, bad anatomy, bad hands, extra fingers, missing fingers, blurry, low quality, watermark, text, logo, distorted face, bad proportions'

    // Accept either a URL or a base64 data URI
    const faceInput = faceUrl.startsWith('data:') ? faceUrl : faceUrl

    const prediction = await replicate.predictions.create({
      model: 'zsxkib/instant-id',
      input: {
        image: faceInput,
        prompt,
        negative_prompt: negativePrompt,
        num_inference_steps: 30,
        guidance_scale: 5.0,
        ip_adapter_scale: 0.8,
        controlnet_conditioning_scale: 0.8,
        width: 832,
        height: 1216,
        sdxl_weights: 'protovision-xl-high-fidel',
      },
    })

    return NextResponse.json({ predictionId: prediction.id })
  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: 'Generation failed to start' }, { status: 500 })
  }
}
