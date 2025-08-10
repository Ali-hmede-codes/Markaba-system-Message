// Centralized media type configuration
// This file contains all supported file extensions and MIME types

export const SUPPORTED_EXTENSIONS = {
  // Image formats
  images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'],
  
  // Video formats
  videos: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', '3gp'],
  
  // Audio formats
  audio: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma'],
  
  // Document formats
  documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'],
  
  // Archive formats
  archives: ['zip', 'rar', '7z']
};

// Get all supported extensions as a single array
export const getAllSupportedExtensions = (): string[] => {
  return [
    ...SUPPORTED_EXTENSIONS.images,
    ...SUPPORTED_EXTENSIONS.videos,
    ...SUPPORTED_EXTENSIONS.audio,
    ...SUPPORTED_EXTENSIONS.documents,
    ...SUPPORTED_EXTENSIONS.archives
  ];
};

// Create regex pattern for file validation
export const createFileValidationRegex = (): RegExp => {
  const allExtensions = getAllSupportedExtensions();
  return new RegExp(allExtensions.join('|'), 'i');
};

// Get HTML accept attribute string
export const getHtmlAcceptString = (): string => {
  const allExtensions = getAllSupportedExtensions();
  return allExtensions.map(ext => `.${ext}`).join(',');
};

// MIME type mappings for better file handling
export const MIME_TYPE_MAPPINGS = {
  // Video MIME types
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/mp4': 'mp4',
  'video/x-ms-wmv': 'wmv',
  'video/x-flv': 'flv',
  'video/x-matroska': 'mkv',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
  
  // Audio MIME types
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/mp4': 'm4a',
  'audio/x-ms-wma': 'wma',
  
  // Image MIME types
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/svg+xml': 'svg'
};

// Get file extension from MIME type
export const getExtensionFromMimeType = (mimeType: string): string => {
  return MIME_TYPE_MAPPINGS[mimeType as keyof typeof MIME_TYPE_MAPPINGS] || 'unknown';
};

// Check if file type is supported
export const isFileTypeSupported = (filename: string, mimeType?: string): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension) return false;
  
  const allExtensions = getAllSupportedExtensions();
  return allExtensions.includes(extension);
};

// Get default filename for media type
export const getDefaultFilename = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) {
    const ext = getExtensionFromMimeType(mimeType);
    return `image.${ext !== 'unknown' ? ext : 'jpg'}`;
  } else if (mimeType.startsWith('video/')) {
    const ext = getExtensionFromMimeType(mimeType);
    return `video.${ext !== 'unknown' ? ext : 'mp4'}`;
  } else if (mimeType.startsWith('audio/')) {
    const ext = getExtensionFromMimeType(mimeType);
    return `audio.${ext !== 'unknown' ? ext : 'mp3'}`;
  } else {
    return 'document';
  }
};