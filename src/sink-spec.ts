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

    describe('fails', () => {

      it('fails with an empty input', () => {
        const reason = new Error('some error');
        const sink = Sink.fail(reason);
        const source = Source.empty();
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.be.rejectedWith(reason);
      });

      it('fails with a non-empty input', () => {
        const reason = new Error('some error');
        const sink = Sink.fail(reason);
        const source = Source.fromArray([1, 2, 3]);
        const promise = source.pipe(sink);
        return chai.expect(promise).to.eventually.be.rejectedWith(reason);
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

  });

});
