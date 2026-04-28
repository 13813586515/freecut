import type {
  FrameAnimationItem,
  DrawingLayer,
  DrawingElement,
  DrawingFrame,
} from '../types'
import { DrawingEngine } from '../drawing-engine'
import { frameCache } from '../frame-cache'
import { createLogger } from '@/shared/logging/logger'

const log = createLogger('FrameAnimationRenderer')

export interface FrameAnimationRenderContext {
  canvasSettings: {
    width: number
    height: number
    fps: number
  }
  renderMode: 'export' | 'preview'
  useCache?: boolean
}

export interface FrameAnimationItemTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}

function resolveFrameInItem(
  item: FrameAnimationItem,
  globalFrame: number
): number {
  const localFrame = globalFrame - item.from
  const speed = 1
  const effectiveFrame = Math.floor(localFrame * speed)

  if (item.playbackMode === 'loop') {
    return ((effectiveFrame % item.durationInFrames) + item.durationInFrames) % item.durationInFrames
  }

  if (item.playbackMode === 'ping-pong') {
    const cycleLength = item.durationInFrames * 2 - 2
    const pos = ((effectiveFrame % cycleLength) + cycleLength) % cycleLength
    return pos < item.durationInFrames ? pos : 2 * (item.durationInFrames - 1) - pos
  }

  if (item.playbackMode === 'once') {
    return Math.max(0, Math.min(effectiveFrame, item.durationInFrames - 1))
  }

  return Math.max(0, Math.min(effectiveFrame, item.durationInFrames - 1))
}

function getFrameFromLayers(
  layers: DrawingLayer[],
  frameIndex: number
): Map<string, DrawingFrame> {
  const result = new Map<string, DrawingFrame>()
  for (const layer of layers) {
    const frame = layer.frames.get(frameIndex)
    if (frame) {
      result.set(layer.id, frame)
    }
  }
  return result
}

export function renderFrameAnimationToCanvas(
  item: FrameAnimationItem,
  globalFrame: number,
  targetCanvas: HTMLCanvasElement | OffscreenCanvas,
  ctx: FrameAnimationRenderContext
): boolean {
  try {
    const localFrame = resolveFrameInItem(item, globalFrame)

    if (localFrame < 0 || localFrame >= item.durationInFrames) {
      return false
    }

    if (ctx.useCache && ctx.renderMode === 'preview') {
      const cached = frameCache.get(item.id, localFrame)
      if (cached) {
        const targetCtx = targetCanvas.getContext('2d')
        if (targetCtx) {
          targetCtx.drawImage(cached.canvas, 0, 0, targetCanvas.width, targetCanvas.height)
          return true
        }
      }
    }

    const sourceCanvas = new OffscreenCanvas(item.width, item.height)
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) {
      log.error('Failed to get source canvas context')
      return false
    }

    if (item.backgroundColor && item.backgroundColor !== 'transparent') {
      sourceCtx.fillStyle = item.backgroundColor
      sourceCtx.fillRect(0, 0, item.width, item.height)
    }

    const visibleLayers = item.layers
      .filter((l) => l.visible)
      .sort((a, b) => a.order - b.order)

    for (const layer of visibleLayers) {
      const frame = layer.frames.get(localFrame)
      if (!frame || frame.elements.length === 0) continue

      const sortedElements = [...frame.elements]
        .filter((e) => e.visible && !e.locked)
        .sort((a, b) => a.order - b.order)

      if (sortedElements.length === 0) continue

      sourceCtx.save()
      sourceCtx.globalAlpha = layer.opacity
      sourceCtx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation

      const engine = new DrawingEngine(sourceCanvas)

      for (const element of sortedElements) {
        if (element.path) {
          engine.drawPath(element.path)
        } else if (element.shape) {
          engine.drawShape(element.shape)
        } else if (element.text) {
          engine.drawText(element.text)
        }
      }

      sourceCtx.restore()
    }

    if (ctx.useCache && ctx.renderMode === 'preview') {
      const cacheCanvas = new OffscreenCanvas(sourceCanvas.width, sourceCanvas.height)
      const cacheCtx = cacheCanvas.getContext('2d')
      if (cacheCtx) {
        cacheCtx.drawImage(sourceCanvas, 0, 0)
        frameCache.set(item.id, localFrame, cacheCanvas)
      }
    }

    const targetCtx = targetCanvas.getContext('2d')
    if (!targetCtx) {
      log.error('Failed to get target canvas context')
      return false
    }

    targetCtx.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      0,
      0,
      targetCanvas.width,
      targetCanvas.height
    )

    return true
  } catch (error) {
    log.error('Error rendering frame animation', { error, itemId: item.id })
    return false
  }
}

export function renderFrameAnimationToContext(
  item: FrameAnimationItem,
  globalFrame: number,
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  transform: FrameAnimationItemTransform,
  renderCtx: FrameAnimationRenderContext
): boolean {
  try {
    const localFrame = resolveFrameInItem(item, globalFrame)

    if (localFrame < 0 || localFrame >= item.durationInFrames) {
      return false
    }

    const sourceCanvas = new OffscreenCanvas(item.width, item.height)
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) {
      log.error('Failed to get source canvas context')
      return false
    }

    if (item.backgroundColor && item.backgroundColor !== 'transparent') {
      sourceCtx.fillStyle = item.backgroundColor
      sourceCtx.fillRect(0, 0, item.width, item.height)
    }

    const visibleLayers = item.layers
      .filter((l) => l.visible)
      .sort((a, b) => a.order - b.order)

    for (const layer of visibleLayers) {
      const frame = layer.frames.get(localFrame)
      if (!frame || frame.elements.length === 0) continue

      const sortedElements = [...frame.elements]
        .filter((e) => e.visible && !e.locked)
        .sort((a, b) => a.order - b.order)

      if (sortedElements.length === 0) continue

      sourceCtx.save()
      sourceCtx.globalAlpha = layer.opacity
      sourceCtx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation

      const engine = new DrawingEngine(sourceCanvas)

      for (const element of sortedElements) {
        if (element.path) {
          engine.drawPath(element.path)
        } else if (element.shape) {
          engine.drawShape(element.shape)
        } else if (element.text) {
          engine.drawText(element.text)
        }
      }

      sourceCtx.restore()
    }

    ctx.save()

    if (transform.opacity !== 1) {
      ctx.globalAlpha = transform.opacity
    }

    if (item.blendMode) {
      ctx.globalCompositeOperation = item.blendMode as GlobalCompositeOperation
    }

    const canvasW = renderCtx.canvasSettings.width
    const canvasH = renderCtx.canvasSettings.height

    const targetX = canvasW / 2 + transform.x - transform.width / 2
    const targetY = canvasH / 2 + transform.y - transform.height / 2

    if (transform.rotation !== 0) {
      const centerX = targetX + transform.width / 2
      const centerY = targetY + transform.height / 2
      ctx.translate(centerX, centerY)
      ctx.rotate((transform.rotation * Math.PI) / 180)
      ctx.translate(-centerX, -centerY)
    }

    ctx.drawImage(
      sourceCanvas,
      0,
      0,
      item.width,
      item.height,
      targetX,
      targetY,
      transform.width,
      transform.height
    )

    ctx.restore()

    return true
  } catch (error) {
    log.error('Error rendering frame animation to context', { error, itemId: item.id })
    return false
  }
}

export function getFrameAnimationInfo(item: FrameAnimationItem, globalFrame: number) {
  const localFrame = resolveFrameInItem(item, globalFrame)
  const activeLayers = item.layers.filter((l) => l.visible)

  let totalElements = 0
  let animatedElements = 0

  for (const layer of activeLayers) {
    const framesWithContent = Array.from(layer.frames.keys())
    totalElements += framesWithContent.reduce((sum, f) => {
      const frame = layer.frames.get(f)
      return sum + (frame?.elements.length || 0)
    }, 0)

    if (framesWithContent.length > 1) {
      animatedElements += framesWithContent.reduce((sum, f) => {
        const frame = layer.frames.get(f)
        return sum + (frame?.elements.length || 0)
      }, 0)
    }
  }

  return {
    localFrame,
    totalFrames: item.durationInFrames,
    fps: item.fps,
    activeLayers: activeLayers.length,
    totalLayers: item.layers.length,
    totalElements,
    animatedElements,
    currentFrameHasContent: activeLayers.some((l) => {
      const frame = l.frames.get(localFrame)
      return frame && frame.elements.length > 0
    }),
  }
}

export function invalidateFrameAnimationCache(itemId: string, frame?: number) {
  if (frame !== undefined) {
    frameCache.invalidateFrame(itemId, frame)
  } else {
    frameCache.clearForItem(itemId)
  }
}

export function getFrameCacheStats() {
  return frameCache.getStats()
}

export { frameCache }
