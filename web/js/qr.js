// @ts-check
/**
 * A QR code as an SVG element: one path of the dark modules, so that it scales sharp to any size.
 * The code itself is qrcode-generator's (pinned in the import map of index.html).
 */
import qrcode from 'qrcode-generator';

const SVG = 'http://www.w3.org/2000/svg';

/** The blank border the scanners ask for, in modules. */
const QUIET = 4;

/**
 * @param {string} text what the code holds
 * @returns {SVGSVGElement} dark on a light ground whatever the theme: a scanner needs the contrast
 */
export function qrSvg(text) {
  // the smallest version that holds the text, with 15% of it recoverable
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++)
      if (qr.isDark(row, col))
        d += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
  const size = n + 2 * QUIET;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'QR code of the invitation');
  const ground = document.createElementNS(SVG, 'rect');
  ground.setAttribute('width', String(size));
  ground.setAttribute('height', String(size));
  ground.setAttribute('fill', '#fff');
  const modules = document.createElementNS(SVG, 'path');
  modules.setAttribute('d', d);
  modules.setAttribute('fill', '#000');
  svg.append(ground, modules);
  return svg;
}
