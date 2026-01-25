"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useCart, type CartItemModifier } from "@/hooks/use-cart"
import { formatPrice } from "@/lib/format"
import { toast } from "sonner"

interface ModifierOption {
  id: string
  name: string
  priceAdjustment: number
}

interface Modifier {
  id: string
  name: string
  options: ModifierOption[]
}

interface MenuItem {
  id: string
  name: string
  description: string | null
  image: string | null
  price: number
  allergens: string | null
  modifiers: Modifier[]
}

const DEFAULT_CHECKOUT_MESSAGE = "Payment via Venmo only. You'll pay after placing your order."

export default function MenuPage() {
  const params = useParams()
  const router = useRouter()
  const org = params.org as string
  const [orgName, setOrgName] = useState("")
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<
    Record<string, ModifierOption>
  >({})
  const [cartOpen, setCartOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState(DEFAULT_CHECKOUT_MESSAGE)
  const cart = useCart(org)

  useEffect(() => {
    fetch(`/api/${org}/menu`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load menu")
        return res.json()
      })
      .then((data) => {
        setOrgName(data.organization?.name || "Menu")
        setMenuItems(Array.isArray(data.menuItems) ? data.menuItems : [])
        if (data.organization?.checkoutMessage) {
          setCheckoutMessage(data.organization.checkoutMessage)
        }
        setLoading(false)
      })
      .catch(() => {
        toast.error("Failed to load menu")
        setMenuItems([])
        setLoading(false)
      })
  }, [org])

  const cartItemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)

  function openItemDialog(item: MenuItem) {
    setSelectedItem(item)
    setSelectedModifiers({})
  }

  function handleModifierSelect(modifierId: string, option: ModifierOption) {
    setSelectedModifiers((prev) => ({
      ...prev,
      [modifierId]: option,
    }))
  }

  function handleAddToCart() {
    if (!selectedItem) return

    const modifiers: CartItemModifier[] = Object.entries(selectedModifiers).map(
      ([, option]) => ({
        optionId: option.id,
        optionName: option.name,
        priceAdjustment: option.priceAdjustment,
      })
    )

    cart.addItem({
      menuItemId: selectedItem.id,
      name: selectedItem.name,
      basePrice: selectedItem.price,
      quantity: 1,
      modifiers,
    })

    toast.success(`Added ${selectedItem.name} to cart`)
    setSelectedItem(null)
    setSelectedModifiers({})
  }

  function calculateItemPrice(item: MenuItem) {
    const modifiersTotal = Object.values(selectedModifiers).reduce(
      (sum, opt) => sum + opt.priceAdjustment,
      0
    )
    return item.price + modifiersTotal
  }

  async function handleSubmitOrder(e: React.FormEvent<HTMLFormElement>) {
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
      setCartOpen(false)
      router.push(`/${org}/order-confirmed?orderNumber=${order.orderNumber}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to place order")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-4">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold mb-6">Menu</h1>
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold mb-6">{orgName}</h1>

        {menuItems.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No items available
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {menuItems.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors overflow-hidden"
                onClick={() => openItemDialog(item)}
              >
                {item.image && (
                  <div className="w-full h-40">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl">{item.name}</CardTitle>
                    <span className="font-semibold">
                      {formatPrice(item.price)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.description && (
                    <p className="text-muted-foreground text-sm mb-2">
                      {item.description}
                    </p>
                  )}
                  {item.allergens && (
                    <p className="text-amber-600 dark:text-amber-500 text-sm mb-2">
                      {item.allergens}
                    </p>
                  )}
                  {item.modifiers.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {item.modifiers.map((mod) => (
                        <Badge key={mod.id} variant="secondary">
                          {mod.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Fixed cart button */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 mx-auto max-w-2xl">
          <Button
            className="w-full h-14 text-lg"
            size="lg"
            onClick={() => setCartOpen(true)}
          >
            View Cart ({cartItemCount}) - {formatPrice(cart.getTotal())}
          </Button>
        </div>
      )}

      {/* Item dialog with modifiers */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-md">
          {selectedItem && (
            <>
              {selectedItem.image && (
                <div className="w-full h-48 mb-2">
                  <img
                    src={selectedItem.image}
                    alt={selectedItem.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              )}
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {selectedItem.name}
                </DialogTitle>
                {selectedItem.description && (
                  <p className="text-muted-foreground">
                    {selectedItem.description}
                  </p>
                )}
                {selectedItem.allergens && (
                  <p className="text-amber-600 dark:text-amber-500 text-sm">
                    {selectedItem.allergens}
                  </p>
                )}
              </DialogHeader>

              {selectedItem.modifiers.length > 0 && (
                <div className="space-y-4 py-4">
                  {selectedItem.modifiers.map((modifier) => (
                    <div key={modifier.id}>
                      <h4 className="font-medium mb-2">{modifier.name}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {modifier.options.map((option) => (
                          <Button
                            key={option.id}
                            variant={
                              selectedModifiers[modifier.id]?.id === option.id
                                ? "default"
                                : "outline"
                            }
                            className="justify-between"
                            onClick={() =>
                              handleModifierSelect(modifier.id, option)
                            }
                          >
                            <span>{option.name}</span>
                            {option.priceAdjustment !== 0 && (
                              <span className="text-xs opacity-70">
                                {option.priceAdjustment > 0 ? "+" : ""}
                                {formatPrice(option.priceAdjustment)}
                              </span>
                            )}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button className="w-full h-12" onClick={handleAddToCart}>
                  Add to Cart - {formatPrice(calculateItemPrice(selectedItem))}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart dialog */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Your Cart</DialogTitle>
          </DialogHeader>

          {cart.items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Your cart is empty
            </p>
          ) : (
            <>
              <div className="space-y-4">
                {cart.items.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">{item.name}</span>
                      <span className="font-semibold">
                        {formatPrice(cart.getItemTotal(item))}
                      </span>
                    </div>
                    {item.modifiers.length > 0 && (
                      <p className="text-sm text-muted-foreground mb-2">
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
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex justify-between items-center text-xl font-bold">
                <span>Total</span>
                <span>{formatPrice(cart.getTotal())}</span>
              </div>

              <form onSubmit={handleSubmitOrder} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Name for order</Label>
                  <Input
                    id="customerName"
                    value={cart.customerName}
                    onChange={(e) => cart.setCustomerName(e.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground text-center">
                    {checkoutMessage}
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12"
                  disabled={submitting}
                >
                  {submitting ? "Placing Order..." : `Place Order - ${formatPrice(cart.getTotal())}`}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
