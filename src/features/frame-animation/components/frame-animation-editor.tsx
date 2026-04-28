import { useCallback, useMemo, memo, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Paintbrush } from 'lucide-react'
import { PropertySection } from '@/shared/ui/property-controls'
import { useDrawingEditorStore, createInitialFrameAnimationItem } from '../store'
import { DrawingToolBar } from './drawing-toolbar'
import { DrawingLayersPanel } from './drawing-layers-panel'
import { DrawingCanvas } from './drawing-canvas'
import { FrameTimeline } from './frame-timeline'
import type { FrameAnimationItem, DrawingElement, DrawingLayer, DrawingFrame } from '../types'

interface FrameAnimationEditorProps {
  item?: FrameAnimationItem
  onUpdate?: (item: FrameAnimationItem) => void
  width?: number
  height?: number
}

export const FrameAnimationEditor = memo(function FrameAnimationEditor({
  item,
  onUpdate,
  width = 1920,
  height = 1080,
}: FrameAnimationEditorProps) {
  const {
    isActive,
    currentItemId,
    activate,
    deactivate,
    currentFrame,
    setCurrentFrame,
    addFrame,
    removeFrame,
    duplicateFrame,
    moveFrame,
    addElement,
    removeElement,
    updateElement,
    zoom,
    pan,
    setZoom,
    setPan,
    showGrid,
    setShowGrid,
    gridSize,
    setGridSize,
    snapToGrid,
    setSnapToGrid,
    onionSkinSettings,
    setOnionSkinSettings,
  } = useDrawingEditorStore(
    useShallow((s) => ({
      isActive: s.isActive,
      currentItemId: s.currentItemId,
      activate: s.activate,
      deactivate: s.deactivate,
      currentFrame: s.currentFrame,
      setCurrentFrame: s.setCurrentFrame,
      addFrame: s.addFrame,
      removeFrame: s.removeFrame,
      duplicateFrame: s.duplicateFrame,
      moveFrame: s.moveFrame,
      addElement: s.addElement,
      removeElement: s.removeElement,
      updateElement: s.updateElement,
      zoom: s.zoom,
      pan: s.pan,
      setZoom: s.setZoom,
      setPan: s.setPan,
      showGrid: s.showGrid,
      setShowGrid: s.setShowGrid,
      gridSize: s.gridSize,
      setGridSize: s.setGridSize,
      snapToGrid: s.snapToGrid,
      setSnapToGrid: s.setSnapToGrid,
      onionSkinSettings: s.onionSkinSettings,
      setOnionSkinSettings: s.setOnionSkinSettings,
    })),
  )

  const activeItem = useMemo(() => {
    if (item) return item
    return createInitialFrameAnimationItem(width, height)
  }, [item, width, height])

  useEffect(() => {
    if (item && item.id !== currentItemId) {
      activate(item.id)
    }
  }, [item, currentItemId, activate])

  const handleElementAdd = useCallback(
    (layerId: string, frameIndex: number, element: DrawingElement) => {
      const updatedLayers = [...activeItem.layers]
      const layerIndex = updatedLayers.findIndex((l) => l.id === layerId)
      if (layerIndex === -1) return

      const layer = { ...updatedLayers[layerIndex]! }
      const frames = new Map(layer.frames)

      const frame = frames.get(frameIndex)
      if (frame) {
        const maxOrder = frame.elements.length > 0 ? Math.max(...frame.elements.map((e) => e.order)) : -1
        element.order = maxOrder + 1
        frames.set(frameIndex, {
          ...frame,
          elements: [...frame.elements, element],
        })
      } else {
        frames.set(frameIndex, {
          frameIndex,
          elements: [element],
        })
      }

      layer.frames = frames
      updatedLayers[layerIndex] = layer

      const updatedItem: FrameAnimationItem = {
        ...activeItem,
        layers: updatedLayers,
      }

      onUpdate?.(updatedItem)
    },
    [activeItem, onUpdate],
  )

  const handleAddFrame = useCallback(
    (layerId: string, frameIndex: number) => {
      const updatedLayers = [...activeItem.layers]
      const layerIndex = updatedLayers.findIndex((l) => l.id === layerId)
      if (layerIndex === -1) return

      const layer = { ...updatedLayers[layerIndex]! }
      const frames = new Map(layer.frames)

      if (!frames.has(frameIndex)) {
        frames.set(frameIndex, {
          frameIndex,
          elements: [],
        })
        layer.frames = frames
        updatedLayers[layerIndex] = layer

        const updatedItem: FrameAnimationItem = {
          ...activeItem,
          layers: updatedLayers,
        }

        onUpdate?.(updatedItem)
      }
    },
    [activeItem, onUpdate],
  )

  const handleRemoveFrame = useCallback(
    (layerId: string, frameIndex: number) => {
      const updatedLayers = [...activeItem.layers]
      const layerIndex = updatedLayers.findIndex((l) => l.id === layerId)
      if (layerIndex === -1) return

      const layer = { ...updatedLayers[layerIndex]! }
      const frames = new Map(layer.frames)

      if (frames.has(frameIndex)) {
        frames.delete(frameIndex)
        layer.frames = frames
        updatedLayers[layerIndex] = layer

        const updatedItem: FrameAnimationItem = {
          ...activeItem,
          layers: updatedLayers,
        }

        onUpdate?.(updatedItem)
      }
    },
    [activeItem, onUpdate],
  )

  const handleDuplicateFrame = useCallback(
    (layerId: string, sourceFrame: number, targetFrame: number) => {
      const updatedLayers = [...activeItem.layers]
      const layerIndex = updatedLayers.findIndex((l) => l.id === layerId)
      if (layerIndex === -1) return

      const layer = { ...updatedLayers[layerIndex]! }
      const frames = new Map(layer.frames)

      const source = frames.get(sourceFrame)
      if (!source) return

      frames.set(targetFrame, {
        ...source,
        frameIndex: targetFrame,
        elements: source.elements.map((e) => ({
          ...e,
          id: crypto.randomUUID(),
          path: e.path ? { ...e.path, id: crypto.randomUUID() } : undefined,
          shape: e.shape ? { ...e.shape, id: crypto.randomUUID() } : undefined,
          text: e.text ? { ...e.text, id: crypto.randomUUID() } : undefined,
        })),
      })

      layer.frames = frames
      updatedLayers[layerIndex] = layer

      const updatedItem: FrameAnimationItem = {
        ...activeItem,
        layers: updatedLayers,
      }

      onUpdate?.(updatedItem)
    },
    [activeItem, onUpdate],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()

      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const newZoom = Math.max(0.1, Math.min(5, zoom + delta))

      setZoom(newZoom)
    },
    [zoom, setZoom],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === '=') {
        setZoom(Math.min(5, zoom + 0.1))
      } else if (e.key === '-') {
        setZoom(Math.max(0.1, zoom - 0.1))
      } else if (e.key === '0') {
        setZoom(1)
        setPan(0, 0)
      } else if (e.key === 'ArrowLeft') {
        setCurrentFrame(Math.max(0, currentFrame - 1))
      } else if (e.key === 'ArrowRight') {
        setCurrentFrame(currentFrame + 1)
      }
    },
    [zoom, currentFrame, setZoom, setPan, setCurrentFrame],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-shrink-0">
          <DrawingToolBar />
        </div>

        <div
          className="flex-1 relative overflow-hidden"
          onWheel={handleWheel}
        >
          <DrawingCanvas
            width={activeItem.width}
            height={activeItem.height}
            layers={activeItem.layers}
            currentFrame={currentFrame}
            backgroundColor={activeItem.backgroundColor}
            itemId={activeItem.id}
            onElementAdd={handleElementAdd}
          />

          <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1">
            <span className="text-xs text-muted-foreground">
              缩放: {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 w-64 border-l border-border overflow-y-auto">
          <PropertySection title="洋葱皮" icon={Paintbrush} defaultOpen={false}>
            <div className="px-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">启用</span>
                <button
                  className={`
                    w-8 h-4 rounded-full transition-colors
                    ${onionSkinSettings.enabled ? 'bg-primary' : 'bg-muted'}
                  `}
                  onClick={() =>
                    setOnionSkinSettings({ enabled: !onionSkinSettings.enabled })
                  }
                >
                  <div
                    className={`
                      w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform
                      ${onionSkinSettings.enabled ? 'translate-x-4' : 'translate-x-0.5'}
                    `}
                  />
                </button>
              </div>

              {onionSkinSettings.enabled && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">前帧数量</span>
                    <span className="text-xs">{onionSkinSettings.prevFrames}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">后帧数量</span>
                    <span className="text-xs">{onionSkinSettings.nextFrames}</span>
                  </div>
                </>
              )}
            </div>
          </PropertySection>

          <PropertySection title="网格" defaultOpen={false}>
            <div className="px-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">显示网格</span>
                <button
                  className={`
                    w-8 h-4 rounded-full transition-colors
                    ${showGrid ? 'bg-primary' : 'bg-muted'}
                  `}
                  onClick={() => setShowGrid(!showGrid)}
                >
                  <div
                    className={`
                      w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform
                      ${showGrid ? 'translate-x-4' : 'translate-x-0.5'}
                    `}
                  />
                </button>
              </div>

              {showGrid && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">网格大小</span>
                    <span className="text-xs">{gridSize}px</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">吸附网格</span>
                    <button
                      className={`
                        w-8 h-4 rounded-full transition-colors
                        ${snapToGrid ? 'bg-primary' : 'bg-muted'}
                      `}
                      onClick={() => setSnapToGrid(!snapToGrid)}
                    >
                      <div
                        className={`
                          w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform
                          ${snapToGrid ? 'translate-x-4' : 'translate-x-0.5'}
                        `}
                      />
                    </button>
                  </div>
                </>
              )}
            </div>
          </PropertySection>

          <DrawingLayersPanel />
        </div>
      </div>

      <FrameTimeline
        layers={activeItem.layers}
        currentFrame={currentFrame}
        durationInFrames={activeItem.durationInFrames}
        fps={activeItem.fps}
        onFrameChange={setCurrentFrame}
        onAddFrame={handleAddFrame}
        onRemoveFrame={handleRemoveFrame}
        onDuplicateFrame={handleDuplicateFrame}
      />
    </div>
  )
})
