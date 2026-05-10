import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json()

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' },
            },
            {
              type: 'text',
              text: `Analyze this background photo for a fashion AI photo shoot. Return ONLY valid JSON with these exact fields:
{
  "scene": "brief location name (e.g. 'Parisian café', 'Tokyo street at night', 'tropical beach')",
  "style": "fashion style name fitting this location (e.g. 'Chic French', 'Harajuku Street', 'Resort Wear')",
  "prompt": "a detailed fashion photography prompt starting with 'fashion photography of a person,' describing the setting, lighting, outfit that fits this location, pose, camera settings, high quality"
}`,
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    })

    const data = JSON.parse(response.choices[0].message.content!)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
