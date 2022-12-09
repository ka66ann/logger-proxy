import type { LogRecord } from "./LogRecord"

export type Formatter<
  Output,
  Context extends {} = {},
  Data = any,
  Record extends LogRecord<Data> = LogRecord<Data>
> = (record: Record, options?: Context) => Output
