export type {
  ReframeAspectRatio,
  ReframePlatform,
  ReframeStrategy,
  ReframeBackgroundType,
  ReframePreset,
  ReframeSettings,
  ReframeCropRegion,
  ReframeResult,
  ReframePreviewState,
} from './types'

export {
  REFRAME_PRESETS,
  getPresetById,
  getPresetsByPlatform,
  getPresetsByAspectRatio,
  createSettingsFromPreset,
  DEFAULT_REFRAME_SETTINGS,
} from './presets'

export {
  getAspectRatio,
  parseAspectRatioString,
  calculateTargetDimensions,
  calculateCenterCropRegion,
  calculateFitRegion,
  calculateLetterboxRegion,
  calculatePillarboxRegion,
  calculateSmartCropRegion,
  calculateReframe,
  needsReframe,
  getReframeStrategyLabel,
  validateReframeSettings,
  type ReframeSourceDimensions,
} from './calculator'

export { useReframeStore, getReframePreviewState } from './store'

export { ReframePanel } from './components/reframe-panel'
