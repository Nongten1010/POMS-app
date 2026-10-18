export function getChatViewerId(auth) {
  const response = auth?.response ?? auth
  const payload = response?.data ?? response
  const user = response?.user ?? payload?.user
  let id = user?.id ?? user?.userId
  if (id == null) {
    try {
      const encoded = (response?.accessToken ?? payload?.accessToken).split('.')[1]
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
      // Token claims are used for message alignment only, never authorization.
      id = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))).sub
    } catch { return null }
  }
  const value = Number(id)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export const CHAT_MESSAGE_MAX_LENGTH = 2000
