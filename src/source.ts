import {Sink, SinkInterface} from './sink';
import {fromInputStream} from './compat/input';
import {intoOutputStream} from './compat/output';

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

  static fail<Output>(reason: Error): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return Promise.reject<Result>(reason);
    });
  }

  concat(next: Source<Output>): Source<Output> {
    return this.concatAsync(() => Promise.resolve(next));
  }

  concatAsync(f: () => Promise<Source<Output>>): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return this.pipe({
        onStart: () => sink.onStart(),
        onData: (state: State, output: Output) => sink.onData(state, output),
        onEnd: (intermediateState: State) => {
          return f().then((next) => {
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

  fold<State>(init: State, accum: (state: State, output: Output) => State): Promise<State> {
    return this.pipe(Sink.fold(init, accum));
  }

  foldAsync<State>(init: State, accum: (state: State, output: Output) => Promise<State>): Promise<State> {
    return this.pipe(Sink.foldAsync(init, accum));
  }

  map<NewOutput>(f: (output: Output) => NewOutput): Source<NewOutput> {
    return this.mapWithState(null, (state, output) => [state, f(output)]);
  }

  mapWithState<S, NewOutput>(init: S, f: (state: S, output: Output) => [S, NewOutput]): Source<NewOutput> {
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
    return this.filterWithState(null, (state, output) => [state, pred(output)]);
  }

  filterWithState<State>(init: State, pred: (state: State, output: Output) => [State, boolean]): Source<Output> {
    return new Source(<SinkState, Result>(sink: SinkInterface<Output, SinkState, Result>) => {
      return this.pipe<[State, SinkState], Result>({
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

  filterAsync(pred: (output: Output) => Promise<boolean>): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return this.pipe<State, Result>({
        onStart: () => sink.onStart(),
        onData: (state, output) => pred(output).then(res => {
          if (!res) {
            return Promise.resolve(state);
          }
          return sink.onData(state, output);
        }),
        onEnd: (state) => sink.onEnd(state)
      });
    });
  }

  toArray(): Promise<Array<Output>> {
    return this.fold([], (arr, outp) => arr.concat([outp]));
  }

  intoOutputStream(f: (output: Output) => Buffer, output: NodeJS.WritableStream): Promise<void> {
    return intoOutputStream(this.map(f), output);
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
