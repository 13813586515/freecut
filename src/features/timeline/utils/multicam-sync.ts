import type { CachedWaveform } from '../services/waveform-cache'
import { getMonoPeaks } from '../services/waveform-cache'

export interface MulticamTrack {
  id: string
  name: string
  label?: string
  mediaId: string
  src: string
  type: 'video' | 'audio'
  durationFrames: number
  durationSeconds: number
  waveform?: CachedWaveform
  syncOffsetFrames: number
  syncOffsetSeconds: number
  isSynced: boolean
  isActive: boolean
}

export interface SyncResult {
  success: boolean
  referenceTrackId: string
  trackOffsets: Map<string, number>
  confidence: number
  issues: string[]
}

export interface MulticamSession {
  id: string
  name: string
  tracks: MulticamTrack[]
  referenceTrackId: string | null
  isSynced: boolean
  activeTrackId: string | null
  timelineStartFrame: number
  durationFrames: number
}

export interface CameraSwitch {
  id: string
  fromFrame: number
  toFrame: number
  fromTrackId: string
  toTrackId: string
  transitionType: 'cut' | 'dissolve' | 'slide'
  transitionDurationFrames: number
}

export interface MulticamEditPlan {
  session: MulticamSession
  switches: CameraSwitch[]
  nestedCompositionId: string | null
}

function normalizeWaveform(waveform: CachedWaveform): Float32Array {
  const peaks = getMonoPeaks(waveform)
  const maxPeak = waveform.maxPeak > 0 ? waveform.maxPeak : 1

  const normalized = new Float32Array(peaks.length)
  for (let i = 0; i < peaks.length; i++) {
    normalized[i] = (peaks[i] ?? 0) / maxPeak
  }

  return normalized
}

function extractEnergyFingerprint(
  normalizedWaveform: Float32Array,
  windowSize: number = 20,
): number[] {
  const fingerprint: number[] = []
  const numWindows = Math.floor(normalizedWaveform.length / windowSize)

  for (let w = 0; w < numWindows; w++) {
    let sum = 0
    const startIdx = w * windowSize
    const endIdx = Math.min(startIdx + windowSize, normalizedWaveform.length)

    for (let i = startIdx; i < endIdx; i++) {
      sum += normalizedWaveform[i] ?? 0
    }

    fingerprint.push(sum / (endIdx - startIdx))
  }

  return fingerprint
}

function crossCorrelate(
  reference: number[],
  target: number[],
  maxOffset: number = 500,
): { bestOffset: number; bestScore: number; scores: number[] } {
  const scores: number[] = []
  let bestScore = -Infinity
  let bestOffset = 0

  const minOffset = -Math.min(maxOffset, reference.length - 1, target.length - 1)
  const maxOffsetVal = Math.min(maxOffset, reference.length - 1, target.length - 1)

  for (let offset = minOffset; offset <= maxOffsetVal; offset++) {
    let score = 0
    let count = 0

    for (let i = 0; i < reference.length; i++) {
      const targetIdx = i + offset
      if (targetIdx >= 0 && targetIdx < target.length) {
        score += (reference[i] ?? 0) * (target[targetIdx] ?? 0)
        count++
      }
    }

    if (count > 0) {
      const normalizedScore = score / Math.sqrt(count)
      scores.push(normalizedScore)

      if (normalizedScore > bestScore) {
        bestScore = normalizedScore
        bestOffset = offset
      }
    }
  }

  return { bestOffset, bestScore, scores }
}

export function syncTracksByWaveform(
  referenceTrack: MulticamTrack,
  targetTracks: MulticamTrack[],
  options: {
    maxOffsetSeconds?: number
    windowSize?: number
    confidenceThreshold?: number
  } = {},
): SyncResult {
  const {
    maxOffsetSeconds = 30,
    windowSize = 20,
    confidenceThreshold = 0.5,
  } = options

  const issues: string[] = []
  const trackOffsets = new Map<string, number>()

  if (!referenceTrack.waveform) {
    return {
      success: false,
      referenceTrackId: referenceTrack.id,
      trackOffsets,
      confidence: 0,
      issues: ['Reference track has no waveform data'],
    }
  }

  const referenceNormalized = normalizeWaveform(referenceTrack.waveform)
  const referenceFingerprint = extractEnergyFingerprint(referenceNormalized, windowSize)

  if (referenceFingerprint.length === 0) {
    return {
      success: false,
      referenceTrackId: referenceTrack.id,
      trackOffsets,
      confidence: 0,
      issues: ['Reference track waveform is too short'],
    }
  }

  const sampleRate = referenceTrack.waveform.sampleRate
  const maxOffsetWindows = Math.ceil((maxOffsetSeconds * sampleRate) / windowSize)

  let totalConfidence = 0
  let syncedCount = 0

  for (const targetTrack of targetTracks) {
    if (!targetTrack.waveform) {
      issues.push(`Track "${targetTrack.name}" has no waveform data, cannot sync`)
      continue
    }

    const targetNormalized = normalizeWaveform(targetTrack.waveform)
    const targetFingerprint = extractEnergyFingerprint(targetNormalized, windowSize)

    if (targetFingerprint.length === 0) {
      issues.push(`Track "${targetTrack.name}" waveform is too short`)
      continue
    }

    const correlation = crossCorrelate(referenceFingerprint, targetFingerprint, maxOffsetWindows)

    const offsetSamples = correlation.bestOffset * windowSize
    const offsetSeconds = offsetSamples / sampleRate
    const offsetFrames = Math.round(offsetSeconds * 30)

    const maxPossibleScore = Math.min(referenceFingerprint.length, targetFingerprint.length)
    const normalizedConfidence = maxPossibleScore > 0
      ? Math.min(1, correlation.bestScore / maxPossibleScore)
      : 0

    if (normalizedConfidence < confidenceThreshold) {
      issues.push(
        `Track "${targetTrack.name}" sync confidence (${(normalizedConfidence * 100).toFixed(0)}%) below threshold (${(confidenceThreshold * 100).toFixed(0)}%)`,
      )
    }

    trackOffsets.set(targetTrack.id, offsetFrames)
    totalConfidence += normalizedConfidence
    syncedCount++
  }

  const averageConfidence = syncedCount > 0 ? totalConfidence / syncedCount : 0

  return {
    success: trackOffsets.size > 0,
    referenceTrackId: referenceTrack.id,
    trackOffsets,
    confidence: averageConfidence,
    issues,
  }
}

export function createMulticamSession(
  tracks: Omit<MulticamTrack, 'syncOffsetFrames' | 'syncOffsetSeconds' | 'isSynced' | 'isActive'>[],
  name?: string,
): MulticamSession {
  const processedTracks: MulticamTrack[] = tracks.map((t) => ({
    ...t,
    syncOffsetFrames: 0,
    syncOffsetSeconds: 0,
    isSynced: false,
    isActive: false,
  }))

  let maxDurationFrames = 0
  for (const track of processedTracks) {
    if (track.durationFrames > maxDurationFrames) {
      maxDurationFrames = track.durationFrames
    }
  }

  return {
    id: `multicam-${Date.now()}`,
    name: name || `Multicam Session ${tracks.length} tracks`,
    tracks: processedTracks,
    referenceTrackId: processedTracks.length > 0 ? processedTracks[0].id : null,
    isSynced: false,
    activeTrackId: null,
    timelineStartFrame: 0,
    durationFrames: maxDurationFrames,
  }
}

export function applySyncToSession(
  session: MulticamSession,
  syncResult: SyncResult,
): MulticamSession {
  if (!syncResult.success) {
    return session
  }

  const updatedTracks = session.tracks.map((track) => {
    if (track.id === syncResult.referenceTrackId) {
      return {
        ...track,
        syncOffsetFrames: 0,
        syncOffsetSeconds: 0,
        isSynced: true,
      }
    }

    const offset = syncResult.trackOffsets.get(track.id)
    if (offset !== undefined) {
      return {
        ...track,
        syncOffsetFrames: offset,
        syncOffsetSeconds: offset / 30,
        isSynced: true,
      }
    }

    return track
  })

  return {
    ...session,
    tracks: updatedTracks,
    isSynced: true,
  }
}

export function switchCameraAtFrame(
  session: MulticamSession,
  frame: number,
  targetTrackId: string,
  transitionType: CameraSwitch['transitionType'] = 'cut',
  transitionDurationFrames: number = 0,
): CameraSwitch | null {
  const targetTrack = session.tracks.find((t) => t.id === targetTrackId)
  if (!targetTrack) {
    return null
  }

  const effectiveFrame = frame - targetTrack.syncOffsetFrames

  return {
    id: `switch-${Date.now()}`,
    fromFrame: effectiveFrame,
    toFrame: effectiveFrame,
    fromTrackId: session.activeTrackId ?? '',
    toTrackId: targetTrackId,
    transitionType,
    transitionDurationFrames,
  }
}

export interface NestedCompositionPlan {
  compositionId: string
  compositionName: string
  tracks: Array<{
    trackId: string
    trackName: string
    items: Array<{
      itemId: string
      from: number
      durationFrames: number
      trackId: string
      type: 'video' | 'audio'
      mediaId: string
      src: string
      sourceStart: number
      sourceEnd: number
      speed: number
    }>
  }>
}

export function buildNestedCompositionPlan(
  editPlan: MulticamEditPlan,
): NestedCompositionPlan {
  const { session, switches } = editPlan

  const sortedSwitches = [...switches].sort((a, b) => a.fromFrame - b.fromFrame)

  const trackItemsMap = new Map<string, Array<{
    from: number
    durationFrames: number
    trackId: string
    mediaId: string
    src: string
    sourceStart: number
    sourceEnd: number
    speed: number
    type: 'video' | 'audio'
  }>>()

  let currentTrackId = session.referenceTrackId
  let currentStartFrame = 0

  for (const sw of sortedSwitches) {
    if (currentTrackId && sw.fromFrame > currentStartFrame) {
      const track = session.tracks.find((t) => t.id === currentTrackId)
      if (track) {
        const effectiveStart = currentStartFrame - track.syncOffsetFrames
        const effectiveEnd = sw.fromFrame - track.syncOffsetFrames
        const duration = Math.max(1, effectiveEnd - effectiveStart)

        if (!trackItemsMap.has(track.id)) {
          trackItemsMap.set(track.id, [])
        }

        const sourceStart = Math.max(0, effectiveStart)

        trackItemsMap.get(track.id)!.push({
          from: currentStartFrame,
          durationFrames: duration,
          trackId: track.id,
          mediaId: track.mediaId,
          src: track.src,
          sourceStart: sourceStart,
          sourceEnd: sourceStart + duration,
          speed: 1,
          type: track.type,
        })
      }
    }

    currentTrackId = sw.toTrackId
    currentStartFrame = sw.fromFrame
  }

  if (currentTrackId && currentStartFrame < session.durationFrames) {
    const track = session.tracks.find((t) => t.id === currentTrackId)
    if (track) {
      const effectiveStart = currentStartFrame - track.syncOffsetFrames
      const effectiveEnd = session.durationFrames - track.syncOffsetFrames
      const duration = Math.max(1, effectiveEnd - effectiveStart)

      if (!trackItemsMap.has(track.id)) {
        trackItemsMap.set(track.id, [])
      }

      const sourceStart = Math.max(0, effectiveStart)

      trackItemsMap.get(track.id)!.push({
        from: currentStartFrame,
        durationFrames: duration,
        trackId: track.id,
        mediaId: track.mediaId,
        src: track.src,
        sourceStart: sourceStart,
        sourceEnd: sourceStart + duration,
        speed: 1,
        type: track.type,
      })
    }
  }

  const compositionTracks: NestedCompositionPlan['tracks'] = []
  let trackIndex = 0

  for (const [trackId, items] of trackItemsMap.entries()) {
    const track = session.tracks.find((t) => t.id === trackId)
    compositionTracks.push({
      trackId: `multicam-track-${trackIndex}`,
      trackName: track?.name || `Track ${trackIndex + 1}`,
      items: items.map((item, itemIndex) => ({
        itemId: `${trackId}-item-${itemIndex}`,
        ...item,
        trackId: `multicam-track-${trackIndex}`,
      })),
    })
    trackIndex++
  }

  return {
    compositionId: `multicam-comp-${Date.now()}`,
    compositionName: session.name,
    tracks: compositionTracks,
  }
}

export function getSyncedTrackAtFrame(
  session: MulticamSession,
  frame: number,
  switches: CameraSwitch[],
): MulticamTrack | null {
  if (!session.isSynced) {
    return null
  }

  const sortedSwitches = [...switches].sort((a, b) => a.fromFrame - b.fromFrame)

  let activeTrackId = session.referenceTrackId

  for (const sw of sortedSwitches) {
    if (frame >= sw.fromFrame) {
      activeTrackId = sw.toTrackId
    } else {
      break
    }
  }

  if (!activeTrackId) {
    return null
  }

  const track = session.tracks.find((t) => t.id === activeTrackId)
  if (!track) {
    return null
  }

  const syncedFrame = frame - track.syncOffsetFrames
  if (syncedFrame < 0 || syncedFrame >= track.durationFrames) {
    return null
  }

  return track
}
