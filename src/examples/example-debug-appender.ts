import { getLogger } from "../getLogger"
import { LevelNames } from "../Level"
import { getLoggingManager } from "../LoggingManager"


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
