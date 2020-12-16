import images from 'images'
export function render(viewport, element) {
  if (element.style) {
    console.log('element', element)
    const { width, height, left, top } = element.style
    let img = images(width, height)
    let color = element.style['background-color'] || 'rgb(0,0,0)'
    if (color) {
      color.match(/rgb\((\d+),(\d+),(\d+)\)/)
      img.fill(Number(RegExp.$1), Number(RegExp.$2), Number(RegExp.$3), 1)
      viewport.draw(img, left || 0, top || 0)
    }
  }
  if (element.children) {
    for (let child of element.children) {
      render(viewport, child)
    }
  }
}
