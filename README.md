# @3fv/logger-proxy
---

## Overview

With so many logging libraries out there, and the fact that I felt I was creating the same boilerplate configs with
different libs depending on target platforms as well as logging backends, etc. I finally decided to implement a simple
logging framework that's meant to be used with other frameworks & loggers; `Tracer`, `Morgan`, `Winston`.

Works across `browser` & `node` & `deno`

Now, that is a fairly common statement from those that write logging frameworks including the aforementioned; but this
is truly meant to be a `proxy` & with that it enables things like backend async context stacks. i.e. default config goes
to a file appender, but your job's also have an additional append via an async context (Think `ThreadLocal` in
the `java` or `std::thread_local` in `c++` ).

`@3fv/logger-proxy` hotswap logging backends

## Install

```shell
yarn add @3fv/logger-proxy
```

## Usage

### Basic

```typescript
import {
  getLogger,
  LevelNames, getLoggingManager
} from "@3fv/logger-proxy"


getLoggingManager().configure({
  // Default appenders list is [ConsoleAppender], 
  // so the following is not needed and only 
  // remains as an example:
  //
  // appenders: [new ConsoleAppender()],
  rootLevel: "trace"
})

const log = getLogger(__filename)

LevelNames.forEach((name) =>
  log[name].call(log, `example %s`, name)
)

```

### Context Stacks (the coolest bit)

For verboseness as well as the fact I'm lazy, here's a complete unit test illustrating the capabilities (in `jest`)

```typescript
import {
  Appender,
  getLoggingManager,
  LogContext,
  Logger,
  getLogger
} from "@3fv/logger-proxy"

type Jest = typeof jest
type MockAppender = Appender & {
  append: Appender["append"] & ReturnType<Jest["fn"]>
}

function newMockAppender(): MockAppender {
  const fn = jest.fn((record: any) => {
    console.log(`record`, record)
  })
  return {
    append: fn
  }
}

describe("NodeContextProvider", () => {
  jest.setTimeout(10000)
  
  const manager = getLoggingManager()
  let baseAppender: MockAppender
  let contextAppender1: MockAppender
  let contextAppender2: MockAppender
  let context1: LogContext
  let context2: LogContext
  let log1: Logger
  let log2: Logger
  
  beforeEach(() => {
    baseAppender = newMockAppender()
    
    contextAppender1 = newMockAppender()
    contextAppender2 = newMockAppender()
    
    context1 = LogContext.with([contextAppender1])
    context2 = LogContext.with([contextAppender2])
    
    manager.setAppenders(baseAppender).setRootLevel("debug")
    
    log1 = getLogger("log1")
    log2 = getLogger("log2")
  })
  
  it("works with no contexts", async () => {
    log1.info("test1")
    log2.info("test2")
    
    expect(baseAppender.append).toBeCalledTimes(2)
  })
  
  it("works with no context provider", async () => {
    log1.info("test1")
    await context1.use(async () => {
      log1.info("test2")
    })
    
    expect(baseAppender.append).toBeCalledTimes(2)
    expect(contextAppender1.append).toBeCalledTimes(0)
  })
  
  it("works with 1 contexts", async () => {
    
    // You must explicitly `install` the context provider to use contexts
    await import("@3fv/logger-proxy/context/providers/node")
    
    log1.info("test1")
    await context1.use(async () => {
      log1.info("test2")
    })
    
    expect(baseAppender.append).toBeCalledTimes(2)
    expect(contextAppender1.append).toBeCalledTimes(1)
  })
  
  it("works with n contexts", async () => {
    
    // You must explicitly `install` the context provider to use contexts
    await import("@3fv/logger-proxy/context/providers/node")
    
    log1.info("test1")
    await context1.use(async () => {
      log1.info("test2")
      await context2.use(async () => {
        log1.info("test3")
      })
    })
    
    expect(baseAppender.append).toBeCalledTimes(3)
    expect(contextAppender1.append).toBeCalledTimes(2)
    expect(contextAppender2.append).toBeCalledTimes(1)
  })
})

```
