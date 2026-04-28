import { create } from 'zustand'
import { createLogger } from '@/shared/logging/logger'
import type {
  ReframeSettings,
  ReframeResult,
  ReframePreviewState,
  ReframePreset,
} from './types'
import {
  DEFAULT_REFRAME_SETTINGS,
  createSettingsFromPreset,
  getPresetById,
} from './presets'
import type { ReframeSourceDimensions } from './calculator'
import { calculateReframe, validateReframeSettings } from './calculator'

const log = createLogger('ReframeStore')

interface ReframeState {
  isActive: boolean
  currentPresetId: string | null
  settings: ReframeSettings
  sourceDimensions: ReframeSourceDimensions | null
  lastResult: ReframeResult | null
  isProcessing: boolean
  previewFrame: number | null

  activate: () => void
  deactivate: () => void
  toggle: () => void

  setPreset: (presetId: string) => void
  clearPreset: () => void

  setSettings: (settings: Partial<ReframeSettings>) => void
  resetSettings: () => void

  setSourceDimensions: (dimensions: ReframeSourceDimensions) => void
  clearSourceDimensions: () => void

  calculate: () => ReframeResult | null
  setPreviewFrame: (frame: number | null) => void
  setProcessing: (processing: boolean) => void
}

export const useReframeStore = create<ReframeState>()((set, get) => ({
  isActive: false,
  currentPresetId: null,
  settings: { ...DEFAULT_REFRAME_SETTINGS },
  sourceDimensions: null,
  lastResult: null,
  isProcessing: false,
  previewFrame: null,

  activate: () => {
    log.debug('Reframe activated')
    set({ isActive: true })
  },

  deactivate: () => {
    log.debug('Reframe deactivated')
    set({ isActive: false, previewFrame: null })
  },

  toggle: () => {
    const { isActive } = get()
    if (isActive) {
      get().deactivate()
    } else {
      get().activate()
    }
  },

  setPreset: (presetId: string) => {
    const preset = getPresetById(presetId)
    if (preset) {
      log.debug('Setting reframe preset', { presetId, presetName: preset.name })
      const settings = createSettingsFromPreset(preset)
      set({
        currentPresetId: presetId,
        settings,
        lastResult: null,
      })
      get().calculate()
    } else {
      log.warn('Preset not found', { presetId })
    }
  },

  clearPreset: () => {
    log.debug('Clearing reframe preset')
    set({ currentPresetId: null })
  },

  setSettings: (updates: Partial<ReframeSettings>) => {
    const { settings } = get()
    const newSettings = { ...settings, ...updates }
    const validation = validateReframeSettings(newSettings)

    if (validation.valid) {
      log.debug('Updating reframe settings', { updates })
      set({
        settings: newSettings,
        lastResult: null,
        currentPresetId: null,
      })
      get().calculate()
    } else {
      log.warn('Invalid reframe settings', { errors: validation.errors })
    }
  },

  resetSettings: () => {
    log.debug('Resetting reframe settings to default')
    set({
      settings: { ...DEFAULT_REFRAME_SETTINGS },
      currentPresetId: null,
      lastResult: null,
    })
  },

  setSourceDimensions: (dimensions: ReframeSourceDimensions) => {
    log.debug('Setting source dimensions', { dimensions })
    set({
      sourceDimensions: dimensions,
      lastResult: null,
    })
    if (get().isActive) {
      get().calculate()
    }
  },

  clearSourceDimensions: () => {
    log.debug('Clearing source dimensions')
    set({
      sourceDimensions: null,
      lastResult: null,
    })
  },

  calculate: (): ReframeResult | null => {
    const { sourceDimensions, settings } = get()

    if (!sourceDimensions) {
      log.warn('Cannot calculate reframe: source dimensions not set')
      return null
    }

    const result = calculateReframe(sourceDimensions, settings)
    log.debug('Reframe calculation complete', {
      sourceRegion: result.sourceRegion,
      targetTransform: result.targetTransform,
    })

    set({ lastResult: result })
    return result
  },

  setPreviewFrame: (frame: number | null) => {
    set({ previewFrame: frame })
  },

  setProcessing: (processing: boolean) => {
    set({ isProcessing: processing })
  },
}))

export function getReframePreviewState(): ReframePreviewState {
  const state = useReframeStore.getState()
  return {
    isActive: state.isActive,
    currentPresetId: state.currentPresetId,
    settings: state.settings,
    previewFrame: state.previewFrame,
    isProcessing: state.isProcessing,
  }
}
