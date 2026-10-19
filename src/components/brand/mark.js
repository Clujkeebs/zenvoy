/* Hand-built proof mark.
 * A page with two measured lines and a vermilion seal.
 * The same paths are copied into public/favicon.svg and public/brand/.
 * Dark tile reads on paper. Paper tile reads on the near-black app.
 */

export const MARK = {
  darkTile: '#12110e',
  paper: '#f3ecdf',
  fold: '#e4d8c4',
  seal: '#e23d28',
  check: '#fffaf3',
  ink: '#12110e',
}

export function markColors(variant) {
  if (variant === 'on-dark') {
    return {
      tile: MARK.paper,
      page: MARK.darkTile,
      fold: '#2c2822',
      line: MARK.paper,
      seal: MARK.seal,
      check: MARK.check,
    }
  }
  return {
    tile: MARK.darkTile,
    page: MARK.paper,
    fold: MARK.fold,
    line: MARK.ink,
    seal: MARK.seal,
    check: MARK.check,
  }
}
