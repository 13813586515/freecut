export type ReframeAspectRatio =
  | '9:16'
  | '1:1'
  | '4:5'
  | '16:9'
  | '3:4'
  | '4:3'
  | '16:10'
  | 'custom'

export type ReframePlatform =
  | 'tiktok'
  | 'douyin'
  | 'instagram'
  | 'instagram-story'
  | 'instagram-reel'
  | 'facebook'
  | 'youtube-shorts'
  | 'youtube'
  | 'xiaohongshu'
  | 'kuaishou'
  | 'custom'

export type ReframeStrategy =
  | 'center-crop'
  | 'fit-with-background'
  | 'smart-crop'
  | 'letterbox'
  | 'pillarbox'

export type ReframeBackgroundType =
  | 'blur'
  | 'solid-color'
  | 'gradient'
  | 'custom-image'

export interface ReframePreset {
  id: string
  name: string
  platform: ReframePlatform
  aspectRatio: ReframeAspectRatio
  width: number
  height: number
  strategy: ReframeStrategy
  backgroundType: ReframeBackgroundType
  backgroundColor: string
  backgroundBlurRadius: number
  description?: string
  icon?: string
}

export interface ReframeSettings {
  targetWidth: number
  targetHeight: number
  strategy: ReframeStrategy
  backgroundType: ReframeBackgroundType
  backgroundColor: string
  backgroundBlurRadius: number
  backgroundImage?: string
  padding?: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

export interface ReframeCropRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface ReframeResult {
  sourceRegion: ReframeCropRegion
  targetTransform: {
    scaleX: number
    scaleY: number
    translateX: number
    translateY: number
  }
  backgroundSettings: {
    type: ReframeBackgroundType
    color?: string
    blurRadius?: number
    image?: string
  }
}

export interface ReframePreviewState {
  isActive: boolean
  currentPresetId: string | null
  settings: ReframeSettings
  previewFrame: number | null
  isProcessing: boolean
}
