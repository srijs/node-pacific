import {Source} from '../source';

class IntoOutputStreamState {
  private _hasError = false;
  private _err: Error;

  constructor(private _stream: NodeJS.WritableStream) {
    this._stream.on('error', (err: Error) => {
      this._hasError = true;
      this._err = err;
    });
  }

  write(buf: Buffer): Promise<this> {
    return new Promise<this>((resolve, reject) => {
      if (this._hasError) {
        return reject(this._err);
      }
      this._stream.once('error', reject);
      if (this._stream.write(buf)) {
        this._stream.removeListener('error', reject);
        return resolve(this);
      }
      this._stream.once('drain', () => {
        this._stream.removeListener('error', reject);
        resolve(this);
      });
    });
  }

  end(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this._hasError) {
        return reject(this._err);
      }
      this._stream.once('error', reject);
      this._stream.once('finish', () => {
        this._stream.removeListener('error', reject);
        resolve(null);
      });
      this._stream.end();
    });
  }
}

export function intoOutputStream(source: Source<Buffer>, output: NodeJS.WritableStream): Promise<void> {
  const init = new IntoOutputStreamState(output);
  return source.pipe({
    onStart: () => Promise.resolve(init),
    onData: (state, buf) => state.write(buf),
    onEnd: (state) => state.end()
  });
}
