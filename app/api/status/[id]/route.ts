import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const prediction = await replicate.predictions.get(params.id)
    return NextResponse.json({
      status: prediction.status,
      output: prediction.output,
      error: prediction.error,
    })
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Could not check status' }, { status: 500 })
  }
}
