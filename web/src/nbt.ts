import { TagType, getPrototypeOf, setPrototypeOf } from '@xmcl/nbt'
import type { NBTPrototype } from '@xmcl/nbt'

export type NbtCompound = Record<string, any>
export type NbtList<T = any> = T[]
export type NbtSchema = Record<string, any>

export const Tags = TagType

export function ensureCompound(value: unknown): NbtCompound {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as NbtCompound
  }
  return {}
}

export function ensureList<T = any>(value: unknown): NbtList<T> {
  return Array.isArray(value) ? (value as NbtList<T>) : []
}

export function getSchema(target: NbtCompound): NbtSchema {
  const schema = getPrototypeOf(target)
  if (schema) {
    return schema
  }
  const next: NbtSchema = {}
  setPrototypeOf(target, next as NBTPrototype)
  return next
}

export function getPrototypeSchema(target: NbtCompound): NbtSchema | undefined {
  return getPrototypeOf(target)
}

export function setSchemaKey(target: NbtCompound, key: string, type: any): void {
  const schema = getSchema(target)
  schema[key] = type
  setPrototypeOf(target, schema as NBTPrototype)
}

export function setTag(target: NbtCompound, key: string, value: any, type: any): void {
  setSchemaKey(target, key, type)
  target[key] = value
}

export function setCompound(target: NbtCompound, key: string, value: NbtCompound): void {
  const schema = getPrototypeOf(value) ?? {}
  setSchemaKey(target, key, schema)
  target[key] = value
}

export function setList(target: NbtCompound, key: string, value: NbtList, elementType: any): void {
  setSchemaKey(target, key, [elementType])
  target[key] = value
}

export function createCompound(): NbtCompound {
  const obj: NbtCompound = {}
  setPrototypeOf(obj, {} as NBTPrototype)
  return obj
}

export function createList<T = any>(items: T[] = []): NbtList<T> {
  return items
}

export function copyTag(source: NbtCompound, target: NbtCompound, key: string): void {
  const schema = getPrototypeOf(source)
  if (schema && typeof schema[key] !== 'undefined') {
    setSchemaKey(target, key, schema[key])
  }
  target[key] = source[key]
}

export function copyTagAs(source: NbtCompound, sourceKey: string, target: NbtCompound, targetKey: string): void {
  const schema = getPrototypeOf(source)
  if (schema && typeof schema[sourceKey] !== 'undefined') {
    setSchemaKey(target, targetKey, schema[sourceKey])
  }
  target[targetKey] = source[sourceKey]
}

export function getListElementSchema(source: NbtCompound, key: string): any | undefined {
  const schema = getPrototypeOf(source)
  if (schema && Array.isArray(schema[key])) {
    return schema[key][0]
  }
  return undefined
}

export function getString(source: NbtCompound, key: string, fallback = ''): string {
  const value = source[key]
  return typeof value === 'string' ? value : fallback
}

export function getNumber(source: NbtCompound, key: string, fallback = 0): number {
  const value = source[key]
  return typeof value === 'number' ? value : fallback
}

export function getBoolean(source: NbtCompound, key: string, fallback = false): boolean {
  const value = source[key]
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  return fallback
}

export function getLong(source: NbtCompound, key: string, fallback = 0n): bigint {
  const value = source[key]
  if (typeof value === 'bigint') {
    return value
  }
  if (typeof value === 'number') {
    return BigInt(Math.trunc(value))
  }
  return fallback
}

export function setString(target: NbtCompound, key: string, value: string): void {
  setTag(target, key, value, Tags.String)
}

export function setInt(target: NbtCompound, key: string, value: number): void {
  setTag(target, key, value, Tags.Int)
}

export function setShort(target: NbtCompound, key: string, value: number): void {
  setTag(target, key, value, Tags.Short)
}

export function setByte(target: NbtCompound, key: string, value: number): void {
  setTag(target, key, value, Tags.Byte)
}

export function setBoolean(target: NbtCompound, key: string, value: boolean): void {
  setByte(target, key, value ? 1 : 0)
}

export function setFloat(target: NbtCompound, key: string, value: number): void {
  setTag(target, key, value, Tags.Float)
}

export function setDouble(target: NbtCompound, key: string, value: number): void {
  setTag(target, key, value, Tags.Double)
}

export function setLong(target: NbtCompound, key: string, value: bigint | number): void {
  setTag(target, key, typeof value === 'bigint' ? value : BigInt(Math.trunc(value)), Tags.Long)
}

export function setIntArray(target: NbtCompound, key: string, value: number[]): void {
  setTag(target, key, value, Tags.IntArray)
}

export function setLongArray(target: NbtCompound, key: string, value: Array<bigint | number>): void {
  const normalized = value.map((entry) => (typeof entry === 'bigint' ? entry : BigInt(Math.trunc(entry))))
  setTag(target, key, normalized, Tags.LongArray)
}

export function setByteArray(target: NbtCompound, key: string, value: number[] | Uint8Array): void {
  const arr = Array.isArray(value) ? value : Array.from(value)
  setTag(target, key, arr, Tags.ByteArray)
}

export function toSignedInt32(value: bigint | number): number {
  const asBigInt = typeof value === 'bigint' ? value : BigInt(Math.trunc(value))
  return Number(BigInt.asIntN(32, asBigInt))
}

export function uuidStringToIntArray(uuid: string): number[] {
  const cleaned = uuid.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(cleaned)) {
    return [0, 0, 0, 0]
  }
  const high = BigInt(`0x${cleaned.slice(0, 16)}`)
  const low = BigInt(`0x${cleaned.slice(16)}`)
  return [
    toSignedInt32(high >> 32n),
    toSignedInt32(high & 0xffffffffn),
    toSignedInt32(low >> 32n),
    toSignedInt32(low & 0xffffffffn)
  ]
}

export function uuidLongsToIntArray(longPair: Array<bigint | number>): number[] {
  if (longPair.length < 2) {
    return [0, 0, 0, 0]
  }
  const high = typeof longPair[0] === 'bigint' ? longPair[0] : BigInt(Math.trunc(longPair[0]))
  const low = typeof longPair[1] === 'bigint' ? longPair[1] : BigInt(Math.trunc(longPair[1]))
  return [
    toSignedInt32(high >> 32n),
    toSignedInt32(high & 0xffffffffn),
    toSignedInt32(low >> 32n),
    toSignedInt32(low & 0xffffffffn)
  ]
}
