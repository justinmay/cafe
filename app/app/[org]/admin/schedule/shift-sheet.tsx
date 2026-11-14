"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { nameLimit, shiftEnd, shiftMinutes, shiftStarts, stations, type ShiftSignup, type Station } from "@/lib/schedule"

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

  return (
    <Card className="mt-6 max-w-5xl gap-0 overflow-hidden py-0">
      <table className="w-full table-fixed text-left text-sm">
        <caption className="sr-only">Popup shift signups from 10 AM to 2 PM</caption>
        <thead className="bg-muted/60">
          <tr>
            <th scope="col" className="w-[22%] px-2 py-4 sm:px-5">Time</th>
            {stations.map(({ id, label }) => (
              <th key={id} scope="col" className="px-2 py-4 sm:px-4">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shiftStarts.map((startMinute) => {
            const time = timeRange(startMinute, startMinute + shiftMinutes)
            return (
              <tr key={startMinute} className="border-t">
                <th scope="row" className="px-2 py-3 text-xs font-medium tabular-nums sm:px-5 sm:text-sm">{time}</th>
                {stations.map(({ id, label, starts }) => {
                  const end = shiftEnd(starts, startMinute)
                  if (end === null) return null
                  const range = timeRange(startMinute, end)
                  const fieldLabel = `${label}, ${range}`
                  const signup = entries?.find((entry) => entry.station === id && entry.startMinute === startMinute)
                  return (
                    <td key={id} rowSpan={(end - startMinute) / shiftMinutes}
                      className="border-l border-t px-1.5 py-3 align-middle sm:px-4">
                      {id !== "FRONT_OF_HOUSE" && (
                        <span className="mb-1 block text-xs tabular-nums text-muted-foreground">{range}</span>
                      )}
                      {entries ? (
                        <SignupField endpoint={endpoint} station={id} startMinute={startMinute}
                          label={fieldLabel} initialName={signup?.name ?? ""} />
                      ) : (
                        <Input aria-label={fieldLabel} disabled />
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      {entries === null && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
          <span role="status">{error || "Loading signups…"}</span>
          {error && <Button variant="outline" size="sm" onClick={() => { setError(""); setAttempt(attempt + 1) }}>Retry</Button>}
        </div>
      )}
    </Card>
  )
}

function SignupField({ endpoint, station, startMinute, label, initialName }: {
  endpoint: string
  station: Station
  startMinute: number
  label: string
  initialName: string
}) {
  const [saved, setSaved] = useState(initialName)
  const [name, setName] = useState(initialName)
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
        setSaved(current)
        setName(current)
        setMessage("Slot updated on another device.")
      } else {
        if (!response.ok || response.redirected) throw new Error()
        setSaved(next)
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
      <Input aria-label={label} value={name} maxLength={nameLimit} autoComplete="off"
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
