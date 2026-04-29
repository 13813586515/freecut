import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Loader2, RefreshCw, Check, X, Camera, Film, Music, ChevronRight, Play, Pause, Zap } from 'lucide-react'
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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  useEfficiencyToolsStore,
} from '../stores/efficiency-tools-store'
import {
  createMulticamSession,
  syncTracksByWaveform,
  switchCameraAtFrame,
  buildNestedCompositionPlan,
  getSyncedTrackAtFrame,
  type MulticamTrack,
  type CameraSwitch,
  type NestedCompositionPlan,
} from '../utils/multicam-sync'
import type { CachedWaveform } from '../services/waveform-cache'
import type { TimelineItem } from '@/types/timeline'
import { useMediaLibraryStore } from '@/features/timeline/deps/media-library-store'

export interface MulticamEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableItems: TimelineItem[]
  itemWaveforms: Map<string, CachedWaveform>
  fps: number
  onApplyNestedComposition: (plan: NestedCompositionPlan) => void
}

function formatTimecode(frames: number, fps: number): string {
  const totalSeconds = Math.max(0, frames) / fps
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const ms = Math.floor((totalSeconds % 1) * 1000)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

function formatTimecodeSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

export function MulticamEditDialog({
  open,
  onOpenChange,
  availableItems,
  itemWaveforms,
  fps,
  onApplyNestedComposition,
}: MulticamEditDialogProps) {
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([])
  const [referenceTrackId, setReferenceTrackId] = useState<string | null>(null)
  const [previewFrame, setPreviewFrame] = useState(0)
  const [isApplying, setIsApplying] = useState(false)
  const [sessionName, setSessionName] = useState('')

  const {
    multicam,
    setMulticamSession,
    setSyncing,
    setMulticamMode,
    setActiveCameraIndex,
    setSwitches,
    addCameraSwitch,
    setMulticamSyncResult,
    setMulticamSyncError,
    setPreviewPlayheadFrame,
    resetMulticam,
  } = useEfficiencyToolsStore((state) => ({
    multicam: state.multicam,
    setMulticamSession: state.setMulticamSession,
    setSyncing: state.setSyncing,
    setMulticamMode: state.setMulticamMode,
    setActiveCameraIndex: state.setActiveCameraIndex,
    setSwitches: state.setSwitches,
    addCameraSwitch: state.addCameraSwitch,
    setMulticamSyncResult: state.setMulticamSyncResult,
    setMulticamSyncError: state.setMulticamSyncError,
    setPreviewPlayheadFrame: state.setPreviewPlayheadFrame,
    resetMulticam: state.resetMulticam,
  }))

  const availableTracks = useMemo(() => {
    return availableItems
      .filter((item) => item.type === 'video' || item.type === 'audio')
      .map((item) => {
        const waveform = itemWaveforms.get(item.id)
        const track: Omit<MulticamTrack, 'syncOffsetFrames' | 'syncOffsetSeconds' | 'isSynced' | 'isActive'> = {
          id: item.id,
          name: item.mediaId?.substring(0, 12) || `Clip ${item.id.substring(0, 6)}`,
          mediaId: item.mediaId || '',
          src: item.src || '',
          type: item.type,
          durationFrames: item.durationInFrames,
          durationSeconds: item.durationInFrames / fps,
          waveform,
          label: item.type === 'video' ? undefined : undefined,
        }
        return track
      })
  }, [availableItems, itemWaveforms, fps])

  const tracksWithWaveform = useMemo(() => {
    return availableTracks.filter((t) => t.waveform !== undefined)
  }, [availableTracks])

  useEffect(() => {
    if (!open) return

    setSelectedTrackIds([])
    setReferenceTrackId(null)
    setPreviewFrame(0)
    setIsApplying(false)
    setSessionName('Multicam Session')
    resetMulticam()

    if (tracksWithWaveform.length > 0) {
      setSelectedTrackIds(tracksWithWaveform.slice(0, Math.min(4, tracksWithWaveform.length)).map((t) => t.id))
      setReferenceTrackId(tracksWithWaveform[0].id)
    }
  }, [open, tracksWithWaveform, resetMulticam])

  const toggleTrackSelection = useCallback((trackId: string) => {
    setSelectedTrackIds((prev) => {
      if (prev.includes(trackId)) {
        const next = prev.filter((id) => id !== trackId)
        if (referenceTrackId === trackId && next.length > 0) {
          setReferenceTrackId(next[0])
        }
        return next
      }
      const next = [...prev, trackId]
      if (next.length === 1 || !referenceTrackId) {
        setReferenceTrackId(trackId)
      }
      return next
    })
  }, [referenceTrackId])

  const runSync = useCallback(() => {
    const selectedTracks = selectedTrackIds
      .map((id) => tracksWithWaveform.find((t) => t.id === id))
      .filter(Boolean) as typeof tracksWithWaveform

    if (selectedTracks.length < 2) {
      setMulticamSyncError('Need at least 2 tracks with waveform data to sync')
      return
    }

    const referenceTrack = selectedTracks.find((t) => t.id === referenceTrackId)
    if (!referenceTrack) {
      setMulticamSyncError('Reference track not found')
      return
    }

    const targetTracks = selectedTracks.filter((t) => t.id !== referenceTrackId)

    setSyncing(true)
    setMulticamSyncError(null)

    try {
      const session = createMulticamSession(
        selectedTracks.map((t) => ({
          id: t.id,
          name: t.name,
          mediaId: t.mediaId,
          src: t.src,
          type: t.type,
          durationFrames: t.durationFrames,
          durationSeconds: t.durationSeconds,
          waveform: t.waveform,
        })),
        sessionName || 'Multicam Session',
      )

      const updatedSession = { ...session, referenceTrackId }

      const syncResult = syncTracksByWaveform(
        {
          ...referenceTrack,
          syncOffsetFrames: 0,
          syncOffsetSeconds: 0,
          isSynced: false,
          isActive: false,
        },
        targetTracks.map((t) => ({
          ...t,
          syncOffsetFrames: 0,
          syncOffsetSeconds: 0,
          isSynced: false,
          isActive: false,
        })),
        {
          maxOffsetSeconds: 30,
          confidenceThreshold: 0.3,
        },
      )

      setMulticamSession(updatedSession)
      setMulticamSyncResult(syncResult)
      setSwitches([])
      setActiveCameraIndex(0)
    } catch (err) {
      setMulticamSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }, [
    selectedTrackIds,
    tracksWithWaveform,
    referenceTrackId,
    sessionName,
    setSyncing,
    setMulticamSyncError,
    setMulticamSession,
    setMulticamSyncResult,
    setSwitches,
    setActiveCameraIndex,
  ])

  const handleCameraSwitch = useCallback(
    (trackIndex: number) => {
      if (!multicam.session) return

      const sessionTracks = multicam.session.tracks
      const targetTrack = sessionTracks[trackIndex]
      if (!targetTrack) return

      const sw = switchCameraAtFrame(
        multicam.session,
        previewFrame,
        targetTrack.id,
        'cut',
        0,
      )

      if (sw) {
        addCameraSwitch(sw)
        setActiveCameraIndex(trackIndex)
      }
    },
    [multicam.session, previewFrame, addCameraSwitch, setActiveCameraIndex],
  )

  const activeTrackAtPreview = useMemo(() => {
    if (!multicam.session) return null
    return getSyncedTrackAtFrame(multicam.session, previewFrame, multicam.switches)
  }, [multicam.session, previewFrame, multicam.switches])

  const sortedSwitches = useMemo(() => {
    return [...multicam.switches].sort((a, b) => a.fromFrame - b.fromFrame)
  }, [multicam.switches])

  const nestedPlan = useMemo(() => {
    if (!multicam.session) return null
    return buildNestedCompositionPlan({
      session: multicam.session,
      switches: sortedSwitches,
      nestedCompositionId: null,
    })
  }, [multicam.session, sortedSwitches])

  const handleApply = useCallback(() => {
    if (!nestedPlan) return

    setIsApplying(true)
    try {
      onApplyNestedComposition(nestedPlan)
      onOpenChange(false)
    } finally {
      setIsApplying(false)
    }
  }, [nestedPlan, onApplyNestedComposition, onOpenChange])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetMulticam()
      }
      onOpenChange(nextOpen)
    },
    [resetMulticam, onOpenChange],
  )

  const syncedTracksWithOffset = useMemo(() => {
    if (!multicam.syncResult || !multicam.session) return []

    return multicam.session.tracks.map((track) => ({
      ...track,
      displayOffset:
        track.id === multicam.syncResult?.referenceTrackId
          ? 0
          : (multicam.syncResult?.trackOffsets.get(track.id) ?? 0),
    }))
  }, [multicam.syncResult, multicam.session])

  const maxDurationFrames = useMemo(() => {
    if (!multicam.session) return 0
    return Math.max(...multicam.session.tracks.map((t) => t.durationFrames))
  }, [multicam.session])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" hideCloseButton={isApplying}>
        <DialogHeader>
          <DialogTitle>Multicam Sync & Edit</DialogTitle>
          <DialogDescription>
            {tracksWithWaveform.length} tracks with waveform data available
            {tracksWithWaveform.length !== availableTracks.length && ` (${availableTracks.length - tracksWithWaveform.length} tracks without waveform)`}
          </DialogDescription>
        </DialogHeader>

        {!multicam.session ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Session Name</Label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
                placeholder="Multicam Session"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Select Tracks to Sync</Label>
                <Badge variant="outline">
                  {selectedTrackIds.length} selected
                </Badge>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
                {tracksWithWaveform.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No tracks with waveform data available</p>
                    <p className="text-xs mt-1">Ensure audio/video clips are loaded</p>
                  </div>
                ) : (
                  tracksWithWaveform.map((track) => (
                    <div
                      key={track.id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                        selectedTrackIds.includes(track.id)
                          ? 'bg-blue-500/10 border border-blue-500/50'
                          : 'hover:bg-accent/50 border border-transparent'
                      }`}
                      onClick={() => toggleTrackSelection(track.id)}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedTrackIds.includes(track.id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-500'
                      }`}>
                        {selectedTrackIds.includes(track.id) && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>

                      {track.type === 'video' ? (
                        <Film className="h-4 w-4 text-purple-400" />
                      ) : (
                        <Music className="h-4 w-4 text-green-400" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{track.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimecodeSeconds(track.durationSeconds)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {track.id === referenceTrackId && selectedTrackIds.includes(track.id) && (
                          <Badge variant="secondary" className="text-xs">Reference</Badge>
                        )}
                        {selectedTrackIds.includes(track.id) && track.id !== referenceTrackId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              setReferenceTrackId(track.id)
                            }}
                          >
                            Set Reference
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Button
              onClick={runSync}
              disabled={selectedTrackIds.length < 2 || multicam.isSyncing}
              className="w-full"
            >
              {multicam.isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing audio for sync...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Tracks by Waveform
                </>
              )}
            </Button>

            {multicam.syncError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {multicam.syncError}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Sync Results</span>
                  </div>

                  {multicam.syncResult && (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={multicam.syncResult.confidence > 0.7 ? 'default' : 'outline'}
                        className={multicam.syncResult.confidence > 0.7 ? 'bg-green-500' : ''}
                      >
                        Confidence: {(multicam.syncResult.confidence * 100).toFixed(0)}%
                      </Badge>
                      {multicam.syncResult.issues.length > 0 && (
                        <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                          {multicam.syncResult.issues.length} warnings
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {syncedTracksWithOffset.map((track, idx) => (
                    <div
                      key={track.id}
                      className={`flex items-center gap-3 p-2 rounded-md ${
                        idx === multicam.activeCameraIndex ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-secondary/30'
                      }`}
                    >
                      <Badge variant="outline" className="h-6 w-6 p-0 flex items-center justify-center">
                        {idx + 1}
                      </Badge>

                      {track.type === 'video' ? (
                        <Film className="h-4 w-4 text-purple-400" />
                      ) : (
                        <Music className="h-4 w-4 text-green-400" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {track.name}
                          {track.id === multicam.session?.referenceTrackId && (
                            <Badge variant="secondary" className="ml-2 text-xs">Ref</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {track.displayOffset !== 0 && (
                            <span className={track.displayOffset > 0 ? 'text-green-500' : 'text-red-500'}>
                              Sync offset: {track.displayOffset > 0 ? '+' : ''}{track.displayOffset} frames
                              ({formatTimecode(Math.abs(track.displayOffset), fps)})
                            </span>
                          )}
                          {track.displayOffset === 0 && <span className="text-muted-foreground">Aligned to reference</span>}
                        </div>
                      </div>

                      {idx === multicam.activeCameraIndex && (
                        <Badge variant="default" className="bg-blue-500">
                          LIVE
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {multicam.syncResult?.issues && multicam.syncResult.issues.length > 0 && (
                  <div className="mt-3 p-2 bg-yellow-500/10 rounded-md text-xs text-yellow-600">
                    {multicam.syncResult.issues.map((issue, idx) => (
                      <div key={idx}>• {issue}</div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Multicam Preview</span>
                    <span className="text-xs text-muted-foreground">
                      (Press number keys 1-{Math.min(multicam.session.tracks.length, 9)} to switch)
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="relative h-16 bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                    <div className="absolute inset-0 flex items-stretch">
                      {multicam.session.tracks.map((track, idx) => {
                        const switchesAtTrack = sortedSwitches.filter((sw) => sw.toTrackId === track.id)
                        return (
                          <div
                            key={track.id}
                            className={`flex-1 border-r border-gray-700 last:border-r-0 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                              idx === multicam.activeCameraIndex
                                ? 'bg-blue-500/20'
                                : 'hover:bg-gray-800'
                            }`}
                            onClick={() => handleCameraSwitch(idx)}
                          >
                            <span className="text-2xl font-bold text-gray-400">{idx + 1}</span>
                            <span className="text-xs text-muted-foreground truncate px-1 max-w-full">
                              {track.name}
                            </span>
                            {idx === multicam.activeCameraIndex && (
                              <Badge variant="default" className="mt-1 bg-blue-500 text-xs">
                                ACTIVE
                              </Badge>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20">
                      {formatTimecode(previewFrame, fps)}
                    </span>
                    <Slider
                      min={0}
                      max={maxDurationFrames}
                      step={1}
                      value={[previewFrame]}
                      onValueChange={([v]) => setPreviewFrame(v)}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {formatTimecode(maxDurationFrames, fps)}
                    </span>
                  </div>

                  {activeTrackAtPreview && (
                    <div className="text-sm text-center text-muted-foreground">
                      Previewing: <span className="text-white font-medium">{activeTrackAtPreview.name}</span>
                      at {formatTimecode(previewFrame, fps)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">
                    Camera Cuts ({sortedSwitches.length})
                  </Label>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSwitches([])}
                    disabled={sortedSwitches.length === 0}
                  >
                    Clear All
                  </Button>
                </div>

                {sortedSwitches.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No cuts yet. Click on the camera previews above to add cuts at the current playhead position.
                  </div>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {sortedSwitches.map((sw, idx) => {
                      const fromTrack = multicam.session?.tracks.find((t) => t.id === sw.fromTrackId)
                      const toTrack = multicam.session?.tracks.find((t) => t.id === sw.toTrackId)
                      return (
                        <div
                          key={sw.id}
                          className="flex items-center gap-2 p-2 text-sm bg-secondary/30 rounded-md"
                        >
                          <span className="text-muted-foreground w-8">#{idx + 1}</span>
                          <span className="font-mono text-xs text-blue-400 w-24">
                            {formatTimecode(sw.fromFrame, fps)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs">
                            {fromTrack?.name || '?'} → {toTrack?.name || '?'}
                          </span>
                          <Badge variant="outline" className="ml-auto text-xs">
                            {sw.transitionType}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {nestedPlan && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Film className="h-4 w-4 text-violet-500" />
                    <Label className="text-sm font-medium">Nested Composition Preview</Label>
                  </div>

                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Composition:</span>
                      <span className="font-mono">{nestedPlan.compositionName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tracks:</span>
                      <span>{nestedPlan.tracks.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total segments:</span>
                      <span>
                        {nestedPlan.tracks.reduce((sum, t) => sum + t.items.length, 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setMulticamSession(null)
                  setMulticamSyncResult(null)
                  setSwitches([])
                }}
              >
                Back to Track Selection
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {isApplying ? (
            <Button disabled className="w-full">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating nested composition...
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              {nestedPlan && (
                <Button onClick={handleApply}>
                  <Film className="mr-2 h-4 w-4" />
                  Create Nested Composition
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
