import { LevelKind, LevelNames } from "./Level"

export const isString = (s: any): s is string => typeof s === "string"

export function isLogLevelKind(o: any): o is LevelKind {
  return isString(o) && LevelNames.includes(o?.toLowerCase?.() as any)
}
