# Supported File Types

This document lists all supported file extensions for media uploads in the WhatsApp Message Send System.

## 📸 Image Formats
- **JPEG**: `.jpg`, `.jpeg`
- **PNG**: `.png`
- **GIF**: `.gif`
- **WebP**: `.webp`
- **Bitmap**: `.bmp`
- **TIFF**: `.tiff`
- **SVG**: `.svg`

## 🎥 Video Formats
- **MP4**: `.mp4`
- **AVI**: `.avi`
- **MOV**: `.mov` (QuickTime)
- **WMV**: `.wmv` (Windows Media Video)
- **FLV**: `.flv` (Flash Video)
- **MKV**: `.mkv` (Matroska)
- **WebM**: `.webm`
- **M4V**: `.m4v`
- **3GP**: `.3gp`

## 🎵 Audio Formats
- **MP3**: `.mp3`
- **WAV**: `.wav`
- **AAC**: `.aac`
- **OGG**: `.ogg`
- **FLAC**: `.flac`
- **M4A**: `.m4a`
- **WMA**: `.wma`

## 📄 Document Formats
- **PDF**: `.pdf`
- **Microsoft Word**: `.doc`, `.docx`
- **Text**: `.txt`
- **Rich Text**: `.rtf`
- **OpenDocument Text**: `.odt`
- **Microsoft Excel**: `.xls`, `.xlsx`
- **Microsoft PowerPoint**: `.ppt`, `.pptx`

## 🗜️ Archive Formats
- **ZIP**: `.zip`
- **RAR**: `.rar`
- **7-Zip**: `.7z`

## File Size Limits
- **Maximum file size**: 50MB per file
- **Recommended size**: Under 25MB for better performance

## Notes
- All file extensions are case-insensitive
- The system validates both file extension and MIME type for security
- Video files like `.MOV` are fully supported and will be handled appropriately
- Files are automatically categorized based on their type for optimal WhatsApp delivery

## Configuration
File type support is centrally managed in `/src/backend/config/mediaTypes.ts` for easy maintenance and updates.