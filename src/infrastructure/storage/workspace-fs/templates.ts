import type { FreeCutTemplate, TemplateLibraryEntry, TemplateCategory } from '@/types/template'
import { createLogger } from '@/shared/logging/logger'
import { requireWorkspaceRoot } from './root'
import { readJson, writeJsonAtomic, removeEntry, listDirectory, writeBlob } from './fs-primitives'
import {
  templateIndexPath,
  templateDir,
  templateJsonPath,
  templateThumbnailPath,
} from './paths'
import { withKeyLock } from './with-key-lock'

const logger = createLogger('WorkspaceFS:Templates')

const TEMPLATE_INDEX_LOCK_KEY = 'templates:index'

export interface TemplateIndex {
  version: string
  templates: TemplateLibraryEntry[]
}

const DEFAULT_TEMPLATE_INDEX: TemplateIndex = {
  version: '1.0',
  templates: [],
}

async function readTemplateIndex(): Promise<TemplateIndex> {
  const root = requireWorkspaceRoot()
  const index = await readJson<TemplateIndex>(root, templateIndexPath())
  return index ?? DEFAULT_TEMPLATE_INDEX
}

async function writeTemplateIndex(index: TemplateIndex): Promise<void> {
  const root = requireWorkspaceRoot()
  await writeJsonAtomic(root, templateIndexPath(), index)
}

async function rebuildTemplateIndex(): Promise<TemplateIndex> {
  const root = requireWorkspaceRoot()
  const entries = await listDirectory(root, ['templates'])
  const templates: TemplateLibraryEntry[] = []

  for (const entry of entries) {
    if (entry.kind !== 'directory') continue
    const templateId = entry.name

    try {
      const template = await readJson<FreeCutTemplate>(root, templateJsonPath(templateId))
      if (!template) continue

      const templateEntry: TemplateLibraryEntry = {
        templateId: template.templateId,
        name: template.name,
        description: template.description,
        author: template.author,
        tags: template.tags,
        category: template.category,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        thumbnail: template.thumbnail,
        metadata: template.metadata,
        source: 'local',
      }
      templates.push(templateEntry)
    } catch (error) {
      logger.warn(`Failed to read template ${templateId}`, error)
    }
  }

  return {
    version: '1.0',
    templates,
  }
}

export async function getAllTemplates(): Promise<TemplateLibraryEntry[]> {
  const root = requireWorkspaceRoot()
  try {
    let index = await readTemplateIndex()

    if (index.templates.length === 0) {
      index = await rebuildTemplateIndex()
      await writeTemplateIndex(index)
    }

    return index.templates
  } catch (error) {
    logger.error('getAllTemplates failed', error)
    return []
  }
}

export async function getTemplate(templateId: string): Promise<FreeCutTemplate | undefined> {
  const root = requireWorkspaceRoot()
  try {
    const template = await readJson<FreeCutTemplate>(root, templateJsonPath(templateId))
    return template ?? undefined
  } catch (error) {
    logger.error(`getTemplate(${templateId}) failed`, error)
    return undefined
  }
}

export async function getTemplateThumbnail(templateId: string): Promise<Blob | null> {
  const root = requireWorkspaceRoot()
  try {
    const { parent, fileName } = await getTemplateThumbnailPath(templateId)
    const fileHandle = await parent.getFileHandle(fileName, { create: false })
    return await fileHandle.getFile()
  } catch (error) {
    logger.warn(`Failed to get thumbnail for template ${templateId}`, error)
    return null
  }
}

async function getTemplateThumbnailPath(templateId: string): Promise<{
  parent: FileSystemDirectoryHandle
  fileName: string
}> {
  const root = requireWorkspaceRoot()
  const dir = await root.getDirectoryHandle('templates', { create: true })
  const templateDirHandle = await dir.getDirectoryHandle(templateId, { create: true })
  return {
    parent: templateDirHandle,
    fileName: 'thumbnail.jpg',
  }
}

export async function createTemplate(template: FreeCutTemplate): Promise<void> {
  const root = requireWorkspaceRoot()

  try {
    await withKeyLock(TEMPLATE_INDEX_LOCK_KEY, async () => {
      const existing = await readJson<FreeCutTemplate>(root, templateJsonPath(template.templateId))
      if (existing) {
        throw new Error(`Template already exists: ${template.templateId}`)
      }

      await writeJsonAtomic(root, templateJsonPath(template.templateId), template)

      const templateEntry: TemplateLibraryEntry = {
        templateId: template.templateId,
        name: template.name,
        description: template.description,
        author: template.author,
        tags: template.tags,
        category: template.category,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        thumbnail: template.thumbnail,
        metadata: template.metadata,
        source: 'local',
      }

      const index = await readTemplateIndex()
      index.templates.push(templateEntry)
      await writeTemplateIndex(index)
    })
  } catch (error) {
    logger.error('createTemplate failed', error)
    throw error
  }
}

export async function updateTemplate(
  templateId: string,
  updates: Partial<FreeCutTemplate>
): Promise<FreeCutTemplate> {
  const root = requireWorkspaceRoot()

  try {
    return await withKeyLock(TEMPLATE_INDEX_LOCK_KEY, async () => {
      const existing = await readJson<FreeCutTemplate>(root, templateJsonPath(templateId))
      if (!existing) {
        throw new Error(`Template not found: ${templateId}`)
      }

      const updated: FreeCutTemplate = {
        ...existing,
        ...updates,
        templateId,
        updatedAt: Date.now(),
      }

      await writeJsonAtomic(root, templateJsonPath(templateId), updated)

      const index = await readTemplateIndex()
      const templateIndex = index.templates.findIndex((t) => t.templateId === templateId)

      if (templateIndex !== -1) {
        index.templates[templateIndex] = {
          ...index.templates[templateIndex],
          name: updated.name,
          description: updated.description,
          author: updated.author,
          tags: updated.tags,
          category: updated.category,
          updatedAt: updated.updatedAt,
          thumbnail: updated.thumbnail,
          metadata: updated.metadata,
        }
        await writeTemplateIndex(index)
      }

      return updated
    })
  } catch (error) {
    logger.error(`updateTemplate(${templateId}) failed`, error)
    throw error
  }
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const root = requireWorkspaceRoot()

  try {
    await withKeyLock(TEMPLATE_INDEX_LOCK_KEY, async () => {
      await removeEntry(root, templateDir(templateId), { recursive: true })

      const index = await readTemplateIndex()
      index.templates = index.templates.filter((t) => t.templateId !== templateId)
      await writeTemplateIndex(index)
    })
  } catch (error) {
    logger.error(`deleteTemplate(${templateId}) failed`, error)
    throw error
  }
}

export async function saveTemplateThumbnail(
  templateId: string,
  thumbnailBlob: Blob
): Promise<void> {
  const root = requireWorkspaceRoot()

  try {
    await writeBlob(root, templateThumbnailPath(templateId), thumbnailBlob)
  } catch (error) {
    logger.error(`saveTemplateThumbnail(${templateId}) failed`, error)
    throw error
  }
}

export async function getTemplatesByCategory(
  category: TemplateCategory
): Promise<TemplateLibraryEntry[]> {
  const templates = await getAllTemplates()
  return templates.filter((t) => t.category === category)
}

export async function searchTemplates(query: string): Promise<TemplateLibraryEntry[]> {
  const templates = await getAllTemplates()
  const lowerQuery = query.toLowerCase()

  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  )
}

export async function exportTemplateToJson(templateId: string): Promise<string> {
  const template = await getTemplate(templateId)
  if (!template) {
    throw new Error(`Template not found: ${templateId}`)
  }

  return JSON.stringify(template, null, 2)
}

export async function importTemplateFromJson(jsonString: string): Promise<FreeCutTemplate> {
  let template: FreeCutTemplate
  try {
    template = JSON.parse(jsonString) as FreeCutTemplate
  } catch (error) {
    throw new Error('Invalid JSON format')
  }

  if (!template.templateId || !template.name) {
    throw new Error('Invalid template: missing required fields')
  }

  await createTemplate(template)
  return template
}
