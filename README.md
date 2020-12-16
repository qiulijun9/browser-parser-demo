# 浏览进程渲染过程

1. url(http) ---> html

2. html ---> dom

3. dom ---> with css dom

4. with css dom ---> dom width position

5. dom ---> 渲染

## 从 http 获取 html

1. 模拟自定义 Request 类,通过 net 建立 tcp 连接，向服务端发出请求。send()
2. 通过 ResponseParser 解析,并返回
   解析 headers, tostring()
   解析 body:设置'Transfer-Encoding' 为 'chunked'的响应形式
   格式为：chunk 长度+ \r\n + 内容

## html 解析成 dom

1. ParseHTML
   对接收的 html 进行词法分析，解析成 Token
   把解析好的 Token 通过栈的方式来解析成 dom 树

   dom 解析格式:

```
{
    type: 'element',
    tagName:'div',
    attributes: [{ name: 'id', value: 'container' } ],
    children:[
        {
            type:'element',
            tagName:'p',
            attributes:[],
            children:[]
        }
    ]
}

```

## dom 添加 css

给所有的元素添加匹配的 css 规则

1. 由于 dom 树和 css 规则都是从内向外匹配的，所以需要对获取的 element 和 cssRule 数组进行反转
2. 在分别匹配当前元素和父元素的 css 规则
3. 同时要计算 css 的优先级（Specificity）确保匹配到正确的规则
4. 给 dom 树添加 computedStyle

css parse 解析出的 cssrules:

```
[
  {
    type: 'rule',
    selectors: [ 'body div img #myimg' ],
    declarations: [ {
        type: 'declaration',
        property: 'height',
        value: '100px',
        position: Position {
        start: { line: 33, column: 21 },
        end: { line: 33, column: 33 },
        source: undefined }
        }],
    position: Position { start: [Object], end: [Object], source: undefined }
  },
  {
    type: 'rule',
    selectors: [ 'body div img' ],
    declarations: [ [Object], [Object] ],
    position: Position { start: [Object], end: [Object], source: undefined }
  },
]

```

dom with css:

```
{
    type: 'element',
    tagName:'div',
    attributes: [{ name: 'id', value: 'container' } ],
    computedStyle: {
        width: { specificity: [ 0, 1, 0, 0 ], value: '500px' },
        display: { specificity: [ 0, 1, 0, 0 ], value: 'flex' },
        'background-color': { specificity: [ 0, 1, 0, 0 ], value: '#fff' }
    }
    children:[
        {
            type:'element',
            tagName:'p',
            attributes:[],
            computedStyle:{},
            children:[]
        }
    ]
}

```

## 生成布局树,计算元素在位图上的位置，并添加到 dom 上

1. 对元素的属性进行预处理,即添加默认的布局属性
2. 把元素收入行内
3. 计算主轴的位置 (这里计算的是 width,left,right)
4. 计算交叉轴的位置（这里计算的是 height,top,bottom）

dom width position:

```
{
    type: 'element',
    children: [],
    attributes: [{ name: 'id', value: 'container' } ],
    computedStyle: { flex: 1, 'background-color': '#fff' },
    tagName: 'div',
    parent: {
      type: 'element',
      children: [],
      attributes: [ ],
      computedStyle: [],
      tagName: 'div',
      parent: [],
      style: []
    },
    style: {
      flex: '1',
     'background-color': 'blue',
      width: 270,
      left: 230,
      right: 500,
      height: 300,
      top: 0,
      bottom: 300
    }
  }
```

## 根据元素的位置信息绘制图像

借助 Image 库，传入位置信息（目前只绘制了 background-color）

# start

1. 运行 server
   在项目下 node index
2. 运行 client
   cd src/client  
    node index
