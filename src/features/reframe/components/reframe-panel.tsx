import { useCallback, useMemo, memo, useState } from 'react'
import {
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone,
  Square,
  Image as ImageIcon,
  Palette,
  Eye,
  RefreshCw,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PropertySection } from '@/shared/ui/property-controls'
import { cn } from '@/shared/ui/cn'
import type {
  ReframePreset,
  ReframeSettings,
  ReframeStrategy,
  ReframeBackgroundType,
} from '../types'
import { REFRAME_PRESETS, getPresetById, createSettingsFromPreset, DEFAULT_REFRAME_SETTINGS } from '../presets'
import {
  getReframeStrategyLabel,
  needsReframe,
  getAspectRatio,
} from '../calculator'
import { useReframeStore } from '../store'

interface ReframePanelProps {
  projectWidth?: number
  projectHeight?: number
  selectedItem?: {
    id: string
    type: string
    sourceWidth?: number
    sourceHeight?: number
  } | null
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'tiktok':
    case 'douyin':
      return <Smartphone className="w-4 h-4" />
    case 'instagram':
    case 'instagram-story':
    case 'instagram-reel':
      return <Square className="w-4 h-4" />
    case 'youtube':
    case 'youtube-shorts':
    case 'facebook':
      return <Monitor className="w-4 h-4" />
    case 'xiaohongshu':
    case 'kuaishou':
      return <ImageIcon className="w-4 h-4" />
    default:
      return <Square className="w-4 h-4" />
  }
}

function getAspectRatioLabel(width: number, height: number): string {
  const ratio = getAspectRatio(width, height)
  if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9 (横屏)'
  if (Math.abs(ratio - 9 / 16) < 0.01) return '9:16 (竖屏)'
  if (Math.abs(ratio - 1) < 0.01) return '1:1 (方形)'
  if (Math.abs(ratio - 4 / 5) < 0.01) return '4:5'
  if (Math.abs(ratio - 5 / 4) < 0.01) return '5:4'
  if (Math.abs(ratio - 4 / 3) < 0.01) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.01) return '3:4'
  if (Math.abs(ratio - 16 / 10) < 0.01) return '16:10'
  return `${width}x${height}`
}

const ReframePanel = memo(function ReframePanel({
  projectWidth,
  projectHeight,
  selectedItem,
}: ReframePanelProps) {
  const {
    isActive,
    currentPresetId,
    settings,
    sourceDimensions,
    lastResult,
    activate,
    deactivate,
    setPreset,
    setSettings,
    resetSettings,
    setSourceDimensions,
  } = useReframeStore(
    useShallow((state) => ({
      isActive: state.isActive,
      currentPresetId: state.currentPresetId,
      settings: state.settings,
      sourceDimensions: state.sourceDimensions,
      lastResult: state.lastResult,
      activate: state.activate,
      deactivate: state.deactivate,
      setPreset: state.setPreset,
      setSettings: state.setSettings,
      resetSettings: state.resetSettings,
      setSourceDimensions: state.setSourceDimensions,
    }))
  )

  const [customWidth, setCustomWidth] = useState(settings.targetWidth.toString())
  const [customHeight, setCustomHeight] = useState(settings.targetHeight.toString())

  const effectiveSourceDimensions = useMemo(() => {
    if (selectedItem?.sourceWidth && selectedItem?.sourceHeight) {
      return { width: selectedItem.sourceWidth, height: selectedItem.sourceHeight }
    }
    if (projectWidth && projectHeight) {
      return { width: projectWidth, height: projectHeight }
    }
    return sourceDimensions
  }, [selectedItem, projectWidth, projectHeight, sourceDimensions])

  const shouldShowReframe = useMemo(() => {
    if (!effectiveSourceDimensions) return false
    return needsReframe(
      effectiveSourceDimensions.width,
      effectiveSourceDimensions.height,
      settings.targetWidth,
      settings.targetHeight
    )
  }, [effectiveSourceDimensions, settings])

  const presetGroups = useMemo(() => {
    const groups: Record<string, ReframePreset[]> = {}
    for (const preset of REFRAME_PRESETS) {
      const platform = preset.platform
      if (!groups[platform]) {
        groups[platform] = []
      }
      groups[platform].push(preset)
    }
    return groups
  }, [])

  const platformLabels: Record<string, string> = {
    tiktok: 'TikTok',
    douyin: '抖音',
    instagram: 'Instagram',
    'instagram-story': 'Instagram 故事',
    'instagram-reel': 'Instagram Reel',
    facebook: 'Facebook',
    'youtube-shorts': 'YouTube Shorts',
    youtube: 'YouTube',
    xiaohongshu: '小红书',
    kuaishou: '快手',
    custom: '自定义',
  }

  const strategyOptions: { value: ReframeStrategy; label: string }[] = [
    { value: 'center-crop', label: '中心裁剪' },
    { value: 'smart-crop', label: '智能裁剪' },
    { value: 'fit-with-background', label: '适应+背景' },
    { value: 'letterbox', label: '黑边填充（上下）' },
    { value: 'pillarbox', label: '黑边填充（左右）' },
  ]

  const backgroundTypeOptions: { value: ReframeBackgroundType; label: string }[] = [
    { value: 'blur', label: '模糊背景' },
    { value: 'solid-color', label: '纯色背景' },
    { value: 'gradient', label: '渐变背景' },
  ]

  const handleToggleActive = useCallback(() => {
    if (isActive) {
      deactivate()
    } else {
      if (effectiveSourceDimensions) {
        setSourceDimensions(effectiveSourceDimensions)
      }
      activate()
    }
  }, [isActive, effectiveSourceDimensions, setSourceDimensions, activate, deactivate])

  const handlePresetChange = useCallback(
    (presetId: string) => {
      const preset = getPresetById(presetId)
      if (preset) {
        setPreset(presetId)
        setCustomWidth(preset.width.toString())
        setCustomHeight(preset.height.toString())
      }
    },
    [setPreset]
  )

  const handleStrategyChange = useCallback(
    (strategy: ReframeStrategy) => {
      setSettings({ strategy })
    },
    [setSettings]
  )

  const handleBackgroundTypeChange = useCallback(
    (backgroundType: ReframeBackgroundType) => {
      setSettings({ backgroundType })
    },
    [setSettings]
  )

  const handleBlurRadiusChange = useCallback(
    (value: number[]) => {
      setSettings({ backgroundBlurRadius: value[0]! })
    },
    [setSettings]
  )

  const handleBackgroundColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSettings({ backgroundColor: e.target.value })
    },
    [setSettings]
  )

  const handleCustomWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCustomWidth(e.target.value)
      const value = parseInt(e.target.value, 10)
      if (Number.isFinite(value) && value > 0) {
        setSettings({ targetWidth: value })
      }
    },
    [setSettings]
  )

  const handleCustomHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCustomHeight(e.target.value)
      const value = parseInt(e.target.value, 10)
      if (Number.isFinite(value) && value > 0) {
        setSettings({ targetHeight: value })
      }
    },
    [setSettings]
  )

  const handleReset = useCallback(() => {
    resetSettings()
    setCustomWidth(DEFAULT_REFRAME_SETTINGS.targetWidth.toString())
    setCustomHeight(DEFAULT_REFRAME_SETTINGS.targetHeight.toString())
  }, [resetSettings])

  return (
    <PropertySection title="自动重构图" icon={Maximize2} defaultOpen={true}>
      <div className="px-2 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={handleToggleActive} />
            <Label className="text-sm">启用重构图</Label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleReset}
            title="重置为默认设置"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {isActive && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">平台预设</Label>
              <Select value={currentPresetId || ''} onValueChange={handlePresetChange}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="选择预设">
                    {currentPresetId && (
                      <span className="flex items-center gap-1.5">
                        {getPlatformIcon(REFRAME_PRESETS.find((p) => p.id === currentPresetId)?.platform || 'custom')}
                        {REFRAME_PRESETS.find((p) => p.id === currentPresetId)?.name}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(presetGroups).map(([platform, presets]) => (
                    <div key={platform}>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {platformLabels[platform] || platform}
                      </div>
                      {presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id} className="text-xs">
                          <div className="flex items-center justify-between w-full">
                            <span>{preset.name}</span>
                            <span className="text-muted-foreground ml-2">
                              {preset.width}x{preset.height}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">目标宽度</Label>
                <Input
                  type="number"
                  value={customWidth}
                  onChange={handleCustomWidthChange}
                  className="h-7 text-xs"
                  min={1}
                  max={4096}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">目标高度</Label>
                <Input
                  type="number"
                  value={customHeight}
                  onChange={handleCustomHeightChange}
                  className="h-7 text-xs"
                  min={1}
                  max={4096}
                />
              </div>
            </div>

            {effectiveSourceDimensions && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                <div className="flex justify-between">
                  <span>源尺寸:</span>
                  <span className="font-mono">
                    {effectiveSourceDimensions.width}x{effectiveSourceDimensions.height}
                    ({getAspectRatioLabel(effectiveSourceDimensions.width, effectiveSourceDimensions.height)})
                  </span>
                </div>
                <div className="flex justify-between mt-0.5">
                  <span>目标尺寸:</span>
                  <span className="font-mono">
                    {settings.targetWidth}x{settings.targetHeight}
                    ({getAspectRatioLabel(settings.targetWidth, settings.targetHeight)})
                  </span>
                </div>
                {shouldShowReframe && (
                  <div className="text-amber-500 mt-1 flex items-center gap-1">
                    <Minimize2 className="w-3 h-3" />
                    比例不同，将进行重构图
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">重构图策略</Label>
              <Select value={settings.strategy} onValueChange={handleStrategyChange}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="选择策略" />
                </SelectTrigger>
                <SelectContent>
                  {strategyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(settings.strategy === 'fit-with-background' ||
              settings.strategy === 'letterbox' ||
              settings.strategy === 'pillarbox') && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">背景设置</Label>

                <div className="space-y-1.5">
                  <Select
                    value={settings.backgroundType}
                    onValueChange={handleBackgroundTypeChange}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="选择背景类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {backgroundTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {settings.backgroundType === 'blur' && (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs text-muted-foreground">模糊半径</Label>
                      <span className="text-xs text-muted-foreground">{settings.backgroundBlurRadius}px</span>
                    </div>
                    <Slider
                      value={[settings.backgroundBlurRadius]}
                      onValueChange={handleBlurRadiusChange}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>
                )}

                {(settings.backgroundType === 'solid-color' || settings.backgroundType === 'gradient') && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">背景颜色</Label>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-8 h-8 rounded border cursor-pointer',
                          'border-input hover:border-primary'
                        )}
                        style={{ backgroundColor: settings.backgroundColor }}
                      />
                      <Input
                        type="color"
                        value={settings.backgroundColor}
                        onChange={handleBackgroundColorChange}
                        className="h-7 p-0 border-0"
                      />
                      <Input
                        type="text"
                        value={settings.backgroundColor}
                        onChange={handleBackgroundColorChange}
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {lastResult && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">预览信息</span>
                </div>
                <div className="mt-1 space-y-0.5">
                  <div>裁剪区域: ({lastResult.sourceRegion.x}, {lastResult.sourceRegion.y}) - {lastResult.sourceRegion.width}x{lastResult.sourceRegion.height}</div>
                  <div>缩放: {lastResult.targetTransform.scaleX.toFixed(2)}x</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PropertySection>
  )
})

export { ReframePanel }
