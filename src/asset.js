/* global __STAMP__ */
// The address of a file in public/, with a stamp of its folder's contents on the end (see vite.config.js),
// so that a browser holding an old copy does not use it with new code.
//
// Callers name the file as it sits in public/ ('/models/set.glb'). The address handed back starts from
// wherever the site has been put: './' in a build, so the same build works at a domain root or under a
// sub-path such as GitHub Pages' /<repo>/, and '/' on the dev server.
const STAMP = typeof __STAMP__ === 'undefined' ? {} : __STAMP__
const BASE = import.meta.env.BASE_URL

export function asset(path) {
  const v = STAMP[path.split('/')[1]]
  const url = BASE + path.replace(/^\//, '')
  return v ? `${url}?v=${v}` : url
}
