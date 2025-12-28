/**
 * Utility functions for sanitizing and validating filenames
 */

/**
 * Sanitize a filename to prevent security issues
 * - Removes dangerous characters
 * - Prevents path traversal
 * - Prevents double extensions
 * - Limits length
 * - Preserves extension
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'cv.pdf';
  }

  // Remove path components (prevent path traversal)
  let sanitized = filename
    .split(/[/\\]/)
    .pop() || 'cv.pdf'; // Get only the filename part

  // Remove null bytes and other dangerous characters
  sanitized = sanitized
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[<>:"|?*\x00-\x1F]/g, '') // Remove dangerous chars
    .trim();

  // Extract extension
  const lastDot = sanitized.lastIndexOf('.');
  let name = sanitized;
  let ext = '';

  if (lastDot > 0 && lastDot < sanitized.length - 1) {
    name = sanitized.substring(0, lastDot);
    ext = sanitized.substring(lastDot);
    
    // Prevent double extensions (e.g., .pdf.exe)
    const extLower = ext.toLowerCase();
    const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js'];
    if (dangerousExts.some(dangerous => extLower.endsWith(dangerous))) {
      // If the extension is dangerous, remove it and keep only safe extension
      const safeExtMatch = name.match(/\.(pdf|doc|docx)$/i);
      if (safeExtMatch) {
        ext = safeExtMatch[0];
        name = name.substring(0, name.lastIndexOf('.'));
      } else {
        ext = '.pdf'; // Default safe extension
      }
    }
  }

  // Clean the name part (keep alphanumeric, spaces, dots, hyphens, underscores)
  name = name.replace(/[^a-zA-Z0-9\s._-]/g, '').trim();

  // Limit total length (name + extension, max 100 chars)
  const maxLength = 100;
  if (name.length + ext.length > maxLength) {
    name = name.substring(0, maxLength - ext.length);
  }

  // Ensure we have something
  if (!name) {
    name = 'cv';
  }

  // Ensure we have an extension
  if (!ext) {
    ext = '.pdf';
  }

  return name + ext;
}

/**
 * Extract file extension from filename or mime type
 */
export function getFileExtension(filename: string, mimeType?: string): string {
  // Try from filename first
  const match = filename.match(/\.([^.]+)$/);
  if (match) {
    const ext = match[1].toLowerCase();
    // Map common extensions
    if (['pdf'].includes(ext)) return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'docx';
  }

  // Fallback to mime type
  if (mimeType) {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'application/msword') return 'doc';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  }

  return 'pdf'; // Default
}

/**
 * Generate a safe fallback filename based on mime type
 */
export function generateFallbackFilename(mimeType?: string): string {
  const ext = getFileExtension('', mimeType);
  return `cv.${ext}`;
}

