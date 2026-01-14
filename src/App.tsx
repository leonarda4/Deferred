import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import './App.css'
import {
  endSessionBestEffort,
  fetchQuestionByOrder,
  getStoredOrderIndex,
  onNext as trackNext,
  onQuestionRender,
  onTrash as trackTrash,
  registerTypingTick,
  setStoredOrderIndex,
  type Question,
} from './lib/deferredTracking'
import {
  COLS,
  ROWS,
  generateRandomLayout,
  generateRandomLayoutWithInputAwayFromEdges,
  generateRandomLayoutWithBias,
  REQUIRED_BLOCK_COUNT,
  type GridBlock,
  type ScreenLayout,
} from './layout/generateRandomLayout'

type Rect = {
  left: number
  top: number
  width: number
  height: number
}

type ExitingBlock = {
  id: string
  kind: string
  rect: Rect
  z: number
  content: ReactNode
}

const PADDING = 60
const GAP = 40
const COMPACT_BREAKPOINT = 600
const MEDIUM_BREAKPOINT = 1200
const COMPACT_COLS = 4
const COMPACT_MAX_ROWS = 3
const COMPACT_SPACING = 20

const predefinedLayouts: ScreenLayout[] = [
  {
    id: 'layout-01',
    blocks: [
      { id: 'headline', kind: 'headline', x: 1, y: 1, w: 7, h: 2, z: 1, content: 'What decisions do you delay the longest?' },
      { id: 'next', kind: 'button_next', x: 9, y: 1, w: 4, h: 1, z: 2 },
      { id: 'users', kind: 'users_left_panel', x: 8, y: 2, w: 5, h: 3, z: 1, content: '15 users already left, are you next?' },
      { id: 'input', kind: 'input_panel', x: 1, y: 3, w: 7, h: 3, z: 1, content: '"Career stuff."' },
      { id: 'stack', kind: 'trashed_pages_stack', x: 8, y: 5, w: 2, h: 1, z: 2, content: 61 },
      { id: 'trash', kind: 'button_trash', x: 8, y: 6, w: 2, h: 1, z: 3 },
      { id: 'timer', kind: 'timer_panel', x: 10, y: 5, w: 3, h: 2, z: 1 },
    ],
  },
  {
    id: 'layout-02',
    blocks: [
      { id: 'users', kind: 'users_left_panel', x: 1, y: 1, w: 6, h: 3, z: 1, content: '15 users already left, are you next?' },
      { id: 'input', kind: 'input_panel', x: 7, y: 1, w: 6, h: 2, z: 1, content: '"Sleep :)"' },
      { id: 'headline', kind: 'headline', x: 1, y: 4, w: 7, h: 2, z: 1, content: 'What would you still do if no one could see the result?' },
      { id: 'timer', kind: 'timer_panel', x: 8, y: 4, w: 5, h: 2, z: 1 },
      { id: 'stack', kind: 'trashed_pages_stack', x: 9, y: 6, w: 2, h: 1, z: 2, content: 43 },
      { id: 'trash', kind: 'button_trash', x: 11, y: 6, w: 2, h: 1, z: 3 },
      { id: 'next', kind: 'button_next', x: 1, y: 6, w: 6, h: 1, z: 2 },
    ],
  },
  {
    id: 'layout-03',
    blocks: [
      { id: 'users', kind: 'users_left_panel', x: 1, y: 1, w: 6, h: 3, z: 1, content: '5 users already left, are you next?' },
      { id: 'input', kind: 'input_panel', x: 7, y: 1, w: 6, h: 3, z: 1, content: '"Watching bad reality TV and overanalyzing it."' },
      { id: 'next', kind: 'button_next', x: 1, y: 4, w: 6, h: 1, z: 2 },
      { id: 'stack', kind: 'trashed_pages_stack', x: 7, y: 4, w: 2, h: 1, z: 2, content: 11 },
      { id: 'trash', kind: 'button_trash', x: 9, y: 4, w: 3, h: 1, z: 3 },
      { id: 'headline', kind: 'headline', x: 1, y: 5, w: 7, h: 2, z: 1, content: 'What do you enjoy that you rarely talk about?' },
      { id: 'timer', kind: 'timer_panel', x: 9, y: 5, w: 4, h: 2, z: 1 },
    ],
  },
  {
    id: 'layout-04',
    blocks: [
      { id: 'timer', kind: 'timer_panel', x: 1, y: 1, w: 4, h: 2, z: 1 },
      { id: 'headline', kind: 'headline', x: 6, y: 1, w: 7, h: 2, z: 1, content: 'What do you blame on lack of time?' },
      { id: 'trash', kind: 'button_trash', x: 1, y: 3, w: 2, h: 1, z: 3 },
      { id: 'stack', kind: 'trashed_pages_stack', x: 5, y: 3, w: 2, h: 1, z: 2, content: 21 },
      { id: 'next', kind: 'button_next', x: 7, y: 3, w: 4, h: 1, z: 2 },
      { id: 'users', kind: 'users_left_panel', x: 1, y: 4, w: 6, h: 3, z: 1, content: '16 users already left, are you next?' },
      { id: 'input', kind: 'input_panel', x: 7, y: 4, w: 6, h: 3, z: 1, content: '"Calling my parents."' },
    ],
  },
  {
    id: 'layout-05',
    blocks: [
      { id: 'headline', kind: 'headline', x: 1, y: 1, w: 7, h: 2, z: 1, content: 'What part of yourself do others misunderstand?' },
      { id: 'next', kind: 'button_next', x: 9, y: 1, w: 4, h: 1, z: 2 },
      { id: 'users', kind: 'users_left_panel', x: 9, y: 2, w: 4, h: 2, z: 1, content: '9 users already left, are you next?' },
      { id: 'trash', kind: 'button_trash', x: 1, y: 3, w: 2, h: 1, z: 3 },
      { id: 'stack', kind: 'trashed_pages_stack', x: 3, y: 3, w: 2, h: 1, z: 2, content: 43 },
      { id: 'timer', kind: 'timer_panel', x: 1, y: 4, w: 4, h: 3, z: 1 },
      { id: 'input', kind: 'input_panel', x: 5, y: 4, w: 8, h: 3, z: 1, content: '"Idk man"' },
    ],
  },
  {
    id: 'layout-06',
    blocks: [
      { id: 'trash', kind: 'button_trash', x: 1, y: 1, w: 2, h: 1, z: 3 },
      { id: 'stack', kind: 'trashed_pages_stack', x: 3, y: 1, w: 2, h: 1, z: 2, content: 12 },
      { id: 'headline', kind: 'headline', x: 1, y: 2, w: 7, h: 3, z: 1, content: 'Who are you when nothing is being measured?' },
      { id: 'users', kind: 'users_left_panel', x: 8, y: 1, w: 5, h: 3, z: 1, content: '15 users already left, are you next?' },
      { id: 'input', kind: 'input_panel', x: 8, y: 4, w: 5, h: 2, z: 1, content: '"Someone who starts things but doesn\'t finish."' },
      { id: 'timer', kind: 'timer_panel', x: 1, y: 5, w: 5, h: 2, z: 1 },
      { id: 'next', kind: 'button_next', x: 9, y: 6, w: 3, h: 1, z: 2 },
    ],
  },
  {
    id: 'layout-07',
    blocks: [
      { id: 'headline', kind: 'headline', x: 1, y: 1, w: 7, h: 2, z: 1, content: 'When was the last time you lost track of time?' },
      { id: 'users', kind: 'users_left_panel', x: 9, y: 1, w: 4, h: 3, z: 1, content: '3 users already left, are you next?' },
      { id: 'input', kind: 'input_panel', x: 1, y: 3, w: 8, h: 3, z: 1, content: '"Yesterday at 3am scrolling for no reason."' },
      { id: 'stack', kind: 'trashed_pages_stack', x: 9, y: 4, w: 2, h: 1, z: 2, content: 21 },
      { id: 'trash', kind: 'button_trash', x: 1, y: 6, w: 2, h: 1, z: 3 },
      { id: 'next', kind: 'button_next', x: 3, y: 6, w: 6, h: 1, z: 2 },
      { id: 'timer', kind: 'timer_panel', x: 9, y: 5, w: 4, h: 2, z: 1 },
    ],
  },
  {
    id: 'layout-08',
    blocks: [
      { id: 'next', kind: 'button_next', x: 1, y: 1, w: 5, h: 1, z: 2 },
      { id: 'users', kind: 'users_left_panel', x: 1, y: 2, w: 5, h: 3, z: 1, content: '8 users already left, are you next?' },
      { id: 'timer', kind: 'timer_panel', x: 1, y: 5, w: 3, h: 2, z: 1 },
      { id: 'trash', kind: 'button_trash', x: 4, y: 5, w: 2, h: 1, z: 3 },
      { id: 'stack', kind: 'trashed_pages_stack', x: 4, y: 6, w: 2, h: 1, z: 2, content: 4 },
      { id: 'input', kind: 'input_panel', x: 6, y: 1, w: 4, h: 6, z: 1, content: '"How easily they seem to belong."' },
      { id: 'headline', kind: 'headline', x: 10, y: 1, w: 3, h: 5, z: 1, content: 'What do you envy in people close to you?' },
    ],
  },
]

const themes = [
  { id: 'sun', bg: '#FFFFE3', accent: '#FFFF5C' },
  { id: 'rose', bg: '#FCECEC', accent: '#FF9D9D' },
  { id: 'aqua', bg: '#E2FCFC', accent: '#9CFFFF' },
  { id: 'mint', bg: '#E2FDE6', accent: '#81FF94' },
]

const activityRecords = [
  { user: 'User0001', action: 'trashed a page', time: '20:43' },
  { user: 'User0001', action: 'trashed a page', time: '20:44' },
  { user: 'User0001', action: 'trashed a page', time: '20:45' },
  { user: 'User0003', action: 'left', time: '20:46' },
  { user: 'User0005', action: 'trashed a page', time: '20:47' },
  { user: 'User0012', action: 'left', time: '20:48' },
  { user: 'User0017', action: 'trashed a page', time: '20:49' },
  { user: 'User0020', action: 'left', time: '20:50' },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const compactWidthForBlock = (block: GridBlock) => {
  const minById: Record<GridBlock['id'], number> = {
    headline: 4,
    input: 4,
    users: 4,
    timer: 2,
    next: 4,
    trash: 2,
    stack: 2,
  }
  if (block.id === 'users') {
    return COMPACT_COLS
  }
  const scaled = Math.round((block.w / COLS) * COMPACT_COLS) || 1
  const min = minById[block.id] ?? 1
  return clamp(Math.max(min, scaled), 1, COMPACT_COLS)
}

const buildCompactLayout = (layout: ScreenLayout): ScreenLayout => {
  const sorted = [...layout.blocks].sort((a, b) => (a.y - b.y) || (a.x - b.x))
  const blocks: GridBlock[] = []
  let x = 1
  let y = 1
  let rowHeight = 0
  let rowBlocks: GridBlock[] = []
  const finalizeRow = () => {
    if (rowBlocks.length === 1) {
      const only = rowBlocks[0]
      if (only.id !== 'trash') {
        only.x = 1
        only.w = COMPACT_COLS
      }
    }
  }

  for (const block of sorted) {
    const w = compactWidthForBlock(block)
    const baseH =
      block.id === 'trash'
        ? 1
        : clamp(block.h, 1, COMPACT_MAX_ROWS)

    if (x + w - 1 > COMPACT_COLS && rowHeight > 0) {
      finalizeRow()
      y += rowHeight
      x = 1
      rowHeight = 0
      rowBlocks = []
    }

    const nextRowHeight = Math.max(rowHeight, baseH)
    if (nextRowHeight > rowHeight) {
      const minHeight = Math.max(1, nextRowHeight - 1)
      rowBlocks.forEach((rowBlock) => {
        rowBlock.h = Math.max(rowBlock.h, minHeight)
      })
      rowHeight = nextRowHeight
    }

    const minHeight = Math.max(1, rowHeight - 1)
    const h = clamp(Math.max(baseH, minHeight), 1, COMPACT_MAX_ROWS)

    const placed: GridBlock = {
      ...block,
      x,
      y,
      w,
      h,
    }
    blocks.push(placed)
    rowBlocks.push(placed)
    x += w
  }

  finalizeRow()

  return { ...layout, blocks }
}

const getMaxRows = (blocks: GridBlock[]) =>
  blocks.reduce((max, block) => Math.max(max, block.y + block.h - 1), 0)

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    if ('addEventListener' in mediaQuery) {
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }

    const legacy = mediaQuery as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void
    }
    legacy.addListener?.(handler)
    return () => legacy.removeListener?.(handler)
  }, [])

  return prefersReducedMotion
}

const LogPanel = ({ title, records }: { title: string; records: typeof activityRecords }) => {
  const listRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!listRef.current) return
    const node = listRef.current
    const raf = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight
    })
    return () => cancelAnimationFrame(raf)
  }, [records])

  return (
    <div className="log-panel">
      <h2>{title}</h2>
      <div className="log-list" ref={listRef}>
        {records.map((record, index) => (
          <div className="log-row" key={`${record.user}-${record.time}-${index}`}>
            <span>{record.user} {record.action}</span>
            <span>{record.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const useFlipAnimation = (
  blockRefs: MutableRefObject<Map<string, HTMLDivElement>>,
  layoutId: string,
  disabled: boolean,
  size: { width: number; height: number },
  skipFlipRef: MutableRefObject<boolean>,
) => {
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map())

  useLayoutEffect(() => {
    if (disabled) {
      const reducedRects = new Map<string, DOMRect>()
      blockRefs.current.forEach((element, id) => {
        reducedRects.set(id, element.getBoundingClientRect())
      })
      prevRectsRef.current = reducedRects
      return
    }

    if (skipFlipRef.current) {
      const resizedRects = new Map<string, DOMRect>()
      blockRefs.current.forEach((element, id) => {
        resizedRects.set(id, element.getBoundingClientRect())
      })
      prevRectsRef.current = resizedRects
      skipFlipRef.current = false
      return
    }

    const firstRects = prevRectsRef.current
    const lastRects = new Map<string, DOMRect>()

    blockRefs.current.forEach((element, id) => {
      lastRects.set(id, element.getBoundingClientRect())
    })

    if (firstRects.size === 0) {
      prevRectsRef.current = lastRects
      return
    }

    blockRefs.current.forEach((element, id) => {
      const first = firstRects.get(id)
      const last = lastRects.get(id)
      if (!first || !last) return

      const dx = first.left - last.left
      const dy = first.top - last.top
      const sx = first.width / last.width
      const sy = first.height / last.height

      element.style.transformOrigin = 'top left'
      element.style.transition = 'none'
      element.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
      element.style.opacity = '1'

      requestAnimationFrame(() => {
        element.style.transition = 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)'
        element.style.transform = 'translate(0px, 0px) scale(1, 1)'
      })
    })

    blockRefs.current.forEach((element, id) => {
      if (firstRects.has(id)) return

      element.style.transformOrigin = 'top left'
      element.style.transition = 'none'
      element.style.opacity = '0'
      element.style.transform = 'translate(0px, 6px) scale(0.98)'

      requestAnimationFrame(() => {
        element.style.transition = 'transform 320ms ease, opacity 320ms ease'
        element.style.opacity = '1'
        element.style.transform = 'translate(0px, 0px) scale(1, 1)'
      })
    })

    prevRectsRef.current = lastRects
  }, [blockRefs, disabled, layoutId, size.height, size.width, skipFlipRef])
}

const renderBlockContent = (
  block: GridBlock,
  timerText: string,
  onNext: () => void,
  interactive: boolean,
  question: Question | null,
  answerText: string,
  onAnswerChange: (value: string) => void,
  onAnswerKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void,
  onTrash: () => void,
  trashedCount: number,
  isEndScreen: boolean,
  nextDisabled: boolean,
  inputDisabled: boolean,
  errorMessage: string | null,
) => {
  switch (block.kind) {
    case 'headline':
      return (
        <h1 className="block-title">
          {isEndScreen
            ? 'now what?'
            : errorMessage ?? question?.prompt ?? 'Loading question...'}
        </h1>
      )
    case 'users_left_panel':
      return <LogPanel title={String(block.content ?? '15 users already left, are you next?')} records={activityRecords} />
    case 'input_panel':
      return (
        <div className="block-panel">
          <LockedInput
            placeholder={
              question?.meta && typeof question.meta.placeholder === 'string'
                ? question.meta.placeholder
                : ''
            }
            value={answerText}
            onChange={onAnswerChange}
            onKeyDown={onAnswerKeyDown}
            disabled={inputDisabled}
          />
        </div>
      )
    case 'timer_panel':
      return (
        <div className="block-timer">
          <div className="timer-value">{timerText}</div>
          <div className="timer-label">minutes wasted here</div>
        </div>
      )
    case 'button_trash':
      if (!interactive) {
        return <span>Trash</span>
      }
      return (
        <button type="button" className="block-button" onClick={onTrash}>
          Trash
        </button>
      )
    case 'button_next':
      if (!interactive) {
        return <span>Next Question</span>
      }
      return (
        <button
          type="button"
          className="block-button"
          onClick={onNext}
          disabled={nextDisabled}
        >
          {isEndScreen ? 'Start Again' : 'Next Question'}
        </button>
      )
    case 'trashed_pages_stack':
    {
      const count = trashedCount || block.content || 0
      return (
        <div className="block-stack">
          <div className="stack-frame" aria-hidden="true">
            <div className="stack-icon"></div>
          </div>
          <div>
            <div className="stack-count">{count}</div>
            <div className="stack-label">trashed pages</div>
          </div>
        </div>
      )
    }
    default:
      return block.content ?? null
  }
}

const LockedInput = ({
  placeholder,
  value,
  onChange,
  onKeyDown,
  disabled,
}: {
  placeholder: string
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void
  disabled: boolean
}) => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const blockedKeys = useMemo(
    () =>
      new Set([
        'Backspace',
        'Delete',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
        'PageUp',
        'PageDown',
        'Insert',
      ]),
    [],
  )

  const lockCursorToEnd = () => {
    const input = inputRef.current
    if (!input) return
    const end = input.value.length
    requestAnimationFrame(() => {
      input.setSelectionRange(end, end)
    })
  }

  return (
    <div className="locked-wrap">
      <textarea
        ref={inputRef}
        className="locked-input"
        rows={6}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown(event)
          if (event.ctrlKey || event.metaKey || event.altKey) {
            event.preventDefault()
            return
          }
          if (blockedKeys.has(event.key)) {
            event.preventDefault()
          }
        }}
        onBeforeInput={(event) => {
          const native = event.nativeEvent as InputEvent
          const type = native?.inputType || ''
          if (
            type.startsWith('delete') ||
            type === 'insertFromPaste' ||
            type === 'insertFromDrop' ||
            type === 'insertReplacementText'
          ) {
            event.preventDefault()
          }
        }}
        onInput={lockCursorToEnd}
        onFocus={lockCursorToEnd}
        onSelect={lockCursorToEnd}
        onMouseDown={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
          lockCursorToEnd()
        }}
        onPaste={(event) => event.preventDefault()}
        onCopy={(event) => event.preventDefault()}
        onCut={(event) => event.preventDefault()}
      />
    </div>
  )
}

const Canvas = ({
  layout,
  timerText,
  onNext,
  question,
  answerText,
  onAnswerChange,
  onAnswerKeyDown,
  onTrash,
  trashedCount,
  isEndScreen,
  nextDisabled,
  inputDisabled,
  errorMessage,
}: {
  layout: ScreenLayout
  timerText: string
  onNext: () => void
  question: Question | null
  answerText: string
  onAnswerChange: (value: string) => void
  onAnswerKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void
  onTrash: () => void
  trashedCount: number
  isEndScreen: boolean
  nextDisabled: boolean
  inputDisabled: boolean
  errorMessage: string | null
}) => {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const prevLayoutRef = useRef<ScreenLayout | null>(null)
  const prevLayoutRectsRef = useRef<Map<string, Rect>>(new Map())
  const skipFlipRef = useRef(false)
  const [exitingBlocks, setExitingBlocks] = useState<ExitingBlock[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const prefersReducedMotion = usePrefersReducedMotion()

  useLayoutEffect(() => {
    if (!canvasRef.current) return

    const element = canvasRef.current
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ width, height })
        skipFlipRef.current = true
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const compactLayout = useMemo(() => {
    if (!size.width || size.width >= COMPACT_BREAKPOINT) return layout
    return buildCompactLayout(layout)
  }, [layout, size.width])

  const rects = useMemo(() => {
    const rectMap = new Map<string, Rect>()
    if (!size.width || !size.height) return rectMap

    const spacing = size.width < MEDIUM_BREAKPOINT ? COMPACT_SPACING : PADDING
    const gap = size.width < MEDIUM_BREAKPOINT ? COMPACT_SPACING : GAP
    const columns = size.width < COMPACT_BREAKPOINT ? COMPACT_COLS : COLS
    const activeLayout = size.width < COMPACT_BREAKPOINT ? compactLayout : layout

    const innerWidth = size.width - 2 * spacing
    const columnWidth = (innerWidth - (columns - 1) * gap) / columns
    const rowHeight =
      size.width < COMPACT_BREAKPOINT
        ? clamp(columnWidth * 0.72, 44, 78)
        : (size.height - 2 * spacing - (ROWS - 1) * gap) / ROWS

    activeLayout.blocks.forEach((block) => {
      const left = spacing + (block.x - 1) * (columnWidth + gap)
      const top = spacing + (block.y - 1) * (rowHeight + gap)
      const width = block.w * columnWidth + (block.w - 1) * gap
      const height = block.h * rowHeight + (block.h - 1) * gap

      rectMap.set(block.id, {
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(width),
        height: Math.round(height),
      })
    })

    return rectMap
  }, [compactLayout, layout, size.height, size.width])

  useEffect(() => {
    const activeLayout = size.width < COMPACT_BREAKPOINT ? compactLayout : layout

    if (prefersReducedMotion) {
      prevLayoutRef.current = activeLayout
      prevLayoutRectsRef.current = rects
      setExitingBlocks([])
      return
    }

    const previousLayout = prevLayoutRef.current
    if (previousLayout) {
      const prevIds = new Set(previousLayout.blocks.map((block) => block.id))
      const nextIds = new Set(activeLayout.blocks.map((block) => block.id))
      const exitingIds = [...prevIds].filter((id) => !nextIds.has(id))

      if (exitingIds.length > 0) {
        const exiting: ExitingBlock[] = []
        exitingIds.forEach((id) => {
          const block = previousLayout.blocks.find((item) => item.id === id)
          const rect = prevLayoutRectsRef.current.get(id)
          if (!block || !rect) return
          exiting.push({
            id,
            kind: block.kind,
            rect,
            z: block.z ?? 1,
            content: renderBlockContent(
              block,
              timerText,
              onNext,
              false,
              question,
              answerText,
              onAnswerChange,
              onAnswerKeyDown,
              onTrash,
              trashedCount,
              isEndScreen,
              nextDisabled,
              inputDisabled,
              errorMessage,
            ),
          })
        })

        if (exiting.length > 0) {
          setExitingBlocks((current) => [...current, ...exiting])
        }
      }
    }

    prevLayoutRef.current = activeLayout
    prevLayoutRectsRef.current = rects
  }, [compactLayout, layout, onNext, prefersReducedMotion, rects, size.width, timerText])

  useFlipAnimation(blockRefs, layout.id, prefersReducedMotion, size, skipFlipRef)

  const handleExitDone = (id: string) => {
    setExitingBlocks((blocks) => blocks.filter((block) => block.id !== id))
  }

  const activeLayout = size.width < COMPACT_BREAKPOINT ? compactLayout : layout
  const displayBlocks = isEndScreen
    ? activeLayout.blocks.filter((block) => block.kind === 'headline' || block.kind === 'button_next')
    : activeLayout.blocks
  const compactContentHeight = useMemo(() => {
    if (!size.width || size.width >= COMPACT_BREAKPOINT) return null
    const spacing = COMPACT_SPACING
    const gap = COMPACT_SPACING
    const columns = COMPACT_COLS
    const innerWidth = size.width - 2 * spacing
    const columnWidth = (innerWidth - (columns - 1) * gap) / columns
    const rowHeight = clamp(columnWidth * 0.72, 44, 78)
    const rows = getMaxRows(activeLayout.blocks)
    if (!rows) return null
    return spacing * 2 + rows * rowHeight + (rows - 1) * gap
  }, [activeLayout.blocks, size.width])

  return (
    <div
      className="canvas"
      ref={canvasRef}
      style={compactContentHeight ? { minHeight: Math.round(compactContentHeight) } : undefined}
    >
      {displayBlocks.map((block) => {
        const rect = rects.get(block.id)
        if (!rect) return null
        return (
          <div
            key={block.id}
            ref={(node) => {
              if (node) {
                blockRefs.current.set(block.id, node)
              } else {
                blockRefs.current.delete(block.id)
              }
            }}
            className={`block block--${block.kind}`}
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              zIndex: block.z ?? 1,
            }}
          >
            {renderBlockContent(
              block,
              timerText,
              onNext,
              true,
              question,
              answerText,
              onAnswerChange,
              onAnswerKeyDown,
              onTrash,
              trashedCount,
              isEndScreen,
              nextDisabled,
              inputDisabled,
              errorMessage,
            )}
          </div>
        )
      })}

      <div className="exit-layer">
        {exitingBlocks.map((block) => (
          <ExitingBlock key={block.id} block={block} onDone={handleExitDone} />
        ))}
      </div>
    </div>
  )
}

const ExitingBlock = ({ block, onDone }: { block: ExitingBlock; onDone: (id: string) => void }) => {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setActive(true))
    const timeout = window.setTimeout(() => onDone(block.id), 420)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timeout)
    }
  }, [block.id, onDone])

  return (
    <div
      className={`block block--${block.kind} block--exit${active ? ' block--exit-active' : ''}`}
      style={{
        left: block.rect.left,
        top: block.rect.top,
        width: block.rect.width,
        height: block.rect.height,
        zIndex: block.z,
      }}
    >
      {block.content}
    </div>
  )
}

function App() {
  const [orderIndex, setOrderIndex] = useState(() => getStoredOrderIndex())
  const [reviewMode] = useState(false)
  const [themeIndex, setThemeIndex] = useState(() => Math.floor(Math.random() * themes.length))
  const [timerText, setTimerText] = useState('00:00')
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [questionLoading, setQuestionLoading] = useState(true)
  const [questionError, setQuestionError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isEndScreen, setIsEndScreen] = useState(false)
  const [trashedCount, setTrashedCount] = useState(0)
  const baseSeedRef = useRef(Math.floor(Math.random() * 1_000_000_000))

  const generatedLayouts = useMemo(() => {
    const layouts: ScreenLayout[] = []
    const attemptsPerLayout = 40
    let rngSeed = baseSeedRef.current
    const rng = () => {
      rngSeed = (rngSeed + 0x6d2b79f5) >>> 0
      let t = rngSeed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    const isAllDifferent = (prev: ScreenLayout, next: ScreenLayout) => {
      const prevMap = new Map(prev.blocks.map((block) => [block.id, block]))
      return next.blocks.every((block) => {
        const prevBlock = prevMap.get(block.id)
        if (!prevBlock) return true
        return (
          block.x !== prevBlock.x ||
          block.y !== prevBlock.y ||
          block.w !== prevBlock.w ||
          block.h !== prevBlock.h
        )
      })
    }

    const addLayouts = (
      count: number,
      bias: 'any' | 'middle' | 'right' | 'inputAway',
      seedOffset: number,
    ) => {
      for (let i = 0; i < count; i += 1) {
        let generated: ScreenLayout | null = null
        for (let attempt = 0; attempt < attemptsPerLayout; attempt += 1) {
          const seed = baseSeedRef.current + seedOffset + i * 100 + attempt + 1
          const candidate =
            bias === 'inputAway'
              ? generateRandomLayoutWithInputAwayFromEdges(seed)
              : generateRandomLayoutWithBias(seed, bias)
          if (candidate.blocks.length < REQUIRED_BLOCK_COUNT) continue
          if (layouts.length > 0 && !isAllDifferent(layouts[layouts.length - 1], candidate)) continue
          generated = candidate
          break
        }
        layouts.push(generated ?? generateRandomLayout(baseSeedRef.current + seedOffset + i + 1))
      }
    }

    const buildSequence = () => {
      for (let i = 0; i < 70; i += 1) {
        if (rng() < 0.2) {
          layouts.push(predefinedLayouts[i % predefinedLayouts.length])
          continue
        }
        if (i % 5 === 4) {
          addLayouts(1, 'inputAway', 30000 + i * 100)
        } else if (i < 50) {
          addLayouts(1, 'any', i * 100)
        } else if (i < 60) {
          addLayouts(1, 'middle', 5000 + i * 100)
        } else {
          addLayouts(1, 'right', 10000 + i * 100)
        }
      }
    }

    buildSequence()

    const first = layouts[0]
    const last = layouts[layouts.length - 1]
    if (first && last && first.blocks.length >= REQUIRED_BLOCK_COUNT) {
      if (!isAllDifferent(first, last)) {
        for (let attempt = 0; attempt < attemptsPerLayout; attempt += 1) {
          const candidate = generateRandomLayout(baseSeedRef.current + 20000 + attempt)
          if (candidate.blocks.length < REQUIRED_BLOCK_COUNT) continue
          if (!isAllDifferent(first, candidate)) continue
          layouts[layouts.length - 1] = candidate
          break
        }
      }
    }

    return layouts
  }, [])
  const allLayouts = useMemo(
    () => [...predefinedLayouts, ...generatedLayouts],
    [generatedLayouts],
  )
  const reviewLayouts = useMemo(() => generatedLayouts, [generatedLayouts])
  const activeLayouts = reviewMode ? reviewLayouts : allLayouts
  const inputDisabled = questionLoading || Boolean(questionError) || isEndScreen
  const nextDisabled =
    !isEndScreen && (questionLoading || Boolean(questionError) || inputValue.trim().length === 0)

  useEffect(() => {
    if (!window.localStorage.getItem('deferred_current_order_index')) {
      setStoredOrderIndex(1)
    }
  }, [])

  useEffect(() => {
    let active = true
    const loadQuestion = async () => {
      setQuestionLoading(true)
      setQuestionError(null)
      try {
        const question = await fetchQuestionByOrder(orderIndex)
        if (!active) return
        if (!question) {
          setIsEndScreen(true)
          setCurrentQuestion(null)
          setQuestionLoading(false)
          return
        }
        setIsEndScreen(false)
        setCurrentQuestion(question)
        setInputValue('')
        setQuestionLoading(false)
      } catch (error) {
        console.error('Failed to load question', error)
        if (!active) return
        setCurrentQuestion(null)
        setIsEndScreen(false)
        setQuestionError('Unable to load questions right now.')
        setQuestionLoading(false)
      }
    }
    void loadQuestion()
    return () => {
      active = false
    }
  }, [orderIndex])

  useEffect(() => {
    setStoredOrderIndex(orderIndex)
  }, [orderIndex])

  useEffect(() => {
    if (!currentQuestion || isEndScreen || questionError) return
    const run = async () => {
      await onQuestionRender(currentQuestion.id)
    }
    void run()
  }, [currentQuestion, isEndScreen, questionError])

  useEffect(() => {
    const handleExit = () => {
      void endSessionBestEffort()
    }
    window.addEventListener('beforeunload', handleExit)
    window.addEventListener('pagehide', handleExit)
    return () => {
      window.removeEventListener('beforeunload', handleExit)
      window.removeEventListener('pagehide', handleExit)
    }
  }, [])

  useEffect(() => {
    const startTime = Date.now()
    const updateTimer = () => {
      const diff = Math.floor((Date.now() - startTime) / 1000)
      const minutes = Math.floor(diff / 60)
      const seconds = diff % 60
      const pad = (value: number) => String(value).padStart(2, '0')
      setTimerText(`${pad(minutes)}:${pad(seconds)}`)
    }

    updateTimer()
    const intervalId = window.setInterval(updateTimer, 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const handleAnswerChange = (value: string) => {
    if (!currentQuestion) return
    setInputValue(value)
    void registerTypingTick(currentQuestion.id)
  }

  const handleAnswerKeyDown = (_event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!currentQuestion) return
    void registerTypingTick(currentQuestion.id)
  }

  const handleTrash = async () => {
    if (!currentQuestion) return
    await trackTrash(currentQuestion.id, inputValue)
    setInputValue('')
    setTrashedCount((count) => count + 1)
  }

  const layout = activeLayouts[orderIndex % activeLayouts.length]
  const theme = themes[themeIndex]

  const handleNext = async () => {
    if (isEndScreen) {
      setStoredOrderIndex(1)
      setOrderIndex(1)
      setInputValue('')
      return
    }
    if (!currentQuestion || nextDisabled) return
    await trackNext(currentQuestion.id, inputValue)
    const nextIndex = orderIndex + 1
    setStoredOrderIndex(nextIndex)
    setOrderIndex(nextIndex)
    setInputValue('')
    setThemeIndex((current) => {
      if (themes.length <= 1) return current
      let nextIndex = current
      while (nextIndex === current) {
        nextIndex = Math.floor(Math.random() * themes.length)
      }
      return nextIndex
    })
  }

  return (
    <div
      className="app"
      style={
        {
          '--bg': theme.bg,
          '--accent': theme.accent,
        } as CSSProperties
      }
    >
      <Canvas
        layout={layout}
        timerText={timerText}
        onNext={handleNext}
        question={questionLoading ? null : currentQuestion}
        answerText={inputValue}
        onAnswerChange={handleAnswerChange}
        onAnswerKeyDown={handleAnswerKeyDown}
        onTrash={handleTrash}
        trashedCount={trashedCount}
        isEndScreen={isEndScreen}
        nextDisabled={nextDisabled}
        inputDisabled={inputDisabled}
        errorMessage={questionError}
      />
    </div>
  )
}

export default App
