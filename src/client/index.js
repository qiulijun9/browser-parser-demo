// 引入net 模块建立tcp 连接
import net from 'net'
import images from 'images'
import { parseHTML } from './parser.js'
import { render } from './render.js'
/**
 * http 请求
 * 1.定义一个Request 类
 * 2.接收options 中的参数，根据不同的header 返回不同的body（body格式 key:value），但是header 必须存在
 * 只处理POST 和 GET 两种方式 ,application/json  json / application/x-www-form-urlencoded (key:value）
 * 3. send 方法返回解析内容
 * 返回一个promise，从ResponseParser 中获取信息，并返回
 *
 */

class Request {
  constructor(options) {
    this.method = options.method || 'GET'
    this.port = options.port || '80'
    this.host = options.host
    this.path = options.path || '/'
    this.body = options.body || {}
    this.headers = options.headers || {}

    //  根据Content-Type 处理不同的 bodyText，必须要有一个'Content-Type'
    if (!this.headers['Content-Type']) {
      this.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }

    if (this.headers['Content-Type'] === 'application/json') {
      this.bodyText = JSON.stringify(this.body)
    }

    if (this.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      this.bodyText = Object.keys(this.body)
        .map(key => `${key}=${encodeURIComponent(this.body[key])}`)
        .join('&')
    }

    this.headers['Content-Length'] = this.bodyText.length
  }

  send(connection) {
    return new Promise((resolve, reject) => {
      const parser = new ResponseParser()
      if (connection) {
        // 有tcp链接使用,发送数据
        connection.write(this.toString())
      } else {
        // 创建新的tcp链接
        connection = net.createConnection(
          {
            host: this.host,
            port: this.port,
          },
          () => {
            connection.write(this.toString())
          },
        )
      }
      connection.on('connect', function () {
        console.log('建立连接')
      })

      // 监听data
      connection.on('data', data => {
        parser.receive(data.toString())

        if (parser.isFinished) {
          // console.log("response",parser.response)
          resolve(parser.response)
          connection.end()
        }
      })
      connection.on('error', err => {
        console.log(err)
        reject(err)
        connection.end()
      })
    })
  }

  /**
   * 处理http 请求文本
   * 1.header 每行通过\r\n分隔
   * 2.最后要有空行代表header 结束, \r\r\n
   *
   */

  toString() {
    return `${this.method} ${this.path} HTTP/1.1\r
${Object.keys(this.headers)
  .map(key => `${key}: ${this.headers[key]}`)
  .join('\r\n')}\r
\r
${this.bodyText}`
  }
}

/**
 * 根据逐步接受resonse 文本进行分析 http response
 * 
  eg:
   POST / HTTP/1.1  http版本号，http 状态码
   heders:
   x-hello: world
   Content-Length: 10
   Content-Type: application/x-www-form-urlencoded
   Connection:keep-alive
   Transfer-Encoding:chunked
   date:Mon,23 Dec 2020
 ...
   

 WAITING_STATUS_LINE--->WAITING_STATUS_LINE_END--->WAITING_HEADER_NAME--->WAITING_HEADER_SPACE---> WAITING_HEADER_VALUE--->WAITING_HEADER_LINE_END --->WAITING_HEADER_BLOCK_END--->WAITING_BODY
 *
 */
class ResponseParser {
  constructor() {
    //定义状态机
    this.current = this.WAITING_STATUS_LINE
    this.statusLine = ''
    this.headers = {}
    this.headerName = ''
    this.headerValue = ''
    this.bodyParse = null
  }

  get isFinished() {
    return this.bodyParser.isFinished
  }

  get response() {
    // HTTP/1.1 200 OK RegExp.$1 200  RegExp.$2 OK
    this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/)

    return {
      StatusCode: RegExp.$1,
      StatusText: RegExp.$2,
      headers: this.headers,
      body: this.bodyParser.content.join(''), // 连接字符
    }
  }

  receive(str) {
    for (let i = 0; i < str.length; i++) {
      this.receiveChar(str[i])
    }
  }

  WAITING_STATUS_LINE(c) {
    // HTTP/1.1 200 OK
    if (c === '\r') {
      return this.WAITING_HEADER_LINE_END
    }
    this.statusLine += c
    return this.WAITING_STATUS_LINE
  }

  WAITING_HEADER_LINE_END(c) {
    if (c === '\n') {
      return this.WAITING_HEADER_NAME
    }
  }

  WAITING_HEADER_NAME(c) {
    if (c === ':') {
      return this.WAITING_HEADER_SPACE
    }

    // header 遇到 \r 解析完成
    if (c === '\r') {
      //根据chunked 格式设置bodyparse
      if (this.headers['Transfer-Encoding'] === 'chunked') {
        this.bodyParser = new TrunkedBodyParser()
      }
      return this.WAITING_HEADER_BLOCK_END
    }

    this.headerName += c
    return this.WAITING_HEADER_NAME
  }

  WAITING_HEADER_SPACE(c) {
    if (c === ' ') {
      return this.WAITING_HEADER_VALUE
    }
  }

  WAITING_HEADER_VALUE(c) {
    if (c === '\r') {
      this.headers[this.headerName] = this.headerValue
      this.headerName = ''
      this.headerValue = ''
      return this.WAITING_HEADER_LINE_END
    }

    this.headerValue += c
    return this.WAITING_HEADER_VALUE
  }

  // header 结束
  WAITING_HEADER_LINE_END(c) {
    if (c === '\n') {
      return this.WAITING_HEADER_NAME
    }
  }

  // header 之后的空行
  WAITING_HEADER_BLOCK_END(c) {
    if (c === '\n') {
      return this.WAITING_BODY
    }
  }

  WAITING_BODY(c) {
    this.bodyParser.receiveChar(c)
    return this.WAITING_BODY
  }

  receiveChar(c) {
    this.current = this.current(c)
  }
}

/**解析body
 * https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Transfer-Encoding
 * chunked
 * 数据以一系列分块的形式进行发送。
 * Content-Length 首部在这种情况下不被发送。
 * 在每一个分块的开头需要添加当前分块的长度，以十六进制的形式表示，后面紧跟着 '\r\n' ，之后是分块本身，后面也是'\r\n' 。终止块是一个常规的分块，不同之处在于其长度为0。
 * chunked 格式： 分块长度 +\r\n +内容 eg 282 \r\n <html ....
 * @param {*} c
 */
class TrunkedBodyParser {
  constructor() {
    this.trunkLength = 0
    this.content = []
    this.isFinished = false
    this.isError = false
    this.current = this.WAITING_LENGTH
  }

  WAITING_LENGTH(c) {
    // 如果遇到了\r说明是空chunk，长度为0, 也就意味着读取结束了，当前是最后一块
    if (c === '\r') {
      if (this.trunkLength === 0) {
        this.isFinished = true
      }
      return this.WAITING_LENGTH_LINE_END
    }
    // thunkLength 为十六进制的，把其转换成10进制  282  = 2*16^0 + 8*16^1 +2*16^2   ==>642

    this.trunkLength *= 16
    this.trunkLength += parseInt(c, 16)
    return this.WAITING_LENGTH
  }

  WAITING_LENGTH_LINE_END(c) {
    if (c === '\n') {
      return this.READING_TRUNK
    }
  }

  READING_TRUNK(c) {
    this.content.push(c)
    this.trunkLength--
    // 在trunkLength已经减到0时，也就意味着内容已经读取完毕，可以开始准备读取下一行了
    if (this.trunkLength === 0) {
      return this.WAITING_NEW_LINE
    }
    return this.READING_TRUNK
  }

  WAITING_NEW_LINE(c) {
    if (c === '\r') {
      return this.WAITING_NEW_LINE_END
    }
  }

  WAITING_NEW_LINE_END(c) {
    if (c === '\n') {
      return this.WAITING_LENGTH
    }
  }

  receiveChar(char) {
    this.current = this.current(char)
  }
}

;(async function () {
  const request = new Request({
    method: 'POST',
    host: '127.0.0.1',
    port: '8001',
    path: '/',
    headers: {
      ['x-hello']: 'world',
    },
    body: {
      name: 'hello',
    },
  })
  const response = await request.send()
  const dom = parseHTML(response.body)
  const viewPort = images(800, 800)
  render(viewPort, dom)
  viewPort.save('view.jpg')
})()
