"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"

type Mode = "login" | "register" | "select-org"

interface Org {
  id: string
  slug: string
  name: string
  role: string
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")
  const [loading, setLoading] = useState(false)
  const [slug, setSlug] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<Org[]>([])

  function handleSlugChange(value: string) {
    const formatted = value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
    setSlug(formatted)
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const username = formData.get("username") as string
    const password = formData.get("password") as string

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Login failed")
      }

      if (data.needsOrgSelection) {
        setUserId(data.userId)
        setOrgs(data.orgs)
        setMode("select-org")
      } else {
        toast.success("Logged in successfully")
        router.push(`/${data.orgSlug}/admin`)
        router.refresh()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectOrg(org: Org) {
    setLoading(true)

    try {
      const res = await fetch("/api/auth/select-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, orgId: org.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to select organization")
      }

      toast.success("Logged in successfully")
      router.push(`/${data.orgSlug}/admin`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to select organization")
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const orgName = formData.get("orgName") as string
    const username = formData.get("username") as string
    const password = formData.get("password") as string

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          orgSlug: slug,
          username,
          password,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Registration failed")
      }

      const data = await res.json()
      toast.success("Organization created! Logging you in...")

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const loginData = await loginRes.json()

      if (loginRes.ok) {
        router.push(`/${data.organization.slug}/admin`)
        router.refresh()
      } else {
        throw new Error(loginData.error || "Login failed")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Image */}
      <div className="hidden lg:block lg:w-3/5 relative">
        <Image
          src="/cafe.png"
          alt="Cafe"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Right side - Login/Register form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 bg-white">
        <Card className="w-full max-w-md bg-accent/50 border-accent">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {mode === "login" && "Admin Login"}
              {mode === "register" && "Create Your Popup"}
              {mode === "select-org" && "Select Popup"}
            </CardTitle>
            <CardDescription className="text-center">
              {mode === "login" && "Sign in to manage your popup"}
              {mode === "register" && "Set up your point of sale in seconds"}
              {mode === "select-org" && "Choose which popup to manage"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className="underline hover:text-foreground cursor-pointer"
                  >
                    Register
                  </button>
                </p>
              </form>
            )}

            {mode === "select-org" && (
              <div className="space-y-3">
                {orgs.map((org) => (
                  <Button
                    key={org.id}
                    variant="outline"
                    className="w-full justify-start h-auto py-3"
                    onClick={() => handleSelectOrg(org)}
                    disabled={loading}
                  >
                    <div className="text-left">
                      <div className="font-medium">{org.name}</div>
                      <div className="text-sm text-muted-foreground">/{org.slug}</div>
                    </div>
                  </Button>
                ))}
                <p className="text-center text-sm text-muted-foreground pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login")
                      setUserId(null)
                      setOrgs([])
                    }}
                    className="underline hover:text-foreground cursor-pointer"
                  >
                    Back to login
                  </button>
                </p>
              </div>
            )}

            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Popup Name</Label>
                  <Input
                    id="orgName"
                    name="orgName"
                    type="text"
                    placeholder="Joe's Coffee"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Your URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">/</span>
                    <Input
                      id="slug"
                      name="slug"
                      type="text"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="joes-coffee"
                      required
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Customers will order at: /{slug || "your-url"}/menu
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Admin Username</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="admin"
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Admin Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating..." : "Create Popup"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="underline hover:text-foreground cursor-pointer"
                  >
                    Login
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
