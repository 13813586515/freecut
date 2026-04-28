import type { StockMediaItem, StockMediaSearchQuery, StockMediaSearchResult, MediaLicense, StockMediaType } from '@/types/stock-media'
import type { PixabayVideoResponse, PixabayImageResponse } from '@/types/stock-media'
import { createLogger } from '@/shared/logging/logger'

const logger = createLogger('PixabayService')

const PIXABAY_BASE_URL = 'https://pixabay.com/api'

interface PixabayServiceConfig {
  apiKey: string
  enabled: boolean
}

function getLicense(): MediaLicense {
  return {
    type: 'free',
    name: 'Pixabay License',
    url: 'https://pixabay.com/service/license/',
    requiresAttribution: false,
    allowsModification: true,
    allowsCommercialUse: true,
  }
}

function mapPixabayVideoToStockMediaItem(video: PixabayVideoResponse['hits'][0]): StockMediaItem {
  const largeVideo = video.videos.large || video.videos.medium || video.videos.small
  const tags = video.tags.split(',').map((t) => t.trim())

  return {
    id: `pixabay_video_${video.id}`,
    providerId: video.id.toString(),
    provider: 'pixabay',
    type: 'video',
    title: video.tags || `Pixabay Video ${video.id}`,
    description: `Video by ${video.user} from Pixabay`,
    author: {
      id: video.user_id.toString(),
      name: video.user,
      avatarUrl: video.userImageURL || undefined,
    },
    thumbnail: largeVideo.url,
    previewUrl: largeVideo.url,
    downloadUrl: largeVideo.url,
    width: largeVideo.width,
    height: largeVideo.height,
    duration: video.duration,
    fileSize: largeVideo.size,
    mimeType: 'video/mp4',
    tags,
    license: getLicense(),
    attributionText: undefined,
  }
}

function mapPixabayImageToStockMediaItem(image: PixabayImageResponse['hits'][0]): StockMediaItem {
  const tags = image.tags.split(',').map((t) => t.trim())

  return {
    id: `pixabay_photo_${image.id}`,
    providerId: image.id.toString(),
    provider: 'pixabay',
    type: 'photo',
    title: image.tags || `Pixabay Photo ${image.id}`,
    description: `Photo by ${image.user} from Pixabay`,
    author: {
      id: image.user_id.toString(),
      name: image.user,
      avatarUrl: image.userImageURL || undefined,
    },
    thumbnail: image.previewURL,
    previewUrl: image.webformatURL,
    downloadUrl: image.largeImageURL,
    width: image.imageWidth,
    height: image.imageHeight,
    fileSize: image.imageSize,
    mimeType: 'image/jpeg',
    tags,
    license: getLicense(),
    attributionText: undefined,
  }
}

export async function searchPixabay(
  config: PixabayServiceConfig,
  query: StockMediaSearchQuery
): Promise<StockMediaSearchResult> {
  if (!config.enabled || !config.apiKey) {
    logger.warn('Pixabay service is not configured or disabled')
    return {
      total: 0,
      page: query.page || 1,
      perPage: query.perPage || 20,
      hasMore: false,
      items: [],
      provider: 'pixabay',
    }
  }

  const page = query.page || 1
  const perPage = query.perPage || 20

  try {
    let response: Response
    let data: PixabayVideoResponse | PixabayImageResponse

    if (query.type === 'video') {
      const url = new URL(`${PIXABAY_BASE_URL}/videos/`)
      url.searchParams.append('key', config.apiKey)
      url.searchParams.append('q', query.query)
      url.searchParams.append('page', page.toString())
      url.searchParams.append('per_page', perPage.toString())
      url.searchParams.append('safesearch', query.filters?.safeSearch ? 'true' : 'false')

      if (query.filters?.minDuration) {
        url.searchParams.append('min_duration', query.filters.minDuration.toString())
      }
      if (query.filters?.maxDuration) {
        url.searchParams.append('max_duration', query.filters.maxDuration.toString())
      }

      response = await fetch(url.toString())
    } else {
      const url = new URL(`${PIXABAY_BASE_URL}/`)
      url.searchParams.append('key', config.apiKey)
      url.searchParams.append('q', query.query)
      url.searchParams.append('image_type', query.type === 'photo' ? 'all' : query.type)
      url.searchParams.append('page', page.toString())
      url.searchParams.append('per_page', perPage.toString())
      url.searchParams.append('safesearch', query.filters?.safeSearch ? 'true' : 'false')

      if (query.filters?.orientation) {
        url.searchParams.append('orientation', query.filters.orientation)
      }
      if (query.filters?.category) {
        url.searchParams.append('category', query.filters.category)
      }
      if (query.filters?.color) {
        url.searchParams.append('colors', query.filters.color)
      }

      response = await fetch(url.toString())
    }

    if (!response.ok) {
      throw new Error(`Pixabay API error: ${response.status} ${response.statusText}`)
    }

    if (query.type === 'video') {
      data = (await response.json()) as PixabayVideoResponse
      const videoData = data as PixabayVideoResponse

      return {
        total: videoData.totalHits,
        page,
        perPage,
        hasMore: (page * perPage) < videoData.totalHits,
        items: videoData.hits.map(mapPixabayVideoToStockMediaItem),
        provider: 'pixabay',
      }
    } else {
      data = (await response.json()) as PixabayImageResponse
      const imageData = data as PixabayImageResponse

      return {
        total: imageData.totalHits,
        page,
        perPage,
        hasMore: (page * perPage) < imageData.totalHits,
        items: imageData.hits.map(mapPixabayImageToStockMediaItem),
        provider: 'pixabay',
      }
    }
  } catch (error) {
    logger.error('Pixabay search failed', error)
    throw error
  }
}

export async function getPixabayPopular(
  config: PixabayServiceConfig,
  type: StockMediaType,
  page: number = 1,
  perPage: number = 20
): Promise<StockMediaSearchResult> {
  if (!config.enabled || !config.apiKey) {
    logger.warn('Pixabay service is not configured or disabled')
    return {
      total: 0,
      page,
      perPage,
      hasMore: false,
      items: [],
      provider: 'pixabay',
    }
  }

  try {
    let response: Response
    let data: PixabayVideoResponse | PixabayImageResponse

    if (type === 'video') {
      const url = new URL(`${PIXABAY_BASE_URL}/videos/`)
      url.searchParams.append('key', config.apiKey)
      url.searchParams.append('page', page.toString())
      url.searchParams.append('per_page', perPage.toString())
      url.searchParams.append('order', 'popular')

      response = await fetch(url.toString())
    } else {
      const url = new URL(`${PIXABAY_BASE_URL}/`)
      url.searchParams.append('key', config.apiKey)
      url.searchParams.append('image_type', type === 'photo' ? 'all' : type)
      url.searchParams.append('page', page.toString())
      url.searchParams.append('per_page', perPage.toString())
      url.searchParams.append('order', 'popular')

      response = await fetch(url.toString())
    }

    if (!response.ok) {
      throw new Error(`Pixabay API error: ${response.status} ${response.statusText}`)
    }

    if (type === 'video') {
      data = (await response.json()) as PixabayVideoResponse
      const videoData = data as PixabayVideoResponse

      return {
        total: videoData.totalHits,
        page,
        perPage,
        hasMore: (page * perPage) < videoData.totalHits,
        items: videoData.hits.map(mapPixabayVideoToStockMediaItem),
        provider: 'pixabay',
      }
    } else {
      data = (await response.json()) as PixabayImageResponse
      const imageData = data as PixabayImageResponse

      return {
        total: imageData.totalHits,
        page,
        perPage,
        hasMore: (page * perPage) < imageData.totalHits,
        items: imageData.hits.map(mapPixabayImageToStockMediaItem),
        provider: 'pixabay',
      }
    }
  } catch (error) {
    logger.error('Pixabay popular fetch failed', error)
    throw error
  }
}

export async function downloadPixabayMedia(
  downloadUrl: string
): Promise<Blob> {
  try {
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status} ${response.statusText}`)
    }
    return await response.blob()
  } catch (error) {
    logger.error('Pixabay download failed', error)
    throw error
  }
}
