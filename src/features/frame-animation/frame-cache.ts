import type { FrameCacheEntry, FrameCacheStats } from './types'

class FrameCache {
  private cache: Map<string, FrameCacheEntry> = new Map()
  private maxEntries: number
  private maxSizeBytes: number
  private hitCount: number = 0
  private missCount: number = 0

  constructor(maxEntries: number = 100, maxSizeBytes: number = 512 * 1024 * 1024) {
    this.maxEntries = maxEntries
    this.maxSizeBytes = maxSizeBytes
  }

  private getKey(itemId: string, frameIndex: number): string {
    return `${itemId}:${frameIndex}`
  }

  private estimateEntrySize(entry: FrameCacheEntry): number {
    return entry.width * entry.height * 4
  }

  private getTotalSizeBytes(): number {
    let total = 0
    for (const entry of this.cache.values()) {
      total += this.estimateEntrySize(entry)
    }
    return total
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxEntries && this.getTotalSizeBytes() <= this.maxSizeBytes) {
      return
    }

    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => {
      if (a[1].useCount !== b[1].useCount) {
        return a[1].useCount - b[1].useCount
      }
      return a[1].lastModified - b[1].lastModified
    })

    while (
      this.cache.size > this.maxEntries ||
      this.getTotalSizeBytes() > this.maxSizeBytes
    ) {
      if (entries.length === 0) break
      const [key] = entries.shift()!
      this.cache.delete(key)
    }
  }

  set(itemId: string, frameIndex: number, canvas: HTMLCanvasElement | OffscreenCanvas): void {
    const key = this.getKey(itemId, frameIndex)
    const entry: FrameCacheEntry = {
      frameIndex,
      canvas,
      width: canvas.width,
      height: canvas.height,
      lastModified: Date.now(),
      useCount: 0,
    }

    this.cache.set(key, entry)
    this.evictIfNeeded()
  }

  get(itemId: string, frameIndex: number): FrameCacheEntry | undefined {
    const key = this.getKey(itemId, frameIndex)
    const entry = this.cache.get(key)

    if (entry) {
      entry.useCount++
      entry.lastModified = Date.now()
      this.hitCount++
      return entry
    }

    this.missCount++
    return undefined
  }

  has(itemId: string, frameIndex: number): boolean {
    const key = this.getKey(itemId, frameIndex)
    return this.cache.has(key)
  }

  delete(itemId: string, frameIndex: number): boolean {
    const key = this.getKey(itemId, frameIndex)
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.hitCount = 0
    this.missCount = 0
  }

  clearForItem(itemId: string): void {
    const keysToDelete: string[] = []
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${itemId}:`)) {
        keysToDelete.push(key)
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key)
    }
  }

  invalidateFrame(itemId: string, frameIndex: number): void {
    this.delete(itemId, frameIndex)
  }

  invalidateRange(itemId: string, startFrame: number, endFrame: number): void {
    for (let frame = startFrame; frame <= endFrame; frame++) {
      this.delete(itemId, frame)
    }
  }

  getStats(): FrameCacheStats {
    return {
      totalEntries: this.cache.size,
      totalSizeBytes: this.getTotalSizeBytes(),
      hitCount: this.hitCount,
      missCount: this.missCount,
    }
  }

  getHitRate(): number {
    const total = this.hitCount + this.missCount
    if (total === 0) return 0
    return this.hitCount / total
  }

  setMaxEntries(maxEntries: number): void {
    this.maxEntries = maxEntries
    this.evictIfNeeded()
  }

  setMaxSizeBytes(maxSizeBytes: number): void {
    this.maxSizeBytes = maxSizeBytes
    this.evictIfNeeded()
  }
}

export const frameCache = new FrameCache(
  200,
  1024 * 1024 * 1024
)

export function createOffscreenCanvas(width: number, height: number): OffscreenCanvas {
  return new OffscreenCanvas(width, height)
}

export function cloneCanvas(
  source: HTMLCanvasElement | OffscreenCanvas
): OffscreenCanvas {
  const clone = new OffscreenCanvas(source.width, source.height)
  const ctx = clone.getContext('2d')
  if (ctx) {
    ctx.drawImage(source, 0, 0)
  }
  return clone
}

export function clearCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): void {
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

export function fillCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  color: string
): void {
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.save()
    ctx.fillStyle = color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }
}

export function scaleCanvas(
  source: HTMLCanvasElement | OffscreenCanvas,
  targetWidth: number,
  targetHeight: number,
  quality: 'low' | 'medium' | 'high' = 'high'
): OffscreenCanvas {
  const scaled = new OffscreenCanvas(targetWidth, targetHeight)
  const ctx = scaled.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = quality
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight)
  }
  return scaled
}

export function canvasToImageBitmap(
  canvas: HTMLCanvasElement | OffscreenCanvas
): Promise<ImageBitmap> {
  if ('transferToImageBitmap' in canvas) {
    return Promise.resolve((canvas as OffscreenCanvas).transferToImageBitmap())
  }
  return createImageBitmap(canvas as HTMLCanvasElement)
}

export function canvasToDataUrl(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  format: 'image/png' | 'image/jpeg' = 'image/png',
  quality: number = 0.9
): string {
  if ('toDataURL' in canvas) {
    return (canvas as HTMLCanvasElement).toDataURL(format, quality)
  }
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = canvas.width
  tempCanvas.height = canvas.height
  const ctx = tempCanvas.getContext('2d')
  if (ctx) {
    ctx.drawImage(canvas, 0, 0)
  }
  return tempCanvas.toDataURL(format, quality)
}

export function mergeCanvases(
  canvases: Array<{
    canvas: HTMLCanvasElement | OffscreenCanvas
    opacity?: number
    blendMode?: GlobalCompositeOperation
    x?: number
    y?: number
  }>,
  width: number,
  height: number,
  backgroundColor?: string
): OffscreenCanvas {
  const result = new OffscreenCanvas(width, height)
  const ctx = result.getContext('2d')
  if (!ctx) return result

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)
  }

  for (const layer of canvases) {
    ctx.save()
    if (layer.opacity !== undefined) {
      ctx.globalAlpha = layer.opacity
    }
    if (layer.blendMode) {
      ctx.globalCompositeOperation = layer.blendMode
    }
    ctx.drawImage(layer.canvas, layer.x || 0, layer.y || 0)
    ctx.restore()
  }

  return result
}
