import {
  useCallback,
  useRef,
  useEffect,
  memo,
  useState,
} from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useDrawingEditorStore } from '../store'
import { DrawingEngine, getDefaultToolSettings } from '../drawing-engine'
import { frameCache } from '../frame-cache'
import type { DrawingLayer, DrawingPathPoint, DrawingElement } from '../types'

interface DrawingCanvasProps {
  width: number
  height: number
  layers: DrawingLayer[]
  currentFrame: number
  backgroundColor?: string
  itemId?: string
  onElementAdd?: (layerId: string, frameIndex: number, element: DrawingElement) => void
}

export const DrawingCanvas = memo(function DrawingCanvas({
  width,
  height,
  layers,
  currentFrame,
  backgroundColor = 'transparent',
  itemId,
  onElementAdd,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<DrawingEngine | null>(null)
  const overlayEngineRef = useRef<DrawingEngine | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    toolSettings,
    activeLayerId,
    isDrawing,
    currentPathPoints,
    startDrawing,
    continueDrawing,
    endDrawing,
    zoom,
    pan,
    showGrid,
    gridSize,
    snapToGrid,
    onionSkinSettings,
  } = useDrawingEditorStore(
    useShallow((s) => ({
      toolSettings: s.toolSettings,
      activeLayerId: s.activeLayerId,
      isDrawing: s.isDrawing,
      currentPathPoints: s.currentPathPoints,
      startDrawing: s.startDrawing,
      continueDrawing: s.continueDrawing,
      endDrawing: s.endDrawing,
      zoom: s.zoom,
      pan: s.pan,
      showGrid: s.showGrid,
      gridSize: s.gridSize,
      snapToGrid: s.snapToGrid,
      onionSkinSettings: s.onionSkinSettings,
    })),
  )

  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const overlay = overlayCanvasRef.current
    if (!canvas || !overlay) return

    canvas.width = width
    canvas.height = height
    overlay.width = width
    overlay.height = height

    engineRef.current = new DrawingEngine(canvas)
    overlayEngineRef.current = new DrawingEngine(overlay)

    return () => {
      engineRef.current = null
      overlayEngineRef.current = null
    }
  }, [width, height])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return

    engine.clear()

    if (backgroundColor !== 'transparent') {
      engine.fill(backgroundColor)
    }

    if (onionSkinSettings.enabled) {
      const { prevFrames, nextFrames, opacityStep, prevTint, nextTint, colorMode } = onionSkinSettings

      for (let i = 1; i <= prevFrames; i++) {
        const frame = currentFrame - i
        if (frame < 0) continue

        const opacity = 1 - i * opacityStep
        if (opacity <= 0) continue

        engine.save()
        if (colorMode === 'tint') {
          engine.setBlendMode('multiply')
          engine.fill(prevTint)
        }
        engine.setOpacity(opacity * 0.5)
        engine.drawLayers(layers, frame)
        engine.restore()
      }

      for (let i = 1; i <= nextFrames; i++) {
        const frame = currentFrame + i

        engine.save()
        if (colorMode === 'tint') {
          engine.setBlendMode('multiply')
          engine.fill(nextTint)
        }
        const opacity = 1 - i * opacityStep
        if (opacity <= 0) continue
        engine.setOpacity(opacity * 0.5)
        engine.drawLayers(layers, frame)
        engine.restore()
      }
    }

    engine.drawLayers(layers, currentFrame)
  }, [layers, currentFrame, backgroundColor, onionSkinSettings])

  useEffect(() => {
    const overlayEngine = overlayEngineRef.current
    if (!overlayEngine) return

    overlayEngine.clear()

    if (isDrawing && currentPathPoints.length > 0) {
      const path = DrawingEngine.createPath(
        currentPathPoints,
        toolSettings.tool,
        toolSettings.color,
        toolSettings.size,
        toolSettings.opacity,
        toolSettings.smoothness,
      )

      overlayEngine.drawPath(path)
    }

    if (showGrid && gridSize > 0) {
      overlayEngine.save()
      overlayEngine.setBlendMode('source-over')
      overlayEngine.setOpacity(0.1)
      overlayEngine.getContext().strokeStyle = '#888888'
      overlayEngine.getContext().lineWidth = 1

      const scaledGridSize = gridSize * zoom

      const ctx = overlayEngine.getContext()
      ctx.beginPath()

      for (let x = 0; x <= width; x += scaledGridSize) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
      }

      for (let y = 0; y <= height; y += scaledGridSize) {
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
      }

      ctx.stroke()
      overlayEngine.restore()
    }
  }, [isDrawing, currentPathPoints, toolSettings, showGrid, gridSize, zoom, width, height])

  const getCanvasCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }

      const rect = canvas.getBoundingClientRect()
      let x = (clientX - rect.left - pan.x) / zoom
      let y = (clientY - rect.top - pan.y) / zoom

      if (snapToGrid && gridSize > 0) {
        x = Math.round(x / gridSize) * gridSize
        y = Math.round(y / gridSize) * gridSize
      }

      return { x, y }
    },
    [pan, zoom, snapToGrid, gridSize],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.setPointerCapture(e.pointerId)

      const { x, y } = getCanvasCoordinates(e.clientX, e.clientY)
      startDrawing(x, y, e.pressure)
    },
    [getCanvasCoordinates, startDrawing],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return

      const { x, y } = getCanvasCoordinates(e.clientX, e.clientY)
      continueDrawing(x, y, e.pressure)
    },
    [isDrawing, getCanvasCoordinates, continueDrawing],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.releasePointerCapture(e.pointerId)

      if (isDrawing && currentPathPoints.length >= 2 && activeLayerId && onElementAdd) {
        const path = DrawingEngine.createPath(
          currentPathPoints,
          toolSettings.tool,
          toolSettings.color,
          toolSettings.size,
          toolSettings.opacity,
          toolSettings.smoothness,
        )

        const element: DrawingElement = DrawingEngine.createElement('path', path)
        onElementAdd(activeLayerId, currentFrame, element)

        if (itemId) {
          frameCache.invalidateFrame(itemId, currentFrame)
        }
      }

      endDrawing()
    },
    [isDrawing, currentPathPoints, activeLayerId, currentFrame, onElementAdd, itemId, endDrawing],
  )

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isDrawing) {
        handlePointerUp(e)
      }
    },
    [isDrawing, handlePointerUp],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const canvas = canvasRef.current
      if (!canvas || document.activeElement !== canvas) return

      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
      }

      if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: width * zoom,
    height: height * zoom,
    transform: `translate(${pan.x}px, ${pan.y}px)`,
  }

  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    cursor: getCursor(),
    touchAction: 'none',
  }

  function getCursor(): string {
    switch (toolSettings.tool) {
      case 'pen':
      case 'pencil':
      case 'marker':
        return 'crosshair'
      case 'eraser':
        return 'cell'
      case 'text':
        return 'text'
      case 'line':
      case 'rectangle':
      case 'circle':
      case 'arrow':
        return 'crosshair'
      default:
        return 'default'
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-black/50 flex items-center justify-center"
      style={{ width: '100%', height: '100%' }}
    >
      <div style={containerStyle}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={canvasStyle}
          className="shadow-lg"
        />
        <canvas
          ref={overlayCanvasRef}
          width={width}
          height={height}
          style={{ ...canvasStyle, pointerEvents: 'none' }}
        />
        <canvas
          width={width}
          height={height}
          style={{
            ...canvasStyle,
            pointerEvents: 'auto',
            background: 'transparent',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerLeave}
        />
      </div>
    </div>
  )
})
