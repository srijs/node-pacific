import * as stream from 'stream';

import {Source} from '../source';
import {SinkInterface} from '../sink';

class FeedingStream<State> extends stream.Writable {
  public state: State;

  constructor(
    private _init: State,
    private _feed: (state: State, buf: Buffer) => Promise<State>,
    options?: Object
  ) {
    super(options);
    this.state = _init;
  }

  _write(buf: Buffer, enc: String, cb: (err?: Error) => void) {
    this._feed(this.state, buf).then((state: State) => {
      this.state = state;
      return cb();
    }, (err) => cb(err));
  }
}

function feed<State>(input: () => NodeJS.ReadableStream, init: State, step: (state: State, buf: Buffer) => Promise<State>): Promise<State> {
  const s = new FeedingStream(init, step);
  const t = input();
  const p = new Promise((resolve, reject) => {
    t.on('error', reject);
    s.on('finish', () => resolve(s.state));
    s.on('error', reject);
  });
  t.pipe(s);
  return p;
}

export function fromInputStream(input: () => NodeJS.ReadableStream): Source<Buffer> {
  return new Source(<State, Result>(sink: SinkInterface<Buffer, State, Result>) => {
    return sink.onStart().then((init: State) => {
      return feed(input, init, (state, buf) => sink.onData(state, buf));
    }).then((state: State) => {
      return sink.onEnd(state);
    });
  });
}
