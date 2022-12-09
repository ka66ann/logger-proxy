import { assign, defaults } from "lodash"
import * as Path from "path"
import * as Fs from "fs"
import type { LogRecord } from "../LogRecord"
import type { Appender } from "../Appender"
import { asOption, Future } from "@3fv/prelude-ts"
import { get } from "lodash/fp"
import { padStart } from "lodash"
import { Buffer } from "buffer"
import { Deferred } from "@3fv/deferred"
import Debug from "debug"
import * as Bluebird from "bluebird"

const FsAsync = Fs.promises

const debug = Debug("3fv:logger:FileAppender")
const osTempDir = process.env.TMP ?? process.env.TEMP ?? "/tmp"
const tempDir = Fs.mkdtempSync(Path.join(osTempDir, "logger-proxy-example")) //
const getDefaultConfig = (): FileAppenderConfig => ({
  filename: Path.join(tempDir, "app.log"),
  prettyPrint: process.env.NODE_ENV !== "production",
  maxSize: -1,
  maxFiles: 5,
  enableRolling: false,
  sync: false
})

function applyConfigDefaults(options: FileAppenderOptions): FileAppenderConfig {
  return defaults(options, getDefaultConfig())
}

export interface FileAppenderConfig<Record extends LogRecord = any> {
  filename: string

  /**
   * For rolling
   */
  maxFiles: number

  /**
   * For rolling
   */
  maxSize: number

  enableRolling: boolean
  prettyPrint: boolean
  sync: boolean
}

export type FileAppenderOptions<Record extends LogRecord = any> = Partial<
  FileAppenderConfig<Record>
>

export class FileAppender<Record extends LogRecord>
  implements Appender<Record>
{
  readonly config: FileAppenderConfig<Record>

  private readonly state: {
    filename: string
    file: number
    flushing: boolean
    queue: Array<Buffer>
    ready: boolean
    error?: Error
    currentSize: number
    archivedFilenames: string[]
  } = {
    archivedFilenames: [],
    filename: undefined,
    file: undefined,
    ready: false,
    currentSize: 0,
    flushing: false,
    queue: []
  }

  get enableRolling() {
    return this.config.enableRolling
  }

  isReady() {
    return this.state.ready
  }

  /**
   * Initialize and setup the appender
   *
   * @returns {FileAppender<Record>}
   */
  setup(): FileAppender<Record> {
    const { state } = this
    if (!!state.ready) {
      return this
    }

    try {
      const { filename } = this
      const file = Fs.openSync(filename, "a")

      assign(state, {
        filename,
        file,
        ready: true
      })

      return this
    } catch (err) {
      assign(state, {
        error: err,
        file: undefined,
        ready: false
      })
      throw err
    }
  }

  /**
   * Only exposed for the sake of tests & examples
   * DO NOT USE
   *
   * This should all be async, but i was in a rush :(
   *
   * @returns
   */
  rollFile() {
    const { state, config } = this
    let { file, filename, archivedFilenames } = state
    if (!this.isReady() || !file) {
      debug(`Can not roll file before ready`)
      return
    }

    if (!this.enableRolling) {
      return
    }

    const fileCount = archivedFilenames.length + 1
    if (config.maxFiles < 1 || fileCount < config.maxFiles) {
      archivedFilenames.push(
        filename + "." + padStart(fileCount.toString(10), 4, "0")
      )
    }
    Fs.fdatasyncSync(file)
    Fs.closeSync(file)
    file = state.file = undefined
    const filenames = [filename, ...archivedFilenames]

    let dest: string = filenames.pop()
    while (filenames.length) {
      let src = filenames.pop()
      if (!Fs.existsSync(src)) {
        debug(`src does not exist, skipping ${src}`)
      } else {
        debug(`Moving src (${src}) to dest (${dest})`)
        if (Fs.existsSync(dest)) {
          Fs.unlinkSync(dest)
        }
        Fs.renameSync(src, dest)
        // if (src === filename) {
        //   Fs.copyFileSync(src, dest)
        //   Fs.truncateSync(src, 0)
        // } else {
        //   Fs.renameSync(src, dest)
        // }
      }
      dest = src
    }

    assign(state, {
      currentSize: 0,
      file: Fs.openSync(filename, "a")
    })
  }

  /**
   * Close the handler
   *
   * @returns {Promise<void>}
   */
  close() {
    return this.flush().onComplete(() =>
      asOption(this.state.file).map(Fs.closeSync)
    ).toPromise()
  }

  get queue() {
    return this.state.queue
  }

  get file() {
    return this.state.file
  }

  get flushing() {
    return this.state.flushing
  }

  get filename() {
    return (this.state.filename = this.state.filename ?? this.config.filename)
  }

  /**
   * Appends the log queue records to the file
   */
  private flush() {
    const { state } = this
    return Future.do(async () => {
      state.flushing = true
      try {
        const { file } = this
        if (!file) {
          throw Error(`${this.filename} was not opened properly`)
        }
        while (this.queue.length) {
          const buf: Buffer = this.queue.shift()

          await Bluebird.fromCallback((cb) =>
            Fs.appendFile(file, buf, "utf-8", cb)
          )

          state.currentSize += buf.byteLength
        }

        const { maxSize } = this.config
        if (maxSize > 0 && state.currentSize >= maxSize) {
          this.rollFile()
        }

        //await Bluebird.fromCallback((cb) => Fs.fdatasync(this.file, cb))
      } catch (err) {
        console.error(`Failed to append file ${this.filename}`, err)
      } finally {
        this.state.flushing = false
        if (this.queue.length) {
          queueMicrotask(() => this.flush())
        }
      }
    })
  }

  /**
   * Handle log records, transform, push to ES
   *
   * @param record
   */
  append(record: Record): void {
    try {
      const { queue, filename } = this.state
      const count = queue.length
      if (count > 999) {
        debug(
          `Too many log records (${count}) are in the queue without the file (${filename}) opening, skipping %O`,
          record
        )
        return
      }

      const data = this.config.prettyPrint
        ? JSON.stringify(record, null, 2)
        : JSON.stringify(record)
      queue.push(Buffer.from(data + "\n", "utf-8"))
      this.flush()
    } catch (err) {
      console.warn(`Failed to synchronize `, err)
    }
  }

  /**
   *
   * @param {Partial<FileAppenderOptions<Record>>} options
   */
  constructor(options: Partial<FileAppenderOptions<Record>> = {}) {
    this.config = applyConfigDefaults(options)

    assign(this.state, {
      filename: this.config.filename
    })

    this.setup()
    debug(`File appender is ready, logging to ${this.state.filename}`)
    //      return this
  }
}
