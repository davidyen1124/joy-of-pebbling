/* global __STAMP__ */
// The address of a file in public/, with a stamp of its folder's contents on the end (see vite.config.js),
// so that a browser holding an old copy does not use it with new code.
const STAMP = typeof __STAMP__ === 'undefined' ? {} : __STAMP__

export function asset(path) {
  const v = STAMP[path.split('/')[1]]
  return v ? `${path}?v=${v}` : path
}
