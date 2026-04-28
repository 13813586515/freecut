import type { ProjectTimeline, ProjectResolution } from './project'
import type { VisualEffect } from './effects'

export interface FreeCutTemplate {
  version: string
  templateId: string
  name: string
  description: string
  author: string
  createdAt: number
  updatedAt: number
  tags: string[]
  category: string
  thumbnail?: string
  previewImage?: string
  metadata: TemplateMetadata
  content: TemplateContent
}

export interface TemplateMetadata {
  resolution: ProjectResolution
  durationInFrames: number
  hasIntro: boolean
  hasOutro: boolean
  hasTransitions: boolean
  hasEffects: boolean
  hasAudio: boolean
  hasText: boolean
}

export interface TemplateContent {
  timeline: TemplateTimeline
  transitions: TemplateTransition[]
  intro?: TemplateIntro
  outro?: TemplateOutro
  effectPresets: TemplateEffectPreset[]
}

export interface TemplateTimeline extends Omit<ProjectTimeline, 'currentFrame' | 'zoomLevel' | 'scrollPosition'> {
  templateTracks: TemplateTrack[]
}

export interface TemplateTrack {
  id: string
  name: string
  kind?: 'video' | 'audio'
  order: number
  placeholders: TemplatePlaceholder[]
}

export interface TemplatePlaceholder {
  id: string
  placeholderType: 'video' | 'audio' | 'image' | 'text'
  label: string
  description: string
  from: number
  durationInFrames: number
  defaultContent?: DefaultContent
  suggestedEffects?: string[]
}

export interface DefaultContent {
  type: 'text' | 'color'
  value: string
  style?: DefaultTextStyle
}

export interface DefaultTextStyle {
  fontSize?: number
  fontFamily?: string
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold'
  color?: string
}

export interface TemplateTransition {
  id: string
  transitionType: string
  fromItemId: string
  toItemId: string
  durationInFrames: number
  parameters?: Record<string, number | boolean | string>
}

export interface TemplateIntro {
  durationInFrames: number
  placeholderId: string
  defaultContent?: DefaultContent
}

export interface TemplateOutro {
  durationInFrames: number
  placeholderId: string
  defaultContent?: DefaultContent
}

export interface TemplateEffectPreset {
  id: string
  name: string
  description: string
  effects: VisualEffect[]
  category: string
  tags: string[]
}

export type TemplateCategory =
  | 'social'
  | 'youtube'
  | 'tiktok'
  | 'reels'
  | 'shorts'
  | 'intro'
  | 'outro'
  | 'slideshow'
  | 'product'
  | 'education'
  | 'business'
  | 'other'

export interface TemplateLibraryEntry {
  templateId: string
  name: string
  description: string
  author: string
  tags: string[]
  category: string
  createdAt: number
  updatedAt: number
  thumbnail?: string
  metadata: TemplateMetadata
  source: 'local' | 'community' | 'builtin'
}

export interface CommunityTemplate extends TemplateLibraryEntry {
  downloadCount: number
  rating: number
  version: string
  size: number
  verified: boolean
}

export interface TemplateImportResult {
  success: boolean
  templateId: string
  errors?: string[]
}

export interface TemplateExportResult {
  success: boolean
  templatePath?: string
  templateData?: FreeCutTemplate
  errors?: string[]
}
