import type { FreeCutTemplate, TemplateLibraryEntry, TemplateCategory, TemplateExportResult, TemplateImportResult } from '@/types/template'

export interface TemplateState {
  templates: TemplateLibraryEntry[]
  currentTemplate: FreeCutTemplate | null
  selectedTemplateId: string | null
  isLoading: boolean
  error: string | null
  searchQuery: string
  filterCategory: TemplateCategory | 'all'
  sortField: 'name' | 'createdAt' | 'updatedAt'
  sortDirection: 'asc' | 'desc'
}

export interface TemplateActions {
  loadTemplates: () => Promise<void>
  loadTemplate: (templateId: string) => Promise<FreeCutTemplate | null>
  createTemplate: (template: FreeCutTemplate) => Promise<void>
  updateTemplate: (templateId: string, updates: Partial<FreeCutTemplate>) => Promise<void>
  deleteTemplate: (templateId: string) => Promise<void>
  createTemplateFromProject: (projectId: string, templateInfo: { name: string; description: string; category: string; tags: string[] }) => Promise<FreeCutTemplate>
  createProjectFromTemplate: (templateId: string, projectInfo: { name: string; description: string }) => Promise<void>
  exportTemplate: (templateId: string) => Promise<TemplateExportResult>
  importTemplate: (jsonString: string) => Promise<TemplateImportResult>
  setSearchQuery: (query: string) => void
  setFilterCategory: (category: TemplateCategory | 'all') => void
  setSortField: (field: TemplateState['sortField']) => void
  setSortDirection: (direction: TemplateState['sortDirection']) => void
  setSelectedTemplate: (templateId: string | null) => void
  clearFilters: () => void
  clearError: () => void
}

export type TemplateStore = TemplateState & TemplateActions

export interface TemplateFormData {
  name: string
  description: string
  author: string
  category: TemplateCategory
  tags: string[]
}
