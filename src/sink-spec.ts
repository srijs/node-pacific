import * as mocha from 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import * as stream from 'stream';

import {Source} from './source';
import {Sink} from './sink';

chai.use(chaiAsPromised);

describe('Stream', () => {

  describe('Sink', () => {

    describe('unit', () => {

      it('returns null with an empty input', () => {
        const sink = Sink.unit();
        const source = Source.empty();
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.equal(null);
      });

      it('returns null with a non-empty input', () => {
        const sink = Sink.unit();
        const source = Source.fromArray([1, 2, 3]);
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.equal(null);
      });

    });

    describe('const', () => {

      it('returns the result with an empty input', () => {
        const sink = Sink.const(42);
        const source = Source.empty();
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.equal(42);
      });

      it('returns the result with a non-empty input', () => {
        const sink = Sink.const(42);
        const source = Source.fromArray([1, 2, 3]);
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.equal(42);
      });

    });

    describe('map', () => {

      it('transforms the result when run with an empty input', () => {
        const sink = Sink.const(42).map(x => x + 1);
        const source = Source.empty();
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.equal(43);
      });

      it('transforms the result when run with a non-empty input', () => {
        const sink = Sink.const(42).map(x => x + 1);
        const source = Source.fromArray([1, 2, 3]);
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.equal(43);
      });

    });

    describe('effectfulMap', () => {

      it('transforms the result when run with an empty input', () => {
        const sink = Sink.const(42).mapAsync(x => Promise.resolve(x + 1));
        const source = Source.empty();
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.equal(43);
      });

      it('transforms the result when run with a non-empty input', () => {
        const sink = Sink.const(42).mapAsync(x => Promise.resolve(x + 1));
        const source = Source.fromArray([1, 2, 3]);
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.equal(43);
      });

    });

    describe('parallel', () => {

      it('returns both results when run with an empty input', () => {
        const sink = Sink.const(42).parallel(Sink.const('foo'));
        const source = Source.empty();
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.deep.equal([42, 'foo']);
      });

      it('returns both results when run with a non-empty input', () => {
        const sink = Sink.const(42).parallel(Sink.const('foo'));
        const source = Source.fromArray([1, 2, 3]);
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.deep.equal([42, 'foo']);
      });

    });

    describe('intoOutputStream', () => {

      it('writes no data when the source is empty', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const sink = Sink.intoOutputStream(() => str);
        const promiseSink = Source.empty().pipe(sink);
        const promiseSrc = Source.fromInputStream(() => str).toArray();
        return chai.expect(promiseSink).to.eventually.equal(null).then(() => {
          return chai.expect(promiseSrc).to.eventually.deep.equal([]);
        });
      });

      it('writes data when the source is not empty (without buffering)', () => {
        const str = new stream.PassThrough({highWaterMark: 2048});
        const sink = Sink.intoOutputStream(() => str);
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = Source.fromArray([data1, data2]).pipe(sink);
        const promiseSrc = Source.fromInputStream(() => str).toArray();
        return chai.expect(promiseSink).to.eventually.equal(null).then(() => {
          return chai.expect(promiseSrc).to.eventually.deep.equal([data1, data2]);
        });
      });

      it('writes data when the source is not empty (with buffering)', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const sink = Sink.intoOutputStream(() => str);
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = Source.fromArray([data1, data2]).pipe(sink);
        const promiseSrc = Source.fromInputStream(() => str).toArray();
        return chai.expect(promiseSink).to.eventually.equal(null).then(() => {
          return chai.expect(promiseSrc).to.eventually.deep.equal([data1, data2]);
        });
      });

      it('fails when the output stream fails during write', () => {
        const err = new Error('yep this is an error');
        const str = new stream.PassThrough({highWaterMark: 1024});
        const sink = Sink.intoOutputStream(() => str);
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = sink.onStart().then(state => {
          return sink.onData(state, data1);
        }).then(state => {
          return Promise.all([sink.onData(state, data2), str.emit('error', err)]);
        }).then(states => {
          return sink.onEnd(states[0]);
        });
        return chai.expect(promiseSink).to.eventually.be.rejectedWith(err);
      });

      it('fails when the output stream fails during end', () => {
        const err = new Error('yep this is an error');
        const str = new stream.PassThrough({highWaterMark: 2048});
        const sink = Sink.intoOutputStream(() => str);
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = sink.onStart().then(state => {
          return sink.onData(state, data1);
        }).then(state => {
          return sink.onData(state, data2);
        }).then(state => {
          return Promise.all([sink.onEnd(state), str.emit('error', err)]);
        });
        return chai.expect(promiseSink).to.eventually.be.rejectedWith(err);
      });

      it('fails when the output stream fails between writes', () => {
        const err = new Error('yep this is an error');
        const str = new stream.PassThrough({highWaterMark: 1024});
        const sink = Sink.intoOutputStream(() => str);
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = sink.onStart().then(state => {
          return sink.onData(state, data1);
        }).then(state => {
          str.emit('error', err);
          return sink.onData(state, data2);
        }).then(state => {
          return sink.onEnd(state);
        });
        return chai.expect(promiseSink).to.eventually.be.rejectedWith(err);
      });

      it('fails when the output stream fails between write and end', () => {
        const err = new Error('yep this is an error');
        const str = new stream.PassThrough({highWaterMark: 2048});
        const sink = Sink.intoOutputStream(() => str);
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = sink.onStart().then(state => {
          return sink.onData(state, data1);
        }).then(state => {
          return sink.onData(state, data2);
        }).then(state => {
          str.emit('error', err);
          return sink.onEnd(state);
        });
        return chai.expect(promiseSink).to.eventually.be.rejectedWith(err);
      });

    });

  });

});
