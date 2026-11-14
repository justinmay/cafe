"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  baristaPositions, baristaRotation, frontShiftMinutes, frontShiftStarts,
  nameLimit, type Barista, type ShiftSignup, type Station,
} from "@/lib/schedule"

function timeLabel(minutes: number) {
  const hour = Math.floor(minutes / 60)
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`
}

function timeRange(start: number, end: number) {
  const from = timeLabel(start)
  const samePeriod = (start < 720) === (end < 720)
  return `${samePeriod ? from.slice(0, -3) : from} – ${timeLabel(end)}`
}

export function ShiftSheet({ org }: { org: string }) {
  const endpoint = `/api/${encodeURIComponent(org)}/admin/schedule`
  const [entries, setEntries] = useState<ShiftSignup[] | null>(null)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" })
        if (response.status === 503) {
          setError((await response.json()).error)
          return
        }
        if (!response.ok) throw new Error()
        const data: ShiftSignup[] = await response.json()
        if (!controller.signal.aborted) setEntries(data)
      } catch {
        if (!controller.signal.aborted) setError("Couldn’t load the shift signups.")
      }
    }
    load()
    return () => controller.abort()
  }, [endpoint, attempt])

  function signupName(station: Station, startMinute: number) {
    return entries?.find((entry) => entry.station === station && entry.startMinute === startMinute)?.name ?? ""
  }

  function field(station: Station, startMinute: number, label: string) {
    if (!entries) return <Input id={`signup-${station}-${startMinute}`} aria-label={label} disabled />
    return (
      <SignupField endpoint={endpoint} station={station} startMinute={startMinute} label={label}
        saved={signupName(station, startMinute)}
        onSaved={(name) => setEntries((current) => {
          const others = (current ?? []).filter((entry) => entry.station !== station || entry.startMinute !== startMinute)
          return name ? [...others, { station, startMinute, name }] : others
        })}
      />
    )
  }

  const roster = new Map<Barista, string>(baristaPositions.map(({ letter, station, startMinute }) =>
    [letter, signupName(station, startMinute) || letter]
  ))

  return (
    <div className="mt-6 space-y-4">
      {entries === null && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span role="status">{error || "Loading signups…"}</span>
          {error && <Button variant="outline" size="sm" onClick={() => { setError(""); setAttempt(attempt + 1) }}>Retry</Button>}
        </div>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="p-4 sm:p-5">
            <h2 className="font-display text-2xl font-semibold">Barista rotation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              From 11:30 AM to 2 PM, two baristas are on bar and each gets one 50-minute break.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {baristaPositions.map(({ letter, station, startMinute }) => (
                <div key={letter}>
                  <label htmlFor={`signup-${station}-${startMinute}`} className="mb-1 block text-sm font-medium">Barista {letter}</label>
                  {field(station, startMinute, `Barista ${letter}`)}
                </div>
              ))}
            </div>
          </div>
          <table className="w-full table-fixed text-left text-sm">
            <caption className="sr-only">Barista duties and breaks from 10 AM to 2 PM</caption>
            <thead className="border-t bg-muted/60">
              <tr>
                <th scope="col" className="w-[29%] px-3 py-3">Time</th>
                <th scope="col" className="px-2 py-3">Main</th>
                <th scope="col" className="px-2 py-3">Second</th>
                <th scope="col" className="px-2 py-3">Free</th>
              </tr>
            </thead>
            <tbody>
              {baristaRotation.map(({ start, end, main, second, free, duty }) => (
                <tr key={start} className={duty === "On bar" ? "border-t bg-secondary/40" : "border-t"}>
                  <th scope="row" className="px-3 py-3 text-xs font-medium tabular-nums sm:text-sm">{timeRange(start, end)}</th>
                  <td className="px-2 py-3 [overflow-wrap:anywhere]">{roster.get(main)}</td>
                  <td className="px-2 py-3 [overflow-wrap:anywhere]">
                    {roster.get(second)}
                    <span className="block text-xs text-muted-foreground">{duty}</span>
                  </td>
                  <td className="px-2 py-3 text-muted-foreground [overflow-wrap:anywhere]">{roster.get(free)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="gap-0 overflow-hidden py-0">
          <h2 className="p-4 font-display text-2xl font-semibold sm:p-5">Front of house</h2>
          <table className="w-full table-fixed text-left text-sm">
            <caption className="sr-only">Front-of-house signups in 30-minute shifts</caption>
            <thead className="border-t bg-muted/60">
              <tr>
                <th scope="col" className="w-[46%] px-3 py-3">Time</th>
                <th scope="col" className="px-3 py-3">Name</th>
              </tr>
            </thead>
            <tbody>
              {frontShiftStarts.map((start) => {
                const range = timeRange(start, start + frontShiftMinutes)
                return (
                  <tr key={start} className="border-t">
                    <th scope="row" className="px-3 py-3 text-xs font-medium tabular-nums sm:text-sm">{range}</th>
                    <td className="px-3 py-2">{field("FRONT_OF_HOUSE", start, `Front of house, ${range}`)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

function SignupField({ endpoint, station, startMinute, label, saved, onSaved }: {
  endpoint: string
  station: Station
  startMinute: number
  label: string
  saved: string
  onSaved: (name: string) => void
}) {
  const [name, setName] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  async function save() {
    const next = name.trim()
    if (saving || next === saved) {
      setName(next)
      return
    }
    setSaving(true)
    setMessage("Saving…")
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ station, startMinute, previousName: saved || null, name: next || null }),
      })
      if (response.status === 409) {
        const current = (await response.json()).name ?? ""
        onSaved(current)
        setName(current)
        setMessage("Slot updated on another device.")
      } else {
        if (!response.ok || response.redirected) throw new Error()
        onSaved(next)
        setName(next)
        setMessage("Saved")
      }
    } catch {
      setMessage("Couldn’t save. Press Enter to retry.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Input id={`signup-${station}-${startMinute}`} aria-label={label} value={name} maxLength={nameLimit} autoComplete="off"
        placeholder="Name" readOnly={saving}
        onChange={(event) => { setName(event.target.value); setMessage("") }}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) event.currentTarget.blur()
        }}
      />
      <span role="status" className={message === "Saved" ? "sr-only" : "text-xs text-muted-foreground"}>{message}</span>
    </>
  )
}
