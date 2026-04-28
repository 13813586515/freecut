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
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { useTemplateStore } from '../stores/template-store'
import type { TemplateCategory } from '@/types/template'

const logger = createLogger('SaveAsTemplateDialog')

const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'intro', label: 'Intro/Outro' },
  { value: 'lower-third', label: 'Lower Third' },
  { value: 'transition', label: 'Transition Pack' },
  { value: 'title', label: 'Title Sequence' },
  { value: 'slideshow', label: 'Slideshow' },
  { value: 'social-media', label: 'Social Media' },
  { value: 'other', label: 'Other' },
]

interface SaveAsTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}

export function SaveAsTemplateDialog({ open, onOpenChange, projectId }: SaveAsTemplateDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('other')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const createTemplateFromProject = useTemplateStore((s) => s.createTemplateFromProject)

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setCategory('other')
      setTagInput('')
      setTags([])
    }
  }, [open])

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const newTag = tagInput.trim().replace(/,/g, '')
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag])
        setTagInput('')
      }
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a template name')
      return
    }

    setIsSaving(true)
    try {
      const template = await createTemplateFromProject(projectId, {
        name: name.trim(),
        description: description.trim(),
        category,
        tags,
      })

      if (template) {
        toast.success('Template saved successfully', {
          description: `"${template.name}" has been saved to your templates.`,
        })
        onOpenChange(false)
      }
    } catch (error) {
      logger.error('Failed to save template', error)
      toast.error('Failed to save template', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isSaving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Save Project as Template</DialogTitle>
          <DialogDescription>
            Save your current project as a reusable template. Templates include the timeline structure,
            transitions, and effects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name <span className="text-destructive">*</span></Label>
            <Input
              id="template-name"
              placeholder="Enter template name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              placeholder="Describe what this template is for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <Input
              placeholder="Type a tag and press Enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
