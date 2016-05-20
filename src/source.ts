import {Sink, SinkInterface} from './sink';
import {fromInputStream} from './compat/input';

export class Source<Output> {
  constructor(private _pipe: <State, Result>(sink: SinkInterface<Output, State, Result>) => Promise<Result>) {}

  pipe<State, Result>(sink: SinkInterface<Output, State, Result>): Promise<Result> {
    return this._pipe(sink);
  }

  static empty<Output>(): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return sink.onStart().then((state: State) => sink.onEnd(state));
    });
  }

  static singleton<Output>(output: Output): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return sink.onStart()
        .then((init: State) => sink.onData(init, output))
        .then((state: State) => sink.onEnd(state));
    });
  }

  concat(next: Source<Output>): Source<Output> {
    return this.concatAsync(Promise.resolve(next));
  }

  concatAsync(f: Promise<Source<Output>>): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return this.pipe({
        onStart: () => sink.onStart(),
        onData: (state: State, output: Output) => sink.onData(state, output),
        onEnd: (intermediateState: State) => {
          return f.then((next) => {
            return next.pipe({
              onStart: () => Promise.resolve<State>(intermediateState),
              onData: (state: State, output: Output) => sink.onData(state, output),
              onEnd: (state: State) => sink.onEnd(state)
            });
          });
        }
      });
    });
  }

  map<NewOutput>(f: (output: Output) => NewOutput): Source<NewOutput> {
    return this.statefulMap(null, (state, output) => [state, f(output)]);
  }

  statefulMap<S, NewOutput>(init: S, f: (state: S, output: Output) => [S, NewOutput]): Source<NewOutput> {
    return new Source(<State, Result>(sink: SinkInterface<NewOutput, State, Result>) => {
      return this.pipe<[S, State], Result>({
        onStart: () => sink.onStart().then(state => [init, state]),
        onData: (states, output) => {
          const res = f(states[0], output);
          return sink.onData(states[1], res[1]).then(state => [res[0], state]);
        },
        onEnd: (states) => sink.onEnd(states[1])
      });
    });
  }

  mapAsync<NewOutput>(f: (output: Output) => Promise<NewOutput>): Source<NewOutput> {
    return new Source(<State, Result>(sink: SinkInterface<NewOutput, State, Result>) => {
      return this.pipe<State, Result>({
        onStart: () => sink.onStart(),
        onData: (state, output) => f(output).then(newOutput => sink.onData(state, newOutput)),
        onEnd: (state) => sink.onEnd(state)
      });
    });
  }

  flatMap<NewOutput>(f: (output: Output) => Source<NewOutput>): Source<NewOutput> {
    return new Source(<State, Result>(sink: SinkInterface<NewOutput, State, Result>) => {
      return this.pipe<State, Result>({
        onStart: () => sink.onStart(),
        onData: (state, output) => f(output).pipe({
          onStart: () => Promise.resolve<State>(state),
          onData: (intermediateState, newOutput) => sink.onData(intermediateState, newOutput),
          onEnd: (intermediateState) => Promise.resolve<State>(intermediateState)
        }),
        onEnd: (state) => sink.onEnd(state)
      });
    });
  }

  filter(pred: (output: Output) => boolean): Source<Output> {
    return this.statefulFilter(null, (state, output) => [state, pred(output)]);
  }

  statefulFilter<S>(init: S, pred: (state: S, output: Output) => [S, boolean]): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return this.pipe<[S, State], Result>({
        onStart: () => sink.onStart().then(state => [init, state]),
        onData: (state, output) => {
          const res = pred(state[0], output);
          if (!res[1]) {
            return Promise.resolve([res[0], state[1]]);
          }
          return sink.onData(state[1], output).then(newState => [res[0], newState]);
        },
        onEnd: (state) => sink.onEnd(state[1])
      });
    });
  }

  toArray(): Promise<Array<Output>> {
    return this.pipe(Sink.fold([], (arr, outp) => arr.concat([outp])));
  }

  static fromArray<Output>(arr: Array<Output>): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return sink.onStart().then((init: State) => {
        function fold(idx: number, state: State): Promise<State> {
          if (idx < arr.length) {
            return sink.onData(state, arr[idx]).then(newState => fold(idx + 1, newState));
          }
          return Promise.resolve(state);
        }
        return fold(0, init);
      }).then((state: State) => {
        return sink.onEnd(state);
      });
    });
  }

  static fromInputStream(input: () => NodeJS.ReadableStream): Source<Buffer> {
    return fromInputStream(input);
  }
}
