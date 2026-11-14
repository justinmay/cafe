export const frontShiftMinutes = 30
const open = 10 * 60
const close = 14 * 60
export const frontShiftStarts = Array.from(
  { length: (close - open) / frontShiftMinutes },
  (_, index) => open + index * frontShiftMinutes
)

// Keep these signup keys stable when rotation times change so names carry over.
export const baristaPositions = [
  { letter: "A", station: "BARISTA_2", startMinute: 620 },
  { letter: "B", station: "BARISTA_2", startMinute: 600 },
  { letter: "C", station: "BARISTA", startMinute: 600 },
] as const

export const baristaRotation = [
  { start: 600, end: 630, main: "C", second: "B", free: "A", duty: "Backup" },
  { start: 630, end: 660, main: "B", second: "A", free: "C", duty: "Backup" },
  { start: 660, end: 690, main: "A", second: "C", free: "B", duty: "Backup" },
  { start: 690, end: 740, main: "A", second: "B", free: "C", duty: "On bar" },
  { start: 740, end: 790, main: "B", second: "C", free: "A", duty: "On bar" },
  { start: 790, end: 840, main: "C", second: "A", free: "B", duty: "On bar" },
] as const

export type Barista = (typeof baristaPositions)[number]["letter"]
export type Station = "FRONT_OF_HOUSE" | (typeof baristaPositions)[number]["station"]

export function isSignupSlot(station: Station, startMinute: number) {
  if (station === "FRONT_OF_HOUSE") return frontShiftStarts.includes(startMinute)
  return baristaPositions.some((slot) => slot.station === station && slot.startMinute === startMinute)
}

export const nameLimit = 100

export interface ShiftSignup {
  station: Station
  startMinute: number
  name: string
}
