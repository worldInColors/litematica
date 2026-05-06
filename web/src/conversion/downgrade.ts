import { deserialize, serialize } from '@xmcl/nbt'
import type { NbtCompound, NbtList } from '../nbt'
import {
  Tags,
  ensureCompound,
  ensureList,
  getListElementSchema,
  getNumber,
  getPrototypeSchema,
  setInt,
  setList
} from '../nbt'
import { MINECRAFT_DATA_VERSION_1_20_4, SCHEMATIC_VERSION_V6, SCHEMATIC_VERSION_V7 } from '../constants'
import { fixEntityTypesFrom1_21_2 } from './conversionMaps'
import { downgradeBlockEntityTo_1_20_4, downgradeEntityTo_1_20_4 } from './downgradeConverter'

export interface DowngradeSummary {
  regions: number
  entities: number
  blockEntities: number
  minecraftDataVersion: number
  sourceVersion: number
}

export interface DowngradeResult {
  output: Uint8Array
  summary: DowngradeSummary
}

function inferListElementSchema(list: NbtList, fallback: any = {}): any {
  for (const entry of list) {
    if (entry == null) {
      continue
    }
    if (typeof entry === 'string') {
      return Tags.String
    }
    if (typeof entry === 'number') {
      return Tags.Int
    }
    if (typeof entry === 'bigint') {
      return Tags.Long
    }
    if (Array.isArray(entry)) {
      return Tags.List
    }
    if (typeof entry === 'object') {
      const schema = getPrototypeSchema(entry as NbtCompound)
      if (schema && Object.keys(schema).length > 0) {
        return schema
      }
    }
  }
  return fallback
}

function replaceList(parent: NbtCompound, key: string, items: NbtList): void {
  const existing = parent[key]
  if (Array.isArray(existing)) {
    existing.length = 0
    existing.push(...items)
    return
  }
  const schema = getListElementSchema(parent, key) ?? inferListElementSchema(items)
  setList(parent, key, items, schema)
}

export async function downgradeLitematicToV6(input: Uint8Array): Promise<DowngradeResult> {
  const root = (await deserialize(input, { compressed: 'gzip' })) as NbtCompound
  const sourceVersion = getNumber(root, 'Version', 0)
  if (sourceVersion !== SCHEMATIC_VERSION_V7) {
    throw new Error(`Unsupported schematic version ${sourceVersion}. Only v7 litematics are supported.`)
  }

  const minecraftDataVersion = getNumber(root, 'MinecraftDataVersion', 0)
  if (minecraftDataVersion < MINECRAFT_DATA_VERSION_1_20_4) {
    throw new Error(
      `Unsupported data version ${minecraftDataVersion}. Expected 1.20.4+ litematics for downgrade.`
    )
  }

  const regions = ensureCompound(root.Regions)
  const regionEntries = Object.entries(regions)
  if (regionEntries.length === 0) {
    throw new Error('No Regions found in the litematic file.')
  }

  let entityCount = 0
  let blockEntityCount = 0

  for (const [regionName, regionValue] of regionEntries) {
    const region = ensureCompound(regionValue)
    if ('TileEntities' in region) {
      const tiles = ensureList(region.TileEntities)
      const downgraded = tiles.map((entry) =>
        downgradeBlockEntityTo_1_20_4(ensureCompound(entry), minecraftDataVersion)
      )
      replaceList(region, 'TileEntities', downgraded)
      blockEntityCount += downgraded.length
    }
    if ('Entities' in region) {
      const entities = ensureList(region.Entities)
      const downgraded = entities.map((entry) =>
        downgradeEntityTo_1_20_4(fixEntityTypesFrom1_21_2(ensureCompound(entry)), minecraftDataVersion)
      )
      replaceList(region, 'Entities', downgraded)
      entityCount += downgraded.length
    }
    regions[regionName] = region
  }

  setInt(root, 'Version', SCHEMATIC_VERSION_V6)
  setInt(root, 'MinecraftDataVersion', MINECRAFT_DATA_VERSION_1_20_4)

  const output = await serialize(root, { compressed: 'gzip' })

  return {
    output,
    summary: {
      regions: regionEntries.length,
      entities: entityCount,
      blockEntities: blockEntityCount,
      minecraftDataVersion,
      sourceVersion
    }
  }
}
