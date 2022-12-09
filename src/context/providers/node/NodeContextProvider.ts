import { AsyncLocalStorage } from "async_hooks"
import { uniq } from "lodash"
import type { LogContext } from "../../LogContext"
import type { LogContextProvider } from "../../LogContextProvider"
import { LogContextContainer } from "../../LogContextContainer"

const contextStorage = new AsyncLocalStorage<Array<LogContext>>()

function currentContextStore(): Array<LogContext> {
  return contextStorage.getStore() ?? []
}

class NodeContextProvider implements LogContextProvider {
  
  
  /**
   * Get current context stack
   *
   * @returns {any[]}
   */
  currentContext(): Array<LogContext> {
    return currentContextStore() ?? []
  }
  
  /**
   * Run in context
   *
   * @param {LogContext} context
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  runInContext<T = unknown>(
    context: LogContext,
    fn: () => Promise<T>
  ): Promise<T> {
    const contexts = currentContextStore()
    return contextStorage.run<Promise<T>, []>(uniq([...contexts, context]), fn)
  }
}

const instance = new NodeContextProvider()

LogContextContainer.setProvider(instance)

export {}
