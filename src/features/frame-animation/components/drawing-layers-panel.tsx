import { useCallback, memo, useMemo } from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Layers,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { PropertySection } from '@/shared/ui/property-controls'
import { useDrawingEditorStore } from '../store'
import type { DrawingLayer } from '../types'

interface LayerItemProps {
  layer: DrawingLayer
  isActive: boolean
  onSelect: (id: string) => void
  onToggleVisibility: (id: string, visible: boolean) => void
  onToggleLock: (id: string, locked: boolean) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

const LayerItem = memo(function LayerItem({
  layer,
  isActive,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: LayerItemProps) {
  const handleVisibilityClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggleVisibility(layer.id, !layer.visible)
    },
    [layer.id, layer.visible, onToggleVisibility],
  )

  const handleLockClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggleLock(layer.id, !layer.locked)
    },
    [layer.id, layer.locked, onToggleLock],
  )

  const handleDuplicateClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDuplicate(layer.id)
    },
    [layer.id, onDuplicate],
  )

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRemove(layer.id)
    },
    [layer.id, onRemove],
  )

  const handleMoveUpClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onMoveUp(layer.id)
    },
    [layer.id, onMoveUp],
  )

  const handleMoveDownClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onMoveDown(layer.id)
    },
    [layer.id, onMoveDown],
  )

  return (
    <div
      className={`
        flex items-center gap-1 px-2 py-1.5 rounded-sm cursor-pointer text-xs
        ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary/50'}
      `}
      onClick={() => onSelect(layer.id)}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={handleVisibilityClick}
        title={layer.visible ? '隐藏图层' : '显示图层'}
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
        className="h-6 w-6 p-0"
        onClick={handleLockClick}
        title={layer.locked ? '解锁图层' : '锁定图层'}
      >
        {layer.locked ? (
          <Lock className="w-3 h-3" />
        ) : (
          <Unlock className="w-3 h-3 text-muted-foreground" />
        )}
      </Button>

      <span className="flex-1 truncate" title={layer.name}>
        {layer.name}
      </span>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleMoveUpClick}
          title="上移图层"
        >
          <ChevronUp className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleMoveDownClick}
          title="下移图层"
        >
          <ChevronDown className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleDuplicateClick}
          title="复制图层"
        >
          <Copy className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive"
          onClick={handleRemoveClick}
          title="删除图层"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
})

export const DrawingLayersPanel = memo(function DrawingLayersPanel() {
  const {
    layers,
    activeLayerId,
    addLayer,
    setActiveLayer,
    setLayerVisibility,
    setLayerLocked,
    duplicateLayer,
    removeLayer,
    moveLayer,
  } = useDrawingEditorStore(
    useShallow((s) => ({
      layers: [] as DrawingLayer[],
      activeLayerId: s.activeLayerId,
      addLayer: s.addLayer,
      setActiveLayer: s.setActiveLayer,
      setLayerVisibility: s.setLayerVisibility,
      setLayerLocked: s.setLayerLocked,
      duplicateLayer: s.duplicateLayer,
      removeLayer: s.removeLayer,
      moveLayer: s.moveLayer,
    })),
  )

  const sortedLayers = useMemo(() => {
    return [...layers].sort((a, b) => b.order - a.order)
  }, [layers])

  const handleAddLayer = useCallback(() => {
    const newOrder = layers.length > 0 ? Math.max(...layers.map((l) => l.order)) + 1 : 0
    addLayer(`图层 ${layers.length + 1}`)
  }, [layers, addLayer])

  const handleMoveUp = useCallback(
    (layerId: string) => {
      const currentLayer = layers.find((l) => l.id === layerId)
      if (!currentLayer) return

      const layersAbove = layers.filter((l) => l.order > currentLayer.order)
      if (layersAbove.length === 0) return

      const nextLayer = layersAbove.sort((a, b) => a.order - b.order)[0]
      if (!nextLayer) return

      const currentOrder = currentLayer.order
      moveLayer(layerId, nextLayer.order)
      moveLayer(nextLayer.id, currentOrder)
    },
    [layers, moveLayer],
  )

  const handleMoveDown = useCallback(
    (layerId: string) => {
      const currentLayer = layers.find((l) => l.id === layerId)
      if (!currentLayer) return

      const layersBelow = layers.filter((l) => l.order < currentLayer.order)
      if (layersBelow.length === 0) return

      const prevLayer = layersBelow.sort((a, b) => b.order - a.order)[0]
      if (!prevLayer) return

      const currentOrder = currentLayer.order
      moveLayer(layerId, prevLayer.order)
      moveLayer(prevLayer.id, currentOrder)
    },
    [layers, moveLayer],
  )

  return (
    <PropertySection title="图层" icon={Layers} defaultOpen={true}>
      <div className="space-y-1">
        <div className="flex justify-end px-2 pb-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleAddLayer}
          >
            <Plus className="w-3 h-3 mr-1" />
            添加图层
          </Button>
        </div>

        <div className="space-y-0.5 max-h-60 overflow-y-auto">
          {sortedLayers.length === 0 ? (
            <div className="px-2 py-4 text-xs text-muted-foreground text-center">
              暂无图层
            </div>
          ) : (
            sortedLayers.map((layer) => (
              <LayerItem
                key={layer.id}
                layer={layer}
                isActive={activeLayerId === layer.id}
                onSelect={setActiveLayer}
                onToggleVisibility={setLayerVisibility}
                onToggleLock={setLayerLocked}
                onDuplicate={duplicateLayer}
                onRemove={removeLayer}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
              />
            ))
          )}
        </div>
      </div>
    </PropertySection>
  )
})
