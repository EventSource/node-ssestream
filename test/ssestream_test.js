'use strict'

const assert = require('assert')
const Stream = require('stream')
const http = require('http')
const EventSource = require('eventsource')
const SseStream = require('..')

const written = stream => new Promise((resolve, reject) => stream.on('error', reject).on('finish', resolve))

class Sink extends Stream.Writable {
  constructor() {
    super({ objectMode: true })
    this._chunks = []
  }

  _write(chunk, encoding, callback) {
    this._chunks.push(chunk)
    callback()
  }

  get content() {
    return this._chunks.join('')
  }
}

describe('SseStream', () => {
  let sse, sink
  beforeEach(() => {
    sse = new SseStream()
    sink = new Sink()
  })

  it('writes multiple multiline messages', async () => {
    sse.pipe(sink)
    sse.write({
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
    sse.pipe(sink)
    sse.write({
      data: { hello: 'world' },
    })
    sse.end()
    await written(sink)
    assert.equal(sink.content, ':ok\n\ndata: {"hello":"world"}\n\n')
  })

  it('writes all message attributes', async () => {
    sse.pipe(sink)
    sse.write({
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
    sink.writeHead = (status, headers) => {
      assert.deepEqual(headers, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Transfer-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      callback()
    }
    sse.pipe(sink)
  })

  it('allows an eventsource to connect', callback => {
    const server = http.createServer((req, res) => {
      sse = new SseStream(req)
      sse.pipe(res)
    })
    server.listen(err => {
      if (err) return callback(err)
      const es = new EventSource(`http://localhost:${server.address().port}`)
      es.onmessage = e => {
        assert.equal(e.data, 'hello')
        callback()
      }
      es.onopen = () => sse.write({data: 'hello'})
      es.onerror = e =>
        callback(new Error(`Error from EventSource: ${JSON.stringify(e)}`))
    })
  })
})
