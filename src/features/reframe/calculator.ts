import type {
  ReframeSettings,
  ReframeResult,
  ReframeCropRegion,
  ReframeStrategy,
} from './types'

export interface ReframeSourceDimensions {
  width: number
  height: number
}

export function getAspectRatio(width: number, height: number): number {
  return width / height
}

export function parseAspectRatioString(aspectRatio: string): { width: number; height: number } {
  const [w, h] = aspectRatio.split(':').map(Number)
  return { width: w || 16, height: h || 9 }
}

export function calculateTargetDimensions(
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: number,
  maxWidth: number = 1920,
  maxHeight: number = 1920
): { width: number; height: number } {
  let targetWidth: number
  let targetHeight: number

  if (targetAspectRatio >= 1) {
    targetWidth = Math.min(maxWidth, sourceWidth)
    targetHeight = Math.round(targetWidth / targetAspectRatio)
  } else {
    targetHeight = Math.min(maxHeight, sourceHeight)
    targetWidth = Math.round(targetHeight * targetAspectRatio)
  }

  if (targetWidth > maxWidth) {
    targetWidth = maxWidth
    targetHeight = Math.round(targetWidth / targetAspectRatio)
  }
  if (targetHeight > maxHeight) {
    targetHeight = maxHeight
    targetWidth = Math.round(targetHeight * targetAspectRatio)
  }

  return { width: targetWidth, height: targetHeight }
}

export function calculateCenterCropRegion(
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: number
): ReframeCropRegion {
  const sourceAspectRatio = getAspectRatio(sourceWidth, sourceHeight)
  let cropWidth: number
  let cropHeight: number

  if (sourceAspectRatio > targetAspectRatio) {
    cropHeight = sourceHeight
    cropWidth = Math.round(sourceHeight * targetAspectRatio)
  } else {
    cropWidth = sourceWidth
    cropHeight = Math.round(sourceWidth / targetAspectRatio)
  }

  return {
    x: Math.round((sourceWidth - cropWidth) / 2),
    y: Math.round((sourceHeight - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  }
}

export function calculateFitRegion(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): { scale: number; offsetX: number; offsetY: number } {
  const sourceAspectRatio = getAspectRatio(sourceWidth, sourceHeight)
  const targetAspectRatio = getAspectRatio(targetWidth, targetHeight)

  let scale: number
  if (sourceAspectRatio > targetAspectRatio) {
    scale = targetWidth / sourceWidth
  } else {
    scale = targetHeight / sourceHeight
  }

  const scaledWidth = sourceWidth * scale
  const scaledHeight = sourceHeight * scale

  const offsetX = (targetWidth - scaledWidth) / 2
  const offsetY = (targetHeight - scaledHeight) / 2

  return { scale, offsetX, offsetY }
}

export function calculateLetterboxRegion(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): { scale: number; offsetX: number; offsetY: number; sourceRegion: ReframeCropRegion } {
  const fit = calculateFitRegion(sourceWidth, sourceHeight, targetWidth, targetHeight)
  return {
    ...fit,
    sourceRegion: {
      x: 0,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
    },
  }
}

export function calculatePillarboxRegion(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): { scale: number; offsetX: number; offsetY: number; sourceRegion: ReframeCropRegion } {
  return calculateLetterboxRegion(sourceWidth, sourceHeight, targetWidth, targetHeight)
}

export function calculateSmartCropRegion(
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: number,
  focusPoints?: Array<{ x: number; y: number; weight: number }>
): ReframeCropRegion {
  let centerX = sourceWidth / 2
  let centerY = sourceHeight / 2

  if (focusPoints && focusPoints.length > 0) {
    let totalWeight = 0
    let weightedX = 0
    let weightedY = 0

    for (const point of focusPoints) {
      totalWeight += point.weight
      weightedX += point.x * point.weight
      weightedY += point.y * point.weight
    }

    if (totalWeight > 0) {
      centerX = weightedX / totalWeight
      centerY = weightedY / totalWeight
    }
  }

  const sourceAspectRatio = getAspectRatio(sourceWidth, sourceHeight)
  let cropWidth: number
  let cropHeight: number

  if (sourceAspectRatio > targetAspectRatio) {
    cropHeight = sourceHeight
    cropWidth = Math.round(sourceHeight * targetAspectRatio)
  } else {
    cropWidth = sourceWidth
    cropHeight = Math.round(sourceWidth / targetAspectRatio)
  }

  let cropX = centerX - cropWidth / 2
  let cropY = centerY - cropHeight / 2

  cropX = Math.max(0, Math.min(sourceWidth - cropWidth, cropX))
  cropY = Math.max(0, Math.min(sourceHeight - cropHeight, cropY))

  return {
    x: Math.round(cropX),
    y: Math.round(cropY),
    width: cropWidth,
    height: cropHeight,
  }
}

export function calculateReframe(
  source: ReframeSourceDimensions,
  settings: ReframeSettings,
  focusPoints?: Array<{ x: number; y: number; weight: number }>
): ReframeResult {
  const targetAspectRatio = getAspectRatio(settings.targetWidth, settings.targetHeight)
  const sourceAspectRatio = getAspectRatio(source.width, source.height)

  let sourceRegion: ReframeCropRegion
  let targetTransform: { scaleX: number; scaleY: number; translateX: number; translateY: number }

  switch (settings.strategy) {
    case 'center-crop':
      sourceRegion = calculateCenterCropRegion(source.width, source.height, targetAspectRatio)
      targetTransform = {
        scaleX: settings.targetWidth / sourceRegion.width,
        scaleY: settings.targetHeight / sourceRegion.height,
        translateX: -sourceRegion.x,
        translateY: -sourceRegion.y,
      }
      break

    case 'smart-crop':
      sourceRegion = calculateSmartCropRegion(
        source.width,
        source.height,
        targetAspectRatio,
        focusPoints
      )
      targetTransform = {
        scaleX: settings.targetWidth / sourceRegion.width,
        scaleY: settings.targetHeight / sourceRegion.height,
        translateX: -sourceRegion.x,
        translateY: -sourceRegion.y,
      }
      break

    case 'fit-with-background':
    case 'letterbox':
    case 'pillarbox': {
      const fit = calculateFitRegion(
        source.width,
        source.height,
        settings.targetWidth,
        settings.targetHeight
      )
      sourceRegion = {
        x: 0,
        y: 0,
        width: source.width,
        height: source.height,
      }
      targetTransform = {
        scaleX: fit.scale,
        scaleY: fit.scale,
        translateX: fit.offsetX / fit.scale,
        translateY: fit.offsetY / fit.scale,
      }
      break
    }

    default:
      sourceRegion = calculateCenterCropRegion(source.width, source.height, targetAspectRatio)
      targetTransform = {
        scaleX: settings.targetWidth / sourceRegion.width,
        scaleY: settings.targetHeight / sourceRegion.height,
        translateX: -sourceRegion.x,
        translateY: -sourceRegion.y,
      }
  }

  return {
    sourceRegion,
    targetTransform,
    backgroundSettings: {
      type: settings.backgroundType,
      color: settings.backgroundColor,
      blurRadius: settings.backgroundBlurRadius,
      image: settings.backgroundImage,
    },
  }
}

export function needsReframe(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  tolerance: number = 0.01
): boolean {
  const sourceRatio = getAspectRatio(sourceWidth, sourceHeight)
  const targetRatio = getAspectRatio(targetWidth, targetHeight)
  return Math.abs(sourceRatio - targetRatio) > tolerance
}

export function getReframeStrategyLabel(strategy: ReframeStrategy): string {
  const labels: Record<ReframeStrategy, string> = {
    'center-crop': '中心裁剪',
    'fit-with-background': '适应+背景',
    'smart-crop': '智能裁剪',
    letterbox: '黑边填充（上下）',
    pillarbox: '黑边填充（左右）',
  }
  return labels[strategy] || strategy
}

export function validateReframeSettings(settings: ReframeSettings): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (settings.targetWidth <= 0 || !Number.isFinite(settings.targetWidth)) {
    errors.push('目标宽度必须是有效的正数')
  }
  if (settings.targetHeight <= 0 || !Number.isFinite(settings.targetHeight)) {
    errors.push('目标高度必须是有效的正数')
  }
  if (settings.backgroundBlurRadius < 0 || !Number.isFinite(settings.backgroundBlurRadius)) {
    errors.push('背景模糊半径必须是非负数')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
