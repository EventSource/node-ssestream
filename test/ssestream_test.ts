import assert from 'assert'
import { Writable } from 'stream'
import http, { OutgoingHttpHeaders } from 'http'
import EventSource from 'eventsource'
import SseStream, { HeaderStream } from '../index'
import { AddressInfo } from "net"

const written = (stream: Writable) => new Promise((resolve, reject) => stream.on('error', reject).on('finish', resolve))

class Sink extends Writable implements HeaderStream {
  private readonly chunks: string[] = []

  constructor(public readonly writeHead?: (statusCode: number, headers?: OutgoingHttpHeaders) => Sink) {
    super({ objectMode: true })
  }

  _write(chunk: any, encoding: string, callback: (error?: Error | null) => void): void {
    this.chunks.push(chunk)
    callback()
  }

  get content() {
    return this.chunks.join('')
  }
}

describe('SseStream', () => {
  it('writes multiple multiline messages', async () => {
    const sse = new SseStream()
    const sink = new Sink()
    sse.pipe(sink)
    sse.writeMessage({
      data: 'hello\nworld',
    })
    sse.write({
      data: 'bonjour\nmonde',
    })
    sse.end()
    await written(sink)
    assert.equal(
      sink.content,
      `:ok

data: hello
data: world

data: bonjour
data: monde

`
    )
  })

  it('writes object messages as JSON', async () => {
    const sse = new SseStream()
    const sink = new Sink()
    sse.pipe(sink)
    sse.writeMessage({
      data: { hello: 'world' },
    })
    sse.end()
    await written(sink)
    assert.equal(sink.content, ':ok\n\ndata: {"hello":"world"}\n\n')
  })

  it('writes all message attributes', async () => {
    const sse = new SseStream()
    const sink = new Sink()
    sse.pipe(sink)
    sse.writeMessage({
      comment: 'jibber jabber',
      event: 'tea-time',
      id: 'the-id',
      retry: 222,
      data: 'hello',
    })
    sse.end()
    await written(sink)
    assert.equal(
      sink.content,
      `:ok

: jibber jabber
event: tea-time
id: the-id
retry: 222
data: hello

`
    )
  })

  it('sets headers on destination when it looks like a HTTP Response', callback => {
    const sse = new SseStream()
    let sink: Sink
    sink = new Sink((status: number, headers: OutgoingHttpHeaders) => {
      assert.deepEqual(headers, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Transfer-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      callback()
      return sink
    })
    sse.pipe(sink)
  })

  it('allows an eventsource to connect', callback => {
    let sse: SseStream
    const server = http.createServer((req, res) => {
      sse = new SseStream(req)
      sse.pipe(res)
    })
    server.listen(() => {
      const es = new EventSource(`http://localhost:${(server.address() as AddressInfo).port}`)
      es.onmessage = e => {
        assert.equal(e.data, 'hello')
        es.close()
        server.close(callback)
      }
      es.onopen = () => sse.writeMessage({data: 'hello'})
      es.onerror = e =>
        callback(new Error(`Error from EventSource: ${JSON.stringify(e)}`))
    })
  })
})
