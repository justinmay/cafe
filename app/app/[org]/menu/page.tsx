"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { formatPrice, formatPriceRange } from "@/lib/format"
import { toast } from "sonner"
import {
  Coffee,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
} from "lucide-react"

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
  suggestedMinPrice: number | null
  suggestedMaxPrice: number | null
  useSuggestedPriceRange: boolean
  allergens: string | null
  modifiers: Modifier[]
}

function getMenuItemPriceRange(
  item: MenuItem,
  modifiersTotal = 0,
  quantity = 1
) {
  if (
    item.useSuggestedPriceRange &&
    item.suggestedMinPrice != null &&
    item.suggestedMaxPrice != null
  ) {
    return {
      min: Math.max(0, item.suggestedMinPrice + modifiersTotal) * quantity,
      max: Math.max(0, item.suggestedMaxPrice + modifiersTotal) * quantity,
    }
  }

  const total = Math.max(0, item.price + modifiersTotal) * quantity
  return { min: total, max: total }
}

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
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [cartOpen, setCartOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [hidePricesUntilCart, setHidePricesUntilCart] = useState(false)
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
        setHidePricesUntilCart(data.organization?.hidePricesUntilCart === true)
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
    setSelectedQuantity(1)
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
      suggestedMinPrice: selectedItem.suggestedMinPrice,
      suggestedMaxPrice: selectedItem.suggestedMaxPrice,
      useSuggestedPriceRange: selectedItem.useSuggestedPriceRange,
      quantity: selectedQuantity,
      modifiers,
    })

    toast.success(
      selectedQuantity === 1
        ? `Added ${selectedItem.name} to cart`
        : `Added ${selectedQuantity} × ${selectedItem.name} to cart`
    )
    setSelectedItem(null)
    setSelectedModifiers({})
    setSelectedQuantity(1)
  }

  function calculateSelectedItemPriceRange(item: MenuItem) {
    const modifiersTotal = Object.values(selectedModifiers).reduce(
      (sum, opt) => sum + opt.priceAdjustment,
      0
    )
    return getMenuItemPriceRange(item, modifiersTotal, selectedQuantity)
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
      const usesSuggestedPrice = order.items.some(
        (item: { usesSuggestedPriceRange: boolean }) =>
          item.usesSuggestedPriceRange
      )
      const confirmationParams = new URLSearchParams({
        orderNumber: String(order.orderNumber),
        priceMin: String(order.totalMin),
        priceMax: String(order.totalMax),
      })

      if (usesSuggestedPrice) {
        confirmationParams.set("suggested", "true")
      }

      cart.clearCart()
      setCartOpen(false)
      router.push(`/${org}/order-confirmed?${confirmationParams.toString()}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to place order")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <Skeleton className="mb-8 h-56 w-full rounded-3xl" />
          <div className="grid gap-5 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-5 pb-28 sm:px-6 sm:py-10 sm:pb-32">
      <div className="mx-auto max-w-5xl">
        <header
          className="relative mb-8 flex min-h-56 overflow-hidden rounded-3xl border border-white/25 bg-cover bg-center shadow-[0_24px_60px_-30px_oklch(0.25_0.05_45_/_0.55)] sm:min-h-72"
          style={{
            backgroundImage:
              "linear-gradient(100deg, rgba(45, 29, 25, 0.9) 0%, rgba(63, 38, 31, 0.65) 50%, rgba(63, 38, 31, 0.18) 100%), url('/cafe.png')",
          }}
        >
          <div className="relative z-10 flex max-w-2xl flex-col justify-end p-6 text-white sm:p-10">
            <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] backdrop-blur-md">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Today&apos;s menu
            </div>
            <h1 className="font-display text-4xl font-semibold leading-none tracking-tight sm:text-6xl">
              {orgName}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
              Made in small batches. Pick a favorite and make it yours.
            </p>
          </div>
        </header>

        {menuItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card/70 px-6 py-16 text-center shadow-sm">
            <Coffee
              className="mx-auto mb-4 size-10 text-primary/60"
              aria-hidden="true"
            />
            <h2 className="font-display text-2xl font-semibold">
              The menu is resting
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back soon for today&apos;s offerings.
            </p>
          </div>
        ) : (
          <section aria-labelledby="menu-heading">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Fresh today
              </p>
              <h2
                id="menu-heading"
                className="font-display mt-1 text-3xl font-semibold tracking-tight"
              >
                Choose your order
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {menuItems.map((item) => (
                <Card
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className="group relative aspect-square cursor-pointer gap-0 overflow-hidden border-white/20 bg-foreground py-0 shadow-[0_12px_40px_-24px_oklch(0.27_0.05_45_/_0.75)] transition-all duration-200 hover:-translate-y-1 hover:border-white/40 hover:shadow-[0_24px_55px_-26px_oklch(0.25_0.07_32_/_0.8)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                  onClick={() => openItemDialog(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openItemDialog(item)
                    }
                  }}
                >
                  <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-secondary via-muted to-accent">
                    {item.image ? (
                      <>
                        <img
                          src={item.image}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl"
                        />
                        <img
                          src={item.image}
                          alt=""
                          className="relative h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.025]"
                        />
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Coffee
                          className="size-16 text-primary/25 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/5" />

                  {!hidePricesUntilCart && (
                    <span className="absolute top-4 right-4 rounded-full bg-background/90 px-3 py-1.5 text-sm font-bold text-foreground shadow-sm backdrop-blur-md">
                      {item.useSuggestedPriceRange && "Suggested "}
                      {formatPriceRange(
                        getMenuItemPriceRange(item).min,
                        getMenuItemPriceRange(item).max
                      )}
                    </span>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                    <h3 className="font-display text-2xl leading-tight font-semibold drop-shadow-sm sm:text-3xl">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="mt-2 line-clamp-2 max-w-md text-sm leading-relaxed text-white/80">
                        {item.description}
                      </p>
                    )}
                    {item.allergens && (
                      <p className="mt-2 line-clamp-1 text-xs font-medium text-amber-200">
                        {item.allergens}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Fixed cart button */}
      {cartItemCount > 0 && (
        <div className="fixed right-0 bottom-3 left-0 z-40 mx-auto max-w-xl px-4 pb-[env(safe-area-inset-bottom)]">
          <Button
            className="h-16 w-full justify-between rounded-2xl px-5 text-base shadow-[0_16px_45px_-14px_oklch(0.28_0.08_25_/_0.75)]"
            size="lg"
            onClick={() => setCartOpen(true)}
          >
            <span className="flex items-center gap-3">
              <span className="relative flex size-9 items-center justify-center rounded-xl bg-primary-foreground/15">
                <ShoppingBag className="size-5" aria-hidden="true" />
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary-foreground text-[10px] font-bold text-primary">
                  {cartItemCount}
                </span>
              </span>
              View cart
            </span>
            <span className="text-right">
              {hidePricesUntilCart
                ? "Review order"
                : formatPriceRange(
                    cart.getTotalPriceRange().min,
                    cart.getTotalPriceRange().max
                  )}
            </span>
          </Button>
        </div>
      )}

      {/* Item dialog with modifiers */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="top-auto bottom-0 left-0 max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-t-3xl rounded-b-none border-x-0 border-b-0 p-0 shadow-2xl sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:z-20 [&_[data-slot=dialog-close]]:bg-background/90 [&_[data-slot=dialog-close]]:p-2 [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:shadow-sm">
          {selectedItem && (
            <>
              <div className="absolute top-2 left-1/2 z-20 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/70 shadow-sm sm:hidden" />
              <div className="relative h-52 shrink-0 overflow-hidden bg-gradient-to-br from-secondary via-muted to-accent sm:h-60">
                {selectedItem.image ? (
                  <img
                    src={selectedItem.image}
                    alt={selectedItem.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Coffee
                      className="size-16 text-primary/25"
                      aria-hidden="true"
                    />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 to-transparent" />
              </div>

              <div className="space-y-5 overflow-y-auto px-6 py-5">
                <DialogHeader className="text-left">
                  <DialogTitle className="font-display text-3xl leading-tight">
                    {selectedItem.name}
                  </DialogTitle>
                  {selectedItem.description && (
                    <p className="leading-relaxed text-muted-foreground">
                      {selectedItem.description}
                    </p>
                  )}
                  {selectedItem.allergens && (
                    <p className="text-sm font-medium text-amber-700">
                      {selectedItem.allergens}
                    </p>
                  )}
                </DialogHeader>

                {selectedItem.modifiers.length > 0 && (
                  <div className="space-y-5">
                    {selectedItem.modifiers.map((modifier) => (
                      <div key={modifier.id}>
                        <h4 className="mb-2 font-semibold">{modifier.name}</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {modifier.options.map((option) => (
                            <Button
                              key={option.id}
                              variant={
                                selectedModifiers[modifier.id]?.id === option.id
                                  ? "default"
                                  : "outline"
                              }
                              className="h-11 justify-between rounded-xl"
                              onClick={() =>
                                handleModifierSelect(modifier.id, option)
                              }
                            >
                              <span>{option.name}</span>
                              {!hidePricesUntilCart &&
                                option.priceAdjustment !== 0 && (
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

                <div className="flex items-center justify-between rounded-2xl border bg-muted/45 p-3.5">
                  <div>
                    <p className="font-semibold">Quantity</p>
                    <p className="text-xs text-muted-foreground">
                      Add more with the same options
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-xl bg-background"
                      aria-label="Decrease quantity"
                      onClick={() =>
                        setSelectedQuantity((quantity) =>
                          Math.max(1, quantity - 1)
                        )
                      }
                      disabled={selectedQuantity <= 1}
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </Button>
                    <span className="w-8 text-center text-lg font-bold">
                      {selectedQuantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-xl bg-background"
                      aria-label="Increase quantity"
                      onClick={() =>
                        setSelectedQuantity((quantity) => quantity + 1)
                      }
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t bg-background/95 p-4 backdrop-blur-md sm:p-5">
                <Button
                  className="h-13 w-full rounded-xl text-base shadow-md"
                  onClick={handleAddToCart}
                >
                  {selectedQuantity === 1
                    ? "Add to Cart"
                    : `Add ${selectedQuantity} to Cart`}
                  {!hidePricesUntilCart &&
                    ` - ${formatPriceRange(
                      calculateSelectedItemPriceRange(selectedItem).min,
                      calculateSelectedItemPriceRange(selectedItem).max
                    )}`}
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
                        {formatPriceRange(
                          cart.getItemPriceRange(item).min,
                          cart.getItemPriceRange(item).max
                        )}
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
                <span>
                  {cart.getTotalPriceRange().min ===
                  cart.getTotalPriceRange().max
                    ? "Total"
                    : "Suggested total"}
                </span>
                <span>
                  {formatPriceRange(
                    cart.getTotalPriceRange().min,
                    cart.getTotalPriceRange().max
                  )}
                </span>
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

                <Button
                  type="submit"
                  className="w-full h-12"
                  disabled={submitting}
                >
                  {submitting
                    ? "Placing Order..."
                    : `Place Order - ${formatPriceRange(
                        cart.getTotalPriceRange().min,
                        cart.getTotalPriceRange().max
                      )}`}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
