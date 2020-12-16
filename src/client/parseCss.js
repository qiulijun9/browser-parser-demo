import css from 'css'
const cssRules = []

/**
 * [inline,id,class,tagName]
 * 优先级是由 A 、B、C、D 的值来决定的，其中它们的值计算规则如下：
 * 如果存在内联样式，那么 A = 1, 否则 A = 0; 内联样式目前不在css dom 树上
 * B: id 选择器出现的次数
 * C: class 选择器出现的次数
 * D: 标签选择器出现的次数
 * 比较规则是: 从左往右依次进行比较 ，返回较大的值，如果相等，则继续往右移动一位进行比较 ，如果4位全部相等，则后面的会覆盖前面的
 *
 */

// 计算优先级
function computeSpecificity(selector) {
  const sp = [0, 0, 0, 0]
  const selectorParts = selector.split(' ')

  for (let parts of selectorParts) {
    if (parts.charAt(0) === '#') {
      sp[1] += 1
    } else if (parts.charAt(0) === '.') {
      sp[2] += 1
    } else {
      sp[3] += 1
    }
  }
  return sp
}

// 比较选择器 从左往右依次比较
function compareSpecificity(sp1, sp2) {
  for (let i = 0; i < sp1.length; i++) {
    if (sp1[i] !== sp2[i]) {
      return sp1[i] - sp2[i]
    }
  }
}

// 仅对 class,id，tagName 选择器做匹配
function matchSelector(element, selector) {
  // 是文本节点，不用做处理
  if (!selector || !element.attributes) {
    return false
  }
  const attrClass = element.attributes.find(attr => attr.name === 'class')
  const attrId = element.attributes.find(attr => attr.name === 'id')
  const selectorType = selector.charAt(0)

  if (selectorType === '#' && attrId?.value === selector.replace('#', '')) {
    return true
  }

  if (selectorType === '.' && attrClass?.value === selector.replace('.', '')) {
    return true
  }

  if (element.tagName === selector) {
    return true
  }

  return false
}

export function computeCSS(element, stack) {
  // 获取所有的元素（父元素），元素是从当前元素开始向外匹配父元素
  const elements = stack.slice().reverse()
  for (let cssRule of cssRules) {
    // 由里向外匹配css 规则  eg.['#myid','img','div','body']
    const selectorParts = cssRule.selectors[0].split(' ').reverse()

    // 匹配当前的元素
    if (!matchSelector(element, selectorParts[0])) {
      continue
    }

    // 匹配元素的父元素
    let j = 1
    for (let i = 0; i < elements.length; i++) {
      // 当前dom 元素的属性和当前的css 是否匹配
      if (matchSelector(elements[i], selectorParts[j])) {
        j++
      }
    }

    // css规则和元素匹配完成
    if (j >= selectorParts.length) {
      // 计算css 的优先级
      const specificity = computeSpecificity(cssRule.selectors[0])

      for (let declaration of cssRule.declarations) {
        setComputedStyleDeclaration(element, declaration, specificity)
      }
    }
  }

  function setComputedStyleDeclaration(
    { computedStyle },
    declaration,
    specificity,
  ) {
    if (!computedStyle[declaration.property]) {
      computedStyle[declaration.property] = {}
    }

    if (!computedStyle[declaration.property].specificity) {
      computedStyle[declaration.property].specificity = specificity
      computedStyle[declaration.property].value = declaration.value
    }

    // 优先级高的覆盖之前的css
    if (
      compareSpecificity(
        computedStyle[declaration.property].specificity,
        specificity,
      ) < 0
    ) {
      computedStyle[declaration.property].specificity = specificity
      computedStyle[declaration.property].value = declaration.value
    }
  }
}

export function addCssRules(text) {
  const cssAst = css.parse(text)
  cssRules.push(...cssAst.stylesheet.rules)
  console.log('cssrules', cssRules)
}
