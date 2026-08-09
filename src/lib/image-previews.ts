// Object URLs of images picked in the composer this session, keyed by
// conversation + stored name. Sent messages render from these instead of the
// server URL: right after the first send the conversation row doesn't exist
// yet (it's created during the POST), so an immediate download-route fetch
// 404s — and browsers never retry a failed <img>. The blob is already local
// anyway; the server URL is only needed after a reload, when the row exists.
// Entries live until the page unloads (object URLs die with it).
const previews = new Map<string, string>()

const key = (conversationId: string, name: string) => `${conversationId}/${name}`

export function cacheImagePreview(conversationId: string, name: string, objectUrl: string): void {
  previews.set(key(conversationId, name), objectUrl)
}

export function cachedImagePreview(conversationId: string, name: string): string | undefined {
  return previews.get(key(conversationId, name))
}
