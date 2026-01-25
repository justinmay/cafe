"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useCart } from "@/hooks/use-cart"
import { formatPrice } from "@/lib/format"
import { toast } from "sonner"

const DEFAULT_CHECKOUT_MESSAGE = "Payment via Venmo only. You'll pay after placing your order."

export default function CartPage() {
  const router = useRouter()
  const params = useParams()
  const org = params.org as string
  const cart = useCart(org)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState(DEFAULT_CHECKOUT_MESSAGE)

  useEffect(() => {
    async function fetchCheckoutMessage() {
      try {
        const res = await fetch(`/api/${org}/menu`)
        if (res.ok) {
          const data = await res.json()
          if (data.organization?.checkoutMessage) {
            setCheckoutMessage(data.organization.checkoutMessage)
          }
        }
      } catch {
        // Use default message on error
      }
    }
    fetchCheckoutMessage()
  }, [org])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!cart.customerName.trim()) {
      toast.error("Please enter your name")
      return
    }

    if (cart.items.length === 0) {
      toast.error("Your cart is empty")
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(`/api/${org}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: cart.customerName.trim(),
          items: cart.items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            modifiers: item.modifiers.map((m) => ({
              optionId: m.optionId,
            })),
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to place order")
      }

      const order = await res.json()
      cart.clearCart()
      router.push(`/${org}/order-confirmed?orderNumber=${order.orderNumber}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to place order")
    } finally {
      setSubmitting(false)
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen p-4">
        <div className="mx-auto max-w-2xl text-center py-16">
          <h1 className="text-3xl font-bold mb-4">Your Cart</h1>
          <p className="text-muted-foreground mb-6">Your cart is empty</p>
          <Link href={`/${org}/menu`}>
            <Button size="lg">Browse Menu</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Your Cart</h1>
          <Link href={`/${org}/menu`}>
            <Button variant="outline">Add More</Button>
          </Link>
        </div>

        <div className="space-y-4 mb-6">
          {cart.items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <span className="font-semibold">
                    {formatPrice(cart.getItemTotal(item))}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {item.modifiers.length > 0 && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {item.modifiers.map((m) => m.optionName).join(", ")}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                    >
                      +
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => cart.removeItem(item.id)}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="my-6" />

        <div className="flex justify-between items-center text-xl font-bold mb-6">
          <span>Total</span>
          <span>{formatPrice(cart.getTotal())}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Name for order</Label>
            <Input
              id="customerName"
              value={cart.customerName}
              onChange={(e) => cart.setCustomerName(e.target.value)}
              placeholder="Enter your name"
              required
              className="h-12 text-lg"
            />
          </div>

          <Card className="bg-muted/50">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground text-center">
                {checkoutMessage}
              </p>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full h-14 text-lg"
            size="lg"
            disabled={submitting}
          >
            {submitting ? "Placing Order..." : `Place Order - ${formatPrice(cart.getTotal())}`}
          </Button>
        </form>
      </div>
    </div>
  )
}
