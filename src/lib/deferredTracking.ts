import { supabase } from './supabaseClient'

export type Question = {
  id: string
  prompt: string
  order_index: number
  meta: Record<string, unknown> | null
}

const STORAGE_KEYS = {
  userId: 'deferred_user_id',
  sessionId: 'deferred_session_id',
  questionStartedAt: 'deferred_question_started_at_ms',
  versionIndex: 'deferred_version_index',
  lastTypedAt: 'deferred_last_typed_at_ms',
  currentOrderIndex: 'deferred_current_order_index',
}

const getStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const setStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

const removeStorage = (key: string) => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

const getStoredNumber = (key: string) => {
  const raw = getStorage(key)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

const nowMs = () => Date.now()

const ensureSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }
  return supabase
}

export const getOrCreateUserId = async () => {
  const stored = getStorage(STORAGE_KEYS.userId)
  if (stored) return stored

  try {
    const client = ensureSupabase()
    const { data, error } = await client
      .from('app_users')
      .insert({})
      .select('id')
      .single()
    if (error || !data?.id) {
      throw error ?? new Error('Missing app_users id')
    }
    const userId = String(data.id)
    setStorage(STORAGE_KEYS.userId, userId)
    return userId
  } catch (error) {
    console.error('Failed to create app user', error)
    const fallback = `local-${crypto.randomUUID()}`
    setStorage(STORAGE_KEYS.userId, fallback)
    return fallback
  }
}

export const getOrCreateSessionId = async () => {
  const stored = getStorage(STORAGE_KEYS.sessionId)
  if (stored) return stored

  try {
    const client = ensureSupabase()
    const userId = await getOrCreateUserId()
    const { data, error } = await client
      .from('sessions')
      .insert({
        user_id: userId,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error || !data?.id) {
      throw error ?? new Error('Missing sessions id')
    }
    const sessionId = String(data.id)
    setStorage(STORAGE_KEYS.sessionId, sessionId)
    return sessionId
  } catch (error) {
    console.error('Failed to create session', error)
    const fallback = `local-${crypto.randomUUID()}`
    setStorage(STORAGE_KEYS.sessionId, fallback)
    return fallback
  }
}

export const fetchQuestionByOrder = async (orderIndex: number) => {
  const client = ensureSupabase()
  const { data, error } = await client
    .from('questions')
    .select('*')
    .eq('order_index', orderIndex)
    .maybeSingle()
  if (error) {
    console.error('Supabase questions fetch error', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    throw error
  }
  if (!data) return null
  const prompt =
    data.prompt ??
    data.question ??
    data.text ??
    ''
  return {
    id: String(data.id),
    prompt: String(prompt),
    order_index: Number(data.order_index),
    meta: (data.meta ?? null) as Record<string, unknown> | null,
  }
}

const ensureSessionQuestionRow = async (sessionId: string, questionId: string) => {
  try {
    const client = ensureSupabase()
    await client.from('session_questions').upsert(
      {
        session_id: sessionId,
        question_id: questionId,
        total_duration_ms: 0,
        long_pause_count: 0,
      },
      { onConflict: 'session_id,question_id', ignoreDuplicates: true },
    )
  } catch (error) {
    console.error('Failed to upsert session question', error)
  }
}

const incrementLongPause = async (sessionId: string, questionId: string) => {
  try {
    const client = ensureSupabase()
    const { data, error } = await client
      .from('session_questions')
      .select('long_pause_count')
      .eq('session_id', sessionId)
      .eq('question_id', questionId)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      await client.from('session_questions').insert({
        session_id: sessionId,
        question_id: questionId,
        total_duration_ms: 0,
        long_pause_count: 1,
      })
      return
    }
    const nextCount = (data.long_pause_count ?? 0) + 1
    await client
      .from('session_questions')
      .update({ long_pause_count: nextCount })
      .eq('session_id', sessionId)
      .eq('question_id', questionId)
  } catch (error) {
    console.error('Failed to increment long pause count', error)
  }
}

const addQuestionDuration = async (sessionId: string, questionId: string, durationMs: number) => {
  try {
    const client = ensureSupabase()
    const { data, error } = await client
      .from('session_questions')
      .select('total_duration_ms')
      .eq('session_id', sessionId)
      .eq('question_id', questionId)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      await client.from('session_questions').insert({
        session_id: sessionId,
        question_id: questionId,
        total_duration_ms: durationMs,
        long_pause_count: 0,
      })
      return
    }
    const nextTotal = (data.total_duration_ms ?? 0) + durationMs
    await client
      .from('session_questions')
      .update({ total_duration_ms: nextTotal })
      .eq('session_id', sessionId)
      .eq('question_id', questionId)
  } catch (error) {
    console.error('Failed to update question duration', error)
  }
}

const insertAnswerVersion = async ({
  sessionId,
  questionId,
  versionIndex,
  body,
  durationMs,
  kind,
}: {
  sessionId: string
  questionId: string
  versionIndex: number
  body: string
  durationMs: number
  kind: 'trash' | 'final'
}) => {
  try {
    const client = ensureSupabase()
    await client.from('answer_versions').insert({
      session_id: sessionId,
      question_id: questionId,
      version_index: versionIndex,
      body,
      duration_ms: durationMs,
      kind,
    })
  } catch (error) {
    console.error('Failed to insert answer version', error)
  }
}

export const onQuestionRender = async (questionId: string) => {
  try {
    const sessionId = await getOrCreateSessionId()
    await ensureSessionQuestionRow(sessionId, questionId)
    const startedAt = nowMs()
    setStorage(STORAGE_KEYS.questionStartedAt, String(startedAt))
    if (!getStoredNumber(STORAGE_KEYS.versionIndex)) {
      setStorage(STORAGE_KEYS.versionIndex, '1')
    }
    removeStorage(STORAGE_KEYS.lastTypedAt)
  } catch (error) {
    console.error('Failed to initialize question tracking', error)
  }
}

export const registerTypingTick = async (questionId: string) => {
  const lastTyped = getStoredNumber(STORAGE_KEYS.lastTypedAt)
  const now = nowMs()
  if (lastTyped && now - lastTyped > 5000) {
    try {
      const sessionId = await getOrCreateSessionId()
      await incrementLongPause(sessionId, questionId)
    } catch (error) {
      console.error('Failed to register long pause', error)
    }
  }
  setStorage(STORAGE_KEYS.lastTypedAt, String(now))
}

export const onTrash = async (questionId: string, body: string) => {
  try {
    const sessionId = await getOrCreateSessionId()
    const startedAt = getStoredNumber(STORAGE_KEYS.questionStartedAt) ?? nowMs()
    const durationMs = Math.max(0, nowMs() - startedAt)
    const versionIndex = getStoredNumber(STORAGE_KEYS.versionIndex) ?? 1
    await insertAnswerVersion({
      sessionId,
      questionId,
      versionIndex,
      body,
      durationMs,
      kind: 'trash',
    })
    await addQuestionDuration(sessionId, questionId, durationMs)
    setStorage(STORAGE_KEYS.versionIndex, String(versionIndex + 1))
    setStorage(STORAGE_KEYS.questionStartedAt, String(nowMs()))
    removeStorage(STORAGE_KEYS.lastTypedAt)
  } catch (error) {
    console.error('Failed to record trash version', error)
  }
}

export const onNext = async (questionId: string, body: string) => {
  try {
    const sessionId = await getOrCreateSessionId()
    const startedAt = getStoredNumber(STORAGE_KEYS.questionStartedAt) ?? nowMs()
    const durationMs = Math.max(0, nowMs() - startedAt)
    const versionIndex = getStoredNumber(STORAGE_KEYS.versionIndex) ?? 1
    await insertAnswerVersion({
      sessionId,
      questionId,
      versionIndex,
      body,
      durationMs,
      kind: 'final',
    })
    await addQuestionDuration(sessionId, questionId, durationMs)
    try {
      const client = ensureSupabase()
      await client
        .from('session_questions')
        .update({ advanced_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('question_id', questionId)
    } catch (error) {
      console.error('Failed to mark question advanced', error)
    }
    setStorage(STORAGE_KEYS.versionIndex, '1')
    removeStorage(STORAGE_KEYS.questionStartedAt)
    removeStorage(STORAGE_KEYS.lastTypedAt)
  } catch (error) {
    console.error('Failed to record next version', error)
  }
}

export const endSessionBestEffort = async () => {
  try {
    const client = ensureSupabase()
    const sessionId = getStorage(STORAGE_KEYS.sessionId)
    if (!sessionId) return
    await client
      .from('sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
  } catch (error) {
    console.error('Failed to end session', error)
  }
}

export const getStoredOrderIndex = () => {
  const stored = getStoredNumber(STORAGE_KEYS.currentOrderIndex)
  return stored && stored > 0 ? stored : 1
}

export const setStoredOrderIndex = (orderIndex: number) => {
  setStorage(STORAGE_KEYS.currentOrderIndex, String(orderIndex))
}
