import type { AxiosRequestConfig } from 'axios';
import type { WAMediaUploadFunction, WAUrlInfo } from '@whiskeysockets/baileys';
import { prepareWAMessageMedia } from '@whiskeysockets/baileys';

const THUMBNAIL_WIDTH_PX = 192;

/** Fetches an image and generates a thumbnail for it */
const getCompressedJpegThumbnail = async (url: string, { thumbnailWidth, fetchOpts }: URLGenerationOptions) => {
  // For now, we'll skip thumbnail generation to keep it simple
  // This can be enhanced later with proper image processing
  return { buffer: undefined };
};

export type URLGenerationOptions = {
  thumbnailWidth: number;
  fetchOpts: {
    /** Timeout in ms */
    timeout: number;
    proxyUrl?: string;
    headers?: AxiosRequestConfig<{}>['headers'];
  };
  uploadImage?: WAMediaUploadFunction;
  logger?: any;
};

/**
 * Given a piece of text, checks for any URL present, generates link preview for the same and returns it
 * Return undefined if the fetch failed or no URL was found
 * @param text first matched URL in text
 * @returns the URL info required to generate link preview
 */
export const getUrlInfo = async (
  text: string,
  opts: URLGenerationOptions = {
    thumbnailWidth: THUMBNAIL_WIDTH_PX,
    fetchOpts: { timeout: 3000 }
  }
): Promise<WAUrlInfo | undefined> => {
  try {
    // Check if text contains a URL
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = text.match(urlRegex);
    
    if (!urls || urls.length === 0) {
      return undefined;
    }

    // Use the first URL found
    const firstUrl = urls[0];
    
    // retries
    let retries = 0;
    const maxRetry = 5;

    const { getLinkPreview } = await import('link-preview-js');
    let previewLink = firstUrl;
    if (!firstUrl.startsWith('https://') && !firstUrl.startsWith('http://')) {
      previewLink = 'https://' + previewLink;
    }

    const info = await getLinkPreview(previewLink, {
      ...opts.fetchOpts,
      followRedirects: 'follow',
      handleRedirects: (baseURL: string, forwardedURL: string) => {
        const urlObj = new URL(baseURL);
        const forwardedURLObj = new URL(forwardedURL);
        if (retries >= maxRetry) {
          return false;
        }

        if (
          forwardedURLObj.hostname === urlObj.hostname ||
          forwardedURLObj.hostname === 'www.' + urlObj.hostname ||
          'www.' + forwardedURLObj.hostname === urlObj.hostname
        ) {
          retries = retries + 1;
          return true;
        } else {
          return false;
        }
      },
      headers: opts.fetchOpts.headers as {}
    });
    
    if (info && 'title' in info && info.title) {
      const [image] = info.images || [];

      const urlInfo: WAUrlInfo = {
        'canonical-url': info.url,
        'matched-text': firstUrl,
        title: info.title,
        description: info.description,
        originalThumbnailUrl: image
      };

      if (opts.uploadImage && image) {
        try {
          const { imageMessage } = await prepareWAMessageMedia(
            { image: { url: image } },
            {
              upload: opts.uploadImage,
              mediaTypeOverride: 'thumbnail-link',
              options: opts.fetchOpts
            }
          );
          urlInfo.jpegThumbnail = imageMessage?.jpegThumbnail ? Buffer.from(imageMessage.jpegThumbnail) : undefined;
          urlInfo.highQualityThumbnail = imageMessage || undefined;
        } catch (error: any) {
          opts.logger?.debug({ err: error.stack, url: previewLink }, 'error in preparing media for link preview');
        }
      } else if (image) {
        try {
          urlInfo.jpegThumbnail = (await getCompressedJpegThumbnail(image, opts)).buffer;
        } catch (error: any) {
          opts.logger?.debug({ err: error.stack, url: previewLink }, 'error in generating thumbnail');
        }
      }

      return urlInfo;
    }
  } catch (error: any) {
    if (!error.message.includes('receive a valid')) {
      console.error('Error generating link preview:', error.message);
    }
    return undefined;
  }
};

/**
 * Detects if a message contains URLs
 * @param text The message text to check
 * @returns true if URLs are found, false otherwise
 */
export const containsUrl = (text: string): boolean => {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  return urlRegex.test(text);
};

/**
 * Detects if a message contains markaba.news URLs specifically
 * @param text The message text to check
 * @returns true if markaba.news URLs are found, false otherwise
 */
export const containsMarkabaUrl = (text: string): boolean => {
  const markabaRegex = /https:\/\/www\.markaba\.news[^\s]*/gi;
  return markabaRegex.test(text);
};