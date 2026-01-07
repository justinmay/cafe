"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { ChevronDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface Org {
  id: string
  slug: string
  name: string
  role: string
}

export function OrgSwitcher() {
  const router = useRouter()
  const params = useParams()
  const currentSlug = params.org as string
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchOrgs() {
      try {
        const res = await fetch("/api/auth/orgs")
        if (res.ok) {
          const data = await res.json()
          setOrgs(data.orgs)
        }
      } catch (error) {
        console.error("Failed to fetch orgs:", error)
      }
    }
    fetchOrgs()
  }, [])

  const currentOrg = orgs.find((org) => org.slug === currentSlug)

  async function handleSwitch(org: Org) {
    if (org.slug === currentSlug) return

    setLoading(true)
    try {
      const res = await fetch("/api/auth/select-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id }),
      })

      if (!res.ok) {
        throw new Error("Failed to switch organization")
      }

      router.push(`/${org.slug}/admin`)
      router.refresh()
    } catch (error) {
      toast.error("Failed to switch organization")
    } finally {
      setLoading(false)
    }
  }

  if (orgs.length <= 1) {
    return (
      <span className="text-xl font-bold">
        {currentOrg?.name || currentSlug}
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-1 text-xl font-bold" disabled={loading}>
          {currentOrg?.name || currentSlug}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org)}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {org.slug === currentSlug && <Check className="h-4 w-4" />}
              {org.slug !== currentSlug && <div className="w-4" />}
              <div>
                <div className="font-medium">{org.name}</div>
                <div className="text-xs text-muted-foreground">/{org.slug}</div>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
