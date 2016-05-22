import * as mocha from 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import * as stream from 'stream';

import {SinkInterface} from './sink';
import {Source} from './source';

chai.use(chaiAsPromised);

describe('Stream', () => {

  describe('Source', () => {

    describe('fromArray/toArray', () => {

      it('works for empty arrays', () => {
        const src = Source.fromArray([]);
        return chai.expect(src.toArray()).to.eventually.deep.equal([]);
      });

      it('works for non-empty arrays', () => {
        const src = Source.fromArray([1,2,3]);
        return chai.expect(src.toArray()).to.eventually.deep.equal([1,2,3]);
      });

    });

    describe('empty', () => {

      it('results in empty array', () => {
        const src = Source.empty();
        return chai.expect(src.toArray()).to.eventually.deep.equal([]);
      });

    });

    describe('singleton', () => {

      it('results in singleton array', () => {
        const src = Source.singleton(42);
        return chai.expect(src.toArray()).to.eventually.deep.equal([42]);
      });

    });

    describe('concat', () => {

      it('concatenates two empty sources', () => {
        const src1 = Source.empty();
        const src2 = Source.empty();
        return chai.expect(src1.concat(src2).toArray()).to.eventually.deep.equal([]);
      });

      it('concatenates a non-empty source on the left with an empty source on the right', () => {
        const src1 = Source.fromArray([1,2,3]);
        const src2 = Source.empty();
        return chai.expect(src1.concat(src2).toArray()).to.eventually.deep.equal([1,2,3]);
      });

      it('concatenates an empty source on the left with a non-empty source on the right', () => {
        const src1 = Source.empty();
        const src2 = Source.fromArray([1,2,3]);
        return chai.expect(src1.concat(src2).toArray()).to.eventually.deep.equal([1,2,3]);
      });

    });

    describe('fold', () => {

      it('produces the init result from an empty source', () => {
        const src = Source.empty<number>();
        return chai.expect(src.fold(42, (x, y) => x + y)).to.eventually.equal(42);
      });

      it('replaces each output with the result of the function', () => {
        const src = Source.fromArray([1,2,3]);
        return chai.expect(src.fold(42, (x, y) => x + y)).to.eventually.deep.equal(48);
      });

    });

    describe('foldAsync', () => {

      it('produces the init result from an empty source', () => {
        const src = Source.empty<number>();
        return chai.expect(src.foldAsync(42, (x, y) => Promise.resolve(x + y))).to.eventually.equal(42);
      });

      it('replaces each output with the result of the function', () => {
        const src = Source.fromArray([1,2,3]);
        return chai.expect(src.foldAsync(42, (x, y) => Promise.resolve(x + y))).to.eventually.deep.equal(48);
      });

    });

    describe('map', () => {

      it('produces an empty source from an empty source', () => {
        const src = Source.empty();
        return chai.expect(src.map((x: number) => x + 1).toArray()).to.eventually.deep.equal([]);
      });

      it('replaces each output with the result of the function', () => {
        const src = Source.fromArray([1,2,3]);
        return chai.expect(src.map((x: number) => x + 1).toArray()).to.eventually.deep.equal([2,3,4]);
      });

    });

    describe('effectfulMap', () => {

      it('produces an empty source from an empty source', () => {
        const src = Source.empty();
        return chai.expect(src.mapAsync((x: number) => Promise.resolve(x + 1)).toArray()).to.eventually.deep.equal([]);
      });

      it('replaces each output with the result of the function', () => {
        const src = Source.fromArray([1,2,3]);
        return chai.expect(src.mapAsync((x: number) => Promise.resolve(x + 1)).toArray()).to.eventually.deep.equal([2,3,4]);
      });

    });

    describe('flatMap', () => {

      it('produces an empty source from an empty source', () => {
        const src = Source.empty();
        return chai.expect(src.flatMap(() => Source.fromArray([1,2,3])).toArray()).to.eventually.deep.equal([]);
      });

      it('flattens all results of the function', () => {
        const src = Source.fromArray([1,2,3]);
        return chai.expect(src.flatMap(x => Source.fromArray([x,x*2,x*3])).toArray()).to.eventually.deep.equal([1,2,3,2,4,6,3,6,9]);
      });

    });

    describe('filter', () => {

      it('produces an empty source from an empty source', () => {
        const src = Source.empty();
        return chai.expect(src.filter(() => true).toArray()).to.eventually.deep.equal([]);
      });

      it('only produces elements for which the predicate returns true', () => {
        const src = Source.fromArray([1,2,3,4,5,6]);
        return chai.expect(src.filter(x => x % 2 === 0).toArray()).to.eventually.deep.equal([2,4,6]);
      });

    });

    describe('intoOutputStream', () => {

      it('writes no data when the source is empty', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const promiseSink = Source.empty<Buffer>().intoOutputStream(x => x, str);
        const promiseSrc = Source.fromInputStream(() => str).toArray();
        return chai.expect(promiseSink).to.eventually.equal(null).then(() => {
          return chai.expect(promiseSrc).to.eventually.deep.equal([]);
        });
      });

      it('writes data when the source is not empty (without buffering)', () => {
        const str = new stream.PassThrough({highWaterMark: 2048});
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = Source.fromArray([data1, data2]).intoOutputStream(x => x, str);
        const promiseSrc = Source.fromInputStream(() => str).toArray();
        return chai.expect(promiseSink).to.eventually.equal(null).then(() => {
          return chai.expect(promiseSrc).to.eventually.deep.equal([data1, data2]);
        });
      });

      it('writes data when the source is not empty (with buffering)', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = Source.fromArray([data1, data2]).intoOutputStream(x => x, str);
        const promiseSrc = Source.fromInputStream(() => str).toArray();
        return chai.expect(promiseSink).to.eventually.equal(null).then(() => {
          return chai.expect(promiseSrc).to.eventually.deep.equal([data1, data2]);
        });
      });

      it('fails when the output stream fails during write', () => {
        const err = new Error('yep this is an error');
        const str = new stream.PassThrough({highWaterMark: 1024});
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = new Source(<State, Result>(sink: SinkInterface<Buffer, State, Result>) => {
          return sink.onStart().then(state => {
            return sink.onData(state, data1);
          }).then(state => {
            return Promise.all([sink.onData(state, data2), str.emit('error', err)]);
          }).then(states => {
            return sink.onEnd(states[0]);
          });
        }).intoOutputStream(x => x, str);
        return chai.expect(promiseSink).to.eventually.be.rejectedWith(err);
      });

      it('fails when the output stream fails during end', () => {
        const err = new Error('yep this is an error');
        const str = new stream.PassThrough({highWaterMark: 2048});
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = new Source(<State, Result>(sink: SinkInterface<Buffer, State, Result>) => {
          return sink.onStart().then(state => {
            return sink.onData(state, data1);
          }).then(state => {
            return sink.onData(state, data2);
          }).then(state => {
            return Promise.all([sink.onEnd(state), str.emit('error', err)]);
          });
        }).intoOutputStream(x => x, str);
        return chai.expect(promiseSink).to.eventually.be.rejectedWith(err);
      });

      it('fails when the output stream fails between writes', () => {
        const err = new Error('yep this is an error');
        const str = new stream.PassThrough({highWaterMark: 1024});
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = new Source(<State, Result>(sink: SinkInterface<Buffer, State, Result>) => {
          return sink.onStart().then(state => {
            return sink.onData(state, data1);
          }).then(state => {
            str.emit('error', err);
            return sink.onData(state, data2);
          }).then(state => {
            return sink.onEnd(state);
          });
        }).intoOutputStream(x => x, str);
        return chai.expect(promiseSink).to.eventually.be.rejectedWith(err);
      });

      it('fails when the output stream fails between write and end', () => {
        const err = new Error('yep this is an error');
        const str = new stream.PassThrough({highWaterMark: 2048});
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        const promiseSink = new Source(<State, Result>(sink: SinkInterface<Buffer, State, Result>) => {
          return sink.onStart().then(state => {
            return sink.onData(state, data1);
          }).then(state => {
            return sink.onData(state, data2);
          }).then(state => {
            str.emit('error', err);
            return sink.onEnd(state);
          });
        }).intoOutputStream(x => x, str);
        return chai.expect(promiseSink).to.eventually.be.rejectedWith(err);
      });

    });

    describe('fromInputStream', () => {

      it('produces an empty source from an empty stream', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(() => str);
        str.end();
        return chai.expect(src.toArray()).to.eventually.deep.equal([]);
      });

      it('produces multiple chunks from a fed stream', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(() => str);
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        str.write(data1);
        str.write(data2);
        str.end();
        return chai.expect(src.toArray()).to.eventually.deep.equal([data1, data2]);
      });

      it('fails when the sink onStart fails', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(() => str);
        const err = new Error('yep this is an error');
        str.end(new Buffer(1024));
        const promise = src.pipe({
          onStart: () => Promise.reject(err),
          onData: () => Promise.resolve(null),
          onEnd: () => Promise.resolve(null)
        });
        return chai.expect(promise).to.eventually.be.rejectedWith(err);
      });

      it('fails when the sink onData fails', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(() => str);
        const err = new Error('yep this is an error');
        str.end(new Buffer(1024));
        const promise = src.pipe({
          onStart: () => Promise.resolve(null),
          onData: () => Promise.reject(err),
          onEnd: () => Promise.resolve(null)
        });
        return chai.expect(promise).to.eventually.be.rejectedWith(err);
      });

      it('fails when the sink onEnd fails', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(() => str);
        const err = new Error('yep this is an error');
        str.end(new Buffer(1024));
        const promise = src.pipe({
          onStart: () => Promise.resolve(null),
          onData: () => Promise.resolve(null),
          onEnd: () => Promise.reject(err)
        });
        return chai.expect(promise).to.eventually.be.rejectedWith(err);
      });

      it('fails when input stream fails', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const err = new Error('yep this is an error');
        const src = Source.fromInputStream(() => {
          setImmediate(() => {
            str.emit('error', err);
            str.end();
          });
          return str;
        });
        const promise = src.pipe({
          onStart: () => Promise.resolve(null),
          onData: () => Promise.resolve(null),
          onEnd: () => Promise.resolve(null)
        });
        return chai.expect(promise).to.eventually.be.rejectedWith(err);
      });

    });

  });

});
