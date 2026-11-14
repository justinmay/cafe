export const stations = [
  { id: "FRONT_OF_HOUSE", label: "Front of house" },
  { id: "BARISTA", label: "Barista" },
] as const

export const shiftMinutes = 40
export const shiftStarts = Array.from({ length: 6 }, (_, index) => 10 * 60 + index * shiftMinutes)
export const nameLimit = 100

export type Station = (typeof stations)[number]["id"]

export interface ShiftSignup {
  station: Station
  startMinute: number
  name: string
}
