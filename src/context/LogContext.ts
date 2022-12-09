import { Appender } from "../Appender"
import { Level } from "../Level"
import { LogContextProvider } from "./LogContextProvider"
import { LogContextContainer } from "./LogContextContainer"






export class LogContext {
  /**
   * Threshold override level
   *
   * @type {Level}
   */
  readonly thresholdLevel: Level

  /**
   * If specified, only categories that match will
   * use this context
   *
   * @type {RegExp}
   */
  readonly pattern: RegExp

  /**
   * Exclusive, only use this config in context.  Defaults to `false`
   *
   * @type {boolean}
   */
  readonly exclusive: RegExp
  
  /**
   * Use a logger context within
   *
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  use<T = unknown>(fn: () => Promise<T>) {
    return LogContextContainer.runInContext(this, fn)
  }
  
  /**
   * Creates a new logger context
   *
   * @param {Appender[]} appenders - additional appenders for the context
   * @param {LoggerContextOptions} options -
   */
  protected constructor(
    readonly appenders: Appender[],
    options: LoggerContextOptions
  ) {
    Object.assign(this, {
      exclusive: false,
      thresholdLevel: null,
      pattern: null,
      ...options
    })
  }

  /**
   * Create a new logger context
   *
   * @param {Appender[]} appenders
   * @param {LoggerContextOptions} options
   * @returns {LogContext}
   */
  static with(appenders: Appender[], options: LoggerContextOptions = {}) {
    return new LogContext(appenders, options)
  }
}

export type LoggerContextOptions = Partial<Pick<LogContext, "pattern" | "exclusive">>
