import { supabase } from './supabaseClient'

export type TelemetryEvent = {
  session_id: string
  user_id: string
  question_id?: string | null
  type: string
  data?: Record<string, unknown>
  ts?: string
}

type TelemetryContext = {
  sessionId: string
  userId: string
}

type QueuedEvent = Omit<TelemetryEvent, 'session_id' | 'user_id'>

class TelemetryQueue {
  private queue: QueuedEvent[] = []
  private context: TelemetryContext | null = null
  private intervalId: number | null = null
  private boundVisibility: (() => void) | null = null
  private boundPagehide: (() => void) | null = null

  setContext(context: TelemetryContext) {
    this.context = context
  }

  enqueue(event: QueuedEvent) {
    this.queue.push(event)
  }

  async flush() {
    if (!supabase || !this.context || this.queue.length === 0) return
    const batch = this.queue.splice(0, this.queue.length)
    const payload = batch.map((event) => ({
      ...event,
      session_id: this.context?.sessionId,
      user_id: this.context?.userId,
    }))
    const { error } = await supabase.from('events').insert(payload)
    if (error) {
      this.queue.unshift(...batch)
    }
  }

  start(intervalMs = 7000) {
    if (this.intervalId) return
    this.intervalId = window.setInterval(() => {
      void this.flush()
    }, intervalMs)

    this.boundVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void this.flush()
      }
    }

    this.boundPagehide = () => {
      void this.flush()
    }

    document.addEventListener('visibilitychange', this.boundVisibility)
    window.addEventListener('pagehide', this.boundPagehide)
  }

  stop() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (this.boundVisibility) {
      document.removeEventListener('visibilitychange', this.boundVisibility)
      this.boundVisibility = null
    }
    if (this.boundPagehide) {
      window.removeEventListener('pagehide', this.boundPagehide)
      this.boundPagehide = null
    }
  }
}

export const telemetry = new TelemetryQueue()
