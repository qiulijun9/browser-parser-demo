import { computeCSS, addCssRules } from './parseCss.js'
import { layout } from './layout.js'
const EOF = Symbol('EOF')
const tagNameRegex = /^[a-zA-Z]$/
const blankRegex = /^[\t\n\f\t ]$/ // 空白
const TokenType = {
  EOF: 'EOF',
  Text: 'text',
  StartTag: 'startTag',
  EndTag: 'endTag',
}

let currentToken = null
let currentAttribute = null
let currentTextNode = null
let stack = [{ type: 'document', children: [] }]

/**
 * 对标签(tag)进行解析
 * 标签分为：开始标签<div> 结束标签</div>  自封闭标签<img />
 * 文本节点直接写入
 * @param {*} c
 */

function data(c) {
  if (c === '<') {
    return tagOpen
  }
  if (c === EOF) {
    emit({ type: TokenType.EOF })
    return
  } else {
    emit({ type: TokenType.Text, content: c })
  }

  // 继续下一个字符
  return data
}

// 标签开始 eg: <div> | </div>
function tagOpen(c) {
  // 开始标签或自封闭标签
  if (c.match(tagNameRegex)) {
    currentToken = { type: TokenType.StartTag, tagName: '' }
    return tagName(c)
  }
  // 结束标签
  if (c === '/') {
    return endTagOpen
  }
}

// 标签结束
function endTagOpen(c) {
  if (c.match(tagNameRegex)) {
    currentToken = { type: TokenType.EndTag, tagName: '' }

    return tagName(c)
  }
}

function tagName(c) {
  if (c.match(tagNameRegex)) {
    currentToken.tagName += c
    return tagName
  }
  // 匹配属性
  if (c.match(blankRegex)) {
    return beforeAttributeName
  }
  // 匹配自封闭标签
  if (c === '/') {
    return selfCloseingStartTag
  }
  // 标签匹配完成
  if (c === '>') {
    emit(currentToken)
    return data
  }
}

// 自封闭标签
function selfCloseingStartTag(c) {
  if (c === '>') {
    currentToken.isSelfClosing = true
    emit(currentToken)
    return data
  }
}

/**
 * 对html 的属性处理 eg: <html lang="en"> |<html     lang="en">
 */
function beforeAttributeName(c) {
  // 遇到空白情况继续读取属性名
  if (c.match(blankRegex)) {
    return beforeAttributeName
  }

  currentAttribute = { name: '', value: '' }
  return attributeName(c)
}

// eg:lang="en"
function attributeName(c) {
  // 遇到这些字符就认为已经读完属性名了
  if (c.match(blankRegex) || c === '/' || c === '>' || c === EOF) {
    return afterQuotedAttributeValue(c)
  }
  // 读取属性值
  if (c === '=') {
    return beforeAttributeValue
  }
  currentAttribute.name += c
  return attributeName
}

// eg: "en" | 'en' | en
function beforeAttributeValue(c) {
  if (c.match(blankRegex)) {
    return beforeAttributeValue
  }
  if (c === '"' || c === "'") {
    return quotedAttributeValue
  }
  return unQuotedAttributeValue(c)
}

// 处理引号
function quotedAttributeValue(c) {
  if (c === '"' || c === "'") {
    currentToken[currentAttribute.name] = currentAttribute.value
    return afterQuotedAttributeValue
  }
  // 添加属性值
  currentAttribute.value += c
  return quotedAttributeValue
}

// 无引号
function unQuotedAttributeValue(c) {
  currentToken[currentAttribute.name] = currentAttribute.value

  if (c.match(blankRegex)) {
    return beforeAttributeName
  }

  if (c === '/') {
    return selfCloseingStartTag
  }

  if (c === '>') {
    emit(currentToken)
    return data
  }

  currentAttribute.value += c
  return unQuotedAttributeValue
}

// 属性值读取结束
function afterQuotedAttributeValue(c) {
  // 多个属性存在
  if (c.match(blankRegex)) {
    return beforeAttributeName
  }

  if (c === '/') {
    return selfCloseingStartTag
  }

  if (c === '>') {
    currentToken[currentAttribute.name] = currentAttribute.value
    emit(currentToken)
    return data
  }
}

/**
 * https://blog.poetries.top/browser-working-principle/guide/part5/lesson22.html#dom-%E6%A0%91%E5%A6%82%E4%BD%95%E7%94%9F%E6%88%90
 * 利用栈构建dom 树
 * 1. 开始标签入栈，结束标签出栈
 * 2. 自封闭标签进栈后立即出栈
 * 3. 多个文本节点需要合并,注意清空currentTextNode
 * 4. 任何元素的父元素是它入栈前的栈顶
 *
 * */
function emit(token) {
  const top = stack[stack.length - 1]
  const element = {
    type: 'element',
    children: [],
    attributes: [],
    computedStyle: {},
    tagName: token.tagName,
  }

  // 开始标签入栈
  if (token.type === TokenType.StartTag) {
    // 添加属性
    for (let p in token) {
      if (p !== 'type' && p !== 'tagName') {
        element.attributes.push({ name: p, value: token[p] })
      }
    }

    top.children.push(element)

    // 建立父子关系
    element.parent = top

    if (!token.isSelfClosing) {
      stack.push(element)
    }
    currentTextNode = null

    // 处理css
    computeCSS(element, stack)
    return
  }
  // 处理文本节点
  if (token.type === TokenType.Text) {
    if (currentTextNode === null) {
      currentTextNode = {
        type: TokenType.Text,
        content: '',
      }
      top.children.push(currentTextNode)
    }
    currentTextNode.content += token.content
    return
  }

  // 遇到结束标签出栈
  if (token.type === TokenType.EndTag) {
    if (top.tagName === 'style') {
      addCssRules(top.children[0].content)
    }

    layout(top)
    stack.pop()
    currentTextNode = null
  }
}

/**
 * @param html
 * @returns dom 树
 * 利用有限状态机来实现Html 的分析，在标准中已经规定了html 的状态
 * https://whatwg-cn.github.io/html/#next-input-character
 */
export function parseHTML(html) {
  console.log('html----', html)
  let state = data
  for (let c of html) {
    state = state(c)
  }
  state = state(EOF)

  return stack[0]
}
