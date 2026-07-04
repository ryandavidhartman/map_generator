// Transcribed from Shadowdark RPG, "Settlement Maps" (book pp. 134-139).
// Settlement Type is rolled fresh at generation time (never derived from an overland POI's
// location text — see the plan's "Two mechanical points" note). Each settlement-type tier's
// dice (3d4/4d4/6d6/8d8) give the literal district count (one die per district, never
// summed) — the same die's face value also indexes the Districts table directly, which is
// why smaller tiers (d4) can only ever reach the first 4 of 8 district types. Preserve this
// tiering exactly; it's intentional RAW.

// Settlement Type table (d6).
export type SettlementType = 'Village' | 'Town' | 'City' | 'Metropolis'
export type SettlementTypeSpec = { type: SettlementType; diceCount: number; diceSides: 4 | 6 | 8 }

const SETTLEMENT_TYPE_SPECS: Record<SettlementType, SettlementTypeSpec> = {
  Village: { type: 'Village', diceCount: 3, diceSides: 4 },
  Town: { type: 'Town', diceCount: 4, diceSides: 4 },
  City: { type: 'City', diceCount: 6, diceSides: 6 },
  Metropolis: { type: 'Metropolis', diceCount: 8, diceSides: 8 },
}

export function settlementTypeForD6(roll: number): SettlementTypeSpec {
  if (roll < 1 || roll > 6) throw new Error(`settlementTypeForD6: roll out of range: ${roll}`)
  if (roll === 1) return SETTLEMENT_TYPE_SPECS.Village
  if (roll <= 3) return SETTLEMENT_TYPE_SPECS.Town
  if (roll <= 5) return SETTLEMENT_TYPE_SPECS.City
  return SETTLEMENT_TYPE_SPECS.Metropolis
}

export function settlementTypeSpecFor(type: SettlementType): SettlementTypeSpec {
  return SETTLEMENT_TYPE_SPECS[type]
}

// Districts table (d8) — indexed 1..sides directly by a district's placement die.
export type DistrictType =
  | 'Slums'
  | 'Low District'
  | 'Artisan District'
  | 'Market'
  | 'High District'
  | 'Temple District'
  | 'University District'
  | 'Castle District'

const DISTRICT_TYPES_ORDER: DistrictType[] = [
  'Slums',
  'Low District',
  'Artisan District',
  'Market',
  'High District',
  'Temple District',
  'University District',
  'Castle District',
]

export function districtTypeForRoll(roll: number, sides: 4 | 6 | 8): DistrictType {
  if (roll < 1 || roll > sides) throw new Error(`districtTypeForRoll: roll out of range for d${sides}: ${roll}`)
  return DISTRICT_TYPES_ORDER[roll - 1]
}

// Alignment table (d6) — used for the overall settlement or per-district.
export type Alignment = 'Lawful' | 'Neutral' | 'Chaotic'

export function alignmentForD6(roll: number): Alignment {
  if (roll < 1 || roll > 6) throw new Error(`alignmentForD6: roll out of range: ${roll}`)
  if (roll <= 3) return 'Lawful'
  if (roll <= 5) return 'Neutral'
  return 'Chaotic'
}

// Per-district Points of Interest tables (d6 each).
const DISTRICT_POI: Record<DistrictType, string[]> = {
  Slums: ['Seedy flophouse', 'Poor tavern', 'Poor tavern', 'Criminal safehouse', 'Poor shop', "Witch/warlock's hovel"],
  'Low District': ['Graveyard', 'Poor tavern', 'Poor tavern', 'Poor shop', 'Standard shop', 'Warehouses/sheds'],
  'Artisan District': ['Stocks and pillories', 'Modest temple', 'Modest temple', 'Standard tavern', 'Standard tavern', 'Wealthy shop'],
  Market: ['Fortune teller', 'Rare and exotic goods', 'Rare and exotic goods', 'Rare and exotic goods', 'Apothecary', 'Illicit black market'],
  'High District': ['Guildhouse', 'Wealthy tavern', 'Wealthy tavern', 'Manor house', 'Wealthy shop', 'City Watch outpost'],
  'Temple District': ["Ruined temple", "Minor deity's chapel", "Minor deity's chapel", 'Forbidden shrine', "Major god's temple", 'Revered holy site'],
  'University District': ['Library', 'Lecture hall', 'Lecture hall', 'Standard tavern', 'Standard tavern', "Wizard's tower"],
  'Castle District': ['Royal bathhouse', "City Watch's garrison", "City Watch's garrison", 'Theater or coliseum', 'Theater or coliseum', 'Royal castle'],
}

export function districtPoiForD6(district: DistrictType, roll: number): string {
  if (roll < 1 || roll > 6) throw new Error(`districtPoiForD6: roll out of range: ${roll}`)
  return DISTRICT_POI[district][roll - 1]
}

// Tavern Generator (d20) — two independent name-fragment columns + a "Known For" column.
const TAVERN_NAME_A = [
  'The Crimson', 'The Dancing', 'The Dog &', 'The Rusty', "The Demon's", 'The Singing', 'The Boar &', 'The Silver',
  'The Filthy', "The Captain's", 'The Jolly', 'The Wise', 'Cloak &', 'The Royal', 'The Gilded', 'The Blade &',
  'The Drunken', 'Cup &', 'The Jeweled', 'The Frog &',
]
const TAVERN_NAME_B = [
  'Rat', 'Wench', 'Lantern', 'Eel', 'Goblet', 'Trident', 'Candle', 'Dagger',
  'Wheel', 'Pig', 'Snake', 'Camel', 'Dragon', 'Axe', 'Bell', 'Tankard',
  'Shield', 'Blade', 'Anvil', 'Bard',
]
const TAVERN_KNOWN_FOR = [
  'High-stakes gambling', 'Illicit poison sales', 'Wizard patrons', 'Cult rituals in the basement',
  'Rare food and drinks', 'Dancing contests', 'Violent brawls', 'Ancient tunnels in the cellar',
  'Thugs for hire', "Thieves' Guild spies", 'Hostility toward spellcasters', 'City Watch patrons',
  'Underground pit fighting', 'Famous bard performances', 'Treasonous meetings', 'Ban on all weapons',
  'Hostility toward non-regulars', 'Exotic taxidermy collection', 'Pirate and smuggler patrons', 'Drinking contests',
]

function lookupD20(table: string[], roll: number, tableName: string): string {
  if (roll < 1 || roll > 20) throw new Error(`${tableName}: roll out of range: ${roll}`)
  return table[roll - 1]
}

export function tavernNameForD20(rollA: number, rollB: number): string {
  return `${lookupD20(TAVERN_NAME_A, rollA, 'tavernNameForD20 (a)')} ${lookupD20(TAVERN_NAME_B, rollB, 'tavernNameForD20 (b)')}`
}

export function tavernKnownForForD20(roll: number): string {
  return lookupD20(TAVERN_KNOWN_FOR, roll, 'tavernKnownForForD20')
}

// Food (d12) — one column per tavern size tier.
export type TavernSizeTier = 'Poor' | 'Standard' | 'Wealthy'

const FOOD_TABLE: Record<TavernSizeTier, string[]> = {
  Poor: [
    'Boiled cabbage', 'Dates and olives', 'Goat stew', 'Pickled eggs', 'Cheese and bread', 'Hearty broth',
    'Meat pastry', 'Mushroom kebab', 'Roasted pigeon', 'Garlic flatbread', 'Turkey leg', 'Rat-on-a-stick',
  ],
  Standard: [
    'Alligator steak', 'Rosemary ham', 'Raw flailfish', 'Seared venison', 'Buttered ostrich', 'Spicy veal curry',
    'Salted frog legs', 'Herbed snails', 'Grilled tiger eel', 'Spit-roasted boar', 'Saffron duck neck', 'Crimson pudding',
  ],
  Wealthy: [
    'Fried basilisk eyes', 'Giant snake filet', 'Candied scarabs', 'Baked troll bones', 'Cockatrice wings', 'Crispy silkworms',
    'Roasted stingbat', 'Dire lobster tail', 'Wyvern tongue', 'Shrieking seaweed', 'Dragon shanks', 'Dragon shanks',
  ],
}

export function tavernFoodForRoll(tier: TavernSizeTier, roll: number): string {
  if (roll < 1 || roll > 12) throw new Error(`tavernFoodForRoll: roll out of range: ${roll}`)
  return FOOD_TABLE[tier][roll - 1]
}

// Drinks (d12) — single shared table across all tiers; tier only changes how many/which die
// is rolled (Poor: d6, Standard: 2d6, Wealthy: d12) — that dice-mechanics decision belongs to
// the engine, not this pure lookup.
const DRINKS_TABLE = [
  'Barnacle grog. 1 cp, DC 9 Constitution check or blind 1 hour',
  'Watered-down swill. 3 cp, toxic, -1 Constitution 1 hour',
  'Vinegary wine. 5 cp, stains teeth purple, -1 Charisma 1 hour',
  'Stale ale. 5 cp, dulls the senses, -1 Wisdom 1 hour',
  'Clear spirits. 1 sp, burns, ends 1 bad effect of another drink',
  'House ale. 2 sp, crisp and clean, first mug is free',
  'Autumn mead. 3 sp, floral, doubles effect of next drink',
  'Halfling summer wine. 5 sp, sparkling, +1 Charisma 1 hour',
  'Elvish brandy. 5 sp, spiced, +1 Intelligence 1 hour',
  'Dwarvish gold ale. 5 sp, icy cold, regain 1d4 HP per mug',
  'Aged royal wine. 2 gp, smooth and rich, +1 Wisdom 1 hour',
  'Van Dinkle whiskey. 20 gp a sip, only 5 bottles made, +1 XP',
]

export function tavernDrinkForRoll(roll: number): string {
  if (roll < 1 || roll > 12) throw new Error(`tavernDrinkForRoll: roll out of range: ${roll}`)
  return DRINKS_TABLE[roll - 1]
}

// Shops.
export type ShopTier = 'Poor' | 'Standard' | 'Wealthy'

const SHOP_TYPES: Record<ShopTier, string[]> = {
  Poor: [
    'Filthy bakery', 'Used adventuring gear', 'Dead body collector', 'Pawn shop/fence', 'Moneylender',
    'Manure collector', 'Tannery', 'Back-alley chirurgeon', 'Ratcatcher', 'Fishmonger', 'Gambling house', 'Drug den',
  ],
  Standard: [
    'Brewer', 'Butcher', 'Tailor', 'Common blacksmith', 'Adventuring gear',
    'Leatherworker', 'Shipwright/carpenter', 'Stonemason', 'Herald/town crier', 'Livestock',
  ],
  Wealthy: [
    'Fine tailor', 'Glassblower', 'Jeweler', 'Apothecary', 'Artist',
    'Scribe', 'Guildhall', 'Goldsmith', 'Master blacksmith', 'Antiques and curios',
  ],
}

export function shopTypeForRoll(tier: ShopTier, roll: number): string {
  const max = tier === 'Poor' ? 12 : 10
  if (roll < 1 || roll > max) throw new Error(`shopTypeForRoll: roll out of range for ${tier}: ${roll}`)
  return SHOP_TYPES[tier][roll - 1]
}

// Shop Generator (d20) — same two-column-name + Known For shape as the Tavern Generator.
const SHOP_NAME_A = [
  'Fink &', 'Imperial', 'The Stout', "Rose's", "The King's", 'Fox &', 'Noble', "Sylvia's",
  'Sunrise', 'The Corner', "Grigor's", 'Royal', 'Crown &', "Ralina's", 'The Village', 'Golden',
  'Boot &', "Marvolo's", 'The Merry', 'The Jade',
]
const SHOP_NAME_B = [
  'Sons', 'Toad', 'Hammer', 'Commodities', 'Daughters', 'Sundries', 'Castle', 'Finery',
  'Oddments', 'Beetle', 'Storehouse', 'Keep', 'Coins', 'Hearth', 'Wheel', 'Wares',
  'Market', 'Lantern', 'Vendibles', 'Stocks',
]
const SHOP_KNOWN_FOR = [
  'Ancient, beloved owner', 'Buying anything of value', 'Charging non-regulars extra', 'Being a Thieves\' Guild front',
  'Resident cat, Crumpet', 'Password required to enter', 'Free ale with a purchase', 'Heavily armed bodyguards',
  'Paying top coin for curios', 'Secret room behind shelf', 'Fencing illicit goods', 'Ringing a gong at every sale',
  'Goods from distant lands', 'Shoddy and cheap items', 'Accusing customers of theft', 'All goods are dyed blue',
  "Owner's talking parrot", 'Famous bronze imp statue', 'Being haunted', 'Aggressive rodent problem',
]

export function shopNameForD20(rollA: number, rollB: number): string {
  return `${lookupD20(SHOP_NAME_A, rollA, 'shopNameForD20 (a)')} ${lookupD20(SHOP_NAME_B, rollB, 'shopNameForD20 (b)')}`
}

export function shopKnownForForD20(roll: number): string {
  return lookupD20(SHOP_KNOWN_FOR, roll, 'shopKnownForForD20')
}

// Interesting Customer (d4, d4) — 4x4 grid, row = first d4, column = second d4.
const INTERESTING_CUSTOMER: string[][] = [
  ['Odd wizard', '1d10 children', 'Cackling crone', 'Loud dwarf'],
  ['Nervous elf', 'Shifty thug', 'Town guard', '1d4 priests'],
  ['Goblin pirate', 'Cowled mage', 'Half-orc knight', 'Drunk man'],
  ['Staring child', 'Rival crawlers', 'Glum halfling', 'Pickpocket'],
]

export function interestingCustomerFor2D4(rollRow: number, rollCol: number): string {
  if (rollRow < 1 || rollRow > 4 || rollCol < 1 || rollCol > 4) {
    throw new Error(`interestingCustomerFor2D4: roll out of range: ${rollRow}, ${rollCol}`)
  }
  return INTERESTING_CUSTOMER[rollRow - 1][rollCol - 1]
}
