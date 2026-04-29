import type { Keyframe, ItemKeyframes } from '@/types/keyframe'
import { getPropertyKeyframes, interpolatePropertyValue } from '@/features/keyframes/utils/interpolation'
import { MIN_SPEED, MAX_SPEED } from '@/features/timeline/utils/source-calculations'

export type TimeRemapDirection = 'forward' | 'backward' | 'hold'

export interface TimeRemapKeyframe extends Keyframe {
  direction?: TimeRemapDirection
}

export interface FrameTimeRemap {
  frame: number
  sourceTime: number
  speed: number
  direction: TimeRemapDirection
}

export interface TimeRemapResult {
  totalSourceFrames: number
  totalTimelineFrames: number
  averageSpeed: number
  frameMappings: FrameTimeRemap[]
}

export function clampSpeed(speed: number): number {
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed))
}

export function getEffectiveSpeed(
  itemKeyframes: ItemKeyframes | undefined,
  frameRelativeToItem: number,
  baseSpeed: number = 1,
): number {
  const speedKeyframes = getPropertyKeyframes(itemKeyframes, 'speed')

  if (speedKeyframes.length === 0) {
    return baseSpeed
  }

  const animatedSpeed = interpolatePropertyValue(speedKeyframes, frameRelativeToItem, baseSpeed)
  return clampSpeed(animatedSpeed)
}

export function calculateTimeRemapping(
  itemKeyframes: ItemKeyframes | undefined,
  itemDurationFrames: number,
  baseSpeed: number = 1,
  sourceStart: number = 0,
  sourceFps: number = 30,
  timelineFps: number = 30,
): TimeRemapResult {
  const frameMappings: FrameTimeRemap[] = []
  let totalSourceFrames = 0

  for (let timelineFrame = 0; timelineFrame < itemDurationFrames; timelineFrame++) {
    const speed = getEffectiveSpeed(itemKeyframes, timelineFrame, baseSpeed)

    const sourceFramesPerTimelineFrame = (speed * sourceFps) / timelineFps

    totalSourceFrames += sourceFramesPerTimelineFrame

    frameMappings.push({
      frame: timelineFrame,
      sourceTime: sourceStart + totalSourceFrames - sourceFramesPerTimelineFrame,
      speed,
      direction: speed >= 0 ? 'forward' : 'backward',
    })
  }

  const effectiveSourceFrames = totalSourceFrames
  const averageSpeed = itemDurationFrames > 0 ? effectiveSourceFrames / itemDurationFrames : baseSpeed

  return {
    totalSourceFrames: Math.round(totalSourceFrames),
    totalTimelineFrames: itemDurationFrames,
    averageSpeed,
    frameMappings,
  }
}

export function getSourceFrameAtTimelineFrame(
  timeRemap: TimeRemapResult,
  timelineFrame: number,
): number | null {
  if (timelineFrame < 0 || timelineFrame >= timeRemap.frameMappings.length) {
    return null
  }

  const mapping = timeRemap.frameMappings[timelineFrame]
  if (!mapping) return null

  return Math.round(mapping.sourceTime)
}

export interface SpeedRampPreset {
  name: string
  description: string
  keyframes: Array<{
    frame: number
    speed: number
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  }>
}

export const SPEED_RAMP_PRESETS: Record<string, SpeedRampPreset> = {
  'fade-in': {
    name: 'Speed Fade In',
    description: 'Start slow and accelerate to normal speed',
    keyframes: [
      { frame: 0, speed: 0.25, easing: 'ease-out' },
      { frame: 1, speed: 1.0, easing: 'linear' },
    ],
  },
  'fade-out': {
    name: 'Speed Fade Out',
    description: 'Slow down at the end',
    keyframes: [
      { frame: 0, speed: 1.0, easing: 'ease-in' },
      { frame: 1, speed: 0.25, easing: 'linear' },
    ],
  },
  'slow-mo': {
    name: 'Slow Motion',
    description: 'Entire clip in slow motion',
    keyframes: [
      { frame: 0, speed: 0.5, easing: 'linear' },
    ],
  },
  'fast-motion': {
    name: 'Fast Motion',
    description: 'Entire clip in fast motion',
    keyframes: [
      { frame: 0, speed: 2.0, easing: 'linear' },
    ],
  },
  'hyper-lapse': {
    name: 'Hyperlapse',
    description: 'Very fast motion for timelapse effect',
    keyframes: [
      { frame: 0, speed: 4.0, easing: 'linear' },
    ],
  },
  'freeze-frame': {
    name: 'Freeze Frame',
    description: 'Pause at a specific frame (very slow)',
    keyframes: [
      { frame: 0, speed: 1.0, easing: 'ease-out' },
      { frame: 0.5, speed: 0.01, easing: 'ease-in' },
      { frame: 1, speed: 1.0, easing: 'linear' },
    ],
  },
  'smooth-entry': {
    name: 'Smooth Entry',
    description: 'Smooth acceleration from slow to normal',
    keyframes: [
      { frame: 0, speed: 0.3, easing: 'ease-out' },
      { frame: 0.3, speed: 1.0, easing: 'linear' },
    ],
  },
  'smooth-exit': {
    name: 'Smooth Exit',
    description: 'Smooth deceleration from normal to slow',
    keyframes: [
      { frame: 0.7, speed: 1.0, easing: 'ease-in' },
      { frame: 1, speed: 0.3, easing: 'linear' },
    ],
  },
}

export function generatePresetKeyframes(
  presetName: string,
  itemDurationFrames: number,
): Array<{
  frame: number
  speed: number
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
}> | null {
  const preset = SPEED_RAMP_PRESETS[presetName]
  if (!preset) return null

  return preset.keyframes.map((kf) => ({
    frame: Math.round(kf.frame * (itemDurationFrames - 1)),
    speed: kf.speed,
    easing: kf.easing,
  }))
}

export interface FrameSpeedMapping {
  timelineFrame: number
  sourceFrame: number
  speed: number
  durationRatio: number
}

export function buildFrameSpeedMapping(
  speedKeyframes: Keyframe[],
  itemDurationFrames: number,
  baseSpeed: number,
  sourceStart: number,
  sourceFps: number,
  timelineFps: number,
): FrameSpeedMapping[] {
  const mappings: FrameSpeedMapping[] = []
  let cumulativeSourceFrames = sourceStart

  for (let timelineFrame = 0; timelineFrame < itemDurationFrames; timelineFrame++) {
    const speed = interpolatePropertyValue(speedKeyframes, timelineFrame, baseSpeed)
    const clampedSpeed = clampSpeed(speed)

    const sourceFrameDelta = (clampedSpeed * sourceFps) / timelineFps

    const currentSourceFrame = cumulativeSourceFrames

    cumulativeSourceFrames += sourceFrameDelta

    mappings.push({
      timelineFrame,
      sourceFrame: currentSourceFrame,
      speed: clampedSpeed,
      durationRatio: clampedSpeed / baseSpeed,
    })
  }

  return mappings
}

export interface ReversedClipInfo {
  originalItemId: string
  reversedSourceStart: number
  reversedSourceEnd: number
  reversedTimelineStart: number
  reversedDurationFrames: number
}

export function calculateReversedClip(
  sourceStart: number,
  sourceEnd: number,
  timelineStart: number,
  durationFrames: number,
  speed: number = 1,
): ReversedClipInfo {
  return {
    originalItemId: '',
    reversedSourceStart: sourceEnd,
    reversedSourceEnd: sourceStart,
    reversedTimelineStart: timelineStart,
    reversedDurationFrames: durationFrames,
  }
}

export interface TimeRemapValidationResult {
  valid: boolean
  issues: Array<{
    type: 'warning' | 'error'
    message: string
    frame?: number
  }>
}

export function validateTimeRemapping(
  itemKeyframes: ItemKeyframes | undefined,
  itemDurationFrames: number,
  sourceStart: number,
  sourceEnd: number,
  baseSpeed: number = 1,
  sourceFps: number = 30,
  timelineFps: number = 30,
): TimeRemapValidationResult {
  const issues: TimeRemapValidationResult['issues'] = []
  const speedKeyframes = getPropertyKeyframes(itemKeyframes, 'speed')

  if (speedKeyframes.length === 0) {
    const estimatedSourceFrames = itemDurationFrames * (baseSpeed * sourceFps) / timelineFps
    if (sourceStart + estimatedSourceFrames > sourceEnd) {
      issues.push({
        type: 'error',
        message: 'Clip duration exceeds available source content at current speed',
      })
    }
    return { valid: issues.length === 0, issues }
  }

  let cumulativeSourceFrames = sourceStart
  for (let timelineFrame = 0; timelineFrame < itemDurationFrames; timelineFrame++) {
    const speed = interpolatePropertyValue(speedKeyframes, timelineFrame, baseSpeed)
    const clampedSpeed = clampSpeed(speed)

    const sourceFrameDelta = (clampedSpeed * sourceFps) / timelineFps
    cumulativeSourceFrames += sourceFrameDelta

    if (cumulativeSourceFrames > sourceEnd) {
      issues.push({
        type: 'error',
        message: `Speed ramp would exceed source content at frame ${timelineFrame}`,
        frame: timelineFrame,
      })
      break
    }

    if (speed < MIN_SPEED || speed > MAX_SPEED) {
      issues.push({
        type: 'warning',
        message: `Speed keyframe at frame ${timelineFrame} is outside valid range (${MIN_SPEED}-${MAX_SPEED}) and will be clamped`,
        frame: timelineFrame,
      })
    }
  }

  return {
    valid: issues.every((i) => i.type !== 'error'),
    issues,
  }
}
