import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMenuBadges } from '../utils/menuBadges.mjs'

const url = import.meta.env.DEV
  ? '/api-proxy/v1/me/menu-badges'
  : 'https://d-poms.diw.go.th/api/v1/me/menu-badges'

export default function useMenuBadges(accessToken) {
  const [state, setState] = useState({ data: null, loading: Boolean(accessToken), error: '' })
  const activeRequest = useRef(null)
  const retryAt = useRef(0)
  const refresh = useCallback(async () => {
    if (!accessToken || activeRequest.current || Date.now() < retryAt.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    setState((previous) => ({ ...previous, loading: true, error: '' }))
    try {
      const data = await fetchMenuBadges({ url, accessToken, signal: controller.signal })
      if (!controller.signal.aborted) setState({ data, loading: false, error: '' })
    } catch (error) {
      if (!controller.signal.aborted) {
        retryAt.current = error.retryAt || 0
        setState({ data: null, loading: false, error: error instanceof TypeError
          ? 'เชื่อมต่อการแจ้งเตือนไม่สำเร็จ กรุณารีเฟรชอีกครั้ง' : error.message })
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }, [accessToken])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void refresh()
    })
    return () => {
      cancelled = true
      activeRequest.current?.abort()
      activeRequest.current = null
    }
  }, [refresh])

  return { ...state, refresh }
}
