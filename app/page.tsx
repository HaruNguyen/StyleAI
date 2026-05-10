'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const STYLES = [
  { id: 'auto', emoji: '✨', label: 'Auto' },
  { id: 'editorial', emoji: '📸', label: 'Editorial' },
  { id: 'street', emoji: '🛤️', label: 'Street' },
  { id: 'cinematic', emoji: '🎬', label: 'Cinematic' },
  { id: 'luxury', emoji: '💎', label: 'Luxury' },
  { id: 'casual', emoji: '😊', label: 'Casual' },
  { id: 'culture', emoji: '🌏', label: 'Local Culture' },
]

interface Analysis {
  scene: string
  style: string
  prompt: string
}

export default function Home() {
  const [faceUrl, setFaceUrl] = useState<string | null>(null)
  const [isUploadingFace, setIsUploadingFace] = useState(false)
  const [bgPreview, setBgPreview] = useState<string | null>(null)
  const [bgBase64, setBgBase64] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [selectedStyle, setSelectedStyle] = useState('auto')
  const [customPrompt, setCustomPrompt] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingMsg, setGeneratingMsg] = useState('Creating your look...')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const faceInputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('styleai_face_url')
    if (saved) setFaceUrl(saved)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const compressAndStoreFace = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const reader = new FileReader()
      reader.onload = (e) => {
        img.src = e.target?.result as string
        img.onload = () => {
          const maxSize = 512
          const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * ratio)
          canvas.height = Math.round(img.height * ratio)
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = reject
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFaceFile = async (file: File) => {
    setIsUploadingFace(true)
    setError(null)
    try {
      const dataUrl = await compressAndStoreFace(file)
      localStorage.setItem('styleai_face_url', dataUrl)
      setFaceUrl(dataUrl)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not process image'
      setError(msg)
    } finally {
      setIsUploadingFace(false)
    }
  }

  const handleBgFile = useCallback(async (file: File) => {
    setAnalysis(null)
    setResult(null)
    setError(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      setBgPreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      setBgBase64(base64)

      setIsAnalyzing(true)
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        })
        if (res.ok) {
          const data = await res.json()
          setAnalysis(data)
        }
      } catch { /* silently continue without analysis */ } finally {
        setIsAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }, [])

  const handleGenerate = async () => {
    if (!faceUrl || !bgBase64) return
    setIsGenerating(true)
    setError(null)
    setResult(null)

    const msgs = [
      'Creating your look...',
      'Applying your face...',
      'Adding fashion magic...',
      'Almost there...',
    ]
    let msgIdx = 0
    setGeneratingMsg(msgs[0])
    const msgTimer = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, msgs.length - 1)
      setGeneratingMsg(msgs[msgIdx])
    }, 12000)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceUrl,
          style: selectedStyle,
          analysis,
          customPrompt,
        }),
      })

      if (!res.ok) throw new Error('Generation request failed')
      const { predictionId } = await res.json()

      await new Promise<void>((resolve, reject) => {
        pollRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/status/${predictionId}`)
            const { status, output, error: predError } = await statusRes.json()

            if (status === 'succeeded') {
              clearInterval(pollRef.current!)
              const imageUrl = Array.isArray(output) ? output[0] : output
              setResult(imageUrl)
              resolve()
            } else if (status === 'failed' || status === 'canceled') {
              clearInterval(pollRef.current!)
              reject(new Error(predError || 'Generation failed'))
            }
          } catch (e) {
            clearInterval(pollRef.current!)
            reject(e)
          }
        }, 3000)
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      clearInterval(msgTimer)
      setIsGenerating(false)
    }
  }

  const handleDownload = async () => {
    if (!result) return
    try {
      const res = await fetch(result)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `styleai-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      window.open(result, '_blank')
    }
  }

  const resetFace = () => {
    localStorage.removeItem('styleai_face_url')
    setFaceUrl(null)
    setBgPreview(null)
    setBgBase64(null)
    setAnalysis(null)
    setResult(null)
  }

  const resetBg = () => {
    setBgPreview(null)
    setBgBase64(null)
    setAnalysis(null)
    setResult(null)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-pink-50 pb-10">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-md shadow-violet-200">
              <span className="text-white text-base font-black">S</span>
            </div>
            <div>
              <p className="font-black text-gray-900 leading-none text-base">StyleAI</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">AI Fashion Photographer</p>
            </div>
          </div>

          {faceUrl && (
            <button
              onClick={resetFace}
              className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-200 active:scale-95 transition-transform"
            >
              <img
                src={faceUrl}
                alt="Your face"
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="text-xs text-gray-500 font-medium">Change face</span>
            </button>
          )}
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4 animate-fade-in">

        {/* ── SETUP: No face uploaded ── */}
        {!faceUrl && (
          <div className="space-y-4 animate-slide-up">
            <div className="text-center pt-4">
              <div className="text-5xl mb-3">👤</div>
              <h1 className="text-2xl font-black text-gray-900">Set Up Your Face</h1>
              <p className="text-gray-500 text-sm mt-2">Upload a clear photo of your face once.<br />You won't need to do this again.</p>
            </div>

            <div
              onClick={() => !isUploadingFace && faceInputRef.current?.click()}
              className="upload-zone py-14"
            >
              {isUploadingFace ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
                  <p className="text-sm text-violet-600 font-medium">Uploading...</p>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-100 via-fuchsia-100 to-pink-100 flex items-center justify-center text-4xl">📸</div>
                  <div className="text-center">
                    <p className="font-bold text-gray-700">Tap to upload your photo</p>
                    <p className="text-sm text-gray-400 mt-1">JPG, PNG — any size</p>
                  </div>
                </>
              )}
            </div>

            <input
              ref={faceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFaceFile(e.target.files[0])}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-red-600">Upload failed</p>
                <p className="text-xs text-red-500 mt-1">{error}</p>
              </div>
            )}

            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 space-y-1.5">
              <p className="text-sm font-semibold text-violet-700">Tips for best results</p>
              <p className="text-sm text-violet-600">• Front-facing, well-lit photo</p>
              <p className="text-sm text-violet-600">• No sunglasses or hats</p>
              <p className="text-sm text-violet-600">• Face clearly visible, not too far</p>
            </div>
          </div>
        )}

        {/* ── GENERATOR: Face ready ── */}
        {faceUrl && !isGenerating && !result && (
          <div className="space-y-4 animate-slide-up">
            <div className="text-center">
              <h1 className="text-2xl font-black text-gray-900">Create Your Look</h1>
              <p className="text-gray-500 text-sm mt-1">Upload a background photo to get started</p>
            </div>

            {/* Background Upload */}
            <div
              onClick={() => bgInputRef.current?.click()}
              className={`relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.98] ${bgPreview ? '' : 'upload-zone py-14 min-h-0'}`}
            >
              {bgPreview ? (
                <div className="relative w-full h-64">
                  <img src={bgPreview} alt="Background" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end justify-center pb-4">
                    <span className="text-white text-sm font-semibold bg-black/30 backdrop-blur-sm px-4 py-1.5 rounded-full">
                      Tap to change
                    </span>
                  </div>
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
                      <div className="flex items-center gap-3 bg-white/90 rounded-2xl px-5 py-3 shadow-lg">
                        <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-semibold text-gray-700">Analyzing scene...</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-5xl">🌄</div>
                  <div className="text-center">
                    <p className="font-bold text-gray-700">Upload Background</p>
                    <p className="text-sm text-gray-400 mt-1">Take a photo of where you are</p>
                  </div>
                </>
              )}
            </div>

            <input
              ref={bgInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleBgFile(e.target.files[0])}
            />

            {/* Scene Analysis Card */}
            {analysis && !isAnalyzing && (
              <div className="bg-gradient-to-r from-violet-50 to-pink-50 border border-violet-100 rounded-2xl p-4 animate-slide-up">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800">📍 {analysis.scene}</p>
                    <p className="text-sm text-violet-600 mt-1">✨ Suggested: {analysis.style}</p>
                  </div>
                  <button onClick={resetBg} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>
                </div>
              </div>
            )}

            {/* Style Picker */}
            <div>
              <p className="text-sm font-bold text-gray-700 mb-2.5">Style</p>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStyle(s.id)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 active:scale-95 ${
                      selectedStyle === s.id
                        ? 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 text-white shadow-md shadow-violet-200'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300'
                    }`}
                  >
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt Toggle */}
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="flex items-center gap-2 text-sm text-violet-600 font-medium"
            >
              <span className={`transition-transform ${showPrompt ? 'rotate-90' : ''}`}>▶</span>
              Add custom details
            </button>

            {showPrompt && (
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. wearing a red silk dress, carrying a Chanel bag, golden hour..."
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white animate-slide-up"
                rows={3}
              />
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!bgBase64 || isAnalyzing}
              className="btn-primary"
            >
              ✨ Generate My Look
            </button>

            {bgBase64 && (
              <p className="text-center text-xs text-gray-400">Takes about 30–60 seconds</p>
            )}
          </div>
        )}

        {/* ── GENERATING ── */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-24 gap-8 animate-fade-in">
            <div className="relative w-28 h-28">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 animate-spin-slow" />
              <div className="absolute inset-[3px] rounded-full bg-violet-50 flex items-center justify-center text-4xl">
                ✨
              </div>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-gray-900">{generatingMsg}</p>
              <p className="text-sm text-gray-400 mt-2">Powered by AI magic</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-violet-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {result && !isGenerating && (
          <div className="space-y-4 animate-slide-up">
            <div className="text-center">
              <h2 className="text-2xl font-black gradient-text">Your Look is Ready! ✨</h2>
            </div>

            <div className="rounded-3xl overflow-hidden shadow-2xl shadow-violet-200 border border-violet-100">
              <img src={result} alt="Generated fashion photo" className="w-full" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDownload}
                className="py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 shadow-md shadow-violet-200 active:scale-95 transition-transform"
              >
                💾 Save Photo
              </button>
              <button
                onClick={() => {
                  setResult(null)
                  setBgPreview(null)
                  setBgBase64(null)
                  setAnalysis(null)
                  setCustomPrompt('')
                  setShowPrompt(false)
                }}
                className="py-4 rounded-2xl font-bold text-violet-700 bg-violet-50 border border-violet-200 active:scale-95 transition-transform"
              >
                🔄 Try Again
              </button>
            </div>

            {analysis && (
              <p className="text-center text-xs text-gray-400">
                {analysis.scene} · {analysis.style}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
