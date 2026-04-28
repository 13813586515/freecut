import type { StockMediaItem, StockMediaSearchQuery, StockMediaSearchResult, StockMediaDownloadResult, MediaLicense, StockMediaType } from '@/types/stock-media'
import type { PexelsVideoResponse, PexelsPhotoResponse } from '@/types/stock-media'
import { createLogger } from '@/shared/logging/logger'

const logger = createLogger('PexelsService')

const PEXELS_VIDEO_BASE_URL = 'https://api.pexels.com/videos'
const PEXELS_PHOTO_BASE_URL = 'https://api.pexels.com/v1'

interface PexelsServiceConfig {
  apiKey: string
  enabled: boolean
}

function getLicense(): MediaLicense {
  return {
    type: 'free',
    name: 'Pexels License',
    url: 'https://www.pexels.com/license/',
    requiresAttribution: false,
    allowsModification: true,
    allowsCommercialUse: true,
  }
}

function mapPexelsVideoToStockMediaItem(video: PexelsVideoResponse['videos'][0]): StockMediaItem {
  const hdVideo = video.video_files.find((v) => v.quality === 'hd') || video.video_files[0]
  const bestImage = video.image

  return {
    id: `pexels_video_${video.id}`,
    providerId: video.id.toString(),
    provider: 'pexels',
    type: 'video',
    title: `Pexels Video ${video.id}`,
    description: `Video by ${video.user.name} from Pexels`,
    author: {
      id: video.user.id.toString(),
      name: video.user.name,
      avatarUrl: undefined,
    },
    thumbnail: bestImage,
    previewUrl: bestImage,
    downloadUrl: hdVideo?.link || '',
    width: hdVideo?.width || video.width,
    height: hdVideo?.height || video.height,
    duration: video.duration,
    mimeType: hdVideo?.file_type || 'video/mp4',
    tags: [],
    license: getLicense(),
    attributionText: undefined,
  }
}

function mapPexelsPhotoToStockMediaItem(photo: PexelsPhotoResponse['photos'][0]): StockMediaItem {
  return {
    id: `pexels_photo_${photo.id}`,
    providerId: photo.id.toString(),
    provider: 'pexels',
    type: 'photo',
    title: `Pexels Photo ${photo.id}`,
    description: `Photo by ${photo.photographer} from Pexels`,
    author: {
      id: photo.photographer_id.toString(),
      name: photo.photographer,
      avatarUrl: undefined,
    },
    thumbnail: photo.src.medium,
    previewUrl: photo.src.large,
    downloadUrl: photo.src.original,
    width: photo.width,
    height: photo.height,
    mimeType: 'image/jpeg',
    tags: [],
    license: getLicense(),
    attributionText: undefined,
  }
}

export async function searchPexels(
  config: PexelsServiceConfig,
  query: StockMediaSearchQuery
): Promise<StockMediaSearchResult> {
  if (!config.enabled || !config.apiKey) {
    logger.warn('Pexels service is not configured or disabled')
    return {
      total: 0,
      page: query.page || 1,
      perPage: query.perPage || 20,
      hasMore: false,
      items: [],
      provider: 'pexels',
    }
  }

  const page = query.page || 1
  const perPage = query.perPage || 20

  try {
    let response: Response
    let data: PexelsVideoResponse | PexelsPhotoResponse

    if (query.type === 'video') {
      const url = new URL(`${PEXELS_VIDEO_BASE_URL}/search`)
      url.searchParams.append('query', query.query)
      url.searchParams.append('page', page.toString())
      url.searchParams.append('per_page', perPage.toString())

      if (query.filters?.minDuration) {
        url.searchParams.append('min_duration', query.filters.minDuration.toString())
      }
      if (query.filters?.maxDuration) {
        url.searchParams.append('max_duration', query.filters.maxDuration.toString())
      }

      response = await fetch(url.toString(), {
        headers: {
          'Authorization': config.apiKey,
        },
      })
    } else {
      const url = new URL(`${PEXELS_PHOTO_BASE_URL}/search`)
      url.searchParams.append('query', query.query)
      url.searchParams.append('page', page.toString())
      url.searchParams.append('per_page', perPage.toString())

      if (query.filters?.size) {
        url.searchParams.append('size', query.filters.size)
      }
      if (query.filters?.color) {
        url.searchParams.append('color', query.filters.color)
      }
      if (query.filters?.orientation) {
        url.searchParams.append('orientation', query.filters.orientation)
      }

      response = await fetch(url.toString(), {
        headers: {
          'Authorization': config.apiKey,
        },
      })
    }

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status} ${response.statusText}`)
    }

    if (query.type === 'video') {
      data = (await response.json()) as PexelsVideoResponse
      const videoData = data as PexelsVideoResponse

      return {
        total: videoData.total_results,
        page,
        perPage,
        hasMore: !!videoData.next_page,
        items: videoData.videos.map(mapPexelsVideoToStockMediaItem),
        provider: 'pexels',
      }
    } else {
      data = (await response.json()) as PexelsPhotoResponse
      const photoData = data as PexelsPhotoResponse

      return {
        total: photoData.total_results,
        page,
        perPage,
        hasMore: !!photoData.next_page,
        items: photoData.photos.map(mapPexelsPhotoToStockMediaItem),
        provider: 'pexels',
      }
    }
  } catch (error) {
    logger.error('Pexels search failed', error)
    throw error
  }
}

export async function getPexelsPopular(
  config: PexelsServiceConfig,
  type: StockMediaType,
  page: number = 1,
  perPage: number = 20
): Promise<StockMediaSearchResult> {
  if (!config.enabled || !config.apiKey) {
    logger.warn('Pexels service is not configured or disabled')
    return {
      total: 0,
      page,
      perPage,
      hasMore: false,
      items: [],
      provider: 'pexels',
    }
  }

  try {
    let response: Response
    let data: PexelsVideoResponse | PexelsPhotoResponse

    if (type === 'video') {
      const url = new URL(`${PEXELS_VIDEO_BASE_URL}/popular`)
      url.searchParams.append('page', page.toString())
      url.searchParams.append('per_page', perPage.toString())

      response = await fetch(url.toString(), {
        headers: {
          'Authorization': config.apiKey,
        },
      })
    } else {
      const url = new URL(`${PEXELS_PHOTO_BASE_URL}/curated`)
      url.searchParams.append('page', page.toString())
      url.searchParams.append('per_page', perPage.toString())

      response = await fetch(url.toString(), {
        headers: {
          'Authorization': config.apiKey,
        },
      })
    }

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status} ${response.statusText}`)
    }

    if (type === 'video') {
      data = (await response.json()) as PexelsVideoResponse
      const videoData = data as PexelsVideoResponse

      return {
        total: videoData.total_results,
        page,
        perPage,
        hasMore: !!videoData.next_page,
        items: videoData.videos.map(mapPexelsVideoToStockMediaItem),
        provider: 'pexels',
      }
    } else {
      data = (await response.json()) as PexelsPhotoResponse
      const photoData = data as PexelsPhotoResponse

      return {
        total: photoData.total_results,
        page,
        perPage,
        hasMore: !!photoData.next_page,
        items: photoData.photos.map(mapPexelsPhotoToStockMediaItem),
        provider: 'pexels',
      }
    }
  } catch (error) {
    logger.error('Pexels popular fetch failed', error)
    throw error
  }
}

export async function downloadPexelsMedia(
  downloadUrl: string
): Promise<Blob> {
  try {
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status} ${response.statusText}`)
    }
    return await response.blob()
  } catch (error) {
    logger.error('Pexels download failed', error)
    throw error
  }
}
