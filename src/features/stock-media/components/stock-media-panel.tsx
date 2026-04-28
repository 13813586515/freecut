import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { createLogger } from '@/shared/logging/logger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  Video,
  Image,
  Music,
  Download,
  ExternalLink,
  Settings,
  Loader2,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useStockMediaStore } from '../stores/stock-media-store'
import type { StockMediaItem, StockMediaProvider, StockMediaType } from '@/types/stock-media'
import { useSettingsStore } from '@/features/editor/deps/settings'

const logger = createLogger('StockMediaPanel')

const PROVIDER_OPTIONS: { value: StockMediaProvider; label: string }[] = [
  { value: 'pexels', label: 'Pexels' },
  { value: 'pixabay', label: 'Pixabay' },
  { value: 'freesound', label: 'Freesound' },
]

const TYPE_OPTIONS: { value: StockMediaType; label: string; icon: typeof Video }[] = [
  { value: 'video', label: 'Videos', icon: Video },
  { value: 'photo', label: 'Photos', icon: Image },
  { value: 'audio', label: 'Audio', icon: Music },
]

interface MediaCardProps {
  item: StockMediaItem
  onClick: () => void
}

function MediaCard({ item, onClick }: MediaCardProps) {
  const { currentType } = useStockMediaStore.getState()

  const renderPreview = () => {
    if (item.thumbnailUrl) {
      return (
        <img
          src={item.thumbnailUrl}
          alt={item.title || item.id}
          className="w-full h-full object-cover"
        />
      )
    }

    if (currentType === 'audio') {
      return (
        <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-2">
          <Music className="w-8 h-8 text-muted-foreground/60" />
          <div className="flex gap-0.5 items-end h-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-muted-foreground/40 rounded-sm"
                style={{ height: `${40 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        {currentType === 'video' ? (
          <Video className="w-8 h-8 text-muted-foreground/60" />
        ) : (
          <Image className="w-8 h-8 text-muted-foreground/60" />
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative rounded-lg overflow-hidden border border-border bg-secondary/30 hover:border-primary/50 hover:shadow-lg transition-all"
    >
      <div className="relative aspect-video bg-muted">
        {renderPreview()}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
            <Download className="w-8 h-8 text-white" />
            <span className="text-xs text-white font-medium">Import</span>
          </div>
        </div>
        {item.duration && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white font-mono">
            {item.duration}
          </div>
        )}
      </div>
      <div className="p-2 text-left">
        {item.title && (
          <p className="text-xs font-medium text-foreground line-clamp-1">{item.title}</p>
        )}
        {item.author && (
          <p className="text-[10px] text-muted-foreground mt-0.5">by {item.author}</p>
        )}
      </div>
    </button>
  )
}

interface PreviewDialogProps {
  item: StockMediaItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (item: StockMediaItem) => void
  isImporting: boolean
}

function PreviewDialog({ item, open, onOpenChange, onImport, isImporting }: PreviewDialogProps) {
  if (!item) return null

  const renderContent = () => {
    if (item.type === 'audio') {
      return (
        <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center gap-4">
          <Music className="w-16 h-16 text-muted-foreground/60" />
          <div className="text-center">
            <p className="font-medium">{item.title || 'Audio Clip'}</p>
            {item.duration && (
              <p className="text-sm text-muted-foreground">{item.duration}</p>
            )}
            {item.author && (
              <p className="text-sm text-muted-foreground">by {item.author}</p>
            )}
          </div>
          {item.downloadUrl && (
            <audio controls className="w-full max-w-md px-8">
              <source src={item.downloadUrl} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
      )
    }

    if (item.previewUrl) {
      return (
        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
          {item.type === 'video' && item.previewUrl ? (
            <video
              src={item.previewUrl}
              controls
              className="w-full h-full object-contain"
              poster={item.thumbnailUrl || undefined}
            />
          ) : (
            <img
              src={item.previewUrl || item.thumbnailUrl}
              alt={item.title || item.id}
              className="w-full h-full object-contain"
            />
          )}
        </div>
      )
    }

    if (item.thumbnailUrl) {
      return (
        <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
          <img
            src={item.thumbnailUrl}
            alt={item.title || item.id}
            className="w-full h-full object-contain"
          />
        </div>
      )
    }

    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        {item.type === 'video' ? (
          <Video className="w-16 h-16 text-muted-foreground/40" />
        ) : (
          <Image className="w-16 h-16 text-muted-foreground/40" />
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{item.title || `${item.type} ${item.id}`}</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{item.provider}</Badge>
              {item.license && (
                <Badge variant="outline">{item.license}</Badge>
              )}
            </div>
          </div>
          {item.author && (
            <DialogDescription className="flex items-center gap-2">
              by {item.author}
              {item.authorUrl && (
                <a
                  href={item.authorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  View Profile <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {renderContent()}

        {(item.width || item.height || item.duration) && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {item.width && item.height && (
              <span>{item.width} × {item.height}</span>
            )}
            {item.duration && <span>{item.duration}</span>}
          </div>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <DialogFooter className="flex justify-between items-center">
          {item.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <ExternalLink className="w-4 h-4" />
                Open Original
              </a>
            </Button>
          )}
          <Button onClick={() => onImport(item)} disabled={isImporting} className="gap-1.5">
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Import to Library
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ApiKeyMissingDialogProps {
  provider: StockMediaProvider
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ApiKeyMissingDialog({ provider, open, onOpenChange }: ApiKeyMissingDialogProps) {
  const providerInfo = {
    pexels: {
      name: 'Pexels',
      url: 'https://www.pexels.com/api/new/',
      description: 'Get a free API key from Pexels to search for photos and videos.',
    },
    pixabay: {
      name: 'Pixabay',
      url: 'https://pixabay.com/api/docs/',
      description: 'Get a free API key from Pixabay to search for photos, illustrations, and videos.',
    },
    freesound: {
      name: 'Freesound',
      url: 'https://freesound.org/apiv2/apply',
      description: 'Get a free API key from Freesound to search for sound effects and music.',
    },
  }

  const info = providerInfo[provider]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>API Key Required</DialogTitle>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">To use {info.name}, you need to:</p>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Get an API key from {info.name}</li>
              <li>Go to Settings → Integrations</li>
              <li>Paste your API key</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild>
            <a href={info.url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
              <ExternalLink className="w-4 h-4" />
              Get API Key
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StockMediaPanel() {
  const [searchInput, setSearchInput] = useState('')
  const [previewItem, setPreviewItem] = useState<StockMediaItem | null>(null)
  const [apiKeyMissingFor, setApiKeyMissingFor] = useState<StockMediaProvider | null>(null)

  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)

  // Store state
  const currentProvider = useStockMediaStore((s) => s.currentProvider)
  const currentType = useStockMediaStore((s) => s.currentType)
  const searchResults = useStockMediaStore((s) => s.searchResults)
  const isLoading = useStockMediaStore((s) => s.isLoading)
  const isDownloading = useStockMediaStore((s) => s.isDownloading)
  const hasMore = useStockMediaStore((s) => s.hasMore)
  const error = useStockMediaStore((s) => s.error)

  const setCurrentProvider = useStockMediaStore((s) => s.setCurrentProvider)
  const setCurrentType = useStockMediaStore((s) => s.setCurrentType)
  const search = useStockMediaStore((s) => s.search)
  const loadMore = useStockMediaStore((s) => s.loadMore)
  const downloadAndImport = useStockMediaStore((s) => s.downloadAndImport)
  const clearSearchResults = useStockMediaStore((s) => s.clearSearchResults)

  // Settings for API key check
  const pexelsApiKey = useSettingsStore((s) => s.pexelsApiKey)
  const pixabayApiKey = useSettingsStore((s) => s.pixabayApiKey)
  const freesoundApiKey = useSettingsStore((s) => s.freesoundApiKey)

  const hasApiKey = (provider: StockMediaProvider): boolean => {
    switch (provider) {
      case 'pexels': return !!pexelsApiKey
      case 'pixabay': return !!pixabayApiKey
      case 'freesound': return !!freesoundApiKey
    }
  }

  const currentResults = searchResults[currentProvider]
  const displayItems = currentResults?.items || []

  const handleSearch = useCallback(async (query: string) => {
    if (!hasApiKey(currentProvider)) {
      setApiKeyMissingFor(currentProvider)
      return
    }
    await search(query)
  }, [search, currentProvider, pexelsApiKey, pixabayApiKey, freesoundApiKey])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(searchInput)
    }
  }

  const handleTypeChange = (type: StockMediaType) => {
    setCurrentType(type)
    clearSearchResults()
  }

  const handleProviderChange = (provider: StockMediaProvider) => {
    setCurrentProvider(provider)
    clearSearchResults()
  }

  const handleImport = async (item: StockMediaItem) => {
    if (!hasApiKey(item.provider)) {
      setApiKeyMissingFor(item.provider)
      return
    }

    setPreviewItem(null)
    const result = await downloadAndImport(item)

    if (result.success) {
      toast.success('Media imported', {
        description: `"${item.title || item.id}" has been added to your media library.`,
      })
    } else {
      toast.error('Import failed', {
        description: result.error,
      })
    }
  }

  // Load popular content on mount or provider/type change
  useEffect(() => {
    if (hasApiKey(currentProvider)) {
      // Don't auto-search on mount - let user search explicitly
      // search('')
    }
  }, [currentProvider, currentType, pexelsApiKey, pixabayApiKey, freesoundApiKey])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreTriggerRef.current || !hasMore || isLoading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(loadMoreTriggerRef.current)

    return () => observer.disconnect()
  }, [hasMore, isLoading, loadMore])

  const availableTypes = currentProvider === 'freesound'
    ? TYPE_OPTIONS.filter((t) => t.value === 'audio')
    : TYPE_OPTIONS.filter((t) => t.value !== 'audio')

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filters */}
      <div className="flex-shrink-0 p-3 space-y-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${currentProvider}...`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10"
            />
          </div>
          <Button onClick={() => handleSearch(searchInput)} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <Tabs value={currentType} onValueChange={(v) => handleTypeChange(v as StockMediaType)} className="w-auto">
            <TabsList>
              {availableTypes.map((type) => (
                <TabsTrigger key={type.value} value={type.value} className="gap-1.5">
                  <type.icon className="w-3.5 h-3.5" />
                  {type.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Select value={currentProvider} onValueChange={(v) => handleProviderChange(v as StockMediaProvider)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="flex items-center gap-2">
                  {opt.label}
                  {!hasApiKey(opt.value as StockMediaProvider) && (
                    <Badge variant="secondary" className="ml-auto text-[9px]">
                      No Key
                    </Badge>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {!hasApiKey(currentProvider) ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Settings className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground mb-1">API Key Required</p>
              <p className="text-xs text-muted-foreground mb-4">
                Configure your {PROVIDER_OPTIONS.find((p) => p.value === currentProvider)?.label} API key in Settings
              </p>
              <Button variant="outline" size="sm" onClick={() => setApiKeyMissingFor(currentProvider)}>
                Learn More
              </Button>
            </div>
          ) : displayItems.length === 0 && isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-muted-foreground/40 animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Searching...</p>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground mb-1">No Results</p>
              <p className="text-xs text-muted-foreground">
                Try searching for something like "nature" or "city"
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {displayItems.map((item) => (
                  <MediaCard
                    key={`${item.provider}-${item.providerId}`}
                    item={item}
                    onClick={() => setPreviewItem(item)}
                  />
                ))}
              </div>

              {/* Load more trigger */}
              {hasMore && (
                <div ref={loadMoreTriggerRef} className="h-20 flex items-center justify-center mt-4">
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading more...
                    </div>
                  ) : (
                    <Button variant="ghost" onClick={loadMore}>
                      Load More
                    </Button>
                  )}
                </div>
              )}

              {!hasMore && displayItems.length > 0 && (
                <p className="text-center text-xs text-muted-foreground mt-6 pb-2">
                  End of results
                </p>
              )}
            </>
          )}

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Preview Dialog */}
      <PreviewDialog
        item={previewItem}
        open={!!previewItem}
        onOpenChange={(o) => !o && setPreviewItem(null)}
        onImport={handleImport}
        isImporting={isDownloading}
      />

      {/* API Key Missing Dialog */}
      <ApiKeyMissingDialog
        provider={apiKeyMissingFor || currentProvider}
        open={!!apiKeyMissingFor}
        onOpenChange={(o) => !o && setApiKeyMissingFor(null)}
      />
    </div>
  )
}
