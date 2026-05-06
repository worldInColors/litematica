import type { NbtCompound, NbtList } from '../nbt'
import { ensureCompound, ensureList, getListElementSchema, getString, setList, setString } from '../nbt'

export function fixItemTypesFrom1_21_2(nbt: NbtCompound): NbtCompound {
  if (!('id' in nbt)) {
    return nbt
  }

  const id = getString(nbt, 'id', '')
  let newId: string | null = null

  switch (id) {
    case 'minecraft:pale_oak_boat':
      newId = 'minecraft:oak_boat'
      break
    case 'minecraft:pale_oak_chest_boat':
      newId = 'minecraft:oak_chest_boat'
      break
    default:
      break
  }

  if (newId) {
    setString(nbt, 'id', newId)
  }

  return nbt
}

export function fixItemsTag(items: NbtList): NbtList {
  const oldItems = ensureList(items)
  const newList: NbtList = []

  for (let i = 0; i < oldItems.length; i += 1) {
    const entry = fixItemTypesFrom1_21_2(ensureCompound(oldItems[i]))

    if ('tag' in entry) {
      const tag = entry.tag as NbtCompound | null | undefined
      if (tag == null) {
        delete entry.tag
      } else if (tag && typeof tag === 'object') {
        if ('BlockEntityTag' in tag) {
          const blockEntityTag = ensureCompound(tag.BlockEntityTag)
          if ('Items' in blockEntityTag) {
            const nested = fixItemsTag(blockEntityTag.Items as NbtList)
            const elementSchema = getListElementSchema(blockEntityTag, 'Items') ?? {}
            setList(blockEntityTag, 'Items', nested, elementSchema)
          }
          tag.BlockEntityTag = blockEntityTag
        }
        entry.tag = tag
      }
    }

    newList.push(entry)
  }

  return newList
}

export function fixEntityTypesFrom1_21_2(nbt: NbtCompound): NbtCompound {
  if (!('id' in nbt)) {
    return nbt
  }

  if ('Items' in nbt) {
    const items = fixItemsTag(ensureList(nbt.Items))
    const elementSchema = getListElementSchema(nbt, 'Items') ?? {}
    setList(nbt, 'Items', items, elementSchema)
  }

  const id = getString(nbt, 'id', '')
  let newId: string | null = null
  let type = ''
  let boatFix = false

  switch (id) {
    case 'minecraft:oak_boat':
    case 'minecraft:pale_oak_boat':
      newId = 'minecraft:boat'
      type = 'oak'
      boatFix = true
      break
    case 'minecraft:spruce_boat':
      newId = 'minecraft:boat'
      type = 'spruce'
      boatFix = true
      break
    case 'minecraft:birch_boat':
      newId = 'minecraft:boat'
      type = 'birch'
      boatFix = true
      break
    case 'minecraft:jungle_boat':
      newId = 'minecraft:boat'
      type = 'jungle'
      boatFix = true
      break
    case 'minecraft:acacia_boat':
      newId = 'minecraft:boat'
      type = 'acacia'
      boatFix = true
      break
    case 'minecraft:cherry_boat':
      newId = 'minecraft:boat'
      type = 'cherry'
      boatFix = true
      break
    case 'minecraft:dark_oak_boat':
      newId = 'minecraft:boat'
      type = 'dark_oak'
      boatFix = true
      break
    case 'minecraft:mangrove_boat':
      newId = 'minecraft:boat'
      type = 'mangrove'
      boatFix = true
      break
    case 'minecraft:bamboo_raft':
      newId = 'minecraft:boat'
      type = 'bamboo'
      boatFix = true
      break
    case 'minecraft:oak_chest_boat':
    case 'minecraft:pale_oak_chest_boat':
      newId = 'minecraft:chest_boat'
      type = 'oak'
      boatFix = true
      break
    case 'minecraft:spruce_chest_boat':
      newId = 'minecraft:chest_boat'
      type = 'spruce'
      boatFix = true
      break
    case 'minecraft:birch_chest_boat':
      newId = 'minecraft:chest_boat'
      type = 'birch'
      boatFix = true
      break
    case 'minecraft:jungle_chest_boat':
      newId = 'minecraft:chest_boat'
      type = 'jungle'
      boatFix = true
      break
    case 'minecraft:acacia_chest_boat':
      newId = 'minecraft:chest_boat'
      type = 'acacia'
      boatFix = true
      break
    case 'minecraft:cherry_chest_boat':
      newId = 'minecraft:chest_boat'
      type = 'cherry'
      boatFix = true
      break
    case 'minecraft:dark_oak_chest_boat':
      newId = 'minecraft:chest_boat'
      type = 'dark_oak'
      boatFix = true
      break
    case 'minecraft:mangrove_chest_boat':
      newId = 'minecraft:chest_boat'
      type = 'mangrove'
      boatFix = true
      break
    case 'minecraft:bamboo_chest_raft':
      newId = 'minecraft:chest_boat'
      type = 'bamboo'
      boatFix = true
      break
    default:
      if (id.includes('_chest_boat')) {
        newId = 'minecraft:chest_boat'
        type = 'oak'
        boatFix = true
      } else if (id.includes('_boat')) {
        newId = 'minecraft:boat'
        type = 'oak'
        boatFix = true
      }
      break
  }

  if (newId) {
    setString(nbt, 'id', newId)
  }

  if (boatFix) {
    setString(nbt, 'Type', type)
  }

  return nbt
}

export function checkForIdTag(tags: NbtCompound): NbtCompound {
  if ('id' in tags) {
    return tags
  }

  if ('Id' in tags) {
    setString(tags, 'id', getString(tags, 'Id', ''))
    return tags
  }

  if ('Bees' in tags || 'bees' in tags) {
    setString(tags, 'id', 'minecraft:beehive')
  } else if ('TransferCooldown' in tags && 'Items' in tags) {
    setString(tags, 'id', 'minecraft:hopper')
  } else if ('SkullOwner' in tags) {
    setString(tags, 'id', 'minecraft:skull')
  } else if ('Patterns' in tags || 'patterns' in tags) {
    setString(tags, 'id', 'minecraft:banner')
  } else if ('Sherds' in tags || 'sherds' in tags) {
    setString(tags, 'id', 'minecraft:decorated_pot')
  } else if ('last_interacted_slot' in tags && 'Items' in tags) {
    setString(tags, 'id', 'minecraft:chiseled_bookshelf')
  } else if ('CookTime' in tags && 'Items' in tags) {
    setString(tags, 'id', 'minecraft:furnace')
  } else if ('RecordItem' in tags) {
    setString(tags, 'id', 'minecraft:jukebox')
  } else if ('Book' in tags || 'book' in tags) {
    setString(tags, 'id', 'minecraft:lectern')
  } else if ('front_text' in tags) {
    setString(tags, 'id', 'minecraft:sign')
  } else if ('BrewTime' in tags || 'Fuel' in tags) {
    setString(tags, 'id', 'minecraft:brewing_stand')
  } else if (
    ('LootTable' in tags && 'LootTableSeed' in tags) ||
    'hit_direction' in tags ||
    'item' in tags
  ) {
    setString(tags, 'id', 'minecraft:suspicious_sand')
  } else if ('SpawnData' in tags || 'SpawnPotentials' in tags) {
    setString(tags, 'id', 'minecraft:spawner')
  } else if ('normal_config' in tags) {
    setString(tags, 'id', 'minecraft:trial_spawner')
  } else if ('shared_data' in tags) {
    setString(tags, 'id', 'minecraft:vault')
  } else if ('pool' in tags && 'final_state' in tags && 'placement_priority' in tags) {
    setString(tags, 'id', 'minecraft:jigsaw')
  } else if ('author' in tags && 'metadata' in tags && 'showboundingbox' in tags) {
    setString(tags, 'id', 'minecraft:structure_block')
  } else if ('ExactTeleport' in tags && 'Age' in tags) {
    setString(tags, 'id', 'minecraft:end_gateway')
  } else if ('Items' in tags) {
    setString(tags, 'id', 'minecraft:chest')
  } else if ('last_vibration_frequency' in tags || 'listener' in tags) {
    setString(tags, 'id', 'minecraft:sculk_sensor')
  } else if ('warning_level' in tags || 'listener' in tags) {
    setString(tags, 'id', 'minecraft:sculk_shrieker')
  } else if ('OutputSignal' in tags) {
    setString(tags, 'id', 'minecraft:comparator')
  } else if ('facing' in tags || 'extending' in tags) {
    setString(tags, 'id', 'minecraft:piston')
  } else if ('x' in tags && 'y' in tags && 'z' in tags) {
    setString(tags, 'id', 'minecraft:piston')
  }

  if ('Items' in tags) {
    const items = fixItemsTag(ensureList(tags.Items))
    const elementSchema = getListElementSchema(tags, 'Items') ?? {}
    setList(tags, 'Items', items, elementSchema)
  }

  return tags
}
