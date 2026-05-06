import type { NbtCompound, NbtList } from '../nbt'
import {
  Tags,
  createCompound,
  createList,
  copyTag,
  copyTagAs,
  ensureCompound,
  ensureList,
  getBoolean,
  getPrototypeSchema,
  getLong,
  getNumber,
  getString,
  setBoolean,
  setByte,
  setCompound,
  setDouble,
  setFloat,
  setInt,
  setIntArray,
  setList,
  setLong,
  setShort,
  setString,
  uuidLongsToIntArray,
  uuidStringToIntArray
} from '../nbt'
import { checkForIdTag } from './conversionMaps'

const DEFAULT_EQUIPMENT_DROP_CHANCE = 0.085

const DAMAGEABLE_SUFFIXES = [
  '_sword',
  '_pickaxe',
  '_axe',
  '_shovel',
  '_hoe',
  '_helmet',
  '_chestplate',
  '_leggings',
  '_boots'
]

const DAMAGEABLE_ITEMS = new Set([
  'minecraft:bow',
  'minecraft:crossbow',
  'minecraft:trident',
  'minecraft:shield',
  'minecraft:elytra',
  'minecraft:flint_and_steel',
  'minecraft:shears',
  'minecraft:fishing_rod',
  'minecraft:carrot_on_a_stick',
  'minecraft:warped_fungus_on_a_stick',
  'minecraft:brush',
  'minecraft:mace'
])

const DYE_COLOR_IDS: Record<string, number> = {
  white: 0,
  orange: 1,
  magenta: 2,
  light_blue: 3,
  yellow: 4,
  lime: 5,
  pink: 6,
  gray: 7,
  light_gray: 8,
  cyan: 9,
  purple: 10,
  blue: 11,
  brown: 12,
  green: 13,
  red: 14,
  black: 15
}

function isEmptyCompound(tag: NbtCompound): boolean {
  return Object.keys(tag).length === 0
}

function mergeCompound(target: NbtCompound, source: NbtCompound): void {
  Object.keys(source).forEach((key) => {
    copyTag(source, target, key)
  })
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

function normalizeJsonText(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw))
  } catch {
    return raw
  }
}

function collapseText(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw)
    const text = extractText(parsed)
    return text || null
  } catch {
    return null
  }
}

function extractText(node: any): string {
  if (typeof node === 'string') {
    return node
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('')
  }
  if (node && typeof node === 'object') {
    const base = typeof node.text === 'string' ? node.text : ''
    const extra = Array.isArray(node.extra) ? node.extra.map(extractText).join('') : ''
    return base + extra
  }
  return ''
}

function readUuid(entry: NbtCompound): number[] {
  const uuid = entry.UUID ?? entry.uuid ?? entry.Id ?? entry.id
  if (Array.isArray(uuid)) {
    if (uuid.length === 4) {
      return uuid.map((value) => (typeof value === 'number' ? value : Number(value)))
    }
    if (uuid.length === 2) {
      return uuidLongsToIntArray(uuid)
    }
  }
  if (typeof uuid === 'string') {
    return uuidStringToIntArray(uuid)
  }
  return [0, 0, 0, 0]
}

function needsDamageTag(id: string): boolean {
  if (DAMAGEABLE_ITEMS.has(id)) {
    return true
  }
  return DAMAGEABLE_SUFFIXES.some((suffix) => id.endsWith(suffix))
}

function processBlockPosTag(oldPos: { x: number; y: number; z: number } | null, prefix: string, newTags: NbtCompound): void {
  if (!oldPos) {
    return
  }
  setInt(newTags, `${prefix}X`, oldPos.x)
  setInt(newTags, `${prefix}Y`, oldPos.y)
  setInt(newTags, `${prefix}Z`, oldPos.z)
}

function readBlockPos(value: any): { x: number; y: number; z: number } | null {
  if (Array.isArray(value) && value.length >= 3) {
    return { x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) }
  }
  if (value && typeof value === 'object') {
    const x = value.x ?? value.X
    const y = value.y ?? value.Y
    const z = value.z ?? value.Z
    if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
      return { x, y, z }
    }
  }
  return null
}

function processEntityDropChances(nbtElement: any): NbtCompound {
  const oldTags = ensureCompound(nbtElement)
  const newTags = createCompound()
  const handDrops = createList<number>([DEFAULT_EQUIPMENT_DROP_CHANCE, DEFAULT_EQUIPMENT_DROP_CHANCE])
  const armorDrops = createList<number>([
    DEFAULT_EQUIPMENT_DROP_CHANCE,
    DEFAULT_EQUIPMENT_DROP_CHANCE,
    DEFAULT_EQUIPMENT_DROP_CHANCE,
    DEFAULT_EQUIPMENT_DROP_CHANCE
  ])

  Object.keys(oldTags).forEach((key) => {
    switch (key) {
      case 'mainhand':
        handDrops[0] = getNumber(oldTags, key, DEFAULT_EQUIPMENT_DROP_CHANCE)
        break
      case 'offhand':
        handDrops[1] = getNumber(oldTags, key, DEFAULT_EQUIPMENT_DROP_CHANCE)
        break
      case 'feet':
        armorDrops[0] = getNumber(oldTags, key, DEFAULT_EQUIPMENT_DROP_CHANCE)
        break
      case 'legs':
        armorDrops[1] = getNumber(oldTags, key, DEFAULT_EQUIPMENT_DROP_CHANCE)
        break
      case 'chest':
        armorDrops[2] = getNumber(oldTags, key, DEFAULT_EQUIPMENT_DROP_CHANCE)
        break
      case 'head':
        armorDrops[3] = getNumber(oldTags, key, DEFAULT_EQUIPMENT_DROP_CHANCE)
        break
      default:
        break
    }
  })

  setList(newTags, 'HandDropChances', handDrops, Tags.Float)
  setList(newTags, 'ArmorDropChances', armorDrops, Tags.Float)

  return newTags
}

function processEntityEquipment(entries: any, minecraftDataVersion: number): NbtCompound {
  const oldTags = ensureCompound(entries)
  const newTags = createCompound()
  const newHandItems = createList<NbtCompound>([createCompound(), createCompound()])
  const newArmorItems = createList<NbtCompound>([
    createCompound(),
    createCompound(),
    createCompound(),
    createCompound()
  ])

  Object.keys(oldTags).forEach((key) => {
    switch (key) {
      case 'mainhand':
        newHandItems[0] = processEntityItem(oldTags[key], minecraftDataVersion)
        break
      case 'offhand':
        newHandItems[1] = processEntityItem(oldTags[key], minecraftDataVersion)
        break
      case 'feet':
        newArmorItems[0] = processEntityItem(oldTags[key], minecraftDataVersion)
        break
      case 'legs':
        newArmorItems[1] = processEntityItem(oldTags[key], minecraftDataVersion)
        break
      case 'chest':
        newArmorItems[2] = processEntityItem(oldTags[key], minecraftDataVersion)
        break
      case 'head':
        newArmorItems[3] = processEntityItem(oldTags[key], minecraftDataVersion)
        break
      case 'body': {
        const entry = processEntityItem(oldTags[key], minecraftDataVersion)
        newArmorItems[2] = entry
        setCompound(newTags, 'ArmorItem', entry)
        break
      }
      case 'saddle':
        setCompound(newTags, 'SaddleItem', processEntityItem(oldTags[key], minecraftDataVersion))
        break
      default:
        break
    }
  })

  setList(newTags, 'HandItems', newHandItems, inferListElementSchema(newHandItems))
  setList(newTags, 'ArmorItems', newArmorItems, inferListElementSchema(newArmorItems))

  return newTags
}


function processEntityItem(itemEntry: any, minecraftDataVersion: number): NbtCompound {
  const oldItem = ensureCompound(itemEntry)
  const newItem = createCompound()

  if (!('id' in oldItem)) {
    return oldItem
  }

  const idName = getString(oldItem, 'id', '')
  setString(newItem, 'id', idName)

  if ('count' in oldItem) {
    setByte(newItem, 'Count', getNumber(oldItem, 'count', 1))
  }

  if ('components' in oldItem) {
    setCompound(newItem, 'tag', processComponentsTag(ensureCompound(oldItem.components), idName, minecraftDataVersion))
  } else if (needsDamageTag(idName)) {
    const newTag = createCompound()
    setInt(newTag, 'Damage', 0)
    setCompound(newItem, 'tag', newTag)
  }

  return newItem
}

function processEntityItems(oldItems: NbtList, minecraftDataVersion: number, expectedSize: number): NbtList {
  const newItems = createList<NbtCompound>()
  const list = ensureList(oldItems)

  list.forEach((item) => {
    const itemEntry = ensureCompound(item)
    const newEntry = createCompound()
    if ('id' in itemEntry) {
      const idName = getString(itemEntry, 'id', '')
      setString(newEntry, 'id', idName)
      if ('count' in itemEntry) {
        setByte(newEntry, 'Count', getNumber(itemEntry, 'count', 1))
      } else {
        setByte(newEntry, 'Count', 1)
      }
      if ('components' in itemEntry) {
        setCompound(newEntry, 'tag', processComponentsTag(ensureCompound(itemEntry.components), idName, minecraftDataVersion))
      } else if (needsDamageTag(idName)) {
        const newTag = createCompound()
        setInt(newTag, 'Damage', 0)
        setCompound(newEntry, 'tag', newTag)
      }
    }
    newItems.push(newEntry)
  })

  if (newItems.length < expectedSize) {
    const addTotal = expectedSize - newItems.length
    for (let i = 0; i < addTotal; i += 1) {
      newItems.splice(i, 0, createCompound())
    }
  }

  return newItems
}

function processAttributes(attrib: any): any {
  const oldAttrList = ensureList(attrib)
  if (oldAttrList.length === 0) {
    const oldTag = ensureCompound(attrib)
    if (isEmptyCompound(oldTag)) {
      return attrib
    }
    for (const key of Object.keys(oldTag)) {
      if (key === 'modifiers') {
        return processAttributeModifiers(ensureList(oldTag[key]))
      }
    }
  }
  return processAttributeBase(oldAttrList)
}

function processAttributeBase(oldAttr: NbtList): NbtList {
  const newAttr = createList<NbtCompound>()

  ensureList(oldAttr).forEach((entry) => {
    const attrEntry = ensureCompound(entry)
    const newEntry = createCompound()
    if ('type' in attrEntry) {
      setString(newEntry, 'Name', attributeRename(getString(attrEntry, 'type', '')))
      setDouble(newEntry, 'Base', getNumber(attrEntry, 'amount', 0))
    } else {
      setString(newEntry, 'Name', attributeRename(getString(attrEntry, 'id', '')))
      setDouble(newEntry, 'Base', getNumber(attrEntry, 'base', 0))
    }
    const listEntry = ensureList(attrEntry.modifiers)
    const newMods = processAttributeModifiers(listEntry)
    if (newMods.length > 0) {
      setList(newEntry, 'Modifiers', newMods, inferListElementSchema(newMods))
    }
    newAttr.push(newEntry)
  })

  return newAttr
}

function processAttributeModifiers(modifiers: NbtList): NbtList {
  const newMods = createList<NbtCompound>()
  const list = ensureList(modifiers)
  if (list.length === 0) {
    return list
  }

  list.forEach((entry) => {
    const modEntry = ensureCompound(entry)
    const newMod = createCompound()
    if ('type' in modEntry) {
      setString(newMod, 'Name', attributeRename(getString(modEntry, 'type', '')))
      setDouble(newMod, 'Base', getNumber(modEntry, 'amount', 0))
    } else {
      setDouble(newMod, 'Amount', getNumber(modEntry, 'amount', 0))
      setString(newMod, 'Name', modifierIdToName(getString(modEntry, 'id', '')))
    }
    setInt(newMod, 'Operation', modifierOperationToInt(getString(modEntry, 'operation', '')))
    setIntArray(newMod, 'UUID', readUuid(modEntry))
    newMods.push(newMod)
  })

  return newMods
}

function attributeRename(idIn: string): string {
  switch (idIn) {
    case 'minecraft:armor':
      return 'minecraft:generic.armor'
    case 'minecraft:armor_toughness':
      return 'minecraft:generic.armor_toughness'
    case 'minecraft:attack_damage':
      return 'minecraft:generic.attack_damage'
    case 'minecraft:attack_knockback':
      return 'minecraft:generic.attack_knockback'
    case 'minecraft:attack_speed':
      return 'minecraft:generic.attack_speed'
    case 'minecraft:flying_speed':
      return 'minecraft:generic.flying_speed'
    case 'minecraft:follow_range':
      return 'minecraft:generic.follow_range'
    case 'minecraft:jump_strength':
      return 'minecraft:horse.jump_strength'
    case 'minecraft:knockback_resistance':
      return 'minecraft:generic.knockback_resistance'
    case 'minecraft:luck':
      return 'minecraft:generic.luck'
    case 'minecraft:max_absorption':
      return 'minecraft:generic.max_absorption'
    case 'minecraft:max_health':
      return 'minecraft:generic.max_health'
    case 'minecraft:movement_speed':
      return 'minecraft:generic.movement_speed'
    case 'minecraft:spawn_reinforcements':
      return 'minecraft:zombie.spawn_reinforcements'
    case 'minecraft:block_break_speed':
      return 'minecraft:player.block_break_speed'
    case 'minecraft:block_interaction_range':
      return 'minecraft:player.block_interaction_range'
    case 'minecraft:burning_time':
      return 'minecraft:generic.burning_time'
    case 'minecraft:explosion_knockback_resistance':
      return 'minecraft:generic.explosion_knockback_resistance'
    case 'minecraft:entity_interaction_range':
      return 'minecraft:player.entity_interaction_range'
    case 'minecraft:fall_damage_multiplier':
      return 'minecraft:generic.fall_damage_multiplier'
    case 'minecraft:gravity':
      return 'minecraft:generic.gravity'
    case 'minecraft:mining_efficiency':
      return 'minecraft:player.mining_efficiency'
    case 'minecraft:movement_efficiency':
      return 'minecraft:generic.movement_efficiency'
    case 'minecraft:oxygen_bonus':
      return 'minecraft:generic.oxygen_bonus'
    case 'minecraft:safe_fall_distance':
      return 'minecraft:generic.safe_fall_distance'
    case 'minecraft:scale':
      return 'minecraft:generic.scale'
    case 'minecraft:sneaking_speed':
      return 'minecraft:player.sneaking_speed'
    case 'minecraft:step_height':
      return 'minecraft:generic.step_height'
    case 'minecraft:submerged_mining_speed':
      return 'minecraft:player.submerged_mining_speed'
    case 'minecraft:sweeping_damage_ratio':
      return 'minecraft:player.sweeping_damage_ratio'
    case 'minecraft:water_movement_efficiency':
      return 'minecraft:generic.water_movement_efficiency'
    default:
      return idIn
  }
}

function modifierIdToName(idIn: string): string {
  if (idIn === 'minecraft:random_spawn_bonus') {
    return 'Random spawn bonus'
  }
  return ''
}

function modifierOperationToInt(op: string): number {
  switch (op) {
    case 'add_value':
      return 0
    case 'add_multiplied_base':
      return 1
    case 'add_multiplied_total':
      return 2
    default:
      return 0
  }
}

export function downgradeBlockEntityTo_1_20_4(
  oldTE: NbtCompound,
  minecraftDataVersion: number
): NbtCompound {
  const newTE = createCompound()
  if (!('id' in oldTE)) {
    checkForIdTag(oldTE)
  }
  Object.keys(oldTE).forEach((key) => {
    switch (key) {
      case 'x':
        setInt(newTE, 'x', getNumber(oldTE, 'x', 0))
        break
      case 'y':
        setInt(newTE, 'y', getNumber(oldTE, 'y', 0))
        break
      case 'z':
        setInt(newTE, 'z', getNumber(oldTE, 'z', 0))
        break
      case 'id':
        setString(newTE, 'id', getString(oldTE, 'id', ''))
        break
      case 'Items': {
        const items = processItemsTag(ensureList(oldTE.Items), minecraftDataVersion)
        setList(newTE, 'Items', items, inferListElementSchema(items))
        break
      }
      case 'patterns': {
        const patterns = processBannerPatterns(oldTE[key] as any)
        setList(newTE, 'Patterns', patterns, inferListElementSchema(patterns))
        break
      }
      case 'profile':
        setCompound(
          newTE,
          'SkullOwner',
          processSkullProfile(oldTE[key] as any, newTE)
        )
        break
      case 'flower_pos':
        setCompound(
          newTE,
          'FlowerPos',
          processFlowerPos(oldTE, key)
        )
        break
      case 'bees': {
        const bees = processBeesTag(oldTE[key], minecraftDataVersion)
        setList(newTE, 'Bees', bees, inferListElementSchema(bees))
        break
      }
      case 'item':
        setCompound(newTE, 'item', processDecoratedPot(oldTE[key], minecraftDataVersion))
        break
      case 'last_interacted_slot':
        copyTag(oldTE, newTE, key)
        break
      case 'ticks_since_song_started':
        setLong(newTE, 'RecordStartTick', 0n)
        setLong(newTE, 'TickCount', getLong(oldTE, key, 0n))
        setByte(newTE, 'IsPlaying', 0)
        break
      case 'RecordItem':
        setCompound(newTE, 'RecordItem', processRecordItem(oldTE[key], minecraftDataVersion))
        break
      case 'Book':
        setCompound(newTE, 'Book', processBookTag(oldTE[key], minecraftDataVersion))
        break
      case 'CustomName':
      case 'custom_name':
        setString(newTE, 'CustomName', processCustomNameTag(oldTE, key))
        break
      default:
        copyTag(oldTE, newTE, key)
        break
    }
  })
  return newTE
}

function processItemsTag(oldItems: NbtList, minecraftDataVersion: number): NbtList {
  const newItems = createList<NbtCompound>()
  const items = ensureList(oldItems)

  items.forEach((item) => {
    const itemEntry = ensureCompound(item)
    const newEntry = createCompound()
    if (!('id' in itemEntry)) {
      return
    }
    const idName = getString(itemEntry, 'id', '')
    setString(newEntry, 'id', idName)
    if ('count' in itemEntry) {
      setByte(newEntry, 'Count', getNumber(itemEntry, 'count', 1))
    }
    if ('Slot' in itemEntry) {
      setByte(newEntry, 'Slot', getNumber(itemEntry, 'Slot', 1))
    }
    if ('components' in itemEntry) {
      setCompound(newEntry, 'tag', processComponentsTag(ensureCompound(itemEntry.components), idName, minecraftDataVersion))
    } else if (needsDamageTag(idName)) {
      const newTag = createCompound()
      setInt(newTag, 'Damage', 0)
      setCompound(newEntry, 'tag', newTag)
    }
    newItems.push(newEntry)
  })

  return newItems
}

function processItemsTagNested(oldItems: NbtList, minecraftDataVersion: number): NbtList {
  const newItems = createList<NbtCompound>()
  const items = ensureList(oldItems)

  items.forEach((item) => {
    const itemEntry = ensureCompound(item)
    const newEntry = createCompound()
    const slotNum = getNumber(itemEntry, 'slot', 0)
    const itemSlot = ensureCompound(itemEntry.item)
    if (!('id' in itemSlot)) {
      return
    }
    const idName = getString(itemSlot, 'id', '')
    setString(newEntry, 'id', idName)
    if ('count' in itemSlot) {
      setByte(newEntry, 'Count', getNumber(itemSlot, 'count', 1))
    }
    setByte(newEntry, 'Slot', slotNum)
    if ('components' in itemSlot) {
      setCompound(newEntry, 'tag', processComponentsTag(ensureCompound(itemSlot.components), idName, minecraftDataVersion))
    } else if (needsDamageTag(idName)) {
      const newTag = createCompound()
      setInt(newTag, 'Damage', 0)
      setCompound(newEntry, 'tag', newTag)
    }
    newItems.push(newEntry)
  })

  return newItems
}

function processDecoratedPotNested(oldItems: NbtList, minecraftDataVersion: number): NbtCompound {
  const itemEntry = ensureCompound(oldItems[0])
  const newEntry = createCompound()
  const itemSlot = ensureCompound(itemEntry.item)
  if (!('id' in itemSlot)) {
    return itemEntry
  }
  const idName = getString(itemSlot, 'id', '')
  setString(newEntry, 'id', idName)
  setByte(newEntry, 'Count', getNumber(itemSlot, 'count', 1))
  if ('components' in itemSlot) {
    setCompound(newEntry, 'tag', processComponentsTag(ensureCompound(itemSlot.components), idName, minecraftDataVersion))
  } else if (needsDamageTag(idName)) {
    const newTag = createCompound()
    setInt(newTag, 'Damage', 0)
    setCompound(newEntry, 'tag', newTag)
  }
  return newEntry
}

function processComponentsTag(nbt: NbtCompound, itemId: string, minecraftDataVersion: number): NbtCompound {
  const outNbt = createCompound()
  const beNbt = createCompound()
  const dispNbt = createCompound()
  const needsDamage = needsDamageTag(itemId)

  Object.keys(nbt).forEach((key) => {
    switch (key) {
      case 'minecraft:attribute_modifiers': {
        const attributes = processAttributes(nbt[key])
        setList(outNbt, 'AttributeModifiers', attributes, inferListElementSchema(attributes))
        break
      }
      case 'minecraft:banner_patterns': {
        const patterns = processBannerPatterns(nbt[key])
        setList(beNbt, 'Patterns', patterns, inferListElementSchema(patterns))
        setString(beNbt, 'id', 'minecraft:banner')
        break
      }
      case 'minecraft:bees': {
        const bees = processBeesTag(nbt[key], minecraftDataVersion)
        setList(beNbt, 'Bees', bees, inferListElementSchema(bees))
        setString(beNbt, 'id', itemId)
        break
      }
      case 'minecraft:block_state':
        copyTagAs(nbt, key, outNbt, 'BlockStateTag')
        break
      case 'minecraft:block_entity_data':
        processBlockEntityData(nbt[key], beNbt, minecraftDataVersion)
        break
      case 'minecraft:bucket_entity_data':
        processBucketEntityData(nbt[key], beNbt)
        break
      case 'minecraft:bundle_contents': {
        const items = processItemsTag(ensureList(nbt[key]), minecraftDataVersion)
        setList(outNbt, 'Items', items, inferListElementSchema(items))
        break
      }
      case 'minecraft:can_break':
        copyTagAs(nbt, key, outNbt, 'CanDestroy')
        break
      case 'minecraft:can_place_on':
        copyTagAs(nbt, key, outNbt, 'CanPlaceOn')
        break
      case 'minecraft:container':
        if (itemId.includes('decorated_pot')) {
          setCompound(beNbt, 'item', processDecoratedPotNested(ensureList(nbt[key]), minecraftDataVersion))
        } else {
          const containerItems = processItemsTagNested(ensureList(nbt[key]), minecraftDataVersion)
          setList(beNbt, 'Items', containerItems, inferListElementSchema(containerItems))
        }
        setString(beNbt, 'id', itemId.includes('shulker') ? 'minecraft:shulker_box' : itemId)
        break
      case 'minecraft:charged_projectiles': {
        const projectiles = processChargedProjectile(nbt[key], minecraftDataVersion)
        setList(outNbt, 'ChargedProjectiles', projectiles, inferListElementSchema(projectiles))
        setBoolean(outNbt, 'Charged', true)
        break
      }
      case 'minecraft:container_loot':
        setCompound(beNbt, 'LootTable', ensureCompound(processLootTable(nbt[key])))
        setString(beNbt, 'id', itemId)
        break
      case 'minecraft:custom_data':
        processCustomData(nbt[key], outNbt)
        break
      case 'minecraft:custom_model_data':
        setInt(outNbt, 'CustomModelData', getNumber(nbt, key, 0))
        break
      case 'minecraft:custom_name':
        setString(dispNbt, 'Name', processCustomNameTag(nbt, key))
        break
      case 'minecraft:damage':
        setInt(outNbt, 'Damage', getNumber(nbt, key, 0))
        break
      case 'minecraft:debug_stick_state':
        copyTagAs(nbt, key, outNbt, 'DebugProperty')
        break
      case 'minecraft:dyed_color':
        setInt(dispNbt, 'color', processDyedColor(nbt[key]))
        break
      case 'minecraft:enchantments': {
        const enchantments = processEnchantments(nbt[key], true, true)
        setList(outNbt, 'Enchantments', enchantments, inferListElementSchema(enchantments))
        break
      }
      case 'minecraft:entity_data':
        setCompound(outNbt, 'EntityTag', downgradeEntityTo_1_20_4(ensureCompound(nbt[key]), minecraftDataVersion))
        break
      case 'minecraft:stored_enchantments': {
        const stored = processEnchantments(nbt[key], true, true)
        setList(outNbt, 'StoredEnchantments', stored, inferListElementSchema(stored))
        break
      }
      case 'minecraft:fireworks':
        setCompound(outNbt, 'Fireworks', ensureCompound(processFireworks(nbt[key])))
        break
      case 'minecraft:firework_explosion':
        setCompound(outNbt, 'Explosion', ensureCompound(processFireworkExplosion(nbt[key])))
        break
      case 'minecraft:instrument':
        copyTagAs(nbt, key, outNbt, 'instrument')
        break
      case 'minecraft:item_name':
        setString(dispNbt, 'Name', processItemName(nbt[key]))
        break
      case 'minecraft:lock':
        setCompound(beNbt, 'Lock', ensureCompound(nbt[key]))
        setString(beNbt, 'id', itemId)
        break
      case 'minecraft:lodestone_tracker':
        processLodestoneTracker(nbt[key], outNbt)
        break
      case 'minecraft:lore': {
        copyTag(nbt, dispNbt, key)
        const lore = ensureList(nbt[key])
        setList(dispNbt, 'Lore', lore, inferListElementSchema(lore))
        break
      }
      case 'minecraft:map_id':
        copyTagAs(nbt, key, outNbt, 'map')
        break
      case 'minecraft:map_color':
        copyTagAs(nbt, key, dispNbt, 'MapColor')
        break
      case 'minecraft:map_decorations': {
        const decorations = processMapDecorations(nbt[key])
        setList(outNbt, 'Decorations', decorations, inferListElementSchema(decorations))
        break
      }
      case 'minecraft:note_block_sound':
        copyTagAs(nbt, key, beNbt, 'note_block_sound')
        break
      case 'minecraft:pot_decorations':
        copyTagAs(nbt, key, beNbt, 'sherds')
        setString(beNbt, 'id', itemId)
        break
      case 'minecraft:potion_contents':
        processPotions(nbt[key], outNbt)
        break
      case 'minecraft:profile':
        setCompound(outNbt, 'SkullOwner', processSkullProfile(nbt[key], dispNbt))
        break
      case 'minecraft:repair_cost':
        setInt(outNbt, 'RepairCost', getNumber(nbt, key, 0))
        break
      case 'minecraft:recipes':
        copyTagAs(nbt, key, outNbt, 'Recipes')
        break
      case 'minecraft:suspicious_stew_effects':
        copyTagAs(nbt, key, outNbt, 'effects')
        break
      case 'minecraft:trim':
        copyTagAs(nbt, key, outNbt, 'Trim')
        break
      case 'minecraft:writable_book_content': {
        const bookNbt = processWritableBookContent(ensureCompound(nbt[key]))
        Object.keys(bookNbt).forEach((bookKey) => {
          copyTag(bookNbt, outNbt, bookKey)
        })
        break
      }
      case 'minecraft:written_book_content': {
        const bookNbt = processWrittenBookContent(ensureCompound(nbt[key]))
        Object.keys(bookNbt).forEach((bookKey) => {
          copyTag(bookNbt, outNbt, bookKey)
        })
        break
      }
      case 'minecraft:unbreakable':
        setBoolean(outNbt, 'Unbreakable', processUnbreakable(nbt[key]))
        break
      default:
        break
    }
  })

  if (!isEmptyCompound(beNbt)) {
    setCompound(outNbt, 'BlockEntityTag', beNbt)
  }
  if (!isEmptyCompound(dispNbt)) {
    setCompound(outNbt, 'display', dispNbt)
  }
  if (!('RepairCost' in outNbt) && (itemId === 'minecraft:dragon_head' || needsDamage)) {
    setInt(outNbt, 'RepairCost', 0)
  }
  if (!('Damage' in outNbt) && needsDamage) {
    setInt(outNbt, 'Damage', 0)
  }

  return outNbt
}

function processCustomData(oldNbt: any, outNbt: NbtCompound): void {
  const origData = ensureCompound(oldNbt)
  Object.keys(origData).forEach((key) => {
    copyTag(origData, outNbt, key)
  })
}

function processLodestoneTracker(oldEle: any, outNbt: NbtCompound): void {
  const oldNbt = ensureCompound(oldEle)
  if ('tracked' in oldNbt) {
    setBoolean(outNbt, 'LodestoneTracked', getBoolean(oldNbt, 'tracked', false))
  }
  if ('target' in oldNbt) {
    const target = ensureCompound(oldNbt.target)
    if ('dimension' in target) {
      setString(outNbt, 'LodestoneDimension', getString(target, 'dimension', ''))
    }
    if ('pos' in target) {
      copyTagAs(target, 'pos', outNbt, 'LodestonePos')
    }
  }
}

function processBucketEntityData(oldTags: any, beNbt: NbtCompound): void {
  const oldNbt = ensureCompound(oldTags)
  Object.keys(oldNbt).forEach((key) => {
    copyTag(oldNbt, beNbt, key)
  })
}

function processPotions(oldPots: any, outNbt: NbtCompound): void {
  const oldNbt = ensureCompound(oldPots)
  if ('potion' in oldNbt) {
    setString(outNbt, 'Potion', getString(oldNbt, 'potion', ''))
  }
  if ('custom_color' in oldNbt) {
    copyTagAs(oldNbt, 'custom_color', outNbt, 'CustomPotionColor')
  }
  if ('custom_effects' in oldNbt) {
    copyTagAs(oldNbt, 'custom_effects', outNbt, 'custom_potion_effects')
  }
}

function processMapDecorations(oldDeco: any): NbtList {
  const oldTag = ensureCompound(oldDeco)
  const newTags = createList<NbtCompound>()

  Object.keys(oldTag).forEach((key) => {
    const entryOld = ensureCompound(oldTag[key])
    const entryNew = createCompound()
    setString(entryNew, 'id', key)
    setDouble(entryNew, 'x', getNumber(entryOld, 'x', 0))
    setDouble(entryNew, 'z', getNumber(entryOld, 'z', 0))
    setDouble(entryNew, 'rot', entryOld.rotation ? getNumber(entryOld, 'rotation', 0) : 0)
    setByte(entryNew, 'type', convertMapDecoration(getString(entryOld, 'type', '')))
    newTags.push(entryNew)
  })

  return newTags
}

function convertMapDecoration(type: string): number {
  switch (type) {
    case 'minecraft:player':
      return 0
    case 'minecraft:frame':
      return 1
    case 'minecraft:red_marker':
      return 2
    case 'minecraft:blue_marker':
      return 3
    case 'minecraft:target_x':
      return 4
    case 'minecraft:target_point':
      return 5
    case 'minecraft:player_off_map':
      return 6
    case 'minecraft:player_off_limits':
      return 7
    case 'minecraft:mansion':
      return 8
    case 'minecraft:monument':
      return 9
    case 'minecraft:banner_white':
      return 10
    case 'minecraft:banner_orange':
      return 11
    case 'minecraft:banner_magenta':
      return 12
    case 'minecraft:banner_light_blue':
      return 13
    case 'minecraft:banner_yellow':
      return 14
    case 'minecraft:banner_lime':
      return 15
    case 'minecraft:banner_pink':
      return 16
    case 'minecraft:banner_gray':
      return 17
    case 'minecraft:banner_light_gray':
      return 18
    case 'minecraft:banner_cyan':
      return 19
    case 'minecraft:banner_purple':
      return 20
    case 'minecraft:banner_blue':
      return 21
    case 'minecraft:banner_brown':
      return 22
    case 'minecraft:banner_green':
      return 23
    case 'minecraft:banner_red':
      return 24
    case 'minecraft:banner_black':
      return 25
    case 'minecraft:red_x':
      return 26
    case 'minecraft:village_desert':
      return 27
    case 'minecraft:village_plains':
      return 28
    case 'minecraft:village_savanna':
      return 29
    case 'minecraft:village_snowy':
      return 30
    case 'minecraft:village_taiga':
      return 31
    case 'minecraft:jungle_temple':
      return 32
    case 'minecraft:swamp_hut':
      return 33
    default:
      return 0
  }
}

function processLootTable(oldLoot: any): any {
  const oldTable = ensureCompound(oldLoot)
  const newTable = createCompound()
  if ('loot_table' in oldTable) {
    const loot = ensureCompound(oldTable.loot_table)
    mergeCompound(newTable, loot)
  }
  if ('seed' in oldTable) {
    setLong(newTable, 'LootTableSeed', getLong(oldTable, 'seed', 0n))
  }
  return newTable
}

function processItemName(oldName: any): string {
  if (oldName != null) {
    return typeof oldName === 'string' ? oldName : JSON.stringify(oldName)
  }
  return 'minecraft:air'
}

function processDyedColor(oldDye: any): number {
  const oldColor = ensureCompound(oldDye)
  if ('rgb' in oldColor) {
    return getNumber(oldColor, 'rgb', 10511680)
  }
  return 10511680
}

function processChargedProjectile(oldProjectiles: any, minecraftDataVersion: number): NbtList {
  const oldNbt = ensureList(oldProjectiles)
  const newNbt = createList<NbtCompound>()

  oldNbt.forEach((entry) => {
    const itemEntry = ensureCompound(entry)
    const newEntry = createCompound()
    if (!('id' in itemEntry)) {
      return
    }
    const idName = getString(itemEntry, 'id', '')
    setString(newEntry, 'id', idName)
    setByte(newEntry, 'Count', getNumber(itemEntry, 'count', 1))
    if ('components' in itemEntry) {
      setCompound(newEntry, 'tag', processComponentsTag(ensureCompound(itemEntry.components), idName, minecraftDataVersion))
    }
    newNbt.push(newEntry)
  })

  return newNbt
}

function processUnbreakable(oldNbt: any): boolean {
  const oldUnbr = ensureCompound(oldNbt)
  if ('show_in_tooltip' in oldUnbr) {
    return getBoolean(oldUnbr, 'show_in_tooltip', false)
  }
  return false
}

function processBlockEntityData(oldBeData: any, beNbt: NbtCompound, minecraftDataVersion: number): void {
  const newData = downgradeBlockEntityTo_1_20_4(ensureCompound(oldBeData), minecraftDataVersion)
  mergeCompound(beNbt, newData)
}

function processDecoratedPot(oldPot: any, minecraftDataVersion: number): NbtCompound {
  const oldNbt = ensureCompound(oldPot)
  const newNbt = createCompound()
  Object.keys(oldNbt).forEach((key) => {
    switch (key) {
      case 'id':
        setString(newNbt, 'id', getString(oldNbt, 'id', ''))
        break
      case 'count':
        setByte(newNbt, 'Count', getNumber(oldNbt, 'count', 1))
        break
      case 'components':
        setCompound(
          newNbt,
          'tag',
          processComponentsTag(ensureCompound(oldNbt.components), getString(oldNbt, 'id', ''), minecraftDataVersion)
        )
        break
      default:
        break
    }
  })

  if (!('tag' in newNbt) && 'id' in oldNbt && needsDamageTag(getString(oldNbt, 'id', ''))) {
    const newTag = createCompound()
    setInt(newTag, 'Damage', 0)
    setCompound(newNbt, 'tag', newTag)
  }

  return newNbt
}

function processEnchantments(oldNbt: any, fullId: boolean, shortInt: boolean): NbtList {
  const oldEnchants = ensureCompound(oldNbt)
  const oldLevels = ensureCompound(oldEnchants.levels)
  const newEnchants = createList<NbtCompound>()

  Object.keys(oldLevels).forEach((key) => {
    const newEntry = createCompound()
    if (shortInt) {
      setShort(newEntry, 'lvl', getNumber(oldLevels, key, 1))
    } else {
      setInt(newEntry, 'lvl', getNumber(oldLevels, key, 1))
    }
    setString(newEntry, 'id', fullId ? key : key.split(':').pop() || key)
    newEnchants.push(newEntry)
  })

  return newEnchants
}

function processCustomNameTag(nameTag: NbtCompound, key: string): string {
  const value = nameTag[key]
  if (typeof value === 'string') {
    return normalizeJsonText(value)
  }
  if (value != null) {
    return JSON.stringify(value)
  }
  return ''
}

function processFireworks(rocket: any): any {
  const oldRocket = ensureCompound(rocket)
  const newRocket = createCompound()
  if ('flight_duration' in oldRocket) {
    setByte(newRocket, 'Flight', getNumber(oldRocket, 'flight_duration', 1))
  }
  if ('explosions' in oldRocket) {
    const oldExplosions = ensureList(oldRocket.explosions)
    const newExplosions = createList<NbtCompound>()
    oldExplosions.forEach((entry) => {
      newExplosions.push(processFireworkExplosion(entry))
    })
    setList(newRocket, 'Explosions', newExplosions, inferListElementSchema(newExplosions))
  }
  return newRocket
}

function processFireworkExplosion(explosion: any): NbtCompound {
  const oldExplosion = ensureCompound(explosion)
  const newExplosion = createCompound()
  if ('shape' in oldExplosion) {
    setByte(newExplosion, 'Type', convertFireworkShape(getString(oldExplosion, 'shape', '')))
  }
  if ('colors' in oldExplosion) {
    setIntArray(newExplosion, 'Colors', oldExplosion.colors as number[])
  }
  if ('fade_colors' in oldExplosion) {
    setIntArray(newExplosion, 'FadeColors', oldExplosion.fade_colors as number[])
  }
  if ('has_trail' in oldExplosion) {
    setBoolean(newExplosion, 'Trail', getBoolean(oldExplosion, 'has_trail', false))
  }
  if ('has_twinkle' in oldExplosion) {
    setBoolean(newExplosion, 'Flicker', getBoolean(oldExplosion, 'has_twinkle', false))
  }
  return newExplosion
}

function convertFireworkShape(shape: string): number {
  switch (shape) {
    case 'small_ball':
      return 0
    case 'large_ball':
      return 1
    case 'star':
      return 2
    case 'creeper':
      return 3
    case 'burst':
      return 4
    default:
      return 0
  }
}

function processRecordItem(itemIn: any, minecraftDataVersion: number): NbtCompound {
  const oldRecord = ensureCompound(itemIn)
  const recordOut = createCompound()
  setString(recordOut, 'id', getString(oldRecord, 'id', ''))
  setByte(recordOut, 'Count', getNumber(oldRecord, 'count', 1))
  if ('components' in oldRecord) {
    setCompound(
      recordOut,
      'tag',
      processComponentsTag(ensureCompound(oldRecord.components), getString(oldRecord, 'id', ''), minecraftDataVersion)
    )
  }
  return recordOut
}

function processBookTag(bookNbt: any, minecraftDataVersion: number): NbtCompound {
  const oldBook = ensureCompound(bookNbt)
  const newBook = createCompound()
  setString(newBook, 'id', getString(oldBook, 'id', ''))
  setByte(newBook, 'Count', getNumber(oldBook, 'count', 1))
  if ('Page' in oldBook) {
    setInt(newBook, 'Page', getNumber(oldBook, 'Page', 1))
  }
  if ('components' in oldBook) {
    setCompound(
      newBook,
      'tag',
      processComponentsTag(ensureCompound(oldBook.components), getString(oldBook, 'id', ''), minecraftDataVersion)
    )
  }
  return newBook
}

function processWritableBookContent(bookNbt: NbtCompound): NbtCompound {
  const newBook = createCompound()
  const newPages = createList<string>()
  if ('pages' in bookNbt) {
    const pages = ensureList(bookNbt.pages)
    pages.forEach((page, index) => {
      const pageTag = ensureCompound(page)
      const oldPage = getString(pageTag, 'raw', '')
      newPages[index] = normalizeJsonText(oldPage)
    })
  }
  if (newPages.length > 0) {
    setList(newBook, 'pages', newPages, Tags.String)
  }
  return newBook
}

function processWrittenBookContent(bookNbt: NbtCompound): NbtCompound {
  const newBook = createCompound()
  const filtered = createCompound()
  const newPages = createList<string>()

  if ('author' in bookNbt) {
    setString(newBook, 'author', getString(bookNbt, 'author', '?'))
  }
  if ('title' in bookNbt) {
    const title = ensureCompound(bookNbt.title)
    setString(newBook, 'title', getString(title, 'raw', ''))
  }
  if ('resolved' in bookNbt) {
    setBoolean(newBook, 'resolved', getBoolean(bookNbt, 'resolved', false))
  }
  if ('generation' in bookNbt) {
    setInt(newBook, 'generation', getNumber(bookNbt, 'generation', 1))
  }

  if ('pages' in bookNbt) {
    const pages = ensureList(bookNbt.pages)
    pages.forEach((page, index) => {
      const pageTag = ensureCompound(page)
      const oldPage = getString(pageTag, 'raw', '')
      if ('filtered' in pageTag) {
        const filterPage = getString(pageTag, 'filtered', '')
        setString(filtered, filterPage, normalizeJsonText(filterPage))
      }
      newPages[index] = normalizeJsonText(oldPage)
    })
  }

  if (newPages.length > 0) {
    setList(newBook, 'pages', newPages, Tags.String)
  }
  if (!isEmptyCompound(filtered)) {
    setCompound(newBook, 'filtered_pages', filtered)
  }
  return newBook
}

function processBannerPatterns(oldPatterns: any): NbtList {
  const oldList = ensureList(oldPatterns)
  const newList = createList<NbtCompound>()
  oldList.forEach((entry) => {
    const oldEntry = ensureCompound(entry)
    const newEntry = createCompound()
    const color = getString(oldEntry, 'color', '')
    const pattern = getString(oldEntry, 'pattern', '')
    const dyeId = DYE_COLOR_IDS[color] ?? DYE_COLOR_IDS.white
    setString(newEntry, 'Pattern', convertBannerPattern(pattern))
    setInt(newEntry, 'Color', dyeId)
    newList.push(newEntry)
  })
  return newList
}

function convertBannerPattern(patternId: string): string {
  switch (patternId) {
    case 'minecraft:base':
      return 'b'
    case 'minecraft:square_bottom_left':
      return 'bl'
    case 'minecraft:square_bottom_right':
      return 'br'
    case 'minecraft:square_top_left':
      return 'tl'
    case 'minecraft:square_top_right':
      return 'tr'
    case 'minecraft:stripe_bottom':
      return 'bs'
    case 'minecraft:stripe_top':
      return 'ts'
    case 'minecraft:stripe_left':
      return 'ls'
    case 'minecraft:stripe_right':
      return 'rs'
    case 'minecraft:stripe_center':
      return 'cs'
    case 'minecraft:stripe_middle':
      return 'ms'
    case 'minecraft:stripe_downright':
      return 'drs'
    case 'minecraft:stripe_downleft':
      return 'dls'
    case 'minecraft:small_stripes':
      return 'ss'
    case 'minecraft:cross':
      return 'cr'
    case 'minecraft:straight_cross':
      return 'sc'
    case 'minecraft:triangle_bottom':
      return 'bt'
    case 'minecraft:triangle_top':
      return 'tt'
    case 'minecraft:triangles_bottom':
      return 'bts'
    case 'minecraft:triangles_top':
      return 'tts'
    case 'minecraft:diagonal_left':
      return 'ld'
    case 'minecraft:diagonal_up_right':
      return 'rd'
    case 'minecraft:diagonal_up_left':
      return 'lud'
    case 'minecraft:diagonal_right':
      return 'rud'
    case 'minecraft:circle':
      return 'mc'
    case 'minecraft:rhombus':
      return 'mr'
    case 'minecraft:half_vertical':
      return 'vh'
    case 'minecraft:half_horizontal':
      return 'hh'
    case 'minecraft:half_vertical_right':
      return 'vhr'
    case 'minecraft:half_horizontal_bottom':
      return 'hhb'
    case 'minecraft:border':
      return 'bo'
    case 'minecraft:curly_border':
      return 'cbo'
    case 'minecraft:gradient':
      return 'gra'
    case 'minecraft:gradient_up':
      return 'gru'
    case 'minecraft:bricks':
      return 'bri'
    case 'minecraft:globe':
      return 'glb'
    case 'minecraft:creeper':
      return 'cre'
    case 'minecraft:skull':
      return 'sku'
    case 'minecraft:flower':
      return 'flo'
    case 'minecraft:mojang':
      return 'moj'
    case 'minecraft:piglin':
      return 'pig'
    default:
      return 'b'
  }
}

function processSkullProfile(oldProfile: any, dispNbt: NbtCompound): NbtCompound {
  const profile = ensureCompound(oldProfile)
  const newProfile = createCompound()
  const customName1 = getString(dispNbt, 'Name', '')
  const customName2 = getString(dispNbt, 'CustomName', '')
  let name = getString(profile, 'name', '')

  if (!name && customName1) {
    name = collapseText(customName1) ?? customName1
  } else if (!name && customName2) {
    name = collapseText(customName2) ?? customName2
  }

  setString(newProfile, 'Name', name)
  setIntArray(newProfile, 'Id', readUuid(profile))

  const properties = ensureList(profile.properties)
  const newProperties = createCompound()
  properties.forEach((entry) => {
    const property = ensureCompound(entry)
    const propName = getString(property, 'name', '')
    const propValue = getString(property, 'value', '')
    if (propName === 'textures') {
      const textures = createList<NbtCompound>()
      const value = createCompound()
      setString(value, 'Value', propValue)
      textures.push(value)
      setList(newProperties, 'textures', textures, inferListElementSchema(textures))
    }
  })

  setCompound(newProfile, 'Properties', newProperties)
  return newProfile
}

function processFlowerPos(oldNbt: NbtCompound, key: string): NbtCompound {
  const flowerOut = createCompound()
  const flowerPos = readBlockPos(oldNbt[key])
  if (flowerPos) {
    setInt(flowerOut, 'X', flowerPos.x)
    setInt(flowerOut, 'Y', flowerPos.y)
    setInt(flowerOut, 'Z', flowerPos.z)
  }
  return flowerOut
}

function processBeesTag(beesTag: any, minecraftDataVersion: number): NbtList {
  const oldBees = ensureList(beesTag)
  const newBees = createList<NbtCompound>()
  oldBees.forEach((entry) => {
    const oldEntry = ensureCompound(entry)
    const newEntry = createCompound()
    setInt(newEntry, 'TicksInHive', getNumber(oldEntry, 'ticks_in_hive', 0))
    setInt(newEntry, 'MinOccupationTicks', getNumber(oldEntry, 'min_ticks_in_hive', 0))
    setCompound(newEntry, 'EntityData', downgradeEntityTo_1_20_4(ensureCompound(oldEntry.entity_data), minecraftDataVersion))
    newBees.push(newEntry)
  })
  return newBees
}

export function downgradeEntityTo_1_20_4(
  oldEntity: NbtCompound,
  minecraftDataVersion: number
): NbtCompound {
  const newEntity = createCompound()
  if (!('id' in oldEntity)) {
    return oldEntity
  }

  Object.keys(oldEntity).forEach((key) => {
    switch (key) {
      case 'x':
        setInt(newEntity, 'x', getNumber(oldEntity, 'x', 0))
        break
      case 'y':
        setInt(newEntity, 'y', getNumber(oldEntity, 'y', 0))
        break
      case 'z':
        setInt(newEntity, 'z', getNumber(oldEntity, 'z', 0))
        break
      case 'id':
        setString(newEntity, 'id', getString(oldEntity, 'id', ''))
        break
      case 'attributes': {
        const attributes = processAttributes(oldEntity[key])
        setList(newEntity, 'Attributes', attributes, inferListElementSchema(attributes))
        break
      }
      case 'flower_pos':
        setCompound(newEntity, 'FlowerPos', processFlowerPos(oldEntity, key))
        break
      case 'hive_pos':
        setCompound(newEntity, 'HivePos', processFlowerPos(oldEntity, key))
        break
      case 'ArmorItems': {
        const armorItems = processEntityItems(ensureList(oldEntity[key]), minecraftDataVersion, 4)
        setList(newEntity, 'ArmorItems', armorItems, inferListElementSchema(armorItems))
        break
      }
      case 'HandItems': {
        const handItems = processEntityItems(ensureList(oldEntity[key]), minecraftDataVersion, 2)
        setList(newEntity, 'HandItems', handItems, inferListElementSchema(handItems))
        break
      }
      case 'Item':
        setCompound(newEntity, 'Item', processEntityItem(oldEntity[key], minecraftDataVersion))
        break
      case 'Inventory': {
        const inventory = processEntityItems(ensureList(oldEntity[key]), minecraftDataVersion, 1)
        setList(newEntity, 'Inventory', inventory, inferListElementSchema(inventory))
        break
      }
      case 'equipment':
        mergeCompound(newEntity, processEntityEquipment(oldEntity[key], minecraftDataVersion))
        break
      case 'drop_chances':
        mergeCompound(newEntity, processEntityDropChances(oldEntity[key]))
        break
      case 'fall_distance':
        setFloat(newEntity, 'FallDistance', getNumber(oldEntity, key, 0))
        break
      case 'anchor_pos':
        processBlockPosTag(readBlockPos(oldEntity[key]), 'A', newEntity)
        break
      case 'block_pos':
        processBlockPosTag(readBlockPos(oldEntity[key]), 'Tile', newEntity)
        break
      case 'bound_pos':
        processBlockPosTag(readBlockPos(oldEntity[key]), 'Bound', newEntity)
        break
      case 'home_pos':
        processBlockPosTag(readBlockPos(oldEntity[key]), 'HomePos', newEntity)
        break
      case 'sleeping_pos':
        processBlockPosTag(readBlockPos(oldEntity[key]), 'Sleeping', newEntity)
        break
      case 'has_egg':
        setBoolean(newEntity, 'HasEgg', getBoolean(oldEntity, key, false))
        break
      case 'life_ticks':
        setInt(newEntity, 'LifeTicks', getNumber(oldEntity, key, 0))
        break
      case 'size':
        setInt(newEntity, 'Size', getNumber(oldEntity, key, 0))
        break
      default:
        copyTag(oldEntity, newEntity, key)
        break
    }
  })

  return newEntity
}
