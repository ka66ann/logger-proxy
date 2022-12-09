import { getLogger } from "../getLogger"
import { LevelNames } from "../Level"
import { getLoggingManager } from "../LoggingManager"
import Debug from "debug"
import { DebugAppender } from "../appenders"
import { FileAppender } from "./FileAppender"
import { range } from "lodash"
import { Deferred } from "@3fv/deferred"
import * as Sh from "shelljs"
import * as Path from "path"
import * as Fs from "fs"
import * as Faker from "faker"

const debug = Debug("3fv:logger:FileAppender")
const logMatch = /app\.log/
const countLogFiles = (dir: string, match: RegExp = /.*/) =>
  Sh.ls(dir).filter((name) => match.test(name)).length
const osTempDir = process.env.TMP ?? process.env.TEMP ?? "/tmp"

describe("FileAppender", () => {
  jest.setTimeout(10000)

  it("rolls", async () => {
    const tempDir = Fs.mkdtempSync(Path.join(osTempDir, "jest-logger-proxy")) //
    Sh.mkdir("-p", tempDir)

    const filename = Path.join(tempDir, "app.log")

    if (countLogFiles(tempDir, logMatch)) {
      Sh.rm("-f", filename + "*")
    }

    expect(countLogFiles(tempDir, logMatch)).toBe(0)
    debug(`Using filename ${filename}`)
    const manager = getLoggingManager()
    const fileAppender = new FileAppender({
      enableRolling: true,
      maxFiles: 5,
      maxSize: 2048,
      filename
    })
    manager
      .setAppenders(fileAppender)

      .setRootLevel("trace")

    const log = getLogger(__filename)

    for (const i of range(0, 5)) {
      LevelNames.forEach((name) =>
        log[name].call(log, `${i} example `, Faker.lorem.sentences(5))
      )
      await Deferred.delay(500)

      LevelNames.forEach((name) =>
        log[name].call(log, `${i} example `, Faker.lorem.sentences(2))
      )
      await Deferred.delay(500)

      // fileAppender.rollFile()
    }

    await fileAppender.close()

    expect(countLogFiles(tempDir, logMatch)).toBe(5)
  })
})
