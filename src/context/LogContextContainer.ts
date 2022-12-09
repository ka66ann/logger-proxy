import { LogContext } from "./LogContext"
import { DefaultLogContextProvider, LogContextProvider } from "./LogContextProvider"

const state = {
  provider: DefaultLogContextProvider as LogContextProvider
}


export namespace LogContextContainer  {
  
  export function setProvider(provider: LogContextProvider) {
    state.provider = provider ?? DefaultLogContextProvider
  }
  
  export function getProvider():LogContextProvider {
    return state.provider ?? DefaultLogContextProvider
  }
  
  export function currentContext(): Array<LogContext> {
    return getProvider().currentContext?.() ?? []
  }
  
  export function runInContext<T = unknown>(context: LogContext, fn: () => Promise<T>): Promise<T> {
    const provider = getProvider()
    return provider.runInContext(context,fn)
  }
  
}
