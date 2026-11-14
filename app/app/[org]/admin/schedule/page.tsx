import type { Metadata } from "next"
import { ShiftSheet } from "@/components/shift-sheet"

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
        Enter each barista’s name once and sign up for front-of-house shifts below. Press Tab or Enter to save.
      </p>
      <div className="mt-6">
        <ShiftSheet key={org} org={org} editable />
      </div>
    </div>
  )
}
