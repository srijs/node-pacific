export interface SinkInterface<Input, State, Result> {
  onStart: () => Promise<State>;
  onData: (s: State, i: Input) => Promise<State>;
  onEnd: (s: State) => Promise<Result>;
}

export class Sink<Input, State, Result> implements SinkInterface<Input, State, Result> {
  constructor(private _interface: SinkInterface<Input, State, Result>) {}

  onStart(): Promise<State> {
    return this._interface.onStart();
  }

  onData(s: State, i: Input): Promise<State> {
    return this._interface.onData(s, i);
  }

  onEnd(s: State): Promise<Result> {
    return this._interface.onEnd(s);
  }

  static unit<Input>(): Sink<Input, void, void> {
    return Sink.const(null);
  }

  static const<Input, Result>(res: Result): Sink<Input, Result, Result> {
    return new Sink<Input, Result, Result>({
      onStart: () => Promise.resolve(res),
      onData: (s) => Promise.resolve(s),
      onEnd: (s) => Promise.resolve(s)
    });
  }

  static fold<Input, State>(
    init: State,
    accum: (state: State, input: Input) => State
  ): Sink<Input, State, State> {
    return new Sink({
      onStart: () => Promise.resolve(init),
      onData: (state: State, input: Input) => Promise.resolve(accum(state, input)),
      onEnd: (state: State) => Promise.resolve(state)
    });
  }

  map<NewResult>(f: (res: Result) => NewResult): Sink<Input, State, NewResult> {
    return new Sink<Input, State, NewResult>({
      onStart: () => this.onStart(),
      onData: (s, i) => this.onData(s, i),
      onEnd: (s) => this.onEnd(s).then(f)
    });
  }

  mapAsync<NewResult>(f: (res: Result) => Promise<NewResult>): Sink<Input, State, NewResult> {
    return new Sink<Input, State, NewResult>({
      onStart: () => this.onStart(),
      onData: (s, i) => this.onData(s, i),
      onEnd: (s) => this.onEnd(s).then(f)
    });
  }

  parallel<OtherState, OtherResult>(
    other: Sink<Input, OtherState, OtherResult>
  ): Sink<Input, [State, OtherState], [Result, OtherResult]> {
    return new Sink<Input, [State, OtherState], [Result, OtherResult]>({
      onStart: () => Promise.all([this.onStart(), other.onStart()]),
      onData: (s, i) => Promise.all([this.onData(s[0], i), other.onData(s[1], i)]),
      onEnd: (s) => Promise.all([this.onEnd(s[0]), other.onEnd(s[1])])
    });
  }
}
