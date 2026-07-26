"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import {
  BarChart3,
  ClipboardList,
  ExternalLink,
  LogOut,
  SlidersHorizontal,
} from "lucide-react"
import { OrgSwitcher } from "@/components/org-switcher"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  {
    label: "Menu & settings",
    href: (org: string) => `/${org}/admin`,
    icon: SlidersHorizontal,
    isActive: (pathname: string, org: string) => pathname === `/${org}/admin`,
  },
  {
    label: "Orders",
    href: (org: string) => `/${org}/orders`,
    icon: ClipboardList,
    isActive: (pathname: string, org: string) =>
      pathname.startsWith(`/${org}/orders`),
  },
  {
    label: "Analytics",
    href: (org: string) => `/${org}/admin/analytics`,
    icon: BarChart3,
    isActive: (pathname: string, org: string) =>
      pathname.startsWith(`/${org}/admin/analytics`),
  },
]

export function AdminNavigation() {
  const params = useParams()
  const pathname = usePathname()
  const org = params.org as string

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 pt-3 sm:pt-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 overflow-hidden">
            <OrgSwitcher />
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button asChild variant="outline" size="sm">
              <Link href={`/${org}/menu`} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />
                <span className="hidden sm:inline">Customer menu</span>
                <span className="sm:hidden">Menu</span>
              </Link>
            </Button>
            <form action={`/api/${org}/auth/logout`} method="POST">
              <Button
                variant="ghost"
                size="sm"
                type="submit"
                aria-label="Log out"
              >
                <LogOut aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </form>
          </div>
        </div>

        <nav
          aria-label="Admin navigation"
          className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-2"
        >
          {navItems.map((item) => {
            const href = item.href(org)
            const active = item.isActive(pathname, org)
            const Icon = item.icon

            return (
              <Link
                key={item.label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
