// Превращает SVG-строки в текстуры Phaser с нужной плотностью пикселей.

function scaledSVG(svg, scale) {
  return svg.replace(/<svg([^>]*?)width="([\d.]+)"([^>]*?)height="([\d.]+)"/, (m, a, w, b, h) =>
    `<svg${a}width="${Math.ceil(+w * scale)}"${b}height="${Math.ceil(+h * scale)}"`);
}

export function svgToImage(svg, scale = 2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG decode failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(scaledSVG(svg, scale));
  });
}

// Добавляет текстуру; если такая уже есть — заменяет.
export async function addSVGTexture(scene, key, svg, scale = 2) {
  const img = await svgToImage(svg, scale);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addImage(key, img);
  return key;
}
