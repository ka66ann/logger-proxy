import { Deferred } from "@3fv/deferred"
import * as Faker from "faker"
import { range } from "lodash"
import { FileAppender } from "../appenders/FileAppender"
import { getLogger } from "../getLogger"
import { LevelNames } from "../Level"
import { getLoggingManager } from "../LoggingManager"

async function run() {
  const manager = getLoggingManager()
  const fileAppender = new FileAppender({
    enableRolling: true,
    maxFiles: 4,
    maxSize: 20480
  })
  manager.setAppenders(fileAppender).setRootLevel("trace")

  const log = getLogger(__filename)

  for (const i of range(0, 50)) {
    LevelNames.forEach((name) =>
      log[name].call(log, `${i} example `, Faker.lorem.sentences(5))
    )
    await Deferred.delay(500)
    // fileAppender.rollFile()
    LevelNames.forEach((name) =>
      log[name].call(log, `${i} example `, Faker.lorem.sentences(2))
    )
    await Deferred.delay(500)
  }

  await fileAppender.close()
}

run().catch((err) => console.error(`failed`, err))
