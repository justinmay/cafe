import type { Metadata } from "next"
import { ShiftSheet } from "./shift-sheet"

export const metadata: Metadata = {
  title: "Schedule | Cafe POS",
}

export default async function SchedulePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:py-9">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Schedule
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter a name and press Tab or Enter to save. Clear the field to reopen a shift.
      </p>
      <ShiftSheet key={org} org={org} />
    </div>
  )
}
