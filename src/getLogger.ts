import type { Logger, LoggerOptions } from "./Logger"
import { getLoggingManager } from "./LoggingManager"

export function getLogger(
  category: string,
  options: Partial<LoggerOptions> = {}
): Logger {
  return getLoggingManager().getLogger(category, options)
}
