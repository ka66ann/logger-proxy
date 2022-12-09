// noinspection JSValidateJSDoc

import type { LogContext } from "./LogContext"



export interface LogContextProvider {
  
  /**
   * Get current context stack
   *
   * @returns {any[]}
   */
  currentContext(): Array<LogContext>
  
  /**
   * Run in context
   *
   * @param {LogContext} context
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  runInContext<T = unknown>(context: LogContext, fn: () => Promise<T>): Promise<T>
}


/**
 * Dummy/Noop context provider
 *
 * @type {{currentContext(): Array<LogContext>, runInContext<T=unknown>(context: LogContext, fn: () => Promise<T>): Promise<T>}}
 */
export const DefaultLogContextProvider:LogContextProvider = {
  currentContext(): Array<LogContext> {
    return []
  },
  runInContext<T = unknown>(context: LogContext, fn: () => Promise<T>): Promise<T> {
    if (process.env.NODE_ENV === "development") {
      console.warn(`Attempting to use LogContext without any installed provider`)
    }
  
    return fn()
  }
}
