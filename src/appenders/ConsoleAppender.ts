import type { LogRecord } from "../LogRecord"
import type { Appender } from "../Appender"
import { asOption } from "@3fv/prelude-ts"
import type { LevelKind } from "../Level"
import type { Formatter } from "../Formatter"

const consoleLogBindings = new Map<LevelKind, (...args: any[]) => any>()

function getBoundConsoleFn(level: LevelKind) {
  return (console[level] ?? console.log).bind(console)
}

/**
 * Get a cached console bound log function
 *
 * @param {LevelKind} level
 * @returns {(...args: any[]) => any}
 */
export function getConsoleLogBinding(level: LevelKind) {
  if (!consoleLogBindings.has(level)) {
    consoleLogBindings.set(level, getBoundConsoleFn(level))
  }

  return consoleLogBindings.get(level)
}

/**
 * ConsoleAppender Configuration
 */
export interface ConsoleAppenderConfig<Record extends LogRecord = any> {
  cacheEnabled: boolean
  prettyPrint: boolean
  formatter?: Formatter<string | Array<any>>
}

/**
 * Partial of config, used for shortening instead of Partial<...>
 */
export type ConsoleAppenderOptions<Record extends LogRecord> = Partial<
  ConsoleAppenderConfig<Record>
>

export const consoleFormatter: Formatter<Array<any>> = ({
  level,
  message,
  data,
  args,
  category,
  timestamp
}) => [
  `[${category}]  (${level})  ${message}`,
  ...(Array.isArray(args) ? args : [args])
]

/**
 * Default console config
 * @type {ConsoleAppenderConfig}
 */
export const kDefaultConsoleAppenderConfig: ConsoleAppenderConfig = {
  cacheEnabled: true,
  prettyPrint: true,
  formatter: consoleFormatter
}

/**
 * Console appender, the simple default appender used
 * everywhere OOB
 */
export class ConsoleAppender<Record extends LogRecord>
  implements Appender<Record>
{
  readonly config: ConsoleAppenderConfig

  /**
   * Handle log records, transform, push to ES
   *
   * @param record
   */
  append(record: Record): void {
    const { level, message, data, args, category, timestamp } = record
    const { formatter = consoleFormatter } = this.config
    asOption(formatter(record)).map((result) => {
      const args = Array.isArray(result) ? result : [result]
      this.write(level, ...args)
    })
  }

  /**
   * Write args to console
   * 
   * @param level 
   * @param args 
   */
  protected write(level: LevelKind, ...args: any[]) {
    asOption(console[level])
        .orElse(() => asOption(console.log))
        .map((fn: Function) => fn.apply(console, args))
  }

  /**
   *
   * @param {Partial<ConsoleAppenderOptions<Record>>} options
   */
  constructor(options: Partial<ConsoleAppenderOptions<Record>> = {}) {
    this.config = {
      ...kDefaultConsoleAppenderConfig,
      ...options
    }
  }
}
