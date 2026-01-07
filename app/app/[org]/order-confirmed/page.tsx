"use client"

import { useSearchParams, useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Suspense } from "react"

function OrderConfirmedContent() {
  const searchParams = useSearchParams()
  const params = useParams()
  const router = useRouter()
  const org = params.org as string
  const orderNumber = searchParams.get("orderNumber")
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (countdown <= 0) {
      router.push(`/${org}/menu`)
      return
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown, org, router])

  return (
    <div className="min-h-screen p-4 flex items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="relative">
              {/* Animated checkmark circle */}
              <svg
                className="w-24 h-24"
                viewBox="0 0 100 100"
              >
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="6"
                />
                {/* Animated circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset="283"
                  className="animate-circle"
                />
                {/* Checkmark */}
                <path
                  d="M30 50 L45 65 L70 35"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="60"
                  strokeDashoffset="60"
                  className="animate-checkmark"
                />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl">Order Confirmed!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-muted-foreground mb-2">Your order number is</p>
            <p className="text-6xl font-bold animate-bounce-in">{orderNumber || "—"}</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              Please pay via Venmo and show this number when your order is ready.
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            Returning to menu in {countdown} second{countdown !== 1 ? "s" : ""}...
          </div>

          <Link href={`/${org}/menu`}>
            <Button variant="outline" className="w-full">
              Place Another Order
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

export default function OrderConfirmedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <OrderConfirmedContent />
    </Suspense>
  )
}
