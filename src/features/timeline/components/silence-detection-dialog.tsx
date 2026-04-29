import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Volume2, VolumeX, Scissors, Check, X, RefreshCw } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  useEfficiencyToolsStore,
  type SilenceDetectionState,
} from '../stores/efficiency-tools-store'
import {
  detectSilence,
  generateSilenceCutPlan,
  type SilenceDetectionOptions,
  type SilenceDetectionResult,
  type SilenceCutPlan,
} from '../utils/silence-detection'
import type { CachedWaveform } from '../services/waveform-cache'
import { useMediaLibraryStore } from '@/features/timeline/deps/media-library-store'
import { useKeyframesStore } from '../stores/keyframes-store'
import type { TimelineItem } from '@/types/timeline'

export interface SilenceDetectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: TimelineItem | null
  itemWaveform: CachedWaveform | null
  itemDurationFrames: number
  itemStartFrame: number
  fps: number
  onApplyCutPlan: (cutPlan: SilenceCutPlan) => void
}

function formatTimecode(frames: number, fps: number): string {
  const totalSeconds = Math.max(0, frames) / fps
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const ms = Math.floor((totalSeconds % 1) * 1000)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function SilenceDetectionDialog({
  open,
  onOpenChange,
  item,
  itemWaveform,
  itemDurationFrames,
  itemStartFrame,
  fps,
  onApplyCutPlan,
}: SilenceDetectionDialogProps) {
  const [thresholdDb, setThresholdDb] = useState(-40)
  const [minSilenceSeconds, setMinSilenceSeconds] = useState(0.3)
  const [minVoiceSeconds, setMinVoiceSeconds] = useState(0.2)
  const [mergeGapSeconds, setMergeGapSeconds] = useState(0.1)
  const [keepLeadingSilence, setKeepLeadingSilence] = useState(true)
  const [keepTrailingSilence, setKeepTrailingSilence] = useState(true)

  const {
    silenceDetection,
    setSilenceDetecting,
    setSilenceDetectionResult,
    setSilenceCutPlan,
    setSilenceDetectionError,
    setApplyingCut,
    resetSilenceDetection,
  } = useEfficiencyToolsStore((state) => ({
    silenceDetection: state.silenceDetection,
    setSilenceDetecting: state.setSilenceDetecting,
    setSilenceDetectionResult: state.setSilenceDetectionResult,
    setSilenceCutPlan: state.setSilenceCutPlan,
    setSilenceDetectionError: state.setSilenceDetectionError,
    setApplyingCut: state.setApplyingCut,
    resetSilenceDetection: state.resetSilenceDetection,
  }))

  const hasWaveform = itemWaveform !== null
  const canDetect = hasWaveform && !silenceDetection.isDetecting

  const runDetection = useCallback(() => {
    if (!itemWaveform || !item) return

    setSilenceDetecting(item.id, true)

    const options: SilenceDetectionOptions = {
      thresholdDb,
      minSilenceDurationSeconds: minSilenceSeconds,
      minVoiceDurationSeconds: minVoiceSeconds,
      mergeGapDurationSeconds: mergeGapSeconds,
      keepLeadingSilence,
      keepTrailingSilence,
    }

    try {
      const result = detectSilence(itemWaveform, options)
      setSilenceDetectionResult(result)

      const cutPlan = generateSilenceCutPlan(
        result,
        item.id,
        itemStartFrame,
        itemDurationFrames,
        fps,
      )
      setSilenceCutPlan(cutPlan)
    } catch (err) {
      setSilenceDetectionError(err instanceof Error ? err.message : 'Unknown error occurred')
    }
  }, [
    itemWaveform,
    item,
    thresholdDb,
    minSilenceSeconds,
    minVoiceSeconds,
    mergeGapSeconds,
    keepLeadingSilence,
    keepTrailingSilence,
    itemStartFrame,
    itemDurationFrames,
    fps,
    setSilenceDetecting,
    setSilenceDetectionResult,
    setSilenceCutPlan,
    setSilenceDetectionError,
  ])

  const handleApply = useCallback(() => {
    if (!silenceDetection.lastCutPlan) return

    setApplyingCut(true)
    try {
      onApplyCutPlan(silenceDetection.lastCutPlan)
      onOpenChange(false)
    } finally {
      setApplyingCut(false)
    }
  }, [silenceDetection.lastCutPlan, setApplyingCut, onApplyCutPlan, onOpenChange])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetSilenceDetection()
      }
      onOpenChange(nextOpen)
    },
    [resetSilenceDetection, onOpenChange],
  )

  useEffect(() => {
    if (!open) return

    setThresholdDb(-40)
    setMinSilenceSeconds(0.3)
    setMinVoiceSeconds(0.2)
    setMergeGapSeconds(0.1)
    setKeepLeadingSilence(true)
    setKeepTrailingSilence(true)
  }, [open])

  const stats = useMemo(() => {
    const result = silenceDetection.lastDetectionResult
    if (!result) return null

    return {
      voiceCount: result.voiceSegments.length,
      voiceTotalFrames: result.voiceSegments.reduce((sum, v) => sum + v.durationFrames, 0),
      silenceCount: result.silenceSegments.length,
      silenceTotalFrames: result.silenceSegments.reduce((sum, s) => sum + s.durationFrames, 0),
      silenceRatio: result.silenceRatio,
    }
  }, [silenceDetection.lastDetectionResult])

  const cutPlanStats = useMemo(() => {
    const plan = silenceDetection.lastCutPlan
    if (!plan) return null

    return {
      keepCount: plan.keepSegments.length,
      removeCount: plan.removeSegments.length,
      totalFramesToRemove: plan.totalFramesToRemove,
      newDurationFrames: plan.newDurationFrames,
      estimatedSaveRatio: plan.totalFramesToRemove / Math.max(1, itemDurationFrames),
    }
  }, [silenceDetection.lastCutPlan, itemDurationFrames])

  const isApplying = silenceDetection.isApplyingCut

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" hideCloseButton={isApplying}>
        <DialogHeader>
          <DialogTitle>Detect Silence & Auto-Crop</DialogTitle>
          <DialogDescription>
            {item ? `Analyze waveform for: ${item.mediaId || 'Unknown media'}` : 'No clip selected'}
          </DialogDescription>
        </DialogHeader>

        {!hasWaveform && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
            <div className="flex items-center gap-2">
              <VolumeX className="h-4 w-4" />
              <span>No waveform data available. The clip may be loading or is not audio/video.</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-sm">Silence Threshold</Label>
                <span className="text-xs text-muted-foreground">{thresholdDb} dB</span>
              </div>
              <Slider
                min={-60}
                max={-10}
                step={1}
                value={[thresholdDb]}
                onValueChange={([v]) => setThresholdDb(v)}
                disabled={!canDetect}
              />
              <p className="text-xs text-muted-foreground">Audio below this level is considered silent</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-sm">Min Silence Duration</Label>
                <span className="text-xs text-muted-foreground">{minSilenceSeconds.toFixed(2)}s</span>
              </div>
              <Slider
                min={0.1}
                max={2}
                step={0.05}
                value={[minSilenceSeconds]}
                onValueChange={([v]) => setMinSilenceSeconds(v)}
                disabled={!canDetect}
              />
              <p className="text-xs text-muted-foreground">Only silence longer than this will be marked</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-sm">Min Voice Duration</Label>
                <span className="text-xs text-muted-foreground">{minVoiceSeconds.toFixed(2)}s</span>
              </div>
              <Slider
                min={0.05}
                max={1}
                step={0.05}
                value={[minVoiceSeconds]}
                onValueChange={([v]) => setMinVoiceSeconds(v)}
                disabled={!canDetect}
              />
              <p className="text-xs text-muted-foreground">Short utterances below this are ignored</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-sm">Merge Gap</Label>
                <span className="text-xs text-muted-foreground">{mergeGapSeconds.toFixed(2)}s</span>
              </div>
              <Slider
                min={0}
                max={0.5}
                step={0.01}
                value={[mergeGapSeconds]}
                onValueChange={([v]) => setMergeGapSeconds(v)}
                disabled={!canDetect}
              />
              <p className="text-xs text-muted-foreground">Gaps smaller than this are merged with voice</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={keepLeadingSilence}
                onCheckedChange={(checked) => setKeepLeadingSilence(checked as boolean)}
                disabled={!canDetect}
              />
              <span className="text-sm">Keep leading silence</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={keepTrailingSilence}
                onCheckedChange={(checked) => setKeepTrailingSilence(checked as boolean)}
                disabled={!canDetect}
              />
              <span className="text-sm">Keep trailing silence</span>
            </label>
          </div>

          <Button onClick={runDetection} disabled={!canDetect || silenceDetection.isDetecting} className="w-full">
            {silenceDetection.isDetecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing waveform...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Detect Silence
              </>
            )}
          </Button>

          {silenceDetection.detectionError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {silenceDetection.detectionError}
            </div>
          )}

          {stats && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Volume2 className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Detection Results</span>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500">{stats.voiceCount}</div>
                    <div className="text-xs text-muted-foreground">Voice segments</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-400">{stats.silenceCount}</div>
                    <div className="text-xs text-muted-foreground">Silence segments</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {formatTimecode(stats.voiceTotalFrames, fps)}
                    </div>
                    <div className="text-xs text-muted-foreground">Total voice</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">
                      {formatPercent(stats.silenceRatio)}
                    </div>
                    <div className="text-xs text-muted-foreground">Silence ratio</div>
                  </div>
                </div>

                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full flex">
                    {silenceDetection.lastDetectionResult?.voiceSegments.map((segment, idx) => {
                      const ratio = segment.durationFrames / itemDurationFrames
                      const percent = ratio * 100
                      if (percent < 1) return null
                      return (
                        <div
                          key={`voice-${idx}`}
                          className="h-full bg-blue-500"
                          style={{ width: `${percent}%` }}
                          title={`Voice ${idx + 1}: ${formatTimecode(segment.durationFrames, fps)}`}
                        />
                      )
                    })}
                    {silenceDetection.lastDetectionResult?.silenceSegments.map((segment, idx) => {
                      const ratio = segment.durationFrames / itemDurationFrames
                      const percent = ratio * 100
                      if (percent < 1) return null
                      return (
                        <div
                          key={`silence-${idx}`}
                          className="h-full bg-gray-600"
                          style={{ width: `${percent}%` }}
                          title={`Silence ${idx + 1}: ${formatTimecode(segment.durationFrames, fps)}`}
                        />
                      )
                    })}
                  </div>
                </div>
                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                  <span>
                    <span className="inline-block w-3 h-3 bg-blue-500 mr-1 align-middle rounded-sm" />
                    Voice
                  </span>
                  <span>
                    <span className="inline-block w-3 h-3 bg-gray-600 mr-1 align-middle rounded-sm" />
                    Silence
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {cutPlanStats && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Scissors className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Cut Plan Preview</span>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-2 bg-green-500/10 rounded-lg">
                    <div className="text-lg font-bold text-green-500">{cutPlanStats.keepCount}</div>
                    <div className="text-xs text-muted-foreground">Segments to Keep</div>
                  </div>
                  <div className="text-center p-2 bg-red-500/10 rounded-lg">
                    <div className="text-lg font-bold text-red-500">{cutPlanStats.removeCount}</div>
                    <div className="text-xs text-muted-foreground">Segments to Remove</div>
                  </div>
                  <div className="text-center p-2 bg-blue-500/10 rounded-lg">
                    <div className="text-lg font-bold text-green-500">
                      -{formatPercent(cutPlanStats.estimatedSaveRatio)}
                    </div>
                    <div className="text-xs text-muted-foreground">Est. Time Saved</div>
                  </div>
                </div>

                <div className="mt-3 p-2 bg-secondary/50 rounded text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original duration:</span>
                    <span>{formatTimecode(itemDurationFrames, fps)}</span>
                  </div>
                  <div className="flex justify-between text-red-500">
                    <span>Will remove:</span>
                    <span>-{formatTimecode(cutPlanStats.totalFramesToRemove, fps)}</span>
                  </div>
                  <div className="flex justify-between text-green-500 font-medium mt-1 pt-1 border-t border-border">
                    <span>New duration:</span>
                    <span>{formatTimecode(cutPlanStats.newDurationFrames, fps)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          {isApplying ? (
            <Button disabled className="w-full">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Applying cuts...
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={!cutPlanStats}>
                <Check className="mr-2 h-4 w-4" />
                Apply Cuts ({cutPlanStats ? formatPercent(cutPlanStats.estimatedSaveRatio).replace('%', '') + '% faster' : 'Apply'})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
