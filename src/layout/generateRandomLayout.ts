export type GridBlock = {
  id: string
  kind: string
  x: number
  y: number
  w: number
  h: number
  z?: number
  content?: string | number
}

export type ScreenLayout = {
  id: string
  blocks: GridBlock[]
}

export const COLS = 12
export const ROWS = 6

type BlockSpec = {
  id: GridBlock['id']
  kind: GridBlock['kind']
  minW: number
  minH: number
  maxW: number
  maxH: number
  minArea: number
}

type SizeOption = {
  w: number
  h: number
  area: number
}

const headlineTexts = [
  'What decisions do you delay the longest?',
  'What would you still do if no one could see the result?',
  'What do you enjoy that you rarely talk about?',
  'What do you blame on lack of time?',
  'What part of yourself do others misunderstand?',
  'When was the last time you lost track of time?',
  'What do you envy in people close to you?',
  'Who are you when nothing is being measured?',
]

const inputTexts = [
  '"Career stuff."',
  '"Sleep :)"',
  '"Watching bad reality TV and overanalyzing it."',
  '"Idk man"',
  '"Yesterday at 3am scrolling for no reason."',
  '"Calling my parents."',
  '"Someone who starts things but doesn\'t finish."',
  '"How easily they seem to belong."',
]

const blockSpecs: BlockSpec[] = [
  { id: 'headline', kind: 'headline', minW: 5, minH: 2, maxW: 9, maxH: 4, minArea: 12 },
  { id: 'input', kind: 'input_panel', minW: 3, minH: 2, maxW: 10, maxH: 6, minArea: 6 },
  { id: 'users', kind: 'users_left_panel', minW: 3, minH: 2, maxW: 6, maxH: 3, minArea: 6 },
  { id: 'timer', kind: 'timer_panel', minW: 3, minH: 2, maxW: 5, maxH: 3, minArea: 6 },
  { id: 'next', kind: 'button_next', minW: 3, minH: 1, maxW: 6, maxH: 1, minArea: 3 },
  { id: 'trash', kind: 'button_trash', minW: 2, minH: 1, maxW: 4, maxH: 1, minArea: 2 },
  { id: 'stack', kind: 'trashed_pages_stack', minW: 2, minH: 1, maxW: 3, maxH: 2, minArea: 2 },
]

export const REQUIRED_BLOCK_COUNT = blockSpecs.length

const placementOrder = ['headline', 'input', 'users', 'timer', 'next', 'trash', 'stack']

const mulberry32 = (seed: number) => {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randomInt = (rng: () => number, min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min

const buildSizeOptions = (spec: BlockSpec) => {
  const sizes: SizeOption[] = []
  for (let w = spec.minW; w <= spec.maxW; w += 1) {
    for (let h = spec.minH; h <= spec.maxH; h += 1) {
      const area = w * h
      if (area < spec.minArea) continue
      if (h > 1 && !isButtonKind(spec.kind) && w < 3) continue
      sizes.push({ w, h, area })
    }
  }
  return sizes
}

const isButtonKind = (kind: string) => kind === 'button_next' || kind === 'button_trash'

const isInputAwayFromEdges = (layout: ScreenLayout) => {
  const input = layout.blocks.find((block) => block.id === 'input')
  if (!input) return false
  const notLeftEdge = input.x >= 3
  const notTopRow = input.y > 1
  const notBottomRow = input.y + input.h - 1 < ROWS
  return notLeftEdge && notTopRow && notBottomRow
}

const buildSizePools = (spec: BlockSpec) => {
  const sizes = buildSizeOptions(spec).sort((a, b) => b.area - a.area)
  if (sizes.length === 0) return { sizes, biased: sizes }

  if (spec.id === 'headline' || spec.id === 'input') {
    const take = Math.max(1, Math.floor(sizes.length * 0.4))
    return { sizes, biased: sizes.slice(0, take) }
  }

  if (spec.id === 'next') {
    const biased = sizes.filter((size) => size.w >= 4 && size.w <= 5)
    return { sizes, biased: biased.length > 0 ? biased : sizes }
  }

  if (spec.id === 'trash') {
    const biased = sizes.filter((size) => size.w >= 2 && size.w <= 3)
    return { sizes, biased: biased.length > 0 ? biased : sizes }
  }

  if (spec.id === 'stack') {
    const biased = sizes.filter((size) => size.w === 2 && size.h === 1)
    return { sizes, biased: biased.length > 0 ? biased : sizes }
  }

  return { sizes, biased: sizes }
}

const buildSpecMap = () => new Map(blockSpecs.map((spec) => [spec.id, spec]))

const placeBlock = (
  rng: () => number,
  spec: BlockSpec,
  occupied: boolean[][],
  sizePools: Map<string, { sizes: SizeOption[]; biased: SizeOption[] }>,
) => {
  const pool = sizePools.get(spec.id)
  if (!pool) return null

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const size = pool.biased[Math.floor(rng() * pool.biased.length)]
    const maxX = COLS - size.w + 1
    const maxY = ROWS - size.h + 1
    let x = randomInt(rng, 1, maxX)
    if (spec.id === 'input') {
      const pick = rng()
      if (pick < 0.4) {
        x = randomInt(rng, Math.ceil(COLS / 2), maxX)
      } else if (pick < 0.7) {
        x = randomInt(rng, Math.ceil(COLS / 3), maxX)
      }
    }
    let y = randomInt(rng, 1, maxY)
    if (spec.id === 'input' && maxY >= 2) {
      const pickY = rng()
      if (pickY < 0.7) {
        const minY = Math.min(2, maxY)
        const maxInnerY = Math.max(minY, maxY - 1)
        y = randomInt(rng, minY, maxInnerY)
      }
    }
    if (canPlace(occupied, x, y, size.w, size.h)) {
      markOccupied(occupied, x, y, size.w, size.h)
      return { x, y, w: size.w, h: size.h }
    }
  }

  for (const size of pool.sizes) {
    const maxX = COLS - size.w + 1
    const maxY = ROWS - size.h + 1
    for (let y = 1; y <= maxY; y += 1) {
      for (let x = 1; x <= maxX; x += 1) {
        if (canPlace(occupied, x, y, size.w, size.h)) {
          markOccupied(occupied, x, y, size.w, size.h)
          return { x, y, w: size.w, h: size.h }
        }
      }
    }
  }

  return null
}

const placeBlockDeterministic = (
  spec: BlockSpec,
  occupied: boolean[][],
  sizePools: Map<string, { sizes: SizeOption[]; biased: SizeOption[] }>,
) => {
  const pool = sizePools.get(spec.id)
  if (!pool) return null

  for (const size of pool.sizes) {
    const maxX = COLS - size.w + 1
    const maxY = ROWS - size.h + 1
    for (let y = 1; y <= maxY; y += 1) {
      for (let x = 1; x <= maxX; x += 1) {
        if (canPlace(occupied, x, y, size.w, size.h)) {
          markOccupied(occupied, x, y, size.w, size.h)
          return { x, y, w: size.w, h: size.h }
        }
      }
    }
  }

  return null
}

const canPlace = (occupied: boolean[][], x: number, y: number, w: number, h: number) => {
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      if (occupied[row - 1]?.[col - 1]) return false
    }
  }
  return true
}

const markOccupied = (occupied: boolean[][], x: number, y: number, w: number, h: number) => {
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      occupied[row - 1][col - 1] = true
    }
  }
}

const canGrow = (block: GridBlock, spec: BlockSpec, dir: 'left' | 'right' | 'up' | 'down') => {
  if (dir === 'left' || dir === 'right') {
    const nextW = block.w + 1
    if (nextW > spec.maxW) return false
    return true
  }
  const nextH = block.h + 1
  if (nextH > spec.maxH) return false
  if (nextH > 1 && block.w < 3 && !isButtonKind(spec.kind)) return false
  return true
}

const shouldFillGap = (
  occupied: boolean[][],
  block: GridBlock,
  dir: 'left' | 'right' | 'up' | 'down',
) => {
  if (dir === 'right') {
    const gapCol = block.x + block.w
    if (gapCol > COLS) return false
    for (let row = block.y; row < block.y + block.h; row += 1) {
      if (occupied[row - 1][gapCol - 1]) return false
    }
    const neighborCol = gapCol + 1
    if (neighborCol > COLS) return true
    for (let row = block.y; row < block.y + block.h; row += 1) {
      if (occupied[row - 1][neighborCol - 1]) return true
    }
    return false
  }
  if (dir === 'left') {
    const gapCol = block.x - 1
    if (gapCol < 1) return false
    for (let row = block.y; row < block.y + block.h; row += 1) {
      if (occupied[row - 1][gapCol - 1]) return false
    }
    const neighborCol = gapCol - 1
    if (neighborCol < 1) return true
    for (let row = block.y; row < block.y + block.h; row += 1) {
      if (occupied[row - 1][neighborCol - 1]) return true
    }
    return false
  }
  if (dir === 'down') {
    const gapRow = block.y + block.h
    if (gapRow > ROWS) return false
    for (let col = block.x; col < block.x + block.w; col += 1) {
      if (occupied[gapRow - 1][col - 1]) return false
    }
    const neighborRow = gapRow + 1
    if (neighborRow > ROWS) return true
    for (let col = block.x; col < block.x + block.w; col += 1) {
      if (occupied[neighborRow - 1][col - 1]) return true
    }
    return false
  }
  const gapRow = block.y - 1
  if (gapRow < 1) return false
  for (let col = block.x; col < block.x + block.w; col += 1) {
    if (occupied[gapRow - 1][col - 1]) return false
  }
  const neighborRow = gapRow - 1
  if (neighborRow < 1) return true
  for (let col = block.x; col < block.x + block.w; col += 1) {
    if (occupied[neighborRow - 1][col - 1]) return true
  }
  return false
}

const expandBlock = (
  occupied: boolean[][],
  block: GridBlock,
  spec: BlockSpec,
  dir: 'left' | 'right' | 'up' | 'down',
) => {
  if (!canGrow(block, spec, dir)) return false
  if (!shouldFillGap(occupied, block, dir)) return false

  if (dir === 'right') {
    const targetCol = block.x + block.w
    for (let row = block.y; row < block.y + block.h; row += 1) {
      if (occupied[row - 1][targetCol - 1]) return false
    }
    for (let row = block.y; row < block.y + block.h; row += 1) {
      occupied[row - 1][targetCol - 1] = true
    }
    block.w += 1
    return true
  }
  if (dir === 'left') {
    const targetCol = block.x - 1
    for (let row = block.y; row < block.y + block.h; row += 1) {
      if (occupied[row - 1][targetCol - 1]) return false
    }
    for (let row = block.y; row < block.y + block.h; row += 1) {
      occupied[row - 1][targetCol - 1] = true
    }
    block.x -= 1
    block.w += 1
    return true
  }
  if (dir === 'down') {
    const targetRow = block.y + block.h
    for (let col = block.x; col < block.x + block.w; col += 1) {
      if (occupied[targetRow - 1][col - 1]) return false
    }
    for (let col = block.x; col < block.x + block.w; col += 1) {
      occupied[targetRow - 1][col - 1] = true
    }
    block.h += 1
    return true
  }
  const targetRow = block.y - 1
  for (let col = block.x; col < block.x + block.w; col += 1) {
    if (occupied[targetRow - 1][col - 1]) return false
  }
  for (let col = block.x; col < block.x + block.w; col += 1) {
    occupied[targetRow - 1][col - 1] = true
  }
  block.y -= 1
  block.h += 1
  return true
}

const fillSingleCellGaps = (blocks: GridBlock[]) => {
  const specMap = buildSpecMap()
  let occupied = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false))
  blocks.forEach((block) => markOccupied(occupied, block.x, block.y, block.w, block.h))

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false
    for (const block of blocks) {
      const spec = specMap.get(block.id)
      if (!spec) continue
      if (spec.id === 'stack') continue
      const dirs: Array<'right' | 'left' | 'down' | 'up'> = ['right', 'left', 'down', 'up']
      for (const dir of dirs) {
        if (expandBlock(occupied, block, spec, dir)) {
          changed = true
        }
      }
    }
    if (!changed) break
  }
}

const buildContent = (rng: () => number) => ({
  headline: headlineTexts[Math.floor(rng() * headlineTexts.length)],
  input: inputTexts[Math.floor(rng() * inputTexts.length)],
  users: `${randomInt(rng, 3, 18)} users already left, are you next?`,
  stack: randomInt(rng, 4, 80),
})

const tryGenerate = (seed: number) => {
  const rng = mulberry32(seed)
  const occupied = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false))
  const sizePools = new Map(blockSpecs.map((spec) => [spec.id, buildSizePools(spec)]))
  const content = buildContent(rng)

  const blocks: GridBlock[] = []
  let success = true

  for (const id of placementOrder) {
    const spec = blockSpecs.find((item) => item.id === id)
    if (!spec) continue
    const placement = placeBlock(rng, spec, occupied, sizePools)
    if (!placement) {
      success = false
      break
    }

    const block: GridBlock = {
      id: spec.id,
      kind: spec.kind,
      x: placement.x,
      y: placement.y,
      w: placement.w,
      h: placement.h,
    }

    if (spec.id === 'headline') block.content = content.headline
    if (spec.id === 'input') block.content = content.input
    if (spec.id === 'users') block.content = content.users
    if (spec.id === 'stack') block.content = content.stack
    blocks.push(block)
  }

  if (!success) return null
  fillSingleCellGaps(blocks)
  return blocks
}

export const generateRandomLayout = (seed = Date.now()): ScreenLayout => {
  let blocks: GridBlock[] | null = null

  for (let attempt = 0; attempt < 12; attempt += 1) {
    blocks = tryGenerate(seed + attempt * 9973)
    if (blocks) break
  }

  if (!blocks) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const attemptSeed = seed + attempt * 7919
      const rng = mulberry32(attemptSeed)
      const occupied = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false))
      const sizePools = new Map(blockSpecs.map((spec) => [spec.id, buildSizePools(spec)]))
      const content = buildContent(rng)

      const fallbackBlocks: GridBlock[] = []
      let success = true
      for (const id of placementOrder) {
        const spec = blockSpecs.find((item) => item.id === id)
        if (!spec) continue
        const placement = placeBlockDeterministic(spec, occupied, sizePools)
        if (!placement) {
          success = false
          break
        }
        const block: GridBlock = {
          id: spec.id,
          kind: spec.kind,
          x: placement.x,
          y: placement.y,
          w: placement.w,
          h: placement.h,
        }
        if (spec.id === 'headline') block.content = content.headline
        if (spec.id === 'input') block.content = content.input
        if (spec.id === 'users') block.content = content.users
        if (spec.id === 'stack') block.content = content.stack
        fallbackBlocks.push(block)
      }

      if (success) {
        fillSingleCellGaps(fallbackBlocks)
        blocks = fallbackBlocks
        break
      }
    }
  }

  if (!blocks || blocks.length < blockSpecs.length) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      blocks = tryGenerate(seed + attempt * 15401)
      if (blocks) break
    }
  }

  return {
    id: `generated-${seed}`,
    blocks: blocks ?? [],
  }
}

export const generateRandomLayoutWithBias = (
  seed: number,
  bias: 'any' | 'middle' | 'right',
): ScreenLayout => {
  const base = generateRandomLayout(seed)
  if (bias === 'any') return base

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = generateRandomLayout(seed + 1000 + attempt * 31)
    const input = candidate.blocks.find((block) => block.id === 'input')
    if (!input) continue
    const isMiddle = input.x >= 4 && input.x <= 7
    const isRight = input.x >= 8
    if ((bias === 'middle' && isMiddle) || (bias === 'right' && isRight)) {
      if (!isInputAwayFromEdges(candidate)) continue
      return candidate
    }
  }

  return base
}

export const generateRandomLayoutWithInputAwayFromEdges = (seed: number): ScreenLayout => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = generateRandomLayout(seed + attempt * 8191)
    if (candidate.blocks.length < blockSpecs.length) continue
    if (isInputAwayFromEdges(candidate)) return candidate
  }
  return generateRandomLayout(seed)
}
