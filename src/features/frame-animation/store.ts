import { create } from 'zustand'
import type {
  FrameAnimationItem,
  DrawingEditorState,
  DrawingEditorActions,
  DrawingLayer,
  DrawingElement,
  DrawingOnionSkinSettings,
  DrawingPlaybackMode,
  DrawingToolType,
  DrawingBlendMode,
  DrawingToolSettings,
} from './types'
import { DrawingEngine, getDefaultToolSettings } from './drawing-engine'
import { frameCache } from './frame-cache'

function createInitialLayer(name: string, order: number): DrawingLayer {
  return DrawingEngine.createLayer(name, order)
}

function createInitialFrameAnimationItem(
  width: number,
  height: number,
  fps: number = 24
): FrameAnimationItem {
  const layers: DrawingLayer[] = [
    createInitialLayer('图层 1', 0),
  ]

  return {
    type: 'frame-animation',
    id: crypto.randomUUID(),
    name: '逐帧动画',
    trackId: '',
    from: 0,
    durationInFrames: 60,
    fps,
    width,
    height,
    layers,
    activeLayerId: layers[0]?.id ?? null,
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
  }
}

type DrawingEditorStore = DrawingEditorState & DrawingEditorActions

export const useDrawingEditorStore = create<DrawingEditorStore>((set, get) => ({
  isActive: false,
  currentItemId: null,
  activeLayerId: null,
  currentFrame: 0,
  toolSettings: getDefaultToolSettings(),
  onionSkinSettings: {
    enabled: false,
    prevFrames: 2,
    nextFrames: 1,
    opacityStep: 0.3,
    colorMode: 'tint',
    prevTint: '#00ffff',
    nextTint: '#ff00ff',
  },
  isDrawing: false,
  currentPathId: null,
  currentPathPoints: [],
  playbackMode: 'loop',
  isPlaying: false,
  playbackSpeed: 1,
  selection: {
    elementIds: [],
    layerIds: [],
  },
  clipboard: {
    elements: [],
    layers: [],
  },
  history: {
    past: [],
    future: [],
  },
  zoom: 1,
  pan: {
    x: 0,
    y: 0,
  },
  showGrid: false,
  gridSize: 10,
  snapToGrid: false,

  activate: (itemId: string) => {
    set({
      isActive: true,
      currentItemId: itemId,
    })
  },

  deactivate: () => {
    set({
      isActive: false,
      currentItemId: null,
      isPlaying: false,
    })
  },

  setActiveLayer: (layerId: string) => {
    set({
      activeLayerId: layerId,
    })
  },

  setCurrentFrame: (frame: number) => {
    set({
      currentFrame: frame,
    })
  },

  setTool: (tool: DrawingToolType) => {
    set((state) => ({
      toolSettings: {
        ...state.toolSettings,
        tool,
      },
    }))
  },

  setToolColor: (color: string) => {
    set((state) => ({
      toolSettings: {
        ...state.toolSettings,
        color,
        strokeColor: color,
        textColor: color,
      },
    }))
  },

  setToolSize: (size: number) => {
    set((state) => ({
      toolSettings: {
        ...state.toolSettings,
        size,
        strokeWidth: size,
        eraserSize: size,
      },
    }))
  },

  setToolOpacity: (opacity: number) => {
    set((state) => ({
      toolSettings: {
        ...state.toolSettings,
        opacity,
        strokeOpacity: opacity,
        fillOpacity: opacity,
        textOpacity: opacity,
      },
    }))
  },

  setToolBlendMode: (mode: DrawingBlendMode) => {
    set((state) => ({
      toolSettings: {
        ...state.toolSettings,
        blendMode: mode,
      },
    }))
  },

  setToolSmoothness: (smoothness: number) => {
    set((state) => ({
      toolSettings: {
        ...state.toolSettings,
        smoothness,
      },
    }))
  },

  setOnionSkinSettings: (settings: Partial<DrawingOnionSkinSettings>) => {
    set((state) => ({
      onionSkinSettings: {
        ...state.onionSkinSettings,
        ...settings,
      },
    }))
  },

  setPlaybackMode: (mode: DrawingPlaybackMode) => {
    set({
      playbackMode: mode,
    })
  },

  startDrawing: (x: number, y: number, pressure: number) => {
    const state = get()
    const point = DrawingEngine.createPathPoint(x, y, pressure)
    set({
      isDrawing: true,
      currentPathId: crypto.randomUUID(),
      currentPathPoints: [point],
    })
  },

  continueDrawing: (x: number, y: number, pressure: number) => {
    const state = get()
    if (!state.isDrawing) return

    const point = DrawingEngine.createPathPoint(x, y, pressure)
    set((prev) => ({
      currentPathPoints: [...prev.currentPathPoints, point],
    }))
  },

  endDrawing: () => {
    const state = get()
    if (!state.isDrawing || state.currentPathPoints.length < 2) {
      set({
        isDrawing: false,
        currentPathId: null,
        currentPathPoints: [],
      })
      return
    }

    set({
      isDrawing: false,
      currentPathId: null,
      currentPathPoints: [],
    })
  },

  addElement: (layerId: string, frameIndex: number, element: DrawingElement) => {
    // Implementation will be connected to the project store
  },

  removeElement: (layerId: string, frameIndex: number, elementId: string) => {
    // Implementation will be connected to the project store
  },

  updateElement: (layerId: string, frameIndex: number, elementId: string, updates: Partial<DrawingElement>) => {
    // Implementation will be connected to the project store
  },

  selectElements: (elementIds: string[]) => {
    set((state) => ({
      selection: {
        ...state.selection,
        elementIds,
      },
    }))
  },

  selectLayers: (layerIds: string[]) => {
    set((state) => ({
      selection: {
        ...state.selection,
        layerIds,
      },
    }))
  },

  copySelection: () => {
    // Implementation will be connected to the project store
  },

  pasteSelection: (frameIndex: number) => {
    // Implementation will be connected to the project store
  },

  cutSelection: () => {
    // Implementation will be connected to the project store
  },

  deleteSelection: () => {
    // Implementation will be connected to the project store
  },

  undo: () => {
    // Implementation will be connected to the project store
  },

  redo: () => {
    // Implementation will be connected to the project store
  },

  addLayer: (name: string, position?: 'above' | 'below', relativeToLayerId?: string): string => {
    // Implementation will be connected to the project store
    return crypto.randomUUID()
  },

  removeLayer: (layerId: string) => {
    // Implementation will be connected to the project store
  },

  duplicateLayer: (layerId: string): string => {
    // Implementation will be connected to the project store
    return crypto.randomUUID()
  },

  moveLayer: (layerId: string, newOrder: number) => {
    // Implementation will be connected to the project store
  },

  setLayerVisibility: (layerId: string, visible: boolean) => {
    // Implementation will be connected to the project store
  },

  setLayerLocked: (layerId: string, locked: boolean) => {
    // Implementation will be connected to the project store
  },

  setLayerOpacity: (layerId: string, opacity: number) => {
    // Implementation will be connected to the project store
  },

  setLayerBlendMode: (layerId: string, mode: DrawingBlendMode) => {
    // Implementation will be connected to the project store
  },

  addFrame: (layerId: string, frameIndex: number) => {
    // Implementation will be connected to the project store
  },

  removeFrame: (layerId: string, frameIndex: number) => {
    // Implementation will be connected to the project store
  },

  duplicateFrame: (layerId: string, sourceFrame: number, targetFrame: number) => {
    // Implementation will be connected to the project store
  },

  moveFrame: (layerId: string, sourceFrame: number, targetFrame: number) => {
    // Implementation will be connected to the project store
  },

  startPlayback: () => {
    set({
      isPlaying: true,
    })
  },

  stopPlayback: () => {
    set({
      isPlaying: false,
    })
  },

  setPlaybackSpeed: (speed: number) => {
    set({
      playbackSpeed: speed,
    })
  },

  setZoom: (zoom: number) => {
    set({
      zoom,
    })
  },

  setPan: (x: number, y: number) => {
    set({
      pan: { x, y },
    })
  },

  setShowGrid: (show: boolean) => {
    set({
      showGrid: show,
    })
  },

  setGridSize: (size: number) => {
    set({
      gridSize: size,
    })
  },

  setSnapToGrid: (snap: boolean) => {
    set({
      snapToGrid: snap,
    })
  },
}))

export {
  createInitialFrameAnimationItem,
  createInitialLayer,
}
