# SseStream

A zero-dependency node stream for writing [Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html).

## Installation

```
npm install ssestream
```

Or:

```
yarn add ssestream
```

## Usage

In a `(req, res)` handler for a [`request`](https://nodejs.org/api/http.html#http_event_request) event, Express [#get](https://expressjs.com/en/4x/api.html#app.get.method) route or similar:

```javascript
const SseStream = require('ssestream')

function (req, res) {
  const sse = new SseStream(req)
  sse.pipe(res)
  
  const message = {
    data: 'hello\nworld',
  }
  sse.write(message)
}
```

Properties on `message`:

* `data` - String or object, which gets turned into JSON
* `event` - (optional) String
* `id` - (optional) String
* `retry` - (optional) number
* `comment` - (optional) String

## TypeScript

The `SseStream#writeMessage(message)` method is a type-safe alias for `SseStream#write(message)`.
