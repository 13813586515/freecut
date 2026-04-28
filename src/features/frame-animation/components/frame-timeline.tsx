import { useCallback, useMemo, memo } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  ChevronRight,
  Film,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import type { DrawingLayer, DrawingFrame } from '../types'
import { useDrawingEditorStore } from '../store'

interface FrameTimelineProps {
  layers: DrawingLayer[]
  currentFrame: number
  durationInFrames: number
  fps: number
  onFrameChange: (frame: number) => void
  onAddFrame: (layerId: string, frameIndex: number) => void
  onRemoveFrame: (layerId: string, frameIndex: number) => void
  onDuplicateFrame: (layerId: string, sourceFrame: number, targetFrame: number) => void
}

const FRAME_WIDTH = 40
const LAYER_HEIGHT = 32
const HEADER_HEIGHT = 36
const TIMECODE_HEIGHT = 28

const FrameCell = memo(function FrameCell({
  frame,
  isCurrent,
  hasKeyframe,
  isActive,
  onClick,
  onDoubleClick,
}: {
  frame: number
  isCurrent: boolean
  hasKeyframe: boolean
  isActive: boolean
  onClick: (frame: number) => void
  onDoubleClick: (frame: number) => void
}) {
  return (
    <div
      className={`
        relative flex items-center justify-center cursor-pointer
        border-l border-border
        ${isCurrent ? 'bg-primary/20' : isActive ? 'bg-accent/50' : 'hover:bg-secondary/30'}
        transition-colors
      `}
      style={{ width: FRAME_WIDTH, height: LAYER_HEIGHT }}
      onClick={() => onClick(frame)}
      onDoubleClick={() => onDoubleClick(frame)}
    >
      {hasKeyframe && (
        <div className="w-3 h-3 bg-primary rounded-sm" />
      )}
      {isCurrent && (
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0"
          style={{
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '4px solid #ef4444',
          }}
        />
      )}
    </div>
  )
})

const LayerTrack = memo(function LayerTrack({
  layer,
  layerIndex,
  currentFrame,
  durationInFrames,
  activeLayerId,
  onFrameClick,
  onFrameDoubleClick,
  onToggleVisibility,
  onToggleLock,
  onSelectLayer,
}: {
  layer: DrawingLayer
  layerIndex: number
  currentFrame: number
  durationInFrames: number
  activeLayerId: string | null
  onFrameClick: (frame: number) => void
  onFrameDoubleClick: (frame: number) => void
  onToggleVisibility: (id: string, visible: boolean) => void
  onToggleLock: (id: string, locked: boolean) => void
  onSelectLayer: (id: string) => void
}) {
  const frames = useMemo(() => {
    const result: { frame: number; hasKeyframe: boolean }[] = []
    for (let f = 0; f < durationInFrames; f++) {
      result.push({
        frame: f,
        hasKeyframe: layer.frames.has(f),
      })
    }
    return result
  }, [layer.frames, durationInFrames])

  return (
    <div className="flex" style={{ height: LAYER_HEIGHT }}>
      <div
        className={`
          flex items-center gap-1 px-2 border-r border-b border-border
          ${activeLayerId === layer.id ? 'bg-accent' : 'bg-secondary/50'}
          hover:bg-accent/80 cursor-pointer
        `}
        style={{ width: 140, height: LAYER_HEIGHT }}
        onClick={() => onSelectLayer(layer.id)}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={(e) => {
            e.stopPropagation()
            onToggleVisibility(layer.id, !layer.visible)
          }}
        >
          {layer.visible ? (
            <Eye className="w-3 h-3" />
          ) : (
            <EyeOff className="w-3 h-3 text-muted-foreground" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={(e) => {
            e.stopPropagation()
            onToggleLock(layer.id, !layer.locked)
          }}
        >
          {layer.locked ? (
            <Lock className="w-3 h-3" />
          ) : (
            <Unlock className="w-3 h-3 text-muted-foreground" />
          )}
        </Button>
        <span className="text-xs truncate flex-1">{layer.name}</span>
      </div>

      <div
        className="flex overflow-hidden border-b border-border"
        style={{ height: LAYER_HEIGHT }}
      >
        {frames.map(({ frame, hasKeyframe }) => (
          <FrameCell
            key={frame}
            frame={frame}
            isCurrent={frame === currentFrame}
            hasKeyframe={hasKeyframe}
            isActive={activeLayerId === layer.id}
            onClick={onFrameClick}
            onDoubleClick={onFrameDoubleClick}
          />
        ))}
      </div>
    </div>
  )
})

export const FrameTimeline = memo(function FrameTimeline({
  layers,
  currentFrame,
  durationInFrames,
  fps,
  onFrameChange,
  onAddFrame,
  onRemoveFrame,
  onDuplicateFrame,
}: FrameTimelineProps) {
  const {
    activeLayerId,
    setActiveLayer,
    setLayerVisibility,
    setLayerLocked,
  } = useDrawingEditorStore(
    useShallow((s) => ({
      activeLayerId: s.activeLayerId,
      setActiveLayer: s.setActiveLayer,
      setLayerVisibility: s.setLayerVisibility,
      setLayerLocked: s.setLayerLocked,
    })),
  )

  const handleFrameClick = useCallback(
    (frame: number) => {
      onFrameChange(frame)
    },
    [onFrameChange],
  )

  const handleFrameDoubleClick = useCallback(
    (frame: number) => {
      if (activeLayerId) {
        const layer = layers.find((l) => l.id === activeLayerId)
        if (layer?.frames.has(frame)) {
          onRemoveFrame(activeLayerId, frame)
        } else {
          onAddFrame(activeLayerId, frame)
        }
      }
    },
    [activeLayerId, layers, onAddFrame, onRemoveFrame],
  )

  const timecodes = useMemo(() => {
    const result: { frame: number; label: string }[] = []
    const step = Math.max(1, Math.floor(fps / 2))

    for (let f = 0; f < durationInFrames; f += step) {
      const seconds = Math.floor(f / fps)
      const frames = f % fps
      result.push({
        frame: f,
        label: `${seconds}:${frames.toString().padStart(2, '0')}`,
      })
    }

    return result
  }, [durationInFrames, fps])

  const sortedLayers = useMemo(() => {
    return [...layers].sort((a, b) => a.order - b.order)
  }, [layers])

  const playheadPosition = currentFrame * FRAME_WIDTH

  return (
    <div className="flex flex-col bg-secondary/30 border-t border-border">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            帧: {currentFrame + 1} / {durationInFrames}
          </span>
          <span className="text-xs text-muted-foreground">
            ({fps} FPS)
          </span>
        </div>
        <div className="flex items-center gap-1">
          {activeLayerId && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onAddFrame(activeLayerId, currentFrame)}
                title="在当前帧添加关键帧"
              >
                <Plus className="w-3 h-3 mr-1" />
                关键帧
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  const layer = layers.find((l) => l.id === activeLayerId)
                  if (layer?.frames.has(currentFrame) && currentFrame + 1 < durationInFrames) {
                    onDuplicateFrame(activeLayerId, currentFrame, currentFrame + 1)
                  }
                }}
                title="复制当前帧到下一帧"
              >
                <Copy className="w-3 h-3 mr-1" />
                复制帧
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex">
        <div
          className="border-r border-border bg-secondary/50"
          style={{ width: 140, height: TIMECODE_HEIGHT }}
        />

        <div className="relative overflow-x-auto overflow-y-hidden">
          <div
            className="flex bg-secondary/20"
            style={{ height: TIMECODE_HEIGHT, width: durationInFrames * FRAME_WIDTH }}
          >
            {timecodes.map(({ frame, label }) => (
              <div
                key={frame}
                className="absolute flex items-end pb-1 text-xs text-muted-foreground pl-1"
                style={{ left: frame * FRAME_WIDTH, height: TIMECODE_HEIGHT }}
              >
                {label}
              </div>
            ))}
          </div>

          <div
            className="relative"
            style={{ width: durationInFrames * FRAME_WIDTH }}
          >
            {sortedLayers.map((layer, index) => (
              <LayerTrack
                key={layer.id}
                layer={layer}
                layerIndex={index}
                currentFrame={currentFrame}
                durationInFrames={durationInFrames}
                activeLayerId={activeLayerId}
                onFrameClick={handleFrameClick}
                onFrameDoubleClick={handleFrameDoubleClick}
                onToggleVisibility={setLayerVisibility}
                onToggleLock={setLayerLocked}
                onSelectLayer={setActiveLayer}
              />
            ))}

            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
              style={{ left: playheadPosition + 20 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
})
