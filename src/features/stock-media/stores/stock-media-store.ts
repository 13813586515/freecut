import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { StockMediaItem, StockMediaSearchQuery, StockMediaSearchResult, StockMediaDownloadResult, StockMediaProvider, StockMediaType } from '@/types/stock-media'
import type { StockMediaStore, StockMediaServiceConfig } from '../types'
import {
  searchPexels,
  getPexelsPopular,
  downloadPexelsMedia,
  searchPixabay,
  getPixabayPopular,
  downloadPixabayMedia,
  searchFreesound,
  getFreesoundPopular,
  downloadFreesoundMedia,
} from '../services'
import { createLogger } from '@/shared/logging/logger'

const logger = createLogger('StockMediaStore')

const DEFAULT_CONFIG: StockMediaServiceConfig = {
  pexels: {
    apiKey: '',
    baseUrl: 'https://api.pexels.com',
    enabled: false,
  },
  pixabay: {
    apiKey: '',
    baseUrl: 'https://pixabay.com/api',
    enabled: false,
  },
  freesound: {
    apiKey: '',
    baseUrl: 'https://freesound.org/apiv2',
    enabled: false,
  },
}

function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
  }
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream'
}

function getExtensionFromUrl(url: string): string {
  const urlObj = new URL(url)
  const pathname = urlObj.pathname
  const lastDot = pathname.lastIndexOf('.')
  if (lastDot !== -1) {
    return pathname.slice(lastDot)
  }
  return '.bin'
}

async function importMediaToLibrary(
  item: StockMediaItem,
  blob: Blob
): Promise<StockMediaDownloadResult> {
  try {
    const { mediaLibraryService } = await import('@/features/editor/deps/media-library')

    const extension = getExtensionFromUrl(item.downloadUrl)
    const fileName = `${item.provider}_${item.providerId}${extension}`
    const mimeType = getMimeTypeFromExtension(extension)

    const file = new File([blob], fileName, { type: mimeType })

    const imported = await mediaLibraryService.importMedia([file])

    if (imported.length > 0) {
      return {
        success: true,
        mediaId: imported[0].id,
        blob,
      }
    }

    return {
      success: false,
      error: 'Failed to import media to library',
    }
  } catch (error) {
    logger.error('Failed to import media to library', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export const useStockMediaStore = create<StockMediaStore>()(
  devtools(
    persist(
      (set, get) => ({
        currentProvider: 'pexels',
        currentType: 'video',
        searchResults: {
          pexels: null,
          pixabay: null,
          freesound: null,
        },
        selectedItem: null,
        selectedItems: [],
        isLoading: false,
        isDownloading: false,
        error: null,
        currentPage: 1,
        hasMore: true,
        recentSearches: [],

        config: DEFAULT_CONFIG,

        setCurrentProvider: (provider) => {
          set({ currentProvider: provider })
        },

        setCurrentType: (type) => {
          set({ currentType: type })
        },

        search: async (query, options) => {
          const { currentProvider, currentType } = get()
          const provider = options?.provider || currentProvider
          const type = options?.type || currentType
          const page = options?.page || 1
          const perPage = options?.perPage || 20

          set({ isLoading: true, error: null })

          try {
            let result: StockMediaSearchResult

            const { useSettingsStore } = await import('@/features/editor/deps/settings')
            const settings = useSettingsStore.getState()

            const config: StockMediaServiceConfig = {
              pexels: {
                apiKey: settings.pexelsApiKey || '',
                baseUrl: 'https://api.pexels.com',
                enabled: !!settings.pexelsApiKey,
              },
              pixabay: {
                apiKey: settings.pixabayApiKey || '',
                baseUrl: 'https://pixabay.com/api',
                enabled: !!settings.pixabayApiKey,
              },
              freesound: {
                apiKey: settings.freesoundApiKey || '',
                baseUrl: 'https://freesound.org/apiv2',
                enabled: !!settings.freesoundApiKey,
              },
            }

            const searchQuery: StockMediaSearchQuery = {
              query,
              type,
              provider,
              page,
              perPage,
              filters: options?.filters,
            }

            if (provider === 'pexels') {
              result = await searchPexels(config.pexels, searchQuery)
            } else if (provider === 'pixabay') {
              result = await searchPixabay(config.pixabay, searchQuery)
            } else {
              result = await searchFreesound(config.freesound, searchQuery)
            }

            set((state) => ({
              searchResults: {
                ...state.searchResults,
                [provider]: result,
              },
              currentPage: page,
              hasMore: result.hasMore,
              isLoading: false,
              recentSearches: query.trim()
                ? [query, ...state.recentSearches.filter((s) => s !== query)].slice(0, 10)
                : state.recentSearches,
            }))

            return result
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Search failed'
            logger.error('Stock media search failed', error)
            set({ error: errorMessage, isLoading: false })
            return null
          }
        },

        loadMore: async () => {
          const { currentProvider, currentType, currentPage, hasMore, searchResults } = get()

          if (!hasMore) {
            return null
          }

          const currentResults = searchResults[currentProvider]
          if (!currentResults) {
            return null
          }

          const nextPage = currentPage + 1

          set({ isLoading: true, error: null })

          try {
            const { useSettingsStore } = await import('@/features/editor/deps/settings')
            const settings = useSettingsStore.getState()

            const config: StockMediaServiceConfig = {
              pexels: {
                apiKey: settings.pexelsApiKey || '',
                baseUrl: 'https://api.pexels.com',
                enabled: !!settings.pexelsApiKey,
              },
              pixabay: {
                apiKey: settings.pixabayApiKey || '',
                baseUrl: 'https://pixabay.com/api',
                enabled: !!settings.pixabayApiKey,
              },
              freesound: {
                apiKey: settings.freesoundApiKey || '',
                baseUrl: 'https://freesound.org/apiv2',
                enabled: !!settings.freesoundApiKey,
              },
            }

            const searchQuery: StockMediaSearchQuery = {
              query: '',
              type: currentType,
              provider: currentProvider,
              page: nextPage,
              perPage: 20,
            }

            let result: StockMediaSearchResult

            if (currentProvider === 'pexels') {
              result = await searchPexels(config.pexels, searchQuery)
            } else if (currentProvider === 'pixabay') {
              result = await searchPixabay(config.pixabay, searchQuery)
            } else {
              result = await searchFreesound(config.freesound, searchQuery)
            }

            const combinedResults: StockMediaSearchResult = {
              ...result,
              items: [...(currentResults.items || []), ...(result.items || [])],
            }

            set((state) => ({
              searchResults: {
                ...state.searchResults,
                [currentProvider]: combinedResults,
              },
              currentPage: nextPage,
              hasMore: result.hasMore,
              isLoading: false,
            }))

            return combinedResults
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Load more failed'
            logger.error('Stock media load more failed', error)
            set({ error: errorMessage, isLoading: false })
            return null
          }
        },

        selectItem: (item) => {
          set({ selectedItem: item })
        },

        selectItems: (items) => {
          set({ selectedItems: items })
        },

        downloadAndImport: async (item) => {
          set({ isDownloading: true, error: null })

          try {
            const { useSettingsStore } = await import('@/features/editor/deps/settings')
            const settings = useSettingsStore.getState()

            const config: StockMediaServiceConfig = {
              pexels: {
                apiKey: settings.pexelsApiKey || '',
                baseUrl: 'https://api.pexels.com',
                enabled: !!settings.pexelsApiKey,
              },
              pixabay: {
                apiKey: settings.pixabayApiKey || '',
                baseUrl: 'https://pixabay.com/api',
                enabled: !!settings.pixabayApiKey,
              },
              freesound: {
                apiKey: settings.freesoundApiKey || '',
                baseUrl: 'https://freesound.org/apiv2',
                enabled: !!settings.freesoundApiKey,
              },
            }

            let blob: Blob

            if (item.provider === 'pexels') {
              blob = await downloadPexelsMedia(item.downloadUrl)
            } else if (item.provider === 'pixabay') {
              blob = await downloadPixabayMedia(item.downloadUrl)
            } else {
              blob = await downloadFreesoundMedia(config.freesound, item.downloadUrl)
            }

            const result = await importMediaToLibrary(item, blob)

            set({ isDownloading: false })

            return result
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Download failed'
            logger.error('Stock media download failed', error)
            set({ error: errorMessage, isDownloading: false })
            return {
              success: false,
              error: errorMessage,
            }
          }
        },

        downloadAndImportBatch: async (items) => {
          const results: StockMediaDownloadResult[] = []

          for (const item of items) {
            const result = await get().downloadAndImport(item)
            results.push(result)
          }

          return results
        },

        clearSearchResults: () => {
          set({
            searchResults: {
              pexels: null,
              pixabay: null,
              freesound: null,
            },
            currentPage: 1,
            hasMore: true,
          })
        },

        clearSelection: () => {
          set({
            selectedItem: null,
            selectedItems: [],
          })
        },

        clearError: () => {
          set({ error: null })
        },
      }),
      {
        name: 'freecut-stock-media',
        partialize: (state) => ({
          recentSearches: state.recentSearches,
        }),
      },
    ),
    {
      name: 'StockMediaStore',
      enabled: import.meta.env.DEV,
    },
  ),
)
