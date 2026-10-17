/**
 * The photo a visitor took to collect a statue: kept on their phone only (localStorage), small,
 * and shown on that statue's tile in their collection, like a catch of their own.
 */
const PREFIX = 'myPhoto:'
const SIZE = 480

export function loadMyPhotos(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) out[key.slice(PREFIX.length)] = localStorage.getItem(key)!
    }
  } catch {
    // storage unavailable: no saved photos
  }
  return out
}

/** A square, centred crop of the photo as a ~40 KB JPEG; null if it can't be read or kept. */
export async function saveMyPhoto(id: string, photo: Blob): Promise<string | null> {
  try {
    const img = await createImageBitmap(photo)
    const side = Math.min(img.width, img.height)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
    img.close()
    const url = canvas.toDataURL('image/jpeg', 0.78)
    localStorage.setItem(PREFIX + id, url)
    return url
  } catch {
    return null // unreadable photo, or the phone's storage is full: the tile keeps its usual picture
  }
}
