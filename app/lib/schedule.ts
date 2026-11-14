export const shiftMinutes = 40
const open = 10 * 60
const close = 14 * 60
export const shiftStarts = Array.from({ length: (close - open) / shiftMinutes }, (_, i) => open + i * shiftMinutes)

export const stations = [
  { id: "FRONT_OF_HOUSE", label: "Front of house", starts: shiftStarts },
  { id: "BARISTA", label: "Barista 1", starts: [open, 10 * 60 + 40, 12 * 60, 13 * 60 + 20] },
  { id: "BARISTA_2", label: "Barista 2", starts: [open, 11 * 60 + 20, 12 * 60 + 40] },
] as const

export function shiftEnd(starts: readonly number[], start: number) {
  const index = starts.indexOf(start)
  if (index === -1) return null
  return starts[index + 1] ?? close
}

export const nameLimit = 100

export type Station = (typeof stations)[number]["id"]

export interface ShiftSignup {
  station: Station
  startMinute: number
  name: string
}
