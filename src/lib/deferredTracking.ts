import { supabase } from './supabaseClient'

export type Question = {
  id: string
  prompt: string
  order_index: number
  meta: Record<string, unknown> | null
}

export type TrashedPage = {
  id: string
  body: string
  duration_ms: number
  version_index: number
  created_at: string | null
  session_id: string
  user_label: string
}

export type ActivityRecord = {
  user: string
  action: string
  time: string
}

let sessionIndexCache = new Map<string, number>()
let sessionIndexCacheReady = false
let questionIndexCache: Map<string, number> | null = null

const formatUserLabel = (index: number, isYou: boolean) => {
  const label = `User${String(index).padStart(4, '0')}`
  return isYou ? `${label} (you)` : label
}

const buildSessionIndexCache = async () => {
  const client = ensureSupabase()
  const { data, error } = await client
    .from('sessions')
    .select('id, started_at')
    .order('started_at', { ascending: true })
  if (error) {
    console.error('Failed to fetch sessions for index', error)
    sessionIndexCacheReady = true
    return
  }
  sessionIndexCache = new Map()
  ;(data ?? []).forEach((row, index) => {
    sessionIndexCache.set(String(row.id), index + 1)
  })
  sessionIndexCacheReady = true
}

const fetchSessionIndexMap = async (sessionIds: string[]) => {
  const unique = [...new Set(sessionIds)].filter(Boolean)
  if (!sessionIndexCacheReady) {
    await buildSessionIndexCache()
  }
  const missing = unique.filter((id) => !sessionIndexCache.has(id))
  if (missing.length > 0) {
    await buildSessionIndexCache()
  }
  return new Map(unique.map((id, index) => [id, sessionIndexCache.get(id) ?? index + 1]))
}

const fetchQuestionIndexMap = async () => {
  if (questionIndexCache) return questionIndexCache
  const client = ensureSupabase()
  const { data, error } = await client.from('questions').select('id, order_index')
  if (error) {
    console.error('Failed to fetch questions index map', error)
    return new Map()
  }
  questionIndexCache = new Map(
    (data ?? []).map((row) => [String(row.id), Number(row.order_index ?? 0)]),
  )
  return questionIndexCache
}

export const fetchLeftCount = async (orderIndex: number) => {
  try {
    const client = ensureSupabase()
    const { data: sessions, error } = await client
      .from('sessions')
      .select('id')
      .not('ended_at', 'is', null)
    if (error) {
      console.error('Failed to fetch ended sessions', error)
      return 0
    }
    const sessionIds = (sessions ?? []).map((row) => String(row.id))
    if (sessionIds.length === 0) return 0

    const { data: sq, error: sqError } = await client
      .from('session_questions')
      .select('session_id, question_id, advanced_at')
      .in('session_id', sessionIds)
      .not('advanced_at', 'is', null)
    if (sqError) {
      console.error('Failed to fetch session questions', sqError)
      return sessionIds.length
    }

    const questionIndexMap = await fetchQuestionIndexMap()
    const maxBySession = new Map<string, number>()
    ;(sq ?? []).forEach((row) => {
      const sessionId = String(row.session_id)
      const questionId = String(row.question_id)
      const index = questionIndexMap.get(questionId) ?? 0
      const current = maxBySession.get(sessionId) ?? 0
      if (index > current) maxBySession.set(sessionId, index)
    })

    let count = 0
    sessionIds.forEach((id) => {
      const max = maxBySession.get(id) ?? 0
      if (max <= orderIndex) count += 1
    })
    return count
  } catch (error) {
    console.error('Failed to fetch left count', error)
    return 0
  }
}

export const fetchActivityRecords = async (
  questionId: string,
  limit = 8,
): Promise<ActivityRecord[]> => {
  try {
    const client = ensureSupabase()
    const currentSessionId = await getOrCreateSessionId()
    const { data, error } = await client
      .from('answer_versions')
      .select('session_id, kind, created_at')
      .eq('question_id', questionId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('Failed to fetch activity records', error)
      return []
    }
    const sessionIds = (data ?? []).map((row) => String(row.session_id ?? ''))
    const indexMap = await fetchSessionIndexMap(sessionIds)
    return (data ?? []).map((row) => {
      const sessionId = String(row.session_id ?? '')
      const index = indexMap.get(sessionId) ?? 1
      const action = row.kind === 'trash' ? 'trashed a page' : 'submitted'
      const time = row.created_at
        ? new Date(String(row.created_at)).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '--:--'
      return {
        user: formatUserLabel(index, sessionId === currentSessionId),
        action,
        time,
      }
    })
  } catch (error) {
    console.error('Failed to fetch activity records', error)
    return []
  }
}

export const fetchPlaceholderPool = async () => {
  try {
    const client = ensureSupabase()
    const { data, error } = await client.from('placeholders').select('content')
    if (error) {
      console.error('Failed to fetch placeholders', error)
      return []
    }
    return (data ?? [])
      .map((row) => String(row.content ?? '').trim())
      .filter((value) => value.length > 0)
  } catch (error) {
    console.error('Failed to fetch placeholders', error)
    return []
  }
}

const STORAGE_KEYS = {
  userId: 'deferred_user_id',
  sessionId: 'deferred_session_id',
  questionStartedAt: 'deferred_question_started_at_ms',
  versionIndex: 'deferred_version_index',
  lastTypedAt: 'deferred_last_typed_at_ms',
  currentOrderIndex: 'deferred_current_order_index',
}

const SESSION_SCOPED_KEYS = new Set<string>([
  STORAGE_KEYS.sessionId,
  STORAGE_KEYS.questionStartedAt,
  STORAGE_KEYS.versionIndex,
  STORAGE_KEYS.lastTypedAt,
  STORAGE_KEYS.currentOrderIndex,
])

const getStorageBackend = (key: string) => {
  if (SESSION_SCOPED_KEYS.has(key)) {
    return window.sessionStorage
  }
  return window.localStorage
}

const getStorage = (key: string) => {
  try {
    return getStorageBackend(key).getItem(key)
  } catch {
    return null
  }
}

const setStorage = (key: string, value: string) => {
  try {
    getStorageBackend(key).setItem(key, value)
  } catch {
    // ignore
  }
}

const removeStorage = (key: string) => {
  try {
    getStorageBackend(key).removeItem(key)
  } catch {
    // ignore
  }
}

export const resetSessionForNewAttempt = () => {
  removeStorage(STORAGE_KEYS.sessionId)
  removeStorage(STORAGE_KEYS.questionStartedAt)
  removeStorage(STORAGE_KEYS.versionIndex)
  removeStorage(STORAGE_KEYS.lastTypedAt)
  removeStorage(STORAGE_KEYS.currentOrderIndex)
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
  startedAtMs,
  kind,
}: {
  sessionId: string
  questionId: string
  versionIndex: number
  body: string
  durationMs: number
  startedAtMs: number
  kind: 'trash' | 'final'
}) => {
  try {
    const client = ensureSupabase()
    const startedAtIso = new Date(startedAtMs).toISOString()
    const endedAtIso = new Date(startedAtMs + durationMs).toISOString()
    await client.from('answer_versions').insert({
      session_id: sessionId,
      question_id: questionId,
      version_index: versionIndex,
      body,
      duration_ms: durationMs,
      kind,
      version_type: kind,
      started_at: startedAtIso,
      ended_at: endedAtIso,
    })
  } catch (error) {
    console.error('Failed to insert answer version', error)
  }
}

export const fetchTrashedCount = async (questionId: string) => {
  try {
    const client = ensureSupabase()
    const { count, error } = await client
      .from('answer_versions')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', questionId)
      .eq('kind', 'trash')
    if (error) {
      console.error('Failed to fetch trashed count', error)
    }
    if (count && count > 0) {
      return count
    }

    const { count: legacyCount, error: legacyError } = await client
      .from('trashed_answers')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', questionId)
    if (legacyError) {
      console.error('Failed to fetch legacy trashed count', legacyError)
      return count ?? 0
    }
    return legacyCount ?? count ?? 0
  } catch (error) {
    console.error('Failed to fetch trashed count', error)
    return 0
  }
}

export const fetchTrashedPages = async (questionId: string) => {
  try {
    const client = ensureSupabase()
    const currentSessionId = await getOrCreateSessionId()
    const { data, error } = await client
      .from('answer_versions')
      .select('id, body, duration_ms, version_index, created_at, session_id')
      .eq('question_id', questionId)
      .eq('kind', 'trash')
      .order('version_index', { ascending: false })
    if (error) {
      console.error('Failed to fetch trashed pages', error)
    }

    const sessionIds = (data ?? []).map((row) => String(row.session_id ?? ''))
    const indexMap = await fetchSessionIndexMap(sessionIds)
    const mapped = (data ?? []).map((row) => {
      const sessionId = String(row.session_id ?? '')
      const index = indexMap.get(sessionId) ?? 1
      return {
        id: String(row.id),
        body: String(row.body ?? ''),
        duration_ms: Number(row.duration_ms ?? 0),
        version_index: Number(row.version_index ?? 0),
        created_at: row.created_at ? String(row.created_at) : null,
        session_id: sessionId,
        user_label: formatUserLabel(index, sessionId === currentSessionId),
      }
    })

    if (mapped.length > 0) return mapped

    const { data: legacy, error: legacyError } = await client
      .from('trashed_answers')
      .select('id, trashed_text, trashed_at, session_id')
      .eq('question_id', questionId)
      .order('trashed_at', { ascending: false })
    if (legacyError) {
      console.error('Failed to fetch legacy trashed pages', legacyError)
      return mapped
    }
    const legacySessionIds = (legacy ?? []).map((row) => String(row.session_id ?? ''))
    const legacyIndexMap = await fetchSessionIndexMap(legacySessionIds)
    return (legacy ?? []).map((row, index) => {
      const sessionId = String(row.session_id ?? '')
      const idx = legacyIndexMap.get(sessionId) ?? 1
      return {
        id: String(row.id),
        body: String(row.trashed_text ?? ''),
        duration_ms: 0,
        version_index: (legacy?.length ?? 0) - index,
        created_at: row.trashed_at ? String(row.trashed_at) : null,
        session_id: sessionId,
        user_label: formatUserLabel(idx, sessionId === currentSessionId),
      }
    })
  } catch (error) {
    console.error('Failed to fetch trashed pages', error)
    return []
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
      startedAtMs: startedAt,
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
      startedAtMs: startedAt,
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
