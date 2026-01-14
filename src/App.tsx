import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import './App.css'

type GridBlock = {
  id: string
  kind: string
  x: number
  y: number
  w: number
  h: number
  z?: number
  content?: string | number
}

type ScreenLayout = {
  id: string
  blocks: GridBlock[]
}

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

const COLS = 12
const ROWS = 6
const PADDING = 60
const GAP = 40

const screens: ScreenLayout[] = [
  {
    id: 'layout-01',
    blocks: [
      { id: 'title', kind: 'title', x: 1, y: 1, w: 7, h: 2, z: 1, content: 'What decisions do you delay the longest?' },
      { id: 'next', kind: 'button', x: 9, y: 1, w: 4, h: 1, z: 2 },
      { id: 'log', kind: 'panel-log', x: 8, y: 2, w: 5, h: 3, z: 1, content: '15 users already left, are you next?' },
      { id: 'quote', kind: 'panel-quote', x: 1, y: 3, w: 7, h: 3, z: 1, content: '"Career stuff."' },
      { id: 'stack', kind: 'stack', x: 8, y: 5, w: 2, h: 1, z: 2, content: 61 },
      { id: 'trash', kind: 'trash', x: 8, y: 6, w: 2, h: 1, z: 3 },
      { id: 'timer', kind: 'timer', x: 10, y: 5, w: 3, h: 2, z: 1 },
    ],
  },
  {
    id: 'layout-02',
    blocks: [
      { id: 'log', kind: 'panel-log', x: 1, y: 1, w: 6, h: 3, z: 1, content: '15 users already left, are you next?' },
      { id: 'quote', kind: 'panel-quote', x: 7, y: 1, w: 6, h: 2, z: 1, content: '"Sleep :)"' },
      { id: 'title', kind: 'title', x: 1, y: 4, w: 7, h: 2, z: 1, content: 'What would you still do if no one could see the result?' },
      { id: 'timer', kind: 'timer', x: 8, y: 4, w: 5, h: 2, z: 1 },
      { id: 'stack', kind: 'stack', x: 9, y: 6, w: 2, h: 1, z: 2, content: 43 },
      { id: 'trash', kind: 'trash', x: 11, y: 6, w: 2, h: 1, z: 3 },
      { id: 'next', kind: 'button', x: 1, y: 6, w: 6, h: 1, z: 2 },
    ],
  },
  {
    id: 'layout-03',
    blocks: [
      { id: 'log', kind: 'panel-log', x: 1, y: 1, w: 6, h: 3, z: 1, content: '5 users already left, are you next?' },
      { id: 'quote', kind: 'panel-quote', x: 7, y: 1, w: 6, h: 3, z: 1, content: '"Watching bad reality TV and overanalyzing it."' },
      { id: 'next', kind: 'button', x: 1, y: 4, w: 6, h: 1, z: 2 },
      { id: 'stack', kind: 'stack', x: 7, y: 4, w: 2, h: 1, z: 2, content: 11 },
      { id: 'trash', kind: 'trash', x: 9, y: 4, w: 3, h: 1, z: 3 },
      { id: 'title', kind: 'title', x: 1, y: 5, w: 7, h: 2, z: 1, content: 'What do you enjoy that you rarely talk about?' },
      { id: 'timer', kind: 'timer', x: 9, y: 5, w: 4, h: 2, z: 1 },
    ],
  },
  {
    id: 'layout-04',
    blocks: [
      { id: 'timer', kind: 'timer', x: 1, y: 1, w: 4, h: 2, z: 1 },
      { id: 'title', kind: 'title', x: 6, y: 1, w: 7, h: 2, z: 1, content: 'What do you blame on lack of time?' },
      { id: 'trash', kind: 'trash', x: 1, y: 3, w: 2, h: 1, z: 3 },
      { id: 'stack', kind: 'stack', x: 5, y: 3, w: 2, h: 1, z: 2, content: 21 },
      { id: 'next', kind: 'button', x: 7, y: 3, w: 4, h: 1, z: 2 },
      { id: 'log', kind: 'panel-log', x: 1, y: 4, w: 6, h: 3, z: 1, content: '16 users already left, are you next?' },
      { id: 'quote', kind: 'panel-quote', x: 7, y: 4, w: 6, h: 3, z: 1, content: '"Calling my parents."' },
    ],
  },
  {
    id: 'layout-05',
    blocks: [
      { id: 'title', kind: 'title', x: 1, y: 1, w: 7, h: 2, z: 1, content: 'What part of yourself do others misunderstand?' },
      { id: 'next', kind: 'button', x: 9, y: 1, w: 4, h: 1, z: 2 },
      { id: 'log', kind: 'panel-log', x: 9, y: 2, w: 4, h: 2, z: 1, content: '9 users already left, are you next?' },
      { id: 'trash', kind: 'trash', x: 1, y: 3, w: 2, h: 1, z: 3 },
      { id: 'stack', kind: 'stack', x: 3, y: 3, w: 2, h: 1, z: 2, content: 43 },
      { id: 'timer', kind: 'timer', x: 1, y: 4, w: 4, h: 3, z: 1 },
      { id: 'quote', kind: 'panel-quote', x: 5, y: 4, w: 8, h: 3, z: 1, content: '"Idk man"' },
    ],
  },
  {
    id: 'layout-06',
    blocks: [
      { id: 'trash', kind: 'trash', x: 1, y: 1, w: 2, h: 1, z: 3 },
      { id: 'stack', kind: 'stack', x: 3, y: 1, w: 2, h: 1, z: 2, content: 12 },
      { id: 'title', kind: 'title', x: 1, y: 2, w: 7, h: 3, z: 1, content: 'Who are you when nothing is being measured?' },
      { id: 'log', kind: 'panel-log', x: 8, y: 1, w: 5, h: 3, z: 1, content: '15 users already left, are you next?' },
      { id: 'quote', kind: 'panel-quote', x: 8, y: 4, w: 5, h: 2, z: 1, content: '"Someone who starts things but doesn\'t finish."' },
      { id: 'timer', kind: 'timer', x: 1, y: 5, w: 5, h: 2, z: 1 },
      { id: 'next', kind: 'button', x: 9, y: 6, w: 3, h: 1, z: 2 },
    ],
  },
  {
    id: 'layout-07',
    blocks: [
      { id: 'title', kind: 'title', x: 1, y: 1, w: 7, h: 2, z: 1, content: 'When was the last time you lost track of time?' },
      { id: 'log', kind: 'panel-log', x: 9, y: 1, w: 4, h: 3, z: 1, content: '3 users already left, are you next?' },
      { id: 'quote', kind: 'panel-quote', x: 1, y: 3, w: 8, h: 3, z: 1, content: '"Yesterday at 3am scrolling for no reason."' },
      { id: 'stack', kind: 'stack', x: 9, y: 4, w: 2, h: 1, z: 2, content: 21 },
      { id: 'trash', kind: 'trash', x: 1, y: 6, w: 2, h: 1, z: 3 },
      { id: 'next', kind: 'button', x: 3, y: 6, w: 6, h: 1, z: 2 },
      { id: 'timer', kind: 'timer', x: 9, y: 5, w: 4, h: 2, z: 1 },
    ],
  },
  {
    id: 'layout-08',
    blocks: [
      { id: 'next', kind: 'button', x: 1, y: 1, w: 5, h: 1, z: 2 },
      { id: 'log', kind: 'panel-log', x: 1, y: 2, w: 5, h: 3, z: 1, content: '8 users already left, are you next?' },
      { id: 'timer', kind: 'timer', x: 1, y: 5, w: 3, h: 2, z: 1 },
      { id: 'trash', kind: 'trash', x: 4, y: 5, w: 2, h: 1, z: 3 },
      { id: 'stack', kind: 'stack', x: 4, y: 6, w: 2, h: 1, z: 2, content: 4 },
      { id: 'quote', kind: 'panel-quote', x: 6, y: 1, w: 4, h: 6, z: 1, content: '"How easily they seem to belong."' },
      { id: 'title', kind: 'title', x: 10, y: 1, w: 3, h: 5, z: 1, content: 'What do you envy in people close to you?' },
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

    mediaQuery.addListener(handler)
    return () => mediaQuery.removeListener(handler)
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
) => {
  switch (block.kind) {
    case 'title':
      return <h1 className="block-title">{block.content ?? 'Who are you when nothing is being measured?'}</h1>
    case 'panel-log':
      return <LogPanel title={String(block.content ?? '15 users already left, are you next?')} records={activityRecords} />
    case 'panel-quote':
      return (
        <div className="block-panel">
          <LockedInput placeholder={String(block.content ?? '')} />
        </div>
      )
    case 'timer':
      return (
        <div className="block-timer">
          <div className="timer-value">{timerText}</div>
          <div className="timer-label">minutes wasted here</div>
        </div>
      )
    case 'trash':
      return <span>Trash</span>
    case 'button':
      if (!interactive) {
        return <span>Next Question</span>
      }
      return (
        <button type="button" className="block-button" onClick={onNext}>
          Next Question
        </button>
      )
    case 'stack':
    {
      const count = block.content ?? 12
      return (
        <div className="block-stack">
          <div className="stack-icon" aria-hidden="true"></div>
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

const LockedInput = ({ placeholder }: { placeholder: string }) => {
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
    input.setSelectionRange(end, end)
  }

  return (
    <div className="locked-wrap">
      <textarea
        ref={inputRef}
        className="locked-input"
        rows={6}
        placeholder={placeholder}
        autoComplete="off"
        onKeyDown={(event) => {
          if (event.ctrlKey || event.metaKey || event.altKey) {
            event.preventDefault()
            return
          }
          if (blockedKeys.has(event.key)) {
            event.preventDefault()
          }
        }}
        onBeforeInput={(event) => {
          const type = event.inputType || ''
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
        onMouseDown={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
          lockCursorToEnd()
        }}
        onPaste={(event) => event.preventDefault()}
        onCopy={(event) => event.preventDefault()}
        onCut={(event) => event.preventDefault()}
        onFocus={lockCursorToEnd}
      />
    </div>
  )
}

const Canvas = ({ layout, timerText, onNext }: { layout: ScreenLayout; timerText: string; onNext: () => void }) => {
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

  const rects = useMemo(() => {
    const rectMap = new Map<string, Rect>()
    if (!size.width || !size.height) return rectMap

    const innerWidth = size.width - 2 * PADDING
    const innerHeight = size.height - 2 * PADDING
    const columnWidth = (innerWidth - (COLS - 1) * GAP) / COLS
    const rowHeight = (innerHeight - (ROWS - 1) * GAP) / ROWS

    layout.blocks.forEach((block) => {
      const left = PADDING + (block.x - 1) * (columnWidth + GAP)
      const top = PADDING + (block.y - 1) * (rowHeight + GAP)
      const width = block.w * columnWidth + (block.w - 1) * GAP
      const height = block.h * rowHeight + (block.h - 1) * GAP

      rectMap.set(block.id, {
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(width),
        height: Math.round(height),
      })
    })

    return rectMap
  }, [layout.blocks, size.height, size.width])

  useEffect(() => {
    if (prefersReducedMotion) {
      prevLayoutRef.current = layout
      prevLayoutRectsRef.current = rects
      setExitingBlocks([])
      return
    }

    const previousLayout = prevLayoutRef.current
    if (previousLayout) {
      const prevIds = new Set(previousLayout.blocks.map((block) => block.id))
      const nextIds = new Set(layout.blocks.map((block) => block.id))
      const exitingIds = [...prevIds].filter((id) => !nextIds.has(id))

      if (exitingIds.length > 0) {
        const exiting = exitingIds
          .map((id) => {
            const block = previousLayout.blocks.find((item) => item.id === id)
            const rect = prevLayoutRectsRef.current.get(id)
            if (!block || !rect) return null
            return {
              id,
              kind: block.kind,
              rect,
              z: block.z ?? 1,
              content: renderBlockContent(block, timerText, onNext, false),
            }
          })
          .filter((item): item is ExitingBlock => Boolean(item))

        if (exiting.length > 0) {
          setExitingBlocks((current) => [...current, ...exiting])
        }
      }
    }

    prevLayoutRef.current = layout
    prevLayoutRectsRef.current = rects
  }, [layout, onNext, prefersReducedMotion, rects, timerText])

  useFlipAnimation(blockRefs, layout.id, prefersReducedMotion, size, skipFlipRef)

  const handleExitDone = (id: string) => {
    setExitingBlocks((blocks) => blocks.filter((block) => block.id !== id))
  }

  return (
    <div className="canvas" ref={canvasRef}>
      {layout.blocks.map((block) => {
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
            {renderBlockContent(block, timerText, onNext, true)}
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
  const [screenIndex, setScreenIndex] = useState(0)
  const [themeIndex, setThemeIndex] = useState(() => Math.floor(Math.random() * themes.length))
  const [timerText, setTimerText] = useState('00:00')

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

  const layout = screens[screenIndex]
  const theme = themes[themeIndex]

  const handleNext = () => {
    setScreenIndex((index) => (index + 1) % screens.length)
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
      <Canvas layout={layout} timerText={timerText} onNext={handleNext} />
    </div>
  )
}

export default App
