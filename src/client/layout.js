// 对属性进行预处理, 把px 值转换成数值
function getElementStyle(element) {
  const { computedStyle } = element
  const regExp = /px$/

  if (!element.style) {
    element.style = {}
  }

  for (let prop in element.computedStyle) {
    element.style[prop] = computedStyle[prop].value
    if (regExp.test(computedStyle[prop].value)) {
      element.style[prop] = parseInt(computedStyle[prop].value)
    }
  }

  return element.style
}
/**
 * 1. 预处理元素的属性和布局的默认值
 * 2. 收集元素入行
 * 3. 计算元素在主轴的位置
 * 4. 计算元素在交叉轴的位置
 */
export function layout(element) {
  if (!element.computedStyle) return
  const flexContainerStyle = getElementStyle(element)
  const items = element.children.filter(e => e.type === 'element')

  // 只对flex 布局下的element 做排版
  if (flexContainerStyle.display !== 'flex') {
    return
  }
  const {
    'flex-direction': flexDirection = 'row',
    'align-items': alignItems = 'stretch',
    'justify-content': justifyContent = 'flex-start',
    'flex-wrap': flexWrap = 'warp',
    'align-content': alignContent = 'stretch',
  } = flexContainerStyle

  // 主轴尺寸，开始方向，结束方向
  let mainSize,
    mainStart,
    mainEnd,
    mainSign,
    mainBase,
    crossSize,
    crossStart,
    crossEnd,
    crossSign,
    crossBase

  // 主轴为 x 轴
  if (flexDirection === 'row') {
    mainSize = 'width'
    mainStart = 'left'
    mainEnd = 'right'
    mainSign = +1 // 坐标位置
    mainBase = 0
    crossSize = 'height'
    crossStart = 'top'
    crossEnd = 'bottom'
    crossBase = 0
    crossSign = 1
  }

  /**
   * 收集元素到行内
   * 根据主轴的尺寸把元素分配进行 display:flex width :500
   * 设置了no-wrap 分配到第一行
   */
  let flexLine = [] //当前flex行
  let flexLines = [flexLine]
  // 主轴剩余空间 默认为父元素的尺寸， 是指减掉固定的元素尺寸，剩余的尺寸，有flex 的元素可根据剩余尺寸压缩
  let mainSpace = flexContainerStyle[mainSize]
  // 交叉轴剩余空间
  let crossSpace = 0

  // 收集所有的元素
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const itemStyle = getElementStyle(item)
    if (itemStyle[mainSize] === null) {
      itemStyle[mainSize] = 0
    }

    if (itemStyle.flex) {
      flexLine.push(item)
      continue
    }

    if (flexWrap === 'nowrap') {
      mainSpace -= itemStyle[mainSize]
      // 求得当前flexLine交叉轴方向的最大尺寸
      if (itemStyle[crossSize]) {
        crossSpace = Math.max(crossSpace, itemStyle[crossSize])
      }
      flexLine.push(item)
      continue
    }

    if (flexWrap === 'wrap') {
      // 换行 warp
      if (itemStyle[mainSize] > flexContainerStyle[mainSize]) {
        // 超出父元素压缩到父元素的尺寸
        itemStyle[mainSize] = flexContainerStyle[mainSize]
      }

      // 元素放不下放入新行
      if (mainSpace < itemStyle[mainSize]) {
        // 保存上一行的mainSpace，crossSpace
        flexLine.mainSpace = mainSpace
        flexLine.crossSpace = crossSpace
        flexLine = [item]
        flexLines.push(flexLine)
        // 重置mainSpace 和crossSpace
        mainSpace = flexContainerStyle[mainSize]
        crossSpace = 0
      } else {
        flexLine.push(item)
      }

      if (itemStyle[crossSize]) {
        crossSpace = Math.max(crossSpace, itemStyle[crossSize])
      }

      mainSpace -= itemStyle[mainSize]
    }
  }

  flexLine.mainSpace = mainSpace

  if (flexWrap === 'nowrap') {
    // 一行时 元素若有高 设置行高为元素的高
    flexLine.crossSpace = flexContainerStyle[crossSize] || crossSpace
  } else {
    flexLine.crossSpace = crossSpace
  }

  // 计算元素在主轴上的位置
  computedMainPosition(
    mainSize,
    mainStart,
    mainEnd,
    mainSpace,
    mainBase,
    mainSign,
    flexContainerStyle,
    justifyContent,
    items,
    flexLines,
  )

  //  计算元素在交叉轴上的位置
  computedCrossPosition(
    crossSize,
    crossStart,
    crossEnd,
    crossBase,
    crossSign,
    flexContainerStyle,
    alignContent,
    alignItems,
    flexLines,
  )
}

function computedMainPosition(
  mainSize,
  mainStart,
  mainEnd,
  mainSpace,
  mainBase,
  mainSign,
  style,
  justifyContent,
  items,
  flexLines,
) {
  // 单行的情况下，mainSpace<0,为了能放下元素，需要对元素进行等比压缩，如果存在flex 属性，则width =0, flex 元素则为0
  // 压缩比例 = 主轴的尺寸 / 实际能放下元素的尺寸  500 / 630
  if (mainSpace < 0) {
    const scale = style[mainSize] / (style[mainSize] - mainSpace)
    let currentMainStart = 0
    for (let i = 0; i < items.length; i++) {
      let itemStyle = getElementStyle(items[i])

      if (itemStyle.flex) {
        itemStyle[mainSize] = 0
      }

      itemStyle[mainSize] = Math.floor(itemStyle[mainSize] * scale)
      itemStyle[mainStart] = currentMainStart
      itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize]
      currentMainStart = itemStyle[mainEnd]
    }

    return
  }

  // 多行的处理 ,每一行都根据剩余空间和总的flex值来对各个flex或非flex元素瓜分剩余空间
  flexLines.forEach(flexLine => {
    let mainSpace = flexLine.mainSpace
    let flexTotal = 0

    for (let i = 0; i < flexLine.length; i++) {
      const itemStyle = getElementStyle(flexLine[i])

      if (itemStyle.flex) {
        flexTotal += parseInt(itemStyle.flex)
      }
    }

    // 在该行计算 元素有flex 属性的位置和大小
    if (flexTotal > 0) {
      let currentMainStart = mainBase
      for (let i = 0; i < flexLine.length; i++) {
        const itemStyle = getElementStyle(flexLine[i])

        if (itemStyle.flex) {
          itemStyle[mainSize] = (mainSpace / flexTotal) * itemStyle.flex
        }
        itemStyle[mainStart] = currentMainStart
        itemStyle[mainEnd] =
          itemStyle[mainStart] + mainSign * itemStyle[mainSize]
        currentMainStart = itemStyle[mainEnd]
      }
    } else {
      // 元素没有flex 值，还有剩余空间时 会根据 justifyContent 来确定该位置 ,currentMainStart 元素开始的位置 step 元素列的间隙
      let currentMainStart, step

      switch (justifyContent) {
        case 'flex-start':
        case 'stretch':
          currentMainStart = mainBase
          step = 0
          break

        case 'flex-end':
          currentMainStart = mainSpace * mainSign + mainBase
          step = 0
          break

        case 'center':
          currentMainStart = (mainSpace / 2) * mainSign + mainBase
          step = 0
          break

        case 'space-between':
          // space-between 的左右无空隙
          currentMainStart = mainBase
          step = (mainSpace / (flexLine.length - 1)) * mainSign
          break

        case 'space-around':
          // 左右空隙为 空隙的一半
          step = mainSpace / flexLine.length
          currentMainStart = step / 2 + mainBase
          break

        default:
          currentMainStart = 0
          step = 0
      }

      flexLine.forEach(item => {
        let itemStyle = getElementStyle(item)
        itemStyle[mainStart] = currentMainStart
        itemStyle[mainEnd] =
          itemStyle[mainStart] + mainSign * itemStyle[mainSize]
        currentMainStart = itemStyle[mainEnd] + step
      })
    }
  })
}

function computedCrossPosition(
  crossSize,
  crossStart,
  crossEnd,
  crossBase,
  crossSign,
  style,
  alignContent,
  alignItems,
  flexLines,
) {
  let currentCrossSpace
  //  计算交叉轴剩余的空间: 没有交叉轴大小时,crossSpace = 各个行 crossSpace之和
  if (!style[crossSize]) {
    currentCrossSpace = 0
    style[crossSize] = 0
    for (let i = 0; i < flexLines.length; i++) {
      style[crossSize] += flexLines[i].crossSpace
    }
  } else {
    currentCrossSpace = style[crossSize]
    for (let i = 0; i < flexLines.length; i++) {
      currentCrossSpace -= flexLines[i].crossSpace
    }
  }

  /**
   * 根据容器属性 获取元素在交叉轴上的排列位置
   * alignContent 所有行在交叉轴上的排列
   */

  let step = 0 // 行间距
  switch (alignContent) {
    case 'flex-start':
    case 'stretch':
      // top:0
      crossBase = 0
      break
    case 'flex-end':
      // top: crossSpace 剩余空间的高度
      crossBase += crossSign * currentCrossSpace
      break
    // top: crossSpace / 2 剩余空间的一半
    case 'center':
      crossBase += crossSign * (currentCrossSpace / 2)
      break
    case 'space-between':
      // top:0  step : crossSpace / 行数-1
      crossBase = 0
      step = currentCrossSpace / (flexLines.length - 1)
      break
    default:
      step = 0
      crossBase = 0
  }

  flexLines.forEach(flexLine => {
    let lineCrossSize =
      alignContent === 'stretch'
        ? flexLine.crossSpace + currentCrossSpace / flexLines.length
        : flexLine.crossSpace

    for (let i = 0; i < flexLine.length; i++) {
      const itemStyle = flexLine[i].style

      if (!itemStyle[crossSize]) {
        itemStyle[crossSize] = alignContent === 'stretch' ? lineCrossSize : 0
      }

      // alignItems 元素相对于该行的排列
      switch (alignItems) {
        case 'flex-start':
        case 'stretch':
          itemStyle[crossStart] = crossBase
          itemStyle[crossEnd] =
            itemStyle[crossStart] + crossSign * itemStyle[crossSize]
          break
        case 'flex-end':
          itemStyle[crossStart] =
            crossBase + lineCrossSize - itemStyle[crossSize]
          itemStyle[crossEnd] =
            itemStyle[crossStart] - crossSign * itemStyle[crossSize]
          break
        case 'center':
          itemStyle[crossStart] =
            crossBase + (crossSign * (lineCrossSize - itemStyle[crossSize])) / 2
          itemStyle[crossEnd] =
            itemStyle[crossStart] + crossSign * itemStyle[crossSize]
      }
    }

    crossBase += crossSign * (lineCrossSize + step)
  })
}
