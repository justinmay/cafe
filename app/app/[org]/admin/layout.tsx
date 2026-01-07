"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { OrgSwitcher } from "@/components/org-switcher"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const org = params.org as string

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <OrgSwitcher />
          <nav className="flex gap-2">
            <Link href={`/${org}/orders`}>
              <Button variant="ghost">Orders</Button>
            </Link>
            <Link href={`/${org}/menu`}>
              <Button variant="ghost">View Menu</Button>
            </Link>
            <form action={`/api/${org}/auth/logout`} method="POST">
              <Button variant="outline" type="submit">
                Logout
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
