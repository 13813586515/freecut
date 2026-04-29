import { create } from 'zustand'
import { createLogger } from '@/shared/logging/logger'
import type { SilenceDetectionResult, SilenceCutPlan } from '../utils/silence-detection'
import type { TimeRemapResult, SpeedRampPresetKey } from '../utils/time-remapping'
import type { MulticamSession, CameraSwitch, SyncResult } from '../utils/multicam-sync'

function getLog() {
  return createLogger('EfficiencyToolsStore')
}

export interface SilenceDetectionState {
  isDetecting: boolean
  currentItemId: string | null
  lastDetectionResult: SilenceDetectionResult | null
  lastCutPlan: SilenceCutPlan | null
  detectionError: string | null
  isApplyingCut: boolean
}

export interface TimeRemappingState {
  isEditing: boolean
  currentItemId: string | null
  lastRemapResult: TimeRemapResult | null
  selectedPreset: SpeedRampPresetKey | null
  remapError: string | null
}

export interface MulticamState {
  session: MulticamSession | null
  syncResult: SyncResult | null
  isSyncing: boolean
  isInMulticamMode: boolean
  activeCameraIndex: number
  switches: CameraSwitch[]
  syncError: string | null
  previewPlayheadFrame: number | null
}

interface EfficiencyToolsState {
  silenceDetection: SilenceDetectionState
  timeRemapping: TimeRemappingState
  multicam: MulticamState

  setSilenceDetecting: (itemId: string | null, isDetecting: boolean) => void
  setSilenceDetectionResult: (result: SilenceDetectionResult | null) => void
  setSilenceCutPlan: (plan: SilenceCutPlan | null) => void
  setSilenceDetectionError: (error: string | null) => void
  setApplyingCut: (isApplying: boolean) => void
  resetSilenceDetection: () => void

  setTimeRemappingEditing: (itemId: string | null, isEditing: boolean) => void
  setTimeRemapResult: (result: TimeRemapResult | null) => void
  setSelectedPreset: (preset: SpeedRampPresetKey | null) => void
  setTimeRemapError: (error: string | null) => void
  resetTimeRemapping: () => void

  setMulticamSession: (session: MulticamSession | null) => void
  setSyncing: (isSyncing: boolean) => void
  setMulticamMode: (isActive: boolean) => void
  setActiveCameraIndex: (index: number) => void
  setSwitches: (switches: CameraSwitch[]) => void
  addCameraSwitch: (switchItem: CameraSwitch) => void
  setMulticamSyncResult: (result: SyncResult | null) => void
  setMulticamSyncError: (error: string | null) => void
  setPreviewPlayheadFrame: (frame: number | null) => void
  resetMulticam: () => void
}

const initialSilenceState: SilenceDetectionState = {
  isDetecting: false,
  currentItemId: null,
  lastDetectionResult: null,
  lastCutPlan: null,
  detectionError: null,
  isApplyingCut: false,
}

const initialTimeRemapState: TimeRemappingState = {
  isEditing: false,
  currentItemId: null,
  lastRemapResult: null,
  selectedPreset: null,
  remapError: null,
}

const initialMulticamState: MulticamState = {
  session: null,
  syncResult: null,
  isSyncing: false,
  isInMulticamMode: false,
  activeCameraIndex: 0,
  switches: [],
  syncError: null,
  previewPlayheadFrame: null,
}

export const useEfficiencyToolsStore = create<EfficiencyToolsState>((set, get) => ({
  silenceDetection: initialSilenceState,
  timeRemapping: initialTimeRemapState,
  multicam: initialMulticamState,

  setSilenceDetecting: (itemId, isDetecting) =>
    set((state) => ({
      silenceDetection: {
        ...state.silenceDetection,
        currentItemId: itemId,
        isDetecting,
        detectionError: null,
      },
    })),

  setSilenceDetectionResult: (result) =>
    set((state) => ({
      silenceDetection: {
        ...state.silenceDetection,
        isDetecting: false,
        lastDetectionResult: result,
      },
    })),

  setSilenceCutPlan: (plan) =>
    set((state) => ({
      silenceDetection: {
        ...state.silenceDetection,
        lastCutPlan: plan,
      },
    })),

  setSilenceDetectionError: (error) =>
    set((state) => ({
      silenceDetection: {
        ...state.silenceDetection,
        isDetecting: false,
        detectionError: error,
      },
    })),

  setApplyingCut: (isApplying) =>
    set((state) => ({
      silenceDetection: {
        ...state.silenceDetection,
        isApplyingCut: isApplying,
      },
    })),

  resetSilenceDetection: () =>
    set({
      silenceDetection: initialSilenceState,
    }),

  setTimeRemappingEditing: (itemId, isEditing) =>
    set((state) => ({
      timeRemapping: {
        ...state.timeRemapping,
        currentItemId: itemId,
        isEditing,
        remapError: null,
      },
    })),

  setTimeRemapResult: (result) =>
    set((state) => ({
      timeRemapping: {
        ...state.timeRemapping,
        lastRemapResult: result,
      },
    })),

  setSelectedPreset: (preset) =>
    set((state) => ({
      timeRemapping: {
        ...state.timeRemapping,
        selectedPreset: preset,
      },
    })),

  setTimeRemapError: (error) =>
    set((state) => ({
      timeRemapping: {
        ...state.timeRemapping,
        remapError: error,
      },
    })),

  resetTimeRemapping: () =>
    set({
      timeRemapping: initialTimeRemapState,
    }),

  setMulticamSession: (session) =>
    set((state) => ({
      multicam: {
        ...state.multicam,
        session,
        syncError: null,
      },
    })),

  setSyncing: (isSyncing) =>
    set((state) => ({
      multicam: {
        ...state.multicam,
        isSyncing,
      },
    })),

  setMulticamMode: (isActive) =>
    set((state) => ({
      multicam: {
        ...state.multicam,
        isInMulticamMode: isActive,
        activeCameraIndex: isActive ? state.multicam.activeCameraIndex : 0,
      },
    })),

  setActiveCameraIndex: (index) =>
    set((state) => ({
      multicam: {
        ...state.multicam,
        activeCameraIndex: index,
      },
    })),

  setSwitches: (switches) =>
    set((state) => ({
      multicam: {
        ...state.multicam,
        switches,
      },
    })),

  addCameraSwitch: (switchItem) =>
    set((state) => ({
      multicam: {
        ...state.multicam,
        switches: [...state.multicam.switches, switchItem],
      },
    })),

  setMulticamSyncResult: (result) =>
    set((state) => ({
      multicam: {
        ...state.multicam,
        syncResult: result,
        isSyncing: false,
      },
    })),

  setMulticamSyncError: (error) =>
    set((state) => ({
      multicam: {
        ...state.multicam,
        syncError: error,
        isSyncing: false,
      },
    })),

  setPreviewPlayheadFrame: (frame) =>
    set((state) => ({
      multicam: {
        ...state.multicam,
        previewPlayheadFrame: frame,
      },
    })),

  resetMulticam: () =>
    set({
      multicam: initialMulticamState,
    }),
}))
