import "jest"
import { LevelKind, LevelNames } from "./Level"
import { getLogger } from "./getLogger"
import { getLoggingManager } from "./LoggingManager"

type ConsoleMocks = Array<[prop: string, srcFn: Function, mockFn: Function]>

describe("Logger", () => {
  const propsToMock = ["log", ...LevelNames]
  
  let mocks: Array<[LevelKind, any, any]>
  let globalConsole: any

  beforeAll(() => {
    getLoggingManager().setRootLevel("trace")
  })
  
  beforeEach(() => {
    const mockLevels = propsToMock.filter((level) => !!global.console[level])
    mocks = []
    globalConsole = global.console
    global.console = {} as any
    mockLevels.forEach((prop: LevelKind) => {
      const srcFn = globalConsole[prop]
      const mockFn = (global.console[prop] = jest.fn())
      mocks.push([prop, srcFn, mockFn])
    })
  })

  afterEach(() => {
    global.console = globalConsole
  })
  
  
  test("category is parsed", () => {
    const log = getLogger(__filename)

    expect(log.category).toBe("__tests__:Logger.spec")
  })

  test("console is default", () => {
    const levelMocks = mocks.filter(([prop]) =>
      LevelNames.includes(prop as LevelKind)
    ) as Array<[level: LevelKind, srcFn: Function, mockFn: Function]>
    const log = getLogger(__filename)

    levelMocks.forEach(([level, src, mock]) => {
      log[level].bind(log)("test123")

      expect(mock).toBeCalledTimes(1)
    })
  })
})
