import path from 'path'

/**
 * Resolve a path and verify it is within the allowed base directory.
 * Prevents path traversal attacks (e.g., ../../../etc/passwd).
 */
export function assertPathInsideBase(filePath: string, baseDir: string): string {
  const resolved = path.resolve(filePath)
  const base = path.resolve(baseDir)
  if (!(resolved === base || resolved.startsWith(base + path.sep))) {
    throw new Error('Path traversal detected')
  }
  return resolved
}

/**
 * Validate that a project name contains only safe characters.
 * Rejects names with path separators or ".." sequences.
 */
export function assertSafeProjectName(name: string): string {
  if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error('Invalid project name')
  }
  return name
}

/**
 * Validate that a MAS name is safe for use as a directory name.
 * Allows Unicode letters (including CJK), digits, dashes, underscores, and spaces.
 * Rejects path separators and ".." sequences.
 */
export function assertSafeMasName(name: string): string {
  if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error('MAS name contains invalid characters')
  }
  return name
}

/**
 * Validate that a workdir parameter is provided and is an absolute path.
 */
export function assertValidWorkdir(workdir: string | undefined): string {
  if (!workdir) throw new Error('Missing workdir parameter')
  if (!path.isAbsolute(workdir)) throw new Error('workdir must be an absolute path')
  return workdir
}
