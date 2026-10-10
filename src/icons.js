// The symbols on the controls. Drawn here, on a 16 x 16 grid, so that they are the same size and
// weight as each other on every machine: as characters, each phone picked its own and no two matched.
const PATHS = {
  pause: 'M3 2h4v12H3zM9 2h4v12H9z',
  play: 'M3 2l11 6-11 6z',
  ff: 'M1 2l7 6-7 6zM8 2l7 6-7 6z',
  next: 'M2 2l9 6-9 6zM11 2h3v12h-3z',
  sound: 'M1 6h3l4-4v12l-4-4H1zM10 5h2v6h-2zM13 3h2v10h-2z',
  mute: 'M1 6h3l4-4v12l-4-4H1zM10 6.4l1.4-1.4L13 6.6 14.6 5 16 6.4 14.4 8 16 9.6 14.6 11 13 9.4 11.4 11 10 9.6 11.6 8z',
  mail: 'M1 3h14v10H1zM3 5v1.7l5 3.8 5-3.8V5L8 8.8z',
  keep: 'M6 1h4v6h3l-5 5-5-5h3zM2 13h12v2H2z',
  close: 'M2 4l2-2 4 4 4-4 2 2-4 4 4 4-2 2-4-4-4 4-2-2 4-4z',
}

export const icon = (name) =>
  `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="${PATHS[name] || ''}"/></svg>`

/** fill every <i data-icon="name"> on the page */
export function drawIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon)
}
