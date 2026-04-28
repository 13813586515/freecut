export type DrawingToolType =
  | 'pen'
  | 'pencil'
  | 'marker'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'text'
  | 'fill'

export type DrawingBlendMode =
  | 'source-over'
  | 'source-in'
  | 'source-out'
  | 'source-atop'
  | 'destination-over'
  | 'destination-in'
  | 'destination-out'
  | 'destination-atop'
  | 'lighter'
  | 'copy'
  | 'xor'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

export type DrawingPathPoint = {
  x: number
  y: number
  pressure: number
  timestamp: number
}

export type DrawingPath = {
  id: string
  points: DrawingPathPoint[]
  tool: DrawingToolType
  color: string
  size: number
  opacity: number
  blendMode: DrawingBlendMode
  smoothness: number
  startCap: 'butt' | 'round' | 'square'
  endCap: 'butt' | 'round' | 'square'
}

export type DrawingShape = {
  id: string
  type: 'line' | 'rectangle' | 'circle' | 'arrow'
  startX: number
  startY: number
  endX: number
  endY: number
  strokeColor: string
  strokeWidth: number
  strokeOpacity: number
  fillColor: string
  fillOpacity: number
  cornerRadius?: number
  arrowHeadSize?: number
}

export type DrawingText = {
  id: string
  x: number
  y: number
  text: string
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold' | 'lighter'
  fontStyle: 'normal' | 'italic'
  color: string
  opacity: number
  textAlign: 'left' | 'center' | 'right'
  baseline: 'top' | 'middle' | 'bottom' | 'alphabetic'
}

export type DrawingElement = {
  id: string
  type: 'path' | 'shape' | 'text'
  visible: boolean
  locked: boolean
  order: number
  path?: DrawingPath
  shape?: DrawingShape
  text?: DrawingText
}

export type DrawingFrame = {
  frameIndex: number
  elements: DrawingElement[]
  backgroundColor?: string
  onionSkinPrev?: number
  onionSkinNext?: number
}

export type DrawingLayer = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: DrawingBlendMode
  frames: Map<number, DrawingFrame>
  order: number
  isGroup?: boolean
  parentLayerId?: string
  collapsed?: boolean
}

export type DrawingOnionSkinSettings = {
  enabled: boolean
  prevFrames: number
  nextFrames: number
  opacityStep: number
  colorMode: 'tint' | 'grayscale' | 'custom'
  prevTint: string
  nextTint: string
}

export type DrawingPlaybackMode =
  | 'loop'
  | 'once'
  | 'ping-pong'
  | 'hold'

export type FrameAnimationItem = {
  type: 'frame-animation'
  id: string
  name: string
  trackId: string
  from: number
  durationInFrames: number
  fps: number
  width: number
  height: number
  layers: DrawingLayer[]
  activeLayerId: string | null
  currentFrame: number
  onionSkinSettings: DrawingOnionSkinSettings
  playbackMode: DrawingPlaybackMode
  backgroundColor: string
  transform?: {
    x?: number
    y?: number
    scale?: number
    rotation?: number
    opacity?: number
  }
  blendMode?: DrawingBlendMode
}

export type DrawingToolSettings = {
  tool: DrawingToolType
  color: string
  size: number
  opacity: number
  blendMode: DrawingBlendMode
  smoothness: number
  pressureSensitivity: boolean
  eraserSize: number
  eraserHardness: number
  fillColor: string
  strokeColor: string
  strokeWidth: number
  fillOpacity: number
  strokeOpacity: number
  cornerRadius: number
  arrowHeadSize: number
  textFontSize: number
  textFontFamily: string
  textFontWeight: 'normal' | 'bold' | 'lighter'
  textFontStyle: 'normal' | 'italic'
  textColor: string
  textOpacity: number
}

export type FrameCacheEntry = {
  frameIndex: number
  canvas: HTMLCanvasElement | OffscreenCanvas
  width: number
  height: number
  lastModified: number
  useCount: number
}

export type FrameCacheStats = {
  totalEntries: number
  totalSizeBytes: number
  hitCount: number
  missCount: number
}

export type DrawingEditorState = {
  isActive: boolean
  currentItemId: string | null
  activeLayerId: string | null
  currentFrame: number
  toolSettings: DrawingToolSettings
  onionSkinSettings: DrawingOnionSkinSettings
  isDrawing: boolean
  currentPathId: string | null
  currentPathPoints: DrawingPathPoint[]
  playbackMode: DrawingPlaybackMode
  isPlaying: boolean
  playbackSpeed: number
  selection: {
    elementIds: string[]
    layerIds: string[]
  }
  clipboard: {
    elements: DrawingElement[]
    layers: DrawingLayer[]
  }
  history: {
    past: Array<{
      action: string
      snapshot: FrameAnimationItem
    }>
    future: Array<{
      action: string
      snapshot: FrameAnimationItem
    }>
  }
  zoom: number
  pan: {
    x: number
    y: number
  }
  showGrid: boolean
  gridSize: number
  snapToGrid: boolean
}

export type DrawingEditorActions = {
  activate: (itemId: string) => void
  deactivate: () => void
  setActiveLayer: (layerId: string) => void
  setCurrentFrame: (frame: number) => void
  setTool: (tool: DrawingToolType) => void
  setToolColor: (color: string) => void
  setToolSize: (size: number) => void
  setToolOpacity: (opacity: number) => void
  setToolBlendMode: (mode: DrawingBlendMode) => void
  setToolSmoothness: (smoothness: number) => void
  setOnionSkinSettings: (settings: Partial<DrawingOnionSkinSettings>) => void
  setPlaybackMode: (mode: DrawingPlaybackMode) => void
  startDrawing: (x: number, y: number, pressure: number) => void
  continueDrawing: (x: number, y: number, pressure: number) => void
  endDrawing: () => void
  addElement: (layerId: string, frameIndex: number, element: DrawingElement) => void
  removeElement: (layerId: string, frameIndex: number, elementId: string) => void
  updateElement: (layerId: string, frameIndex: number, elementId: string, updates: Partial<DrawingElement>) => void
  selectElements: (elementIds: string[]) => void
  selectLayers: (layerIds: string[]) => void
  copySelection: () => void
  pasteSelection: (frameIndex: number) => void
  cutSelection: () => void
  deleteSelection: () => void
  undo: () => void
  redo: () => void
  addLayer: (name: string, position?: 'above' | 'below', relativeToLayerId?: string) => string
  removeLayer: (layerId: string) => void
  duplicateLayer: (layerId: string) => string
  moveLayer: (layerId: string, newOrder: number) => void
  setLayerVisibility: (layerId: string, visible: boolean) => void
  setLayerLocked: (layerId: string, locked: boolean) => void
  setLayerOpacity: (layerId: string, opacity: number) => void
  setLayerBlendMode: (layerId: string, mode: DrawingBlendMode) => void
  addFrame: (layerId: string, frameIndex: number) => void
  removeFrame: (layerId: string, frameIndex: number) => void
  duplicateFrame: (layerId: string, sourceFrame: number, targetFrame: number) => void
  moveFrame: (layerId: string, sourceFrame: number, targetFrame: number) => void
  startPlayback: () => void
  stopPlayback: () => void
  setPlaybackSpeed: (speed: number) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  setShowGrid: (show: boolean) => void
  setGridSize: (size: number) => void
  setSnapToGrid: (snap: boolean) => void
}
