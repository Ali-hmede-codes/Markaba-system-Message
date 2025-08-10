"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultFilename = exports.isFileTypeSupported = exports.getExtensionFromMimeType = exports.MIME_TYPE_MAPPINGS = exports.getHtmlAcceptString = exports.createFileValidationRegex = exports.getAllSupportedExtensions = exports.SUPPORTED_EXTENSIONS = void 0;
exports.SUPPORTED_EXTENSIONS = {
    images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'],
    videos: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', '3gp'],
    audio: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma'],
    documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'],
    archives: ['zip', 'rar', '7z']
};
const getAllSupportedExtensions = () => {
    return [
        ...exports.SUPPORTED_EXTENSIONS.images,
        ...exports.SUPPORTED_EXTENSIONS.videos,
        ...exports.SUPPORTED_EXTENSIONS.audio,
        ...exports.SUPPORTED_EXTENSIONS.documents,
        ...exports.SUPPORTED_EXTENSIONS.archives
    ];
};
exports.getAllSupportedExtensions = getAllSupportedExtensions;
const createFileValidationRegex = () => {
    const allExtensions = (0, exports.getAllSupportedExtensions)();
    return new RegExp(allExtensions.join('|'), 'i');
};
exports.createFileValidationRegex = createFileValidationRegex;
const getHtmlAcceptString = () => {
    const allExtensions = (0, exports.getAllSupportedExtensions)();
    return allExtensions.map(ext => `.${ext}`).join(',');
};
exports.getHtmlAcceptString = getHtmlAcceptString;
exports.MIME_TYPE_MAPPINGS = {
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/mp4': 'mp4',
    'video/x-ms-wmv': 'wmv',
    'video/x-flv': 'flv',
    'video/x-matroska': 'mkv',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/mp4': 'm4a',
    'audio/x-ms-wma': 'wma',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/svg+xml': 'svg'
};
const getExtensionFromMimeType = (mimeType) => {
    return exports.MIME_TYPE_MAPPINGS[mimeType] || 'unknown';
};
exports.getExtensionFromMimeType = getExtensionFromMimeType;
const isFileTypeSupported = (filename, mimeType) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension)
        return false;
    const allExtensions = (0, exports.getAllSupportedExtensions)();
    return allExtensions.includes(extension);
};
exports.isFileTypeSupported = isFileTypeSupported;
const getDefaultFilename = (mimeType) => {
    if (mimeType.startsWith('image/')) {
        const ext = (0, exports.getExtensionFromMimeType)(mimeType);
        return `image.${ext !== 'unknown' ? ext : 'jpg'}`;
    }
    else if (mimeType.startsWith('video/')) {
        const ext = (0, exports.getExtensionFromMimeType)(mimeType);
        return `video.${ext !== 'unknown' ? ext : 'mp4'}`;
    }
    else if (mimeType.startsWith('audio/')) {
        const ext = (0, exports.getExtensionFromMimeType)(mimeType);
        return `audio.${ext !== 'unknown' ? ext : 'mp3'}`;
    }
    else {
        return 'document';
    }
};
exports.getDefaultFilename = getDefaultFilename;
