import { useCallback, useEffect, useState } from 'react'
import { errorText } from '../utils/chatApi.mjs'

export default function useChatResource(client, path, query, enabled, onError) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState(null)
  const serialized = JSON.stringify(query || {})
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  const baseKey = `${path}:${serialized}:${enabled}`
  const key = `${baseKey}:${revision}`
  useEffect(() => {
    if (!enabled) return undefined
    const controller = new AbortController()
    client.request(path, { query: JSON.parse(serialized), signal: controller.signal }).then((response) => {
      if (!controller.signal.aborted) setState({ key, baseKey, response, error: '' })
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setState((previous) => ({ key, baseKey, response: ![401, 403, 404].includes(error.status) && previous?.baseKey === baseKey ? previous.response : null, error: errorText(error) }))
        onError?.(error)
      }
    })
    return () => controller.abort()
  }, [client, path, serialized, enabled, baseKey, key, onError])
  return {
    response: enabled && state?.baseKey === baseKey ? state.response : null,
    error: enabled && state?.key === key ? state.error : '',
    loading: enabled && state?.key !== key,
    refresh,
  }
}
