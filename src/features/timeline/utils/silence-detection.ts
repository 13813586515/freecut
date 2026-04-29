import type { CachedWaveform } from '../services/waveform-cache'
import { getMonoPeaks } from '../services/waveform-cache'

export interface SilenceSegment {
  id: string
  startFrame: number
  endFrame: number
  startSeconds: number
  endSeconds: number
  durationFrames: number
  durationSeconds: number
  averageVolume: number
  maxVolume: number
}

export interface VoiceSegment {
  id: string
  startFrame: number
  endFrame: number
  startSeconds: number
  endSeconds: number
  durationFrames: number
  durationSeconds: number
}

export interface SilenceDetectionResult {
  silenceSegments: SilenceSegment[]
  voiceSegments: VoiceSegment[]
  totalSilenceDurationSeconds: number
  totalVoiceDurationSeconds: number
  totalDurationSeconds: number
  silenceRatio: number
}

export interface SilenceDetectionOptions {
  thresholdDb?: number
  minSilenceDurationSeconds?: number
  minVoiceDurationSeconds?: number
  mergeGapSeconds?: number
}

const DEFAULT_OPTIONS: Required<SilenceDetectionOptions> = {
  thresholdDb: -40,
  minSilenceDurationSeconds: 0.3,
  minVoiceDurationSeconds: 0.1,
  mergeGapSeconds: 0.1,
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity
  return 20 * Math.log10(linear)
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

export function detectSilence(
  waveform: CachedWaveform,
  options: SilenceDetectionOptions = {},
): SilenceDetectionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const thresholdLinear = dbToLinear(opts.thresholdDb)

  const peaks = getMonoPeaks(waveform)
  const sampleRate = waveform.sampleRate
  const durationSeconds = waveform.duration

  const maxPeak = waveform.maxPeak > 0 ? waveform.maxPeak : 1

  const samples = peaks.length
  const rawSilenceSegments: { startSample: number; endSample: number; totalVolume: number; sampleCount: number; maxVolume: number }[] = []
  const rawVoiceSegments: { startSample: number; endSample: number }[] = []

  let inSilence = false
  let currentStartSample = 0
  let currentTotalVolume = 0
  let currentMaxVolume = 0
  let currentSampleCount = 0

  for (let i = 0; i < samples; i++) {
    const normalizedPeak = peaks[i]! / maxPeak
    const isSilent = normalizedPeak < thresholdLinear

    if (isSilent) {
      if (!inSilence) {
        if (currentStartSample < i) {
          rawVoiceSegments.push({
            startSample: currentStartSample,
            endSample: i,
          })
        }
        inSilence = true
        currentStartSample = i
        currentTotalVolume = normalizedPeak
        currentMaxVolume = normalizedPeak
        currentSampleCount = 1
      } else {
        currentTotalVolume += normalizedPeak
        currentMaxVolume = Math.max(currentMaxVolume, normalizedPeak)
        currentSampleCount++
      }
    } else {
      if (inSilence) {
        rawSilenceSegments.push({
          startSample: currentStartSample,
          endSample: i,
          totalVolume: currentTotalVolume,
          maxVolume: currentMaxVolume,
          sampleCount: currentSampleCount,
        })
        inSilence = false
        currentStartSample = i
      }
    }
  }

  if (inSilence) {
    rawSilenceSegments.push({
      startSample: currentStartSample,
      endSample: samples,
      totalVolume: currentTotalVolume,
      maxVolume: currentMaxVolume,
      sampleCount: currentSampleCount,
    })
  } else if (currentStartSample < samples) {
    rawVoiceSegments.push({
      startSample: currentStartSample,
      endSample: samples,
    })
  }

  const minSilenceSamples = Math.ceil(opts.minSilenceDurationSeconds * sampleRate)
  const minVoiceSamples = Math.ceil(opts.minVoiceDurationSeconds * sampleRate)
  const mergeGapSamples = Math.ceil(opts.mergeGapSeconds * sampleRate)

  const filteredSilenceSegments = rawSilenceSegments.filter(
    (s) => s.endSample - s.startSample >= minSilenceSamples,
  )

  const filteredVoiceSegments = rawVoiceSegments.filter(
    (s) => s.endSample - s.startSample >= minVoiceSamples,
  )

  const mergedVoiceSegments: { startSample: number; endSample: number }[] = []
  for (const seg of filteredVoiceSegments) {
    if (mergedVoiceSegments.length === 0) {
      mergedVoiceSegments.push({ ...seg })
    } else {
      const last = mergedVoiceSegments[mergedVoiceSegments.length - 1]!
      if (seg.startSample - last.endSample <= mergeGapSamples) {
        mergedVoiceSegments[mergedVoiceSegments.length - 1] = {
          startSample: last.startSample,
          endSample: seg.endSample,
        }
      } else {
        mergedVoiceSegments.push({ ...seg })
      }
    }
  }

  const finalSilenceSegments: SilenceSegment[] = []
  const finalVoiceSegments: VoiceSegment[] = []

  for (const seg of filteredSilenceSegments) {
    const startSample = seg.startSample
    const endSample = seg.endSample
    const startSeconds = startSample / sampleRate
    const endSeconds = endSample / sampleRate
    const durationSamples = endSample - startSample
    const durationSeconds = endSeconds - startSeconds

    finalSilenceSegments.push({
      id: generateId(),
      startFrame: Math.round(startSeconds * 30),
      endFrame: Math.round(endSeconds * 30),
      startSeconds,
      endSeconds,
      durationFrames: Math.round(durationSeconds * 30),
      durationSeconds,
      averageVolume: seg.sampleCount > 0 ? linearToDb(seg.totalVolume / seg.sampleCount) : -Infinity,
      maxVolume: linearToDb(seg.maxVolume),
    })
  }

  let totalVoiceSeconds = 0
  for (const seg of mergedVoiceSegments) {
    const startSample = seg.startSample
    const endSample = seg.endSample
    const startSeconds = startSample / sampleRate
    const endSeconds = endSample / sampleRate
    const durationSamples = endSample - startSample
    const durationSeconds = endSeconds - startSeconds

    finalVoiceSegments.push({
      id: generateId(),
      startFrame: Math.round(startSeconds * 30),
      endFrame: Math.round(endSeconds * 30),
      startSeconds,
      endSeconds,
      durationFrames: Math.round(durationSeconds * 30),
      durationSeconds,
    })
    totalVoiceSeconds += durationSeconds
  }

  const totalSilenceSeconds = finalSilenceSegments.reduce((acc, s) => acc + s.durationSeconds, 0)

  return {
    silenceSegments: finalSilenceSegments,
    voiceSegments: finalVoiceSegments,
    totalSilenceDurationSeconds: totalSilenceSeconds,
    totalVoiceDurationSeconds: totalVoiceSeconds,
    totalDurationSeconds: durationSeconds,
    silenceRatio: durationSeconds > 0 ? totalSilenceSeconds / durationSeconds : 0,
  }
}

export interface SilenceCutPlan {
  originalItemId: string
  originalMediaId?: string
  originalSrc?: string
  operations: Array<{
    type: 'keep' | 'remove'
    startFrame: number
    endFrame: number
    durationFrames: number
  }>
  totalFramesToRemove: number
  totalFramesToKeep: number
  newDurationFrames: number
}

export function generateSilenceCutPlan(
  detectionResult: SilenceDetectionResult,
  itemId: string,
  itemStartFrame: number,
  itemDurationFrames: number,
  mediaId?: string,
  src?: string,
): SilenceCutPlan {
  const operations: SilenceCutPlan['operations'] = []
  let currentPosition = 0

  const maxFrame = itemDurationFrames

  const allSegments = [
    ...detectionResult.silenceSegments.map((s) => ({
      type: 'silence' as const,
      ...s,
    })),
    ...detectionResult.voiceSegments.map((s) => ({
      type: 'voice' as const,
      ...s,
    })),
  ].sort((a, b) => a.startFrame - b.startFrame)

  for (const seg of allSegments) {
    if (seg.startFrame > currentPosition) {
      operations.push({
        type: 'keep',
        startFrame: currentPosition,
        endFrame: Math.min(seg.startFrame, maxFrame),
        durationFrames: Math.min(seg.startFrame, maxFrame) - currentPosition,
      })
    }

    const opType = seg.type === 'silence' ? 'remove' : 'keep'
    const effectiveEnd = Math.min(seg.endFrame, maxFrame)
    if (seg.startFrame < maxFrame) {
      operations.push({
        type: opType,
        startFrame: Math.max(seg.startFrame, currentPosition),
        endFrame: effectiveEnd,
        durationFrames: effectiveEnd - Math.max(seg.startFrame, currentPosition),
      })
    }

    currentPosition = Math.max(currentPosition, seg.endFrame)
  }

  if (currentPosition < maxFrame) {
    operations.push({
      type: 'keep',
      startFrame: currentPosition,
      endFrame: maxFrame,
      durationFrames: maxFrame - currentPosition,
    })
  }

  const totalFramesToRemove = operations
    .filter((op) => op.type === 'remove')
    .reduce((acc, op) => acc + op.durationFrames, 0)

  const totalFramesToKeep = operations
    .filter((op) => op.type === 'keep')
    .reduce((acc, op) => acc + op.durationFrames, 0)

  return {
    originalItemId: itemId,
    originalMediaId: mediaId,
    originalSrc: src,
    operations,
    totalFramesToRemove,
    totalFramesToKeep,
    newDurationFrames: totalFramesToKeep,
  }
}
