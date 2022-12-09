import { isNumber, isObject, isString } from "@3fv/guard"
import { asOption, Option } from "@3fv/prelude-ts"
import { flatten, isEmpty, min, negate } from "lodash"
import type { Appender } from "./Appender"
import { ConsoleAppender } from "./appenders"
import { Level, LevelKind, LevelThresholds } from "./Level"
import { Logger, LoggerOptions } from "./Logger"
import type { LogRecord } from "./LogRecord"
import { LogContextContainer } from "./context"
import { flow, get, nth } from "lodash/fp"

export type CategoryMatch = RegExp | string

export type ThresholdOverride = [match: CategoryMatch, level: LevelKind]

export interface LoggingManagerState<Record extends LogRecord> {
  rootLevel: LevelKind
  appenders: Array<Appender<Record>>
  thresholdOverrides: Array<ThresholdOverride>
}

export type LoggingManagerOptions<Record extends LogRecord> = Partial<
  LoggingManagerState<Record>
>

function parseThresholdOverridePatterns(
  value: string,
  level: LevelKind = "debug"
): ThresholdOverride[] {
  return value
    .split(",")
    .map((s) => [new RegExp(s), level] as ThresholdOverride)
}

export const kEnvThresholdOverrides = asOption(typeof process !== "undefined" && process.env.DEBUG_PATTERNS)
  .filter(negate(isEmpty))
  .map(parseThresholdOverridePatterns)
  .getOrElse([])

/**
 * Logging manager
 */
export class LoggingManager<Record extends LogRecord = any> {
  private readonly loggers = new Map<string, Logger>()

  private readonly state: LoggingManagerState<Record> = {
    appenders: [],
    rootLevel: Level.info,
    thresholdOverrides: kEnvThresholdOverrides
  }

  get rootLevel() {
    return this.state.rootLevel
  }

  set rootLevel(newRootLevel: LevelKind) {
    this.state.rootLevel = newRootLevel
  }

  get rootThreshold() {
    return LevelThresholds[this.rootLevel]
  }

  /**
   * Get the current handler
   *
   * @returns {Appender<Record>}
   */
  get appenders(): Array<Appender<Record>> {
    return asOption(this.state.appenders)
      .filter((appenders) => appenders.length > 0)
      .getOrCall(() => {
        this.state.appenders.push(new ConsoleAppender())
        return this.state.appenders
      })
  }
  
  /**
   * Global threshold overrides
   */
  get thresholdOverrides() {
    return this.state.thresholdOverrides
  }
  
  /**
   * Update the overrides
   *
   * @param newOverrides
   */
  set thresholdOverrides(newOverrides:ThresholdOverride[]) {
    this.state.thresholdOverrides = newOverrides
  }
  
  /**
   * Set global appenders
   *
   * @param {Array<Appender<Record>>} newAppenders
   */
  setAppenders(...newAppenders: Array<Appender<Record> | Appender<Record>[]>) {
    // WE MUTATE DO TO THE LIKELIHOOD OF SOMEONE HOLDING A REF TO THE ARRAY,
    // CONVERT TO OBSERVABLE AT SOME POINT
    const persistentAppenders = this.state.appenders
    persistentAppenders.length = 0
    persistentAppenders.push(...flatten(newAppenders))

    return this
  }
  
  /**
   * Add one or more appenders to existing appender set
   *
   * @param {Appender<Record> | Appender<Record>[]} newAppenders
   * @returns {this<Record>}
   */
  addAppenders(...newAppenders: Array<Appender<Record> | Appender<Record>[]>) {
    this.state.appenders.push(...flatten(newAppenders))
    return this
  }
  
  /**
   * Clear threshold overrides
   *
   * @returns {this<Record>}
   */
  clearThresholdOverrides() {
    this.state.thresholdOverrides.length = 0
    return this
  }

  setThresholdOverrides(...overrides: Array<ThresholdOverride>) {
    this.state.thresholdOverrides.length = 0
    this.state.thresholdOverrides.push(...overrides)
    return this
  }

  addThresholdOverrides(...overrides: Array<ThresholdOverride>) {
    this.state.thresholdOverrides.push(...overrides)
    return this
  }

  /**
   * Get applicable current contexts
   *
   * @param {string} category
   * @returns {LogContext[]}
   */
  getApplicableCurrentContexts(category: string) {
    return LogContextContainer.currentContext().filter(
      ({ pattern }) => !pattern || pattern.test(category)
    )
  }

  /**
   * Check for any matching threshold overrides
   *
   * @param category
   */
  determineThresholdOverride(category: string): number {
    const contexts = this.getApplicableCurrentContexts(category),
      
    // FIND CONFIGURED OVERRIDE LEVEL
      overrideThreshold = asOption(
        this.thresholdOverrides.find(([match]) =>
          isString(match) ? match === category : match.test(category)
        )
      )
        .map(nth(1))
        .map((level) => LevelThresholds[level as Level])
        .getOrNull(),
      // FIND `LogContext` OVERRIDE LEVEL
      contextThresholds = contexts
        .filter(flow(get("thresholdLevel"), isString))
        .map(({ thresholdLevel }) => LevelThresholds[thresholdLevel]),
      // IF ANY OVERRIDES, GET THE MOST VERBOSE LEVEL
      override = asOption(
        [...contextThresholds, overrideThreshold].filter(isNumber)
      )
        .filter(negate(isEmpty))
        .map(min)
        .getOrNull()

    return override
  }
  
  /**
   * Set the root logging level
   *
   * @param {LevelKind} newLevel
   * @returns {this<Record>}
   */
  setRootLevel(newLevel: LevelKind) {
    this.state.rootLevel = newLevel
    return this
  }
  
  /**
   * Fire a log event, eventually
   * invert this by making `Logger` an
   * `EventEmitter3` and having the `LoggingManager`
   * subscribe to `record` event
   *
   * @param {LogRecord<Record>} record
   * @internal
   */
  fire(record: LogRecord<Record>) {
    const { category } = record,
      contexts = this.getApplicableCurrentContexts(category),
      contextAppenders = contexts.flatMap(get("appenders")),
      appenders = [...this.appenders, ...contextAppenders]

    appenders.forEach((appender) => appender.append(record as Record))
  }
  
  /**
   * Get a logger from cache, if the category
   * does not have an existing logger, then create one.
   *
   * @param {string} categoryOrFilename
   * @param {Partial<LoggerOptions>} inOptions
   * @returns {Logger}
   */
  getLogger(
    categoryOrFilename: string,
    inOptions: Partial<LoggerOptions> = {}
  ): Logger {
    const options = Logger.hydrateOptions(inOptions)
    const category = Logger.interoplateCategory(categoryOrFilename, options)

    return asOption(category)
      .map((category) => this.loggers.get(category))
      .getOrCall(() => {
        const logger = new Logger(this, category, options)
        this.loggers.set(category, logger)
        return logger
      })
  }

  /**
   * Configure the logging manager,
   * this function is additive, so simply calling
   * `configure` with a single option `rootLevel`,
   * will not affect other options like `appenders`   *
   *
   * @param {LoggingManagerOptions<any>} options
   * @returns {this<Record>}
   */
  configure(options: LoggingManagerOptions<any>) {
    if (Level[options?.rootLevel]) {
      this.setRootLevel(options.rootLevel)
    }

    if (options?.appenders) {
      this.setAppenders(options.appenders)
    }

    if (options?.thresholdOverrides) {
      this.addThresholdOverrides(...options.thresholdOverrides)
    }

    return this
  }

  private constructor() {
    this.configure({})
  }
  
  /**
   * Singleton instance
   *
   * @type {LoggingManager}
   * @private
   */
  private static manager: LoggingManager
  
  /**
   * Get logging manager and optionally provided
   * configuration options
   *
   * @param {LoggingManagerOptions<Record>} options
   * @returns {LoggingManager<Record>}
   */
  static get<Record extends LogRecord = any>(
    options: LoggingManagerOptions<Record> = null
  ): LoggingManager<Record> {
    if (!this.manager) {
      this.manager = new LoggingManager<Record>()
    }

    if (options) {
      this.manager.configure(options)
    }

    return this.manager
  }
}

export function getLoggingManager(): LoggingManager {
  return LoggingManager.get()
}

if (Option.try(() => process.env.NODE_ENV === "development").getOrElse(false)) {
  [typeof window !== "undefined" && window, typeof global !== "undefined" && global].filter(isObject)
    .map(target => Object.assign(target, {
      loggingManager: getLoggingManager()
    }))
}