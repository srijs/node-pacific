# node-pacific [![CircleCI](https://img.shields.io/circleci/project/srijs/node-pacific/master.svg?maxAge=2592000)](https://circleci.com/gh/srijs/node-pacific) [![Coveralls](https://img.shields.io/coveralls/srijs/node-pacific/master.svg?maxAge=2592000)](https://coveralls.io/github/srijs/node-pacific)

> Ceci n'est pas une pipe

Pacific provides a simple but powerful streaming abstraction. It consist of two concepts: Sinks and Sources.

## Installation

Pacific is available via npm:

```
npm install pacific
```

## Concepts

### Sinks

Sinks are stream consumers. More concretely, they describe how to reduce a stream, by providing three actions:

- `onStart: () => Promise<State>`
- `onData: (s: State, i: Input) => Promise<State>`
- `onEnd: (s: State) => Promise<Result>`

Those three actions are called in order during the lifecycle of the stream. When a stream starts, onStart is called, returning a promise that results in an initial state. As data flows through the stream, onData is called multiple times with the current state and a bit of input, providing the next state. The next onData won't be called unless the promise from the previous call is fulfilled, providing a way to handle back-pressure. At the point where the stream is exhausted, onEnd will be called once with the last state, finalizing it into the end result.

### Sources

Sources are the objects that take a sink and run it. Two sources of the same type can be combined into a new source, which provides a simple way to build up sources from lots of different parts, concatenating many data fetches.