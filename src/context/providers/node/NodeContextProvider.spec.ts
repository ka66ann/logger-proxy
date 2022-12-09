import Debug from "debug"
import { Appender } from "../../../Appender"
import { getLoggingManager } from "../../../LoggingManager"
import { LogContext } from "../../LogContext"
import { Logger } from "../../../Logger"
import { getLogger } from "../../../getLogger"

type Jest = typeof jest
type MockAppender = Appender & {
  append: Appender["append"] & ReturnType<Jest["fn"]>
}

const debug = Debug("logger-proxy:context")

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
    await import("./NodeContextProvider")
    log1.info("test1")
    await context1.use(async () => {
      log1.info("test2")
    })

    expect(baseAppender.append).toBeCalledTimes(2)
    expect(contextAppender1.append).toBeCalledTimes(1)
  })

  it("works with n contexts", async () => {
    await import("./NodeContextProvider")
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
