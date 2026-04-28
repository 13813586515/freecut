import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createLogger } from '@/shared/logging/logger'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  FileDown,
  FileUp,
  Eye,
  X,
  Plus,
  Monitor,
  Film,
  Music,
  Zap,
  Image as ImageIcon,
} from 'lucide-react'
import { useTemplateStore } from '../stores/template-store'
import type { FreeCutTemplate, TemplateCategory } from '@/types/template'

const logger = createLogger('TemplatePickerDialog')

const CATEGORY_OPTIONS: { value: TemplateCategory | 'all'; label: string; icon?: typeof Monitor }[] = [
  { value: 'all', label: 'All Templates' },
  { value: 'intro', label: 'Intro/Outro' },
  { value: 'lower-third', label: 'Lower Third' },
  { value: 'transition', label: 'Transition Pack' },
  { value: 'title', label: 'Title Sequence' },
  { value: 'slideshow', label: 'Slideshow' },
  { value: 'social-media', label: 'Social Media' },
  { value: 'other', label: 'Other' },
]

interface TemplateCardProps {
  template: FreeCutTemplate
  isSelected: boolean
  onClick: () => void
}

function TemplateCard({ template, isSelected, onClick }: TemplateCardProps) {
  const metadata = template.metadata
  const hasFeatures = metadata.hasIntro || metadata.hasOutro || metadata.hasTransitions || metadata.hasEffects || metadata.hasAudio || metadata.hasText

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col gap-3 p-3 rounded-lg border transition-all hover:shadow-lg ${
        isSelected
          ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
          : 'border-border bg-secondary/30 hover:border-primary/50'
      }`}
    >
      <div className="relative aspect-video bg-muted rounded overflow-hidden flex items-center justify-center">
        {template.thumbnail ? (
          <img
            src={template.thumbnail}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
            <Film className="w-8 h-8" />
            <span className="text-xs">No Preview</span>
          </div>
        )}
        {isSelected && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <Eye className="w-8 h-8 text-primary" />
          </div>
        )}
      </div>

      <div className="text-left space-y-1">
        <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {template.name}
        </h3>
        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
        )}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{metadata.resolution.width}×{metadata.resolution.height}</span>
          <span>•</span>
          <span>{metadata.resolution.fps}fps</span>
        </div>
      </div>

      {hasFeatures && (
        <div className="flex flex-wrap gap-1">
          {metadata.hasTransitions && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">
              <Zap className="w-2.5 h-2.5" />
              Transitions
            </span>
          )}
          {metadata.hasEffects && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px]">
              <Sparkles className="w-2.5 h-2.5" />
              Effects
            </span>
          )}
          {metadata.hasAudio && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">
              <Music className="w-2.5 h-2.5" />
              Audio
            </span>
          )}
          {metadata.hasText && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px]">
              <ImageIcon className="w-2.5 h-2.5" />
              Text
            </span>
          )}
        </div>
      )}
    </button>
  )
}

interface TemplatePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTemplate: (template: FreeCutTemplate) => void
  onBlankProject: () => void
}

export function TemplatePickerDialog({ open, onOpenChange, onSelectTemplate, onBlankProject }: TemplatePickerDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<FreeCutTemplate | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const templates = useTemplateStore((s) => s.templates)
  const isLoading = useTemplateStore((s) => s.isLoading)
  const loadTemplates = useTemplateStore((s) => s.loadTemplates)
  const importTemplate = useTemplateStore((s) => s.importTemplate)

  useEffect(() => {
    if (open) {
      loadTemplates()
      setSearchQuery('')
      setSelectedCategory('all')
      setSelectedTemplate(null)
    }
  }, [open, loadTemplates])

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    const matchesSearch =
      !searchQuery.trim() ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const handleImportTemplate = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json, .freecut-template'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setIsImporting(true)
      try {
        const text = await file.text()
        const result = await importTemplate(text)
        if (result.success) {
          toast.success('Template imported successfully')
          await loadTemplates()
        } else {
          toast.error('Failed to import template', { description: result.errors?.[0] })
        }
      } catch (error) {
        logger.error('Failed to import template', error)
        toast.error('Failed to import template')
      } finally {
        setIsImporting(false)
      }
    }

    input.click()
  }

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isImporting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[800px] sm:max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Create Project from Template</DialogTitle>
          <DialogDescription>
            Choose a template to start with, or create a blank project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as TemplateCategory | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleImportTemplate} disabled={isImporting}>
              {isImporting ? (
                <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              ) : (
                <FileUp className="w-4 h-4" />
              )}
            </Button>
          </div>

          <ScrollArea className="h-[400px] pr-4 -mr-4">
            {isLoading && templates.length === 0 ? (
              <div className="flex items-center justify-center h-full py-12">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Loading templates...</p>
                </div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex items-center justify-center h-full py-12">
                <div className="text-center">
                  <FileDown className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No templates found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {searchQuery ? 'Try a different search term' : 'Save a project as a template first'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(null)
                    onBlankProject()
                    onOpenChange(false)
                  }}
                  className={`group relative flex flex-col gap-3 p-3 rounded-lg border transition-all hover:shadow-lg ${
                    selectedTemplate === null
                      ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                      : 'border-border bg-secondary/30 hover:border-primary/50'
                  }`}
                >
                  <div className="relative aspect-video bg-muted rounded overflow-hidden flex items-center justify-center">
                    <div className="flex flex-col items-center gap-1">
                      <Plus className="w-8 h-8 text-muted-foreground/60" />
                      <span className="text-xs text-muted-foreground/60">Blank</span>
                    </div>
                    {selectedTemplate === null && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Eye className="w-8 h-8 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                      Blank Project
                    </h3>
                    <p className="text-xs text-muted-foreground">Start with an empty timeline</p>
                  </div>
                </button>

                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.templateId}
                    template={template}
                    isSelected={selectedTemplate?.templateId === template.templateId}
                    onClick={() => setSelectedTemplate(template)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="flex justify-between items-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedTemplate === null}>
            {selectedTemplate === null ? 'Select Blank Project' : `Use "${selectedTemplate?.name}"`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
