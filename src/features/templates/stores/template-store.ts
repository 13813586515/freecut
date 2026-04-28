import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { FreeCutTemplate, TemplateLibraryEntry, TemplateCategory, TemplateExportResult, TemplateImportResult } from '@/types/template'
import type { TemplateStore, TemplateFormData } from '../types'
import {
  getAllTemplates,
  getTemplate,
  createTemplate as createTemplateDB,
  updateTemplate as updateTemplateDB,
  deleteTemplate as deleteTemplateDB,
  searchTemplates as searchTemplatesDB,
  getTemplatesByCategory,
  exportTemplateToJson,
  importTemplateFromJson,
} from '@/infrastructure/storage'
import { createLogger } from '@/shared/logging/logger'

const logger = createLogger('TemplateStore')

function generateTemplateId(): string {
  return `template_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
}

const DEFAULT_TEMPLATE_METADATA = {
  resolution: {
    width: 1920,
    height: 1080,
    fps: 30,
    backgroundColor: '#000000',
  },
  durationInFrames: 0,
  hasIntro: false,
  hasOutro: false,
  hasTransitions: false,
  hasEffects: false,
  hasAudio: false,
  hasText: false,
}

const DEFAULT_TEMPLATE_CONTENT = {
  timeline: {
    templateTracks: [],
    tracks: [],
    items: [],
  },
  transitions: [],
  effectPresets: [],
}

export const useTemplateStore = create<TemplateStore>()(
  devtools(
    (set, get) => ({
      templates: [],
      currentTemplate: null,
      selectedTemplateId: null,
      isLoading: false,
      error: null,
      searchQuery: '',
      filterCategory: 'all',
      sortField: 'updatedAt',
      sortDirection: 'desc',

      loadTemplates: async () => {
        set({ isLoading: true, error: null })
        try {
          const templates = await getAllTemplates()
          set({ templates, isLoading: false })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load templates'
          logger.error('loadTemplates failed', error)
          set({ error: errorMessage, isLoading: false })
        }
      },

      loadTemplate: async (templateId: string) => {
        set({ isLoading: true, error: null })
        try {
          const template = await getTemplate(templateId)
          if (!template) {
            set({ error: `Template not found: ${templateId}`, isLoading: false })
            return null
          }
          set({ currentTemplate: template, selectedTemplateId: templateId, isLoading: false })
          return template
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load template'
          logger.error(`loadTemplate(${templateId}) failed`, error)
          set({ error: errorMessage, isLoading: false })
          throw error
        }
      },

      createTemplate: async (template: FreeCutTemplate) => {
        set({ isLoading: true, error: null })
        try {
          await createTemplateDB(template)
          await get().loadTemplates()
          set({ isLoading: false })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create template'
          logger.error('createTemplate failed', error)
          set({ error: errorMessage, isLoading: false })
          throw error
        }
      },

      updateTemplate: async (templateId: string, updates: Partial<FreeCutTemplate>) => {
        set({ isLoading: true, error: null })
        try {
          await updateTemplateDB(templateId, updates)
          await get().loadTemplates()
          const { currentTemplate } = get()
          if (currentTemplate && currentTemplate.templateId === templateId) {
            const updatedTemplate = await getTemplate(templateId)
            set({ currentTemplate: updatedTemplate ?? null, isLoading: false })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update template'
          logger.error(`updateTemplate(${templateId}) failed`, error)
          set({ error: errorMessage, isLoading: false })
          throw error
        }
      },

      deleteTemplate: async (templateId: string) => {
        set({ isLoading: true, error: null })
        try {
          await deleteTemplateDB(templateId)
          const { selectedTemplateId, currentTemplate } = get()
          if (selectedTemplateId === templateId) {
            set({ selectedTemplateId: null, currentTemplate: null })
          } else if (currentTemplate && currentTemplate.templateId === templateId) {
            set({ currentTemplate: null })
          }
          await get().loadTemplates()
          set({ isLoading: false })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete template'
          logger.error(`deleteTemplate(${templateId}) failed`, error)
          set({ error: errorMessage, isLoading: false })
          throw error
        }
      },

      createTemplateFromProject: async (projectId: string, templateInfo: { name: string; description: string; category: string; tags: string[] }) => {
        set({ isLoading: true, error: null })
        try {
          const { getProject } = await import('@/infrastructure/storage')
          const project = await getProject(projectId)

          if (!project) {
            const errorMsg = `Project not found: ${projectId}`
            set({ error: errorMsg, isLoading: false })
            throw new Error(errorMsg)
          }

          const template: FreeCutTemplate = {
            version: '1.0',
            templateId: generateTemplateId(),
            name: templateInfo.name,
            description: templateInfo.description,
            author: 'Local User',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: templateInfo.tags,
            category: templateInfo.category as TemplateCategory,
            thumbnail: project.thumbnail,
            previewImage: project.thumbnail,
            metadata: {
              ...DEFAULT_TEMPLATE_METADATA,
              resolution: project.metadata,
              durationInFrames: project.duration,
              hasIntro: false,
              hasOutro: false,
              hasTransitions: !!project.timeline?.transitions && project.timeline.transitions.length > 0,
              hasEffects: false,
              hasAudio: !!project.timeline?.tracks?.some(t => t.kind === 'audio'),
              hasText: !!project.timeline?.items?.some(i => i.type === 'text'),
            },
            content: {
              ...DEFAULT_TEMPLATE_CONTENT,
              timeline: {
                ...DEFAULT_TEMPLATE_CONTENT.timeline,
                tracks: project.timeline?.tracks || [],
                items: project.timeline?.items || [],
                transitions: project.timeline?.transitions || [],
              },
              transitions: [],
            },
          }

          await createTemplateDB(template)
          await get().loadTemplates()
          set({ isLoading: false, currentTemplate: template, selectedTemplateId: template.templateId })
          return template
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create template from project'
          logger.error(`createTemplateFromProject(${projectId}) failed`, error)
          set({ error: errorMessage, isLoading: false })
          throw error
        }
      },

      createProjectFromTemplate: async (templateId: string, projectInfo: { name: string; description: string }) => {
        set({ isLoading: true, error: null })
        try {
          const template = await getTemplate(templateId)

          if (!template) {
            const errorMsg = `Template not found: ${templateId}`
            set({ error: errorMsg, isLoading: false })
            throw new Error(errorMsg)
          }

          const { createProject, createProjectObject } = await Promise.all([
            import('@/infrastructure/storage'),
            import('@/features/projects/utils/project-helpers'),
          ])

          const projectData = {
            name: projectInfo.name,
            description: projectInfo.description,
            width: template.metadata.resolution.width,
            height: template.metadata.resolution.height,
            fps: template.metadata.resolution.fps,
            backgroundColor: template.metadata.resolution.backgroundColor,
          }

          const newProject = createProjectObject.createProjectObject(projectData)

          if (template.content.timeline) {
            newProject.timeline = {
              tracks: template.content.timeline.tracks || [],
              items: template.content.timeline.items || [],
              transitions: template.content.timeline.transitions || [],
              compositions: template.content.timeline.compositions,
              keyframes: template.content.timeline.keyframes,
              markers: template.content.timeline.markers,
              inPoint: template.content.timeline.inPoint,
              outPoint: template.content.timeline.outPoint,
              masterBusDb: template.content.timeline.masterBusDb,
            }
          }

          await createProject.createProject(newProject)
          set({ isLoading: false })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create project from template'
          logger.error(`createProjectFromTemplate(${templateId}) failed`, error)
          set({ error: errorMessage, isLoading: false })
          throw error
        }
      },

      exportTemplate: async (templateId: string): Promise<TemplateExportResult> => {
        set({ isLoading: true, error: null })
        try {
          const json = await exportTemplateToJson(templateId)
          set({ isLoading: false })
          return {
            success: true,
            templateData: JSON.parse(json) as FreeCutTemplate,
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to export template'
          logger.error(`exportTemplate(${templateId}) failed`, error)
          set({ error: errorMessage, isLoading: false })
          return {
            success: false,
            errors: [errorMessage],
          }
        }
      },

      importTemplate: async (jsonString: string): Promise<TemplateImportResult> => {
        set({ isLoading: true, error: null })
        try {
          const template = await importTemplateFromJson(jsonString)
          await get().loadTemplates()
          set({ isLoading: false })
          return {
            success: true,
            templateId: template.templateId,
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to import template'
          logger.error('importTemplate failed', error)
          set({ error: errorMessage, isLoading: false })
          return {
            success: false,
            templateId: '',
            errors: [errorMessage],
          }
        }
      },

      setSearchQuery: (query) => set({ searchQuery: query }),

      setFilterCategory: (category) => set({ filterCategory: category }),

      setSortField: (field) => set({ sortField: field }),

      setSortDirection: (direction) => set({ sortDirection: direction }),

      setSelectedTemplate: (templateId) => set({ selectedTemplateId: templateId }),

      clearFilters: () =>
        set({
          searchQuery: '',
          filterCategory: 'all',
        }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'TemplateStore',
      enabled: import.meta.env.DEV,
    },
  ),
)
