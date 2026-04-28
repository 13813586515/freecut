import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createLogger } from '@/shared/logging/logger'
import { ProjectForm } from '@/features/projects/components/project-form'
import { useCreateProject } from '@/features/projects/hooks/use-project-actions'
import { useProjectStore } from '@/features/projects/stores/project-store'
import { useTemplateStore } from '@/features/templates/stores/template-store'
import { TemplatePickerDialog } from '@/features/templates/components/template-picker-dialog'
import { FreeCutLogo } from '@/components/brand/freecut-logo'
import { Button } from '@/components/ui/button'
import { Github, LayoutTemplate, ArrowLeft } from 'lucide-react'
import type { ProjectFormData } from '@/features/projects/utils/validation'
import type { FreeCutTemplate } from '@/types/template'

const logger = createLogger('NewProject')

export const Route = createFileRoute('/projects/new')({
  component: NewProject,
  beforeLoad: async () => {
    try {
      const { loadProjects } = useProjectStore.getState()
      await loadProjects()
    } catch (err) {
      logger.warn('Failed to pre-load projects in beforeLoad:', err)
    }
  },
})

function NewProject() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<FreeCutTemplate | null>(null)
  const [formDefaultValues, setFormDefaultValues] = useState<Partial<ProjectFormData> | undefined>(undefined)

  const createProject = useCreateProject()
  const loadTemplates = useTemplateStore((s) => s.loadTemplates)
  const createProjectFromTemplate = useTemplateStore((s) => s.createProjectFromTemplate)

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleSelectTemplate = useCallback((template: FreeCutTemplate) => {
    setSelectedTemplate(template)
    setShowTemplatePicker(false)

    setFormDefaultValues({
      name: `Copy of ${template.name}`,
      description: template.description || '',
      width: template.metadata.resolution.width,
      height: template.metadata.resolution.height,
      fps: template.metadata.resolution.fps,
      backgroundColor: template.metadata.resolution.backgroundColor,
    })
  }, [])

  const handleBlankProject = useCallback(() => {
    setSelectedTemplate(null)
    setShowTemplatePicker(false)
    setFormDefaultValues(undefined)
  }, [])

  const handleBackToTemplates = useCallback(() => {
    setShowTemplatePicker(true)
    setSelectedTemplate(null)
    setFormDefaultValues(undefined)
  }, [])

  const handleSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true)

    try {
      let result: { success: boolean; project?: { id: string }; error?: string }

      if (selectedTemplate) {
        const templateData = {
          name: data.name,
          description: data.description || '',
        }

        await createProjectFromTemplate(selectedTemplate.templateId, templateData)

        const { projects } = useProjectStore.getState()
        const newProject = projects.find(
          (p) =>
            p.name === data.name &&
            p.metadata.width === data.width &&
            p.metadata.height === data.height,
        )

        if (newProject) {
          result = { success: true, project: { id: newProject.id } }
        } else {
          result = await createProject(data)
        }
      } else {
        result = await createProject(data)
      }

      if (result.success && result.project) {
        navigate({
          to: '/editor/$projectId',
          params: { projectId: result.project.id },
        })
      } else {
        toast.error('Failed to create project', { description: result.error })
        setIsSubmitting(false)
      }
    } catch (error) {
      logger.error('Failed to create project:', error)
      toast.error('Failed to create project', { description: 'Please try again' })
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="panel-header border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!showTemplatePicker && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={handleBackToTemplates}
                data-tooltip="Back to Templates"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <Link to="/">
              <FreeCutLogo variant="full" size="md" className="hover:opacity-80 transition-opacity" />
            </Link>
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10" asChild>
            <a
              href="https://github.com/walterlow/freecut"
              target="_blank"
              rel="noopener noreferrer"
              data-tooltip="View on GitHub"
              data-tooltip-side="left"
            >
              <Github className="w-5 h-5" />
            </a>
          </Button>
        </div>
      </div>

      {showTemplatePicker ? (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <TemplatePickerDialog
            open={showTemplatePicker}
            onOpenChange={setShowTemplatePicker}
            onSelectTemplate={handleSelectTemplate}
            onBlankProject={handleBlankProject}
          />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 py-8">
          {selectedTemplate && (
            <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-3">
                <LayoutTemplate className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Using Template: <span className="text-primary">{selectedTemplate.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplate.metadata.resolution.width}×{selectedTemplate.metadata.resolution.height} @ {selectedTemplate.metadata.resolution.fps}fps
                  </p>
                </div>
              </div>
            </div>
          )}
          <ProjectForm
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            hideHeader={true}
            defaultValues={formDefaultValues}
          />
        </div>
      )}
    </div>
  )
}
