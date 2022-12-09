import { LogRecord } from "./LogRecord"

export interface Appender<Record extends LogRecord = any> {
  append(record: Record): void
}
