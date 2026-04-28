import type { VisualEffect } from '@/types/effects'
import type { AdjustmentItem, ShapeItem, ShapeType, TextItem, FrameAnimationItem } from '@/types/timeline'
import {
  TEXT_STYLE_PRESETS,
  buildTextStylePresetTemplate,
  type TextStylePresetId,
} from '@/shared/typography/text-style-presets'
import {
  createInitialLayer,
  DrawingEngine,
} from '@/features/frame-animation'

export const DEFAULT_GENERATED_LAYER_DURATION_SECONDS = 60

export interface TimelineTemplateDragData {
  type: 'timeline-template'
  itemType: 'text' | 'shape' | 'adjustment' | 'frame-animation'
  label: string
  textStylePresetId?: TextStylePresetId
  shapeType?: ShapeType
  effects?: VisualEffect[]
}

interface LayerPlacement {
  trackId: string
  from: number
  durationInFrames: number
}

interface VisualLayerPlacement extends LayerPlacement {
  canvasWidth: number
  canvasHeight: number
  fps?: number
}

export function isTimelineTemplateDragData(value: unknown): value is TimelineTemplateDragData {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<TimelineTemplateDragData>
  if (candidate.type !== 'timeline-template') return false
  if (
    candidate.itemType !== 'text' &&
    candidate.itemType !== 'shape' &&
    candidate.itemType !== 'adjustment' &&
    candidate.itemType !== 'frame-animation'
  )
    return false
  if (typeof candidate.label !== 'string' || candidate.label.trim().length === 0) return false
  if (
    candidate.textStylePresetId !== undefined &&
    !TEXT_STYLE_PRESETS.some((preset) => preset.id === candidate.textStylePresetId)
  ) {
    return false
  }
  if (candidate.effects !== undefined && !Array.isArray(candidate.effects)) return false

  if (candidate.itemType === 'frame-animation') {
    return true
  }

  return (
    candidate.itemType !== 'shape' ||
    candidate.shapeType === 'rectangle' ||
    candidate.shapeType === 'circle' ||
    candidate.shapeType === 'triangle' ||
    candidate.shapeType === 'ellipse' ||
    candidate.shapeType === 'star' ||
    candidate.shapeType === 'polygon' ||
    candidate.shapeType === 'heart' ||
    candidate.shapeType === 'path'
  )
}

export function getDefaultGeneratedLayerDurationInFrames(fps: number): number {
  return Math.max(1, Math.round(fps * DEFAULT_GENERATED_LAYER_DURATION_SECONDS))
}

export function getTemplateEffectsForDirectApplication(template: unknown): VisualEffect[] | null {
  if (!isTimelineTemplateDragData(template)) {
    return null
  }

  if (
    template.itemType !== 'adjustment' ||
    !Array.isArray(template.effects) ||
    template.effects.length === 0
  ) {
    return null
  }

  return template.effects
}

export function createDefaultTextItem(params: VisualLayerPlacement): TextItem {
  const { trackId, from, durationInFrames, canvasWidth, canvasHeight } = params

  return {
    id: crypto.randomUUID(),
    type: 'text',
    trackId,
    from,
    durationInFrames,
    label: 'Text',
    text: 'Your Text Here',
    fontSize: 60,
    fontFamily: 'Inter',
    fontWeight: 'normal',
    fontStyle: 'normal',
    underline: false,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: 0,
    transform: {
      x: 0,
      y: 0,
      width: canvasWidth * 0.8,
      height: canvasHeight * 0.3,
      rotation: 0,
      opacity: 1,
    },
  }
}

export function createTextTemplateItem(params: {
  placement: VisualLayerPlacement
  label?: string
  textStylePresetId?: TextStylePresetId
}): TextItem {
  const { placement, label, textStylePresetId } = params
  const baseTextItem = createDefaultTextItem(placement)

  if (!textStylePresetId) {
    return {
      ...baseTextItem,
      label: label ?? baseTextItem.label,
    }
  }

  return {
    ...baseTextItem,
    ...buildTextStylePresetTemplate(textStylePresetId, {
      width: placement.canvasWidth,
      height: placement.canvasHeight,
      fps: placement.fps ?? 30,
    }),
    label:
      label ??
      TEXT_STYLE_PRESETS.find((preset) => preset.id === textStylePresetId)?.label ??
      baseTextItem.label,
  }
}

export function createDefaultShapeItem(
  params: VisualLayerPlacement & { shapeType: ShapeType },
): ShapeItem {
  const { trackId, from, durationInFrames, canvasWidth, canvasHeight, shapeType } = params
  const shapeSize = Math.min(canvasWidth, canvasHeight) * 0.25

  return {
    id: crypto.randomUUID(),
    type: 'shape',
    trackId,
    from,
    durationInFrames,
    label: shapeType.charAt(0).toUpperCase() + shapeType.slice(1),
    shapeType,
    fillColor: '#3b82f6',
    strokeColor: undefined,
    strokeWidth: 0,
    cornerRadius: shapeType === 'rectangle' ? 0 : undefined,
    direction: shapeType === 'triangle' ? 'up' : undefined,
    points: shapeType === 'star' ? 5 : shapeType === 'polygon' ? 6 : undefined,
    innerRadius: shapeType === 'star' ? 0.5 : undefined,
    transform: {
      x: 0,
      y: 0,
      width: shapeSize,
      height: shapeSize,
      rotation: 0,
      opacity: 1,
      aspectRatioLocked: true,
    },
  }
}

export function createDefaultAdjustmentItem(
  params: LayerPlacement & {
    effects?: VisualEffect[]
    label?: string
  },
): AdjustmentItem {
  const { trackId, from, durationInFrames, effects, label } = params

  return {
    id: crypto.randomUUID(),
    type: 'adjustment',
    trackId,
    from,
    durationInFrames,
    label: label ?? 'Adjustment Layer',
    effects:
      effects?.map((effect) => ({
        id: crypto.randomUUID(),
        effect,
        enabled: true,
      })) ?? [],
    effectOpacity: 1,
  }
}

export function createDefaultFrameAnimationItem(
  params: VisualLayerPlacement & {
    label?: string
  },
): FrameAnimationItem {
  const { trackId, from, durationInFrames, canvasWidth, canvasHeight, fps = 24, label } = params

  const initialLayer = createInitialLayer('图层 1', 0)

  return {
    id: crypto.randomUUID(),
    type: 'frame-animation',
    trackId,
    from,
    durationInFrames,
    label: label ?? '逐帧动画',
    fps,
    width: canvasWidth,
    height: canvasHeight,
    layers: [initialLayer],
    activeLayerId: initialLayer.id,
    currentFrame: 0,
    onionSkinSettings: {
      enabled: false,
      prevFrames: 2,
      nextFrames: 1,
      opacityStep: 0.3,
      colorMode: 'tint',
      prevTint: '#00ffff',
      nextTint: '#ff00ff',
    },
    playbackMode: 'loop',
    backgroundColor: 'transparent',
    transform: {
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      rotation: 0,
      opacity: 1,
    },
  }
}

export function createTimelineTemplateItem(params: {
  template: TimelineTemplateDragData
  placement: VisualLayerPlacement
}): TextItem | ShapeItem | AdjustmentItem | FrameAnimationItem {
  const { template, placement } = params

  if (template.itemType === 'text') {
    return createTextTemplateItem({
      placement,
      label: template.label,
      textStylePresetId: template.textStylePresetId,
    })
  }

  if (template.itemType === 'adjustment') {
    return createDefaultAdjustmentItem({
      trackId: placement.trackId,
      from: placement.from,
      durationInFrames: placement.durationInFrames,
      label: template.label,
      effects: template.effects,
    })
  }

  if (template.itemType === 'frame-animation') {
    return createDefaultFrameAnimationItem({
      ...placement,
      label: template.label,
    })
  }

  return createDefaultShapeItem({
    ...placement,
    shapeType: template.shapeType ?? 'rectangle',
  })
}
