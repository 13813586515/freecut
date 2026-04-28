export type StockMediaProvider = 'pexels' | 'pixabay' | 'freesound'

export type StockMediaType = 'video' | 'photo' | 'audio'

export interface StockMediaConfig {
  pexels: {
    apiKey: string
    enabled: boolean
  }
  pixabay: {
    apiKey: string
    enabled: boolean
  }
  freesound: {
    apiKey: string
    enabled: boolean
  }
}

export interface StockMediaSearchQuery {
  query: string
  type: StockMediaType
  provider?: StockMediaProvider
  page?: number
  perPage?: number
  filters?: SearchFilters
}

export interface SearchFilters {
  orientation?: 'landscape' | 'portrait' | 'square'
  size?: 'small' | 'medium' | 'large'
  color?: string
  category?: string
  minDuration?: number
  maxDuration?: number
  safeSearch?: boolean
}

export interface StockMediaSearchResult {
  total: number
  page: number
  perPage: number
  hasMore: boolean
  items: StockMediaItem[]
  provider: StockMediaProvider
}

export interface StockMediaItem {
  id: string
  providerId: string
  provider: StockMediaProvider
  type: StockMediaType
  title: string
  description?: string
  author: {
    id: string
    name: string
    avatarUrl?: string
  }
  thumbnail: string
  previewUrl: string
  downloadUrl: string
  width?: number
  height?: number
  duration?: number
  fileSize?: number
  mimeType?: string
  tags: string[]
  license: MediaLicense
  attributionText?: string
}

export interface MediaLicense {
  type: 'free' | 'attribution' | 'commercial'
  name: string
  url?: string
  requiresAttribution: boolean
  allowsModification: boolean
  allowsCommercialUse: boolean
}

export interface StockMediaDownloadResult {
  success: boolean
  mediaId?: string
  filePath?: string
  blob?: Blob
  error?: string
}

export interface PexelsVideoResponse {
  page: number
  per_page: number
  total_results: number
  next_page?: string
  prev_page?: string
  videos: Array<{
    id: number
    width: number
    height: number
    duration: number
    image: string
    url: string
    image: string
    video_files: Array<{
      id: number
      quality: string
      file_type: string
      width: number
      height: number
      link: string
    }>
    user: {
      id: number
      name: string
      url: string
    }
  }>
}

export interface PexelsPhotoResponse {
  page: number
  per_page: number
  total_results: number
  next_page?: string
  prev_page?: string
  photos: Array<{
    id: number
    width: number
    height: number
    url: string
    photographer: string
    photographer_url: string
    photographer_id: number
    avg_color: string
    src: {
      original: string
      large2x: string
      large: string
      medium: string
      small: string
      portrait: string
      landscape: string
      tiny: string
    }
  }>
}

export interface PixabayVideoResponse {
  total: number
  totalHits: number
  hits: Array<{
    id: number
    pageURL: string
    type: string
    tags: string
    duration: number
    picture_id: string
    videos: {
      large: {
        url: string
        width: number
        height: number
        size: number
      }
      medium: {
        url: string
        width: number
        height: number
        size: number
      }
      small: {
        url: string
        width: number
        height: number
        size: number
      }
      tiny: {
        url: string
        width: number
        height: number
        size: number
      }
    }
    tags: string
    views: number
    downloads: number
    likes: number
    comments: number
    user_id: number
    user: string
    userImageURL: string
  }>
}

export interface PixabayImageResponse {
  total: number
  totalHits: number
  hits: Array<{
    id: number
    pageURL: string
    type: string
    tags: string
    previewURL: string
    previewWidth: number
    previewHeight: number
    webformatURL: string
    webformatWidth: number
    webformatHeight: number
    largeImageURL: string
    imageWidth: number
    imageHeight: number
    imageSize: number
    views: number
    downloads: number
    likes: number
    comments: number
    user_id: number
    user: string
    userImageURL: string
  }>
}

export interface FreesoundSoundResponse {
  count: number
  next: string | null
  previous: string | null
  results: Array<{
    id: number
    url: string
    name: string
    tags: string[]
    description: string
    geotag: string | null
    created: string
    license: string
    type: string
    type: string
    username: string
    previews: {
      'preview-hq-mp3': string
      'preview-lq-mp3': string
      'preview-hq-ogg': string
      'preview-lq-ogg': string
    }
    images: {
      wavefrom_l: string
      wavefrom_m: string
      spectral_l: string
      spectral_m: string
    }
    duration: number
    samplerate: number
    channels: number
    filesize: number
    bitrate: number
    bitdepth: number
  }>
}
