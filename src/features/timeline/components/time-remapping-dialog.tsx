import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Gauge, RefreshCw, Play, Pause, SkipBack, SkipForward, Trash2, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  useEfficiencyToolsStore,
} from '../stores/efficiency-tools-store'
import {
  calculateTimeRemapping,
  getEffectiveSpeed,
  SPEED_RAMP_PRESETS,
  type SpeedRampPresetKey,
  type TimeRemapResult,
  validateTimeRemapping,
} from '../utils/time-remapping'
import type { TimelineItem } from '@/types/timeline'
import type { ItemKeyframes, PropertyKeyframes, AnimatableProperty } from '@/types/keyframe'
import { useKeyframesStore } from '../stores/keyframes-store'

export interface TimeRemappingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: TimelineItem | null
  fps: number
  onApplyKeyframes: (keyframes: ItemKeyframes) => void
}

function formatSpeed(speed: number): string {
  if (speed <= 0) return '0x (Freeze)'
  if (Math.abs(speed - 1) < 0.001) return '1x'
  if (speed > 100) return `${Math.round(speed)}x`
  return `${speed.toFixed(2)}x`
}

function formatTimecodeSeconds(seconds: number): string {
  const totalSeconds = Math.max(0, seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const secs = Math.floor(totalSeconds % 60)
  const ms = Math.floor((totalSeconds % 1) * 1000)
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

interface KeyframeEditorState {
  frame: number
  speed: number
  easing: EasingType
}

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In/Out' },
]

export function TimeRemappingDialog({
  open,
  onOpenChange,
  item,
  fps,
  onApplyKeyframes,
}: TimeRemappingDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState<SpeedRampPresetKey | null>(null)
  const [customKeyframes, setCustomKeyframes] = useState<KeyframeEditorState[]>([])
  const [editingKeyframeIndex, setEditingKeyframeIndex] = useState<number | null>(null)
  const [previewFrame, setPreviewFrame] = useState<number>(0)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const {
    timeRemapping,
    setTimeRemappingEditing,
    setTimeRemapResult,
    setSelectedPreset: setStorePreset,
    setTimeRemapError,
    resetTimeRemapping,
  } = useEfficiencyToolsStore((state) => ({
    timeRemapping: state.timeRemapping,
    setTimeRemappingEditing: state.setTimeRemappingEditing,
    setTimeRemapResult: state.setTimeRemapResult,
    setSelectedPreset: state.setSelectedPreset,
    setTimeRemapError: state.setTimeRemapError,
    resetTimeRemapping: state.resetTimeRemapping,
  }))

  const itemKeyframes = useKeyframesStore((s) =>
    item ? (s.keyframesByItemId[item.id] ?? null) : null
  )

  const itemDurationFrames = item?.durationInFrames ?? 0
  const baseSpeed = item?.speed ?? 1

  useEffect(() => {
    if (!open || !item) return

    setSelectedPreset(null)
    setPreviewFrame(0)
    setIsPreviewPlaying(false)
    setIsApplying(false)

    const existingSpeedKeyframes = itemKeyframes?.properties.find((p) => p.property === 'speed')
    if (existingSpeedKeyframes && existingSpeedKeyframes.keyframes.length > 0) {
      const kfs: KeyframeEditorState[] = existingSpeedKeyframes.keyframes.map((kf) => ({
        frame: kf.frame,
        speed: kf.value as number,
        easing: (kf.easing as EasingType) || 'linear',
      })).sort((a, b) => a.frame - b.frame)

      setCustomKeyframes(kfs)
    } else {
      setCustomKeyframes([
        { frame: 0, speed: baseSpeed, easing: 'linear' },
        { frame: itemDurationFrames, speed: baseSpeed, easing: 'linear' },
      ])
    }
  }, [open, item, itemKeyframes, baseSpeed, itemDurationFrames])

  const remappingResult = useMemo(() => {
    if (!itemDurationFrames || customKeyframes.length < 2) return null

    const keyframesProperty: PropertyKeyframes = {
      property: 'speed' as AnimatableProperty,
      keyframes: customKeyframes.map((kf, idx) => ({
        id: `kf-${idx}`,
        frame: kf.frame,
        value: kf.speed,
        easing: kf.easing,
      })),
    }

    const itemKeyframesForCalc: ItemKeyframes = {
      itemId: item?.id ?? 'temp',
      properties: [keyframesProperty],
    }

    try {
      const result = calculateTimeRemapping(
        itemKeyframesForCalc,
        itemDurationFrames,
        baseSpeed,
        item?.sourceStart ?? 0,
        fps,
        fps,
      )
      return result
    } catch {
      return null
    }
  }, [customKeyframes, itemDurationFrames, baseSpeed, item, fps])

  const previewSpeed = useMemo(() => {
    if (!item || customKeyframes.length < 2) return baseSpeed

    const keyframesProperty: PropertyKeyframes = {
      property: 'speed' as AnimatableProperty,
      keyframes: customKeyframes.map((kf, idx) => ({
        id: `kf-${idx}`,
        frame: kf.frame,
        value: kf.speed,
        easing: kf.easing,
      })),
    }

    const itemKeyframesForCalc: ItemKeyframes = {
      itemId: item.id,
      properties: [keyframesProperty],
    }

    return getEffectiveSpeed(itemKeyframesForCalc, previewFrame, baseSpeed)
  }, [item, customKeyframes, previewFrame, baseSpeed])

  const applyPreset = useCallback((presetKey: SpeedRampPresetKey) => {
    const preset = SPEED_RAMP_PRESETS[presetKey]
    if (!preset || !itemDurationFrames) return

    const normalizedKeyframes: KeyframeEditorState[] = preset.keyframes.map((kf) => ({
      frame: Math.round(kf.relativeFrame * itemDurationFrames),
      speed: kf.speed,
      easing: (kf.easing as EasingType) || 'linear',
    })).sort((a, b) => a.frame - b.frame)

    setCustomKeyframes(normalizedKeyframes)
    setSelectedPreset(presetKey)
  }, [itemDurationFrames])

  const addKeyframe = useCallback(() => {
    if (itemDurationFrames <= 0) return

    const newFrame = Math.min(previewFrame, itemDurationFrames)
    const existingIdx = customKeyframes.findIndex((kf) => kf.frame === newFrame)

    if (existingIdx >= 0) {
      setEditingKeyframeIndex(existingIdx)
      return
    }

    const keyframesProperty: PropertyKeyframes = {
      property: 'speed' as AnimatableProperty,
      keyframes: customKeyframes.map((kf, idx) => ({
        id: `kf-${idx}`,
        frame: kf.frame,
        value: kf.speed,
        easing: kf.easing,
      })),
    }

    const itemKeyframesForCalc: ItemKeyframes = {
      itemId: item?.id ?? 'temp',
      properties: [keyframesProperty],
    }

    const currentSpeed = getEffectiveSpeed(itemKeyframesForCalc, newFrame, baseSpeed)

    const newKeyframes = [...customKeyframes, {
      frame: newFrame,
      speed: currentSpeed,
      easing: 'linear' as EasingType,
    }].sort((a, b) => a.frame - b.frame)

    setCustomKeyframes(newKeyframes)
  }, [itemDurationFrames, previewFrame, customKeyframes, item, baseSpeed])

  const removeKeyframe = useCallback((index: number) => {
    if (customKeyframes.length <= 2) return
    const newKeyframes = customKeyframes.filter((_, i) => i !== index)
    setCustomKeyframes(newKeyframes)
    setEditingKeyframeIndex(null)
  }, [customKeyframes])

  const updateKeyframe = useCallback((index: number, updates: Partial<KeyframeEditorState>) => {
    const newKeyframes = [...customKeyframes]
    newKeyframes[index] = { ...newKeyframes[index], ...updates }
    newKeyframes.sort((a, b) => a.frame - b.frame)
    setCustomKeyframes(newKeyframes)
  }, [customKeyframes])

  const handleApply = useCallback(() => {
    if (!item || customKeyframes.length < 2) return

    setIsApplying(true)

    try {
      const keyframesProperty: PropertyKeyframes = {
        property: 'speed' as AnimatableProperty,
        keyframes: customKeyframes.map((kf, idx) => ({
          id: `speed-kf-${Date.now()}-${idx}`,
          frame: kf.frame,
          value: kf.speed,
          easing: kf.easing,
        })),
      }

      const newItemKeyframes: ItemKeyframes = {
        itemId: item.id,
        properties: [keyframesProperty],
      }

      onApplyKeyframes(newItemKeyframes)
      onOpenChange(false)
    } finally {
      setIsApplying(false)
    }
  }, [item, customKeyframes, onApplyKeyframes, onOpenChange])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetTimeRemapping()
        setIsPreviewPlaying(false)
      }
      onOpenChange(nextOpen)
    },
    [resetTimeRemapping, onOpenChange],
  )

  const presetOptions = Object.entries(SPEED_RAMP_PRESETS).map(([key, preset]) => ({
    value: key as SpeedRampPresetKey,
    label: preset.label,
    description: preset.description,
  }))

  const hasCustomEdits = selectedPreset !== null &&
    customKeyframes.length !== SPEED_RAMP_PRESETS[selectedPreset]?.keyframes.length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" hideCloseButton={isApplying}>
        <DialogHeader>
          <DialogTitle>Time Remapping & Speed Curves</DialogTitle>
          <DialogDescription>
            {item ? `Editing: Clip ${item.id.substring(0, 8)}... (${formatTimecodeSeconds(itemDurationFrames / fps)})` : 'No clip selected'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Quick Preset</Label>
            <div className="grid grid-cols-3 gap-2">
              {presetOptions.map((preset) => (
                <Button
                  key={preset.value}
                  variant={selectedPreset === preset.value ? 'default' : 'outline'}
                  onClick={() => applyPreset(preset.value)}
                  disabled={isApplying}
                  className="h-auto py-2 flex flex-col items-start gap-0"
                >
                  <span className="text-sm font-medium">{preset.label}</span>
                  <span className="text-xs text-muted-foreground opacity-80">{preset.description}</span>
                </Button>
              ))}
            </div>
            {hasCustomEdits && (
              <p className="text-xs text-yellow-500">Preset modified - changes no longer match original</p>
            )}
          </div>

          {remappingResult && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Speed Curve Preview</Label>
                  <Badge variant="outline">
                    Avg: {formatSpeed(remappingResult.averageSpeed)}
                  </Badge>
                </div>

                <div className="relative h-32 bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                  <svg className="w-full h-full" viewBox={`0 0 ${itemDurationFrames} 2`} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="speedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
                      </linearGradient>
                    </defs>

                    <line x1="0" y1="1" x2={itemDurationFrames} y2="1" stroke="#4b5563" strokeWidth="0.02" strokeDasharray="5,5" />

                    {remappingResult.frameMapping.length > 1 && (
                      <>
                        <path
                          d={remappingResult.frameMapping.map((mapping, idx) => {
                            const x = mapping.timelineFrame
                            const speed = mapping.effectiveSpeed
                            const clampedSpeed = Math.max(0.1, Math.min(speed, 5))
                            const normalizedSpeed = Math.log(clampedSpeed) / Math.log(5)
                            const y = 1 - (normalizedSpeed * 0.9 + 0.05)

                            return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
                          }).join(' ') + ' '}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="0.04"
                        />
                      </>
                    )}

                    {customKeyframes.map((kf, idx) => {
                      const clampedSpeed = Math.max(0.1, Math.min(kf.speed, 5))
                      const normalizedSpeed = Math.log(clampedSpeed) / Math.log(5)
                      const y = 1 - (normalizedSpeed * 0.9 + 0.05)
                      return (
                        <circle
                          key={idx}
                          cx={kf.frame}
                          cy={y}
                          r="0.08"
                          fill={editingKeyframeIndex === idx ? '#f59e0b' : '#3b82f6'}
                          stroke="white"
                          strokeWidth="0.02"
                          className="cursor-pointer"
                          onClick={() => {
                            setEditingKeyframeIndex(idx)
                            setPreviewFrame(kf.frame)
                          }}
                        />
                      )
                    })}

                    <line
                      x1={previewFrame}
                      y1="0"
                      x2={previewFrame}
                      y2="2"
                      stroke="#f59e0b"
                      strokeWidth="0.03"
                    />
                  </svg>

                  <div className="absolute top-1 right-2 text-xs text-gray-400">
                    5x
                  </div>
                  <div className="absolute top-1/2 right-2 text-xs text-gray-400 transform -translate-y-1/2">
                    1x
                  </div>
                  <div className="absolute bottom-1 right-2 text-xs text-gray-400">
                    0.1x
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewFrame(0)}
                    disabled={isApplying}
                  >
                    <SkipBack className="h-3 w-3 mr-1" />
                    Start
                  </Button>

                  <div className="flex-1 px-2">
                    <Slider
                      min={0}
                      max={itemDurationFrames}
                      step={1}
                      value={[previewFrame]}
                      onValueChange={([v]) => setPreviewFrame(v)}
                      disabled={isApplying}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewFrame(itemDurationFrames)}
                    disabled={isApplying}
                  >
                    End
                    <SkipForward className="h-3 w-3 ml-1" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addKeyframe}
                    disabled={isApplying || itemDurationFrames <= 0}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add KF
                  </Button>
                </div>

                <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
                  <span>
                    {formatTimecodeSeconds(previewFrame / fps)}
                    {' @ '}
                    <span className="text-blue-400 font-medium">{formatSpeed(previewSpeed)}</span>
                  </span>
                  <span>
                    Total source: {formatTimecodeSeconds(remappingResult.totalSourceFrames / fps)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4">
              <Label className="text-sm font-medium mb-2 block">Keyframes ({customKeyframes.length})</Label>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {customKeyframes.map((kf, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      editingKeyframeIndex === idx
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-xs text-muted-foreground w-6">#{idx + 1}</span>

                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-xs text-muted-foreground block">Frame</span>
                        <Input
                          type="number"
                          value={kf.frame}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            updateKeyframe(idx, {
                              frame: Math.max(0, Math.min(val, itemDurationFrames)),
                            })
                          }}
                          disabled={isApplying}
                          className="h-7 text-sm"
                          min={0}
                          max={itemDurationFrames}
                        />
                      </div>

                      <div>
                        <span className="text-xs text-muted-foreground block">Speed</span>
                        <Input
                          type="number"
                          value={kf.speed}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            updateKeyframe(idx, { speed: Math.max(0, val) })
                          }}
                          disabled={isApplying}
                          className="h-7 text-sm"
                          step={0.1}
                          min={0}
                        />
                      </div>

                      <div>
                        <span className="text-xs text-muted-foreground block">Easing</span>
                        <Select
                          value={kf.easing}
                          onValueChange={(val) => updateKeyframe(idx, { easing: val as EasingType })}
                          disabled={isApplying}
                        >
                          <SelectTrigger className="h-7 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EASING_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeKeyframe(idx)}
                      disabled={isApplying || customKeyframes.length <= 2}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                <p>Tip: Click keyframe dots on the graph to select them, or use the playhead position and "Add KF" to add new keyframes.</p>
              </div>
            </CardContent>
          </Card>

          {timeRemapping.remapError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {timeRemapping.remapError}
            </div>
          )}
        </div>

        <DialogFooter>
          {isApplying ? (
            <Button disabled className="w-full">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Applying speed curve...
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={customKeyframes.length < 2}>
                <Gauge className="mr-2 h-4 w-4" />
                Apply Speed Curve
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
