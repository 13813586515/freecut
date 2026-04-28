import type { StockMediaItem, StockMediaSearchQuery, StockMediaSearchResult, MediaLicense, StockMediaType } from '@/types/stock-media'
import type { FreesoundSoundResponse } from '@/types/stock-media'
import { createLogger } from '@/shared/logging/logger'

const logger = createLogger('FreesoundService')

const FREESOUND_BASE_URL = 'https://freesound.org/apiv2'

interface FreesoundServiceConfig {
  apiKey: string
  enabled: boolean
}

function getLicense(licenseUrl: string): MediaLicense {
  const isCc0 = licenseUrl.includes('creativecommons.org/publicdomain/zero')
  const isAttribution = licenseUrl.includes('creativecommons.org/licenses/by/')
  const isNonCommercial = licenseUrl.includes('creativecommons.org/licenses/by-nc/')

  if (isCc0) {
    return {
      type: 'free',
      name: 'CC0 1.0 Universal',
      url: licenseUrl,
      requiresAttribution: false,
      allowsModification: true,
      allowsCommercialUse: true,
    }
  }

  if (isAttribution && !isNonCommercial) {
    return {
      type: 'attribution',
      name: 'CC BY 4.0',
      url: licenseUrl,
      requiresAttribution: true,
      allowsModification: true,
      allowsCommercialUse: true,
    }
  }

  if (isAttribution && isNonCommercial) {
    return {
      type: 'attribution',
      name: 'CC BY-NC 4.0',
      url: licenseUrl,
      requiresAttribution: true,
      allowsModification: true,
      allowsCommercialUse: false,
    }
  }

  return {
    type: 'free',
    name: 'Freesound License',
    url: licenseUrl,
    requiresAttribution: true,
    allowsModification: true,
    allowsCommercialUse: !isNonCommercial,
  }
}

function mapFreesoundSoundToStockMediaItem(sound: FreesoundSoundResponse['results'][0]): StockMediaItem {
  const previewUrl = sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3']
  const waveformUrl = sound.images.waveform_l || sound.images.waveform_m

  return {
    id: `freesound_audio_${sound.id}`,
    providerId: sound.id.toString(),
    provider: 'freesound',
    type: 'audio',
    title: sound.name,
    description: sound.description,
    author: {
      id: sound.username,
      name: sound.username,
      avatarUrl: undefined,
    },
    thumbnail: waveformUrl,
    previewUrl: previewUrl,
    downloadUrl: previewUrl,
    duration: sound.duration,
    fileSize: sound.filesize,
    mimeType: 'audio/mpeg',
    tags: sound.tags,
    license: getLicense(sound.license),
    attributionText: `Sound by ${sound.username} from Freesound`,
  }
}

export async function searchFreesound(
  config: FreesoundServiceConfig,
  query: StockMediaSearchQuery
): Promise<StockMediaSearchResult> {
  if (!config.enabled || !config.apiKey) {
    logger.warn('Freesound service is not configured or disabled')
    return {
      total: 0,
      page: query.page || 1,
      perPage: query.perPage || 20,
      hasMore: false,
      items: [],
      provider: 'freesound',
    }
  }

  const page = query.page || 1
  const perPage = query.perPage || 20

  try {
    const url = new URL(`${FREESOUND_BASE_URL}/search/text/`)
    url.searchParams.append('token', config.apiKey)
    url.searchParams.append('query', query.query)
    url.searchParams.append('page', page.toString())
    url.searchParams.append('page_size', perPage.toString())

    if (query.filters?.minDuration) {
      url.searchParams.append('filter', `duration:[${query.filters.minDuration} TO *]`)
    }
    if (query.filters?.maxDuration) {
      const existingFilter = url.searchParams.get('filter') || ''
      url.searchParams.set('filter', `${existingFilter} duration:[* TO ${query.filters.maxDuration}]`.trim())
    }

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`Freesound API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as FreesoundSoundResponse

    return {
      total: data.count,
      page,
      perPage,
      hasMore: !!data.next,
      items: data.results.map(mapFreesoundSoundToStockMediaItem),
      provider: 'freesound',
    }
  } catch (error) {
    logger.error('Freesound search failed', error)
    throw error
  }
}

export async function getFreesoundPopular(
  config: FreesoundServiceConfig,
  page: number = 1,
  perPage: number = 20
): Promise<StockMediaSearchResult> {
  if (!config.enabled || !config.apiKey) {
    logger.warn('Freesound service is not configured or disabled')
    return {
      total: 0,
      page,
      perPage,
      hasMore: false,
      items: [],
      provider: 'freesound',
    }
  }

  try {
    const url = new URL(`${FREESOUND_BASE_URL}/sounds/search/`)
    url.searchParams.append('token', config.apiKey)
    url.searchParams.append('sort', 'rating_desc')
    url.searchParams.append('page', page.toString())
    url.searchParams.append('page_size', perPage.toString())

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`Freesound API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as FreesoundSoundResponse

    return {
      total: data.count,
      page,
      perPage,
      hasMore: !!data.next,
      items: data.results.map(mapFreesoundSoundToStockMediaItem),
      provider: 'freesound',
    }
  } catch (error) {
    logger.error('Freesound popular fetch failed', error)
    throw error
  }
}

export async function getFreesoundSoundById(
  config: FreesoundServiceConfig,
  soundId: number
): Promise<StockMediaItem | null> {
  if (!config.enabled || !config.apiKey) {
    logger.warn('Freesound service is not configured or disabled')
    return null
  }

  try {
    const url = new URL(`${FREESOUND_BASE_URL}/sounds/${soundId}/`)
    url.searchParams.append('token', config.apiKey)

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`Freesound API error: ${response.status} ${response.statusText}`)
    }

    const sound = (await response.json()) as FreesoundSoundResponse['results'][0]
    return mapFreesoundSoundToStockMediaItem(sound)
  } catch (error) {
    logger.error(`Freesound get sound ${soundId} failed`, error)
    throw error
  }
}

export async function downloadFreesoundMedia(
  config: FreesoundServiceConfig,
  downloadUrl: string
): Promise<Blob> {
  try {
    const url = new URL(downloadUrl)
    if (!url.searchParams.has('token') && config.apiKey) {
      url.searchParams.append('token', config.apiKey)
    }

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status} ${response.statusText}`)
    }
    return await response.blob()
  } catch (error) {
    logger.error('Freesound download failed', error)
    throw error
  }
}
