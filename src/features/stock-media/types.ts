import type { StockMediaProvider, StockMediaType, StockMediaItem, StockMediaSearchQuery, StockMediaSearchResult, StockMediaDownloadResult } from '@/types/stock-media'

export interface StockMediaState {
  currentProvider: StockMediaProvider
  currentType: StockMediaType
  searchResults: Record<StockMediaProvider, StockMediaSearchResult | null>
  selectedItem: StockMediaItem | null
  selectedItems: StockMediaItem[]
  isLoading: boolean
  isDownloading: boolean
  error: string | null
  currentPage: number
  hasMore: boolean
  recentSearches: string[]
}

export interface StockMediaActions {
  setCurrentProvider: (provider: StockMediaProvider) => void
  setCurrentType: (type: StockMediaType) => void
  search: (query: string, options?: Partial<StockMediaSearchQuery>) => Promise<StockMediaSearchResult | null>
  loadMore: () => Promise<StockMediaSearchResult | null>
  selectItem: (item: StockMediaItem | null) => void
  selectItems: (items: StockMediaItem[]) => void
  downloadAndImport: (item: StockMediaItem) => Promise<StockMediaDownloadResult>
  downloadAndImportBatch: (items: StockMediaItem[]) => Promise<StockMediaDownloadResult[]>
  clearSearchResults: () => void
  clearSelection: () => void
  clearError: () => void
}

export type StockMediaStore = StockMediaState & StockMediaActions

export interface StockMediaServiceConfig {
  pexels: {
    apiKey: string
    baseUrl: string
    enabled: boolean
  }
  pixabay: {
    apiKey: string
    baseUrl: string
    enabled: boolean
  }
  freesound: {
    apiKey: string
    baseUrl: string
    enabled: boolean
  }
}

export interface StockMediaError {
  provider: StockMediaProvider
  message: string
  statusCode?: number
}
