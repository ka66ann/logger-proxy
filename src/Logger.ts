import { assert, isDefined, isNumber } from "@3fv/guard"
import { asOption } from "@3fv/prelude-ts"
import { pick } from "lodash"
import { LevelKind, LevelThresholds } from "./Level"
import type { LoggingManager } from "./LoggingManager"
import type { LogRecord } from "./LogRecord"
import { isLogLevelKind, isString } from "./util"

export interface LoggerOptions {
  categoryInterpolator: CategoryInterpolator
}

export type CategoryInterpolator = (
  inCategory: string,
  options?: LoggerOptions
) => string

export const filenameCategoryInterpolator: CategoryInterpolator = (
  filename: string
) => {
  const allParts = filename.split("/")
  const rootIndex = Math.max(
    ...["src", "lib"].map((name) => allParts.indexOf(name))
  )
  const parts =
    rootIndex === -1 ? [allParts.pop()] : allParts.slice(rootIndex + 1)
  const category = asOption(parts.join(":"))
    .flatMap((cat) =>
      asOption(cat.lastIndexOf(".")).map((index) =>
        index === -1 ? cat : cat.slice(0, index)
      )
    )
    .get()
  return category
}

export const defaultLoggerOptions: LoggerOptions = {
  categoryInterpolator: filenameCategoryInterpolator
}

export function toLogRecord(
  logger: Logger,
  levelOrRecord: LevelKind | LogRecord,
  args: any[]
) {
  return isString(levelOrRecord)
    ? ({
        ...pick(logger, ["category"]),
        timestamp: Date.now(),
        message: args[0],
        level: levelOrRecord,
        args: args.slice(1)
      } as LogRecord)
    : levelOrRecord
}

export interface LoggerState {
  overrideLevel?: LevelKind
}

export class Logger {
  readonly state: LoggerState = {
    overrideLevel: null
  }

  get overrideLevel(): LevelKind {
    return asOption(this.state.overrideLevel)
      .filter(isLogLevelKind) //Predicate.of<LevelKind>(isString).and(isLogLevelKind))
      .getOrNull()
  }

  get overrideThreshold() {
    return asOption(this.overrideLevel)
      .map((level) => LevelThresholds[level])
      .getOrNull()
  }

  setOverrideLevel(inOverrideLevel: LevelKind) {
    const overrideLevel = (
      !inOverrideLevel ? null : inOverrideLevel.toLocaleLowerCase()
    ) as LevelKind

    assert(
      !isDefined(overrideLevel) || isLogLevelKind(overrideLevel),
      `Invalid override level, must be a log level, all lower case`
    )

    Object.assign(this.state, {
      overrideLevel
    })

    return this
  }

  /**
   * Base logging function
   *
   * @param record
   */
  log(record: LogRecord):void
  log(level: LevelKind, message: string, ...args: any[]):void
  log(levelOrRecord: LevelKind | LogRecord, ...args: any[]) {
    const record = toLogRecord(this, levelOrRecord, args)
    this.manager.fire(record)
  }

  /**
   * Factory for the log
   * level functions
   *
   * @param {LevelKind} level
   * @returns {(message: string, ...args: any[]) => void}
   * @private
   */
  private createLevelLogger(level: LevelKind) {
    const isEnabled = this.createLevelEnabled(level)
    return (message: string, ...args: any[]) => {
      if (isEnabled()) {
        this.log(level, message, ...args)
      }
    }
  }

  /**
   * Factory for is<Level>Enabled
   *
   * @param {LevelKind} level
   * @returns {() => boolean}
   * @private
   */
  private createLevelEnabled(level: LevelKind) {
    return () => {
      const { rootThreshold } = this.manager

      const globalOverrideThreshold = this.manager.determineThresholdOverride(this.category)
      const categoryThresholds = [
        globalOverrideThreshold,
        rootThreshold,
        this.overrideThreshold
      ].filter(isNumber)

      const categoryThreshold = Math.min(...categoryThresholds)

      const recordThreshold = LevelThresholds[level]

      return recordThreshold >= categoryThreshold
    }
  }

  readonly trace = this.createLevelLogger("trace")
  readonly debug = this.createLevelLogger("debug")
  readonly info = this.createLevelLogger("info")
  readonly warn = this.createLevelLogger("warn")
  readonly error = this.createLevelLogger("error")
  readonly fatal = this.createLevelLogger("fatal")

  readonly isTraceEnabled = this.createLevelEnabled("trace")
  readonly isDebugEnabled = this.createLevelEnabled("debug")
  readonly isInfoEnabled = this.createLevelEnabled("info")
  readonly isWarnEnabled = this.createLevelEnabled("warn")
  readonly isErrorEnabled = this.createLevelEnabled("error")
  readonly isFatalEnabled = this.createLevelEnabled("fatal")

  constructor(
    readonly manager: LoggingManager,
    readonly category: string,
    readonly options: LoggerOptions
  ) {}

  static hydrateOptions(options: Partial<LoggerOptions> = {}): LoggerOptions {
    return {
      ...defaultLoggerOptions,
      ...options
    }
  }

  static interoplateCategory(category: string, options: LoggerOptions) {
    options = {
      ...defaultLoggerOptions,
      ...options
    }
    return options.categoryInterpolator(category, options)
  }
}
