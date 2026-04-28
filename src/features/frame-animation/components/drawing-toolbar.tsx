import { useCallback, memo } from 'react'
import {
  Pencil,
  PenTool,
  Paintbrush,
  Eraser,
  Line,
  Square,
  Circle,
  ArrowRight,
  Type,
  Move,
  Hand,
  Minus,
  Plus,
  Undo2,
  Redo2,
  Copy,
  Paste,
  Trash2,
  Layers,
  Play,
  Pause,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { useDrawingEditorStore } from '../store'
import type { DrawingToolType, DrawingPlaybackMode } from '../types'
import { getDefaultToolSettings } from '../drawing-engine'

const TOOLS: { id: DrawingToolType; icon: typeof Pencil; label: string }[] = [
  { id: 'pen', icon: PenTool, label: '画笔' },
  { id: 'pencil', icon: Pencil, label: '铅笔' },
  { id: 'marker', icon: Paintbrush, label: '马克笔' },
  { id: 'eraser', icon: Eraser, label: '橡皮擦' },
  { id: 'line', icon: Line, label: '直线' },
  { id: 'rectangle', icon: Square, label: '矩形' },
  { id: 'circle', icon: Circle, label: '圆形' },
  { id: 'arrow', icon: ArrowRight, label: '箭头' },
  { id: 'text', icon: Type, label: '文字' },
]

export const DrawingToolBar = memo(function DrawingToolBar() {
  const {
    toolSettings,
    setTool,
    setToolColor,
    setToolSize,
    setToolOpacity,
    isPlaying,
    startPlayback,
    stopPlayback,
    setCurrentFrame,
    undo,
    redo,
    copySelection,
    pasteSelection,
    deleteSelection,
    currentFrame,
  } = useDrawingEditorStore(
    useShallow((s) => ({
      toolSettings: s.toolSettings,
      setTool: s.setTool,
      setToolColor: s.setToolColor,
      setToolSize: s.setToolSize,
      setToolOpacity: s.setToolOpacity,
      isPlaying: s.isPlaying,
      startPlayback: s.startPlayback,
      stopPlayback: s.stopPlayback,
      setCurrentFrame: s.setCurrentFrame,
      undo: s.undo,
      redo: s.redo,
      copySelection: s.copySelection,
      pasteSelection: s.pasteSelection,
      deleteSelection: s.deleteSelection,
      currentFrame: s.currentFrame,
    })),
  )

  const handleToolSelect = useCallback(
    (tool: DrawingToolType) => {
      setTool(tool)
    },
    [setTool],
  )

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setToolColor(e.target.value)
    },
    [setToolColor],
  )

  const handleSizeChange = useCallback(
    (delta: number) => {
      const newSize = Math.max(1, Math.min(100, toolSettings.size + delta))
      setToolSize(newSize)
    },
    [toolSettings.size, setToolSize],
  )

  const handleOpacityChange = useCallback(
    (delta: number) => {
      const newOpacity = Math.max(0, Math.min(1, toolSettings.opacity + delta))
      setToolOpacity(newOpacity)
    },
    [toolSettings.opacity, setToolOpacity],
  )

  const handleTogglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback()
    } else {
      startPlayback()
    }
  }, [isPlaying, startPlayback, stopPlayback])

  const handleStepBack = useCallback(() => {
    setCurrentFrame(Math.max(0, currentFrame - 1))
  }, [currentFrame, setCurrentFrame])

  const handleStepForward = useCallback(() => {
    setCurrentFrame(currentFrame + 1)
  }, [currentFrame, setCurrentFrame])

  return (
    <div className="flex flex-col gap-2 p-2 bg-background border-r h-full">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold text-muted-foreground px-1 py-1">
          绘制工具
        </div>
        <div className="grid grid-cols-3 gap-1">
          {TOOLS.map(({ id, icon: Icon, label }) => (
            <Button
              key={id}
              variant={toolSettings.tool === id ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleToolSelect(id)}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </Button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border my-1" />

      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold text-muted-foreground px-1 py-1">
          颜色 & 尺寸
        </div>
        
        <div className="flex items-center gap-2 px-1">
          <input
            type="color"
            value={toolSettings.color}
            onChange={handleColorChange}
            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
          />
          <span className="text-xs text-muted-foreground flex-1">
            {toolSettings.color}
          </span>
        </div>

        <div className="flex items-center gap-1 px-1">
          <span className="text-xs text-muted-foreground w-12">尺寸</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => handleSizeChange(-1)}
          >
            <Minus className="w-3 h-3" />
          </Button>
          <span className="text-xs w-8 text-center">{toolSettings.size}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => handleSizeChange(1)}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex items-center gap-1 px-1">
          <span className="text-xs text-muted-foreground w-12">不透明</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => handleOpacityChange(-0.1)}
          >
            <Minus className="w-3 h-3" />
          </Button>
          <span className="text-xs w-8 text-center">
            {Math.round(toolSettings.opacity * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => handleOpacityChange(0.1)}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="h-px bg-border my-1" />

      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold text-muted-foreground px-1 py-1">
          编辑操作
        </div>
        <div className="grid grid-cols-3 gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={undo}
            title="撤销"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={redo}
            title="重做"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={copySelection}
            title="复制"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => pasteSelection(currentFrame)}
            title="粘贴"
          >
            <Paste className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={deleteSelection}
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="h-px bg-border my-1" />

      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold text-muted-foreground px-1 py-1">
          播放控制
        </div>
        <div className="flex items-center justify-center gap-1 px-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleStepBack}
            title="上一帧"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleTogglePlayback}
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleStepForward}
            title="下一帧"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
})
