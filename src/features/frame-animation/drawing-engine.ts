import type {
  DrawingPath,
  DrawingPathPoint,
  DrawingElement,
  DrawingLayer,
  DrawingShape,
  DrawingText,
  DrawingToolType,
  DrawingBlendMode,
  DrawingToolSettings,
} from './types'
import { createLogger } from '@/shared/logging/logger'

const log = createLogger('DrawingEngine')

function distanceBetweenPoints(p1: DrawingPathPoint, p2: DrawingPathPoint): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpPoint(p1: DrawingPathPoint, p2: DrawingPathPoint, t: number): DrawingPathPoint {
  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t),
    pressure: lerp(p1.pressure, p2.pressure, t),
    timestamp: lerp(p1.timestamp, p2.timestamp, t),
  }
}

function smoothPath(points: DrawingPathPoint[], smoothness: number): DrawingPathPoint[] {
  if (points.length < 3) return points

  const result: DrawingPathPoint[] = [points[0]!]
  const windowSize = Math.max(1, Math.floor(smoothness * 5))

  for (let i = 1; i < points.length - 1; i++) {
    const start = Math.max(0, i - windowSize)
    const end = Math.min(points.length - 1, i + windowSize)
    let sumX = 0
    let sumY = 0
    let sumPressure = 0
    let count = 0

    for (let j = start; j <= end; j++) {
      sumX += points[j]!.x
      sumY += points[j]!.y
      sumPressure += points[j]!.pressure
      count++
    }

    result.push({
      x: sumX / count,
      y: sumY / count,
      pressure: sumPressure / count,
      timestamp: points[i]!.timestamp,
    })
  }

  result.push(points[points.length - 1]!)
  return result
}

function simplifyPath(points: DrawingPathPoint[], tolerance: number): DrawingPathPoint[] {
  if (points.length <= 2) return points

  const result: DrawingPathPoint[] = []
  result.push(points[0]!)

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1]!
    const curr = points[i]!

    if (distanceBetweenPoints(prev, curr) > tolerance) {
      result.push(curr)
    }
  }

  result.push(points[points.length - 1]!)
  return result
}

export class DrawingEngine {
  private canvas: HTMLCanvasElement | OffscreenCanvas
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  private width: number
  private height: number

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.canvas = canvas
    this.width = canvas.width
    this.height = canvas.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      throw new Error('Failed to get 2D context')
    }
    this.ctx = ctx
  }

  getContext(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
    return this.ctx
  }

  getCanvas(): HTMLCanvasElement | OffscreenCanvas {
    return this.canvas
  }

  getWidth(): number {
    return this.width
  }

  getHeight(): number {
    return this.height
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  fill(color: string): void {
    this.ctx.save()
    this.ctx.fillStyle = color
    this.ctx.fillRect(0, 0, this.width, this.height)
    this.ctx.restore()
  }

  save(): void {
    this.ctx.save()
  }

  restore(): void {
    this.ctx.restore()
  }

  setBlendMode(mode: DrawingBlendMode): void {
    this.ctx.globalCompositeOperation = mode as GlobalCompositeOperation
  }

  setOpacity(opacity: number): void {
    this.ctx.globalAlpha = opacity
  }

  drawPath(
    path: DrawingPath,
    options?: {
      offsetX?: number
      offsetY?: number
      scale?: number
    }
  ): void {
    const points = path.points
    if (points.length < 2) return

    const offsetX = options?.offsetX ?? 0
    const offsetY = options?.offsetY ?? 0
    const scale = options?.scale ?? 1

    this.ctx.save()
    this.ctx.strokeStyle = path.color
    this.ctx.lineWidth = path.size * scale
    this.ctx.lineCap = path.endCap as CanvasLineCap
    this.ctx.lineJoin = 'round'
    this.ctx.globalAlpha = path.opacity
    this.ctx.globalCompositeOperation = path.blendMode as GlobalCompositeOperation

    if (points.length === 2) {
      this.ctx.beginPath()
      this.ctx.moveTo(
        points[0]!.x * scale + offsetX,
        points[0]!.y * scale + offsetY
      )
      this.ctx.lineTo(
        points[1]!.x * scale + offsetX,
        points[1]!.y * scale + offsetY
      )
      this.ctx.stroke()
      this.ctx.restore()
      return
    }

    this.ctx.beginPath()
    this.ctx.moveTo(
      points[0]!.x * scale + offsetX,
      points[0]!.y * scale + offsetY
    )

    for (let i = 1; i < points.length - 1; i++) {
      const p0 = points[i - 1]!
      const p1 = points[i]!
      const p2 = points[i + 1]!

      const x1 = p0.x * scale + offsetX
      const y1 = p0.y * scale + offsetY
      const x2 = p1.x * scale + offsetX
      const y2 = p1.y * scale + offsetY
      const x3 = p2.x * scale + offsetX
      const y3 = p2.y * scale + offsetY

      const cp1x = (x1 + x2) / 2
      const cp1y = (y1 + y2) / 2
      const cp2x = (x2 + x3) / 2
      const cp2y = (y2 + y3) / 2

      this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x3, y3)
    }

    this.ctx.stroke()
    this.ctx.restore()
  }

  drawShape(
    shape: DrawingShape,
    options?: {
      offsetX?: number
      offsetY?: number
      scale?: number
    }
  ): void {
    const offsetX = options?.offsetX ?? 0
    const offsetY = options?.offsetY ?? 0
    const scale = options?.scale ?? 1

    const startX = shape.startX * scale + offsetX
    const startY = shape.startY * scale + offsetY
    const endX = shape.endX * scale + offsetX
    const endY = shape.endY * scale + offsetY

    this.ctx.save()

    if (shape.fillOpacity > 0 && shape.fillColor) {
      this.ctx.fillStyle = shape.fillColor
      this.ctx.globalAlpha = shape.fillOpacity
    }

    if (shape.strokeOpacity > 0 && shape.strokeColor && shape.strokeWidth > 0) {
      this.ctx.strokeStyle = shape.strokeColor
      this.ctx.lineWidth = shape.strokeWidth * scale
      this.ctx.lineCap = 'round'
      this.ctx.lineJoin = 'round'
    }

    switch (shape.type) {
      case 'line':
        if (shape.strokeOpacity > 0) {
          this.ctx.beginPath()
          this.ctx.moveTo(startX, startY)
          this.ctx.lineTo(endX, endY)
          this.ctx.stroke()
        }
        break

      case 'rectangle': {
        const x = Math.min(startX, endX)
        const y = Math.min(startY, endY)
        const w = Math.abs(endX - startX)
        const h = Math.abs(endY - startY)
        const radius = (shape.cornerRadius ?? 0) * scale

        if (shape.fillOpacity > 0) {
          if (radius > 0) {
            this.ctx.beginPath()
            this.ctx.roundRect(x, y, w, h, radius)
            this.ctx.fill()
          } else {
            this.ctx.fillRect(x, y, w, h)
          }
        }
        if (shape.strokeOpacity > 0) {
          if (radius > 0) {
            this.ctx.beginPath()
            this.ctx.roundRect(x, y, w, h, radius)
            this.ctx.stroke()
          } else {
            this.ctx.strokeRect(x, y, w, h)
          }
        }
        break
      }

      case 'circle': {
        const cx = (startX + endX) / 2
        const cy = (startY + endY) / 2
        const rx = Math.abs(endX - startX) / 2
        const ry = Math.abs(endY - startY) / 2

        this.ctx.beginPath()
        if (Math.abs(rx - ry) < 1) {
          this.ctx.arc(cx, cy, rx, 0, Math.PI * 2)
        } else {
          this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        }

        if (shape.fillOpacity > 0) {
          this.ctx.fill()
        }
        if (shape.strokeOpacity > 0) {
          this.ctx.stroke()
        }
        break
      }

      case 'arrow': {
        const dx = endX - startX
        const dy = endY - startY
        const length = Math.sqrt(dx * dx + dy * dy)
        const arrowSize = (shape.arrowHeadSize ?? 15) * scale

        if (length > arrowSize) {
          const angle = Math.atan2(dy, dx)
          const arrowPointX = endX - arrowSize * Math.cos(angle)
          const arrowPointY = endY - arrowSize * Math.sin(angle)
          const arrowLeftX = arrowPointX - arrowSize * 0.6 * Math.cos(angle - Math.PI / 6)
          const arrowLeftY = arrowPointY - arrowSize * 0.6 * Math.sin(angle - Math.PI / 6)
          const arrowRightX = arrowPointX - arrowSize * 0.6 * Math.cos(angle + Math.PI / 6)
          const arrowRightY = arrowPointY - arrowSize * 0.6 * Math.sin(angle + Math.PI / 6)

          if (shape.strokeOpacity > 0) {
            this.ctx.beginPath()
            this.ctx.moveTo(startX, startY)
            this.ctx.lineTo(arrowPointX, arrowPointY)
            this.ctx.stroke()

            this.ctx.beginPath()
            this.ctx.moveTo(endX, endY)
            this.ctx.lineTo(arrowLeftX, arrowLeftY)
            this.ctx.lineTo(arrowRightX, arrowRightY)
            this.ctx.closePath()

            if (shape.fillOpacity > 0) {
              this.ctx.fillStyle = shape.strokeColor
              this.ctx.globalAlpha = shape.strokeOpacity
              this.ctx.fill()
            }
          }
        }
        break
      }
    }

    this.ctx.restore()
  }

  drawText(
    text: DrawingText,
    options?: {
      offsetX?: number
      offsetY?: number
      scale?: number
    }
  ): void {
    const offsetX = options?.offsetX ?? 0
    const offsetY = options?.offsetY ?? 0
    const scale = options?.scale ?? 1

    this.ctx.save()
    this.ctx.font = `${text.fontStyle} ${text.fontWeight} ${text.fontSize * scale}px ${text.fontFamily}`
    this.ctx.fillStyle = text.color
    this.ctx.globalAlpha = text.opacity
    this.ctx.textAlign = text.textAlign as CanvasTextAlign
    this.ctx.textBaseline = text.baseline as CanvasTextBaseline

    const x = text.x * scale + offsetX
    const y = text.y * scale + offsetY

    this.ctx.fillText(text.text, x, y)
    this.ctx.restore()
  }

  drawElement(
    element: DrawingElement,
    options?: {
      offsetX?: number
      offsetY?: number
      scale?: number
    }
  ): void {
    if (!element.visible) return

    if (element.path) {
      this.drawPath(element.path, options)
    } else if (element.shape) {
      this.drawShape(element.shape, options)
    } else if (element.text) {
      this.drawText(element.text, options)
    }
  }

  drawElements(
    elements: DrawingElement[],
    options?: {
      offsetX?: number
      offsetY?: number
      scale?: number
    }
  ): void {
    const sorted = [...elements].sort((a, b) => a.order - b.order)
    for (const element of sorted) {
      this.drawElement(element, options)
    }
  }

  drawLayer(
    layer: DrawingLayer,
    frameIndex: number,
    options?: {
      offsetX?: number
      offsetY?: number
      scale?: number
      onionSkin?: boolean
      onionSkinOpacity?: number
    }
  ): void {
    if (!layer.visible) return

    const frame = layer.frames.get(frameIndex)
    if (!frame) return

    this.ctx.save()
    this.ctx.globalAlpha = layer.opacity * (options?.onionSkinOpacity ?? 1)
    this.ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation

    this.drawElements(frame.elements, options)

    this.ctx.restore()
  }

  drawLayers(
    layers: DrawingLayer[],
    frameIndex: number,
    options?: {
      offsetX?: number
      offsetY?: number
      scale?: number
      excludeLayerIds?: Set<string>
      onionSkin?: boolean
      onionSkinOpacity?: number
    }
  ): void {
    const sorted = [...layers]
      .filter((l) => !options?.excludeLayerIds?.has(l.id))
      .sort((a, b) => a.order - b.order)

    for (const layer of sorted) {
      this.drawLayer(layer, frameIndex, {
        ...options,
        onionSkinOpacity: options?.onionSkinOpacity,
      })
    }
  }

  createPreview(
    layers: DrawingLayer[],
    frameIndex: number,
    backgroundColor: string,
    width?: number,
    height?: number
  ): OffscreenCanvas {
    const w = width ?? this.width
    const h = height ?? this.height

    const preview = new OffscreenCanvas(w, h)
    const previewCtx = preview.getContext('2d')
    if (!previewCtx) return preview

    previewCtx.fillStyle = backgroundColor
    previewCtx.fillRect(0, 0, w, h)

    const previewEngine = new DrawingEngine(preview)
    previewEngine.drawLayers(layers, frameIndex)

    return preview
  }

  static createPath(
    points: DrawingPathPoint[],
    tool: DrawingToolType,
    color: string,
    size: number,
    opacity: number = 1,
    smoothness: number = 0.5
  ): DrawingPath {
    let processedPoints = points
    if (smoothness > 0) {
      processedPoints = smoothPath(points, smoothness)
    }
    processedPoints = simplifyPath(processedPoints, 0.5)

    return {
      id: crypto.randomUUID(),
      points: processedPoints,
      tool,
      color,
      size,
      opacity,
      blendMode: 'source-over',
      smoothness,
      startCap: 'round',
      endCap: 'round',
    }
  }

  static createPathPoint(
    x: number,
    y: number,
    pressure: number = 0.5
  ): DrawingPathPoint {
    return {
      x,
      y,
      pressure,
      timestamp: Date.now(),
    }
  }

  static createShape(
    type: DrawingShape['type'],
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    strokeColor: string,
    strokeWidth: number,
    fillColor: string = 'transparent',
    options?: {
      strokeOpacity?: number
      fillOpacity?: number
      cornerRadius?: number
      arrowHeadSize?: number
    }
  ): DrawingShape {
    return {
      id: crypto.randomUUID(),
      type,
      startX,
      startY,
      endX,
      endY,
      strokeColor,
      strokeWidth,
      strokeOpacity: options?.strokeOpacity ?? 1,
      fillColor,
      fillOpacity: options?.fillOpacity ?? 0,
      cornerRadius: options?.cornerRadius,
      arrowHeadSize: options?.arrowHeadSize,
    }
  }

  static createText(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: string,
    options?: {
      fontFamily?: string
      fontWeight?: DrawingText['fontWeight']
      fontStyle?: DrawingText['fontStyle']
      opacity?: number
      textAlign?: DrawingText['textAlign']
      baseline?: DrawingText['baseline']
    }
  ): DrawingText {
    return {
      id: crypto.randomUUID(),
      x,
      y,
      text,
      fontSize,
      fontFamily: options?.fontFamily ?? 'Inter',
      fontWeight: options?.fontWeight ?? 'normal',
      fontStyle: options?.fontStyle ?? 'normal',
      color,
      opacity: options?.opacity ?? 1,
      textAlign: options?.textAlign ?? 'left',
      baseline: options?.baseline ?? 'alphabetic',
    }
  }

  static createElement(
    type: DrawingElement['type'],
    path?: DrawingPath,
    shape?: DrawingShape,
    text?: DrawingText
  ): DrawingElement {
    return {
      id: crypto.randomUUID(),
      type,
      visible: true,
      locked: false,
      order: 0,
      path,
      shape,
      text,
    }
  }

  static createLayer(
    name: string,
    order: number
  ): DrawingLayer {
    return {
      id: crypto.randomUUID(),
      name,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      frames: new Map(),
      order,
    }
  }
}

export function getDefaultToolSettings(): DrawingToolSettings {
  return {
    tool: 'pen',
    color: '#ffffff',
    size: 5,
    opacity: 1,
    blendMode: 'source-over',
    smoothness: 0.5,
    pressureSensitivity: true,
    eraserSize: 20,
    eraserHardness: 1,
    fillColor: '#000000',
    strokeColor: '#ffffff',
    strokeWidth: 3,
    fillOpacity: 0,
    strokeOpacity: 1,
    cornerRadius: 0,
    arrowHeadSize: 15,
    textFontSize: 32,
    textFontFamily: 'Inter',
    textFontWeight: 'normal',
    textFontStyle: 'normal',
    textColor: '#ffffff',
    textOpacity: 1,
  }
}
