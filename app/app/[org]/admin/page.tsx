"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatPrice, parsePriceToCents } from "@/lib/format"
import { toast } from "sonner"

interface ModifierOption {
  id?: string
  name: string
  priceAdjustment: number
}

interface Modifier {
  id?: string
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
  available: boolean
  modifiers: Modifier[]
}

export default function AdminPage() {
  const params = useParams()
  const org = params.org as string
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [image, setImage] = useState("")
  const [price, setPrice] = useState("")
  const [allergens, setAllergens] = useState("")
  const [available, setAvailable] = useState(true)
  const [modifiers, setModifiers] = useState<Modifier[]>([])

  // Settings state
  const [checkoutMessage, setCheckoutMessage] = useState("")
  const [savingSettings, setSavingSettings] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    fetchMenuItems()
    fetchSettings()
  }, [org])

  async function fetchSettings() {
    try {
      const res = await fetch(`/api/${org}/admin/settings`)
      if (res.ok) {
        const data = await res.json()
        setCheckoutMessage(data.checkoutMessage || "")
      }
    } catch {
      // Settings fetch failed, use defaults
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      const res = await fetch(`/api/${org}/admin/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutMessage: checkoutMessage.trim() || null }),
      })
      if (!res.ok) throw new Error("Failed to save settings")
      toast.success("Settings saved")
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setSavingSettings(false)
    }
  }

  async function clearAllOrders() {
    if (!confirm("Are you sure you want to delete ALL orders? This cannot be undone.")) {
      return
    }

    setClearing(true)
    try {
      const res = await fetch(`/api/${org}/orders`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to clear orders")
      toast.success("All orders cleared")
    } catch {
      toast.error("Failed to clear orders")
    } finally {
      setClearing(false)
    }
  }

  async function fetchMenuItems() {
    try {
      const res = await fetch(`/api/${org}/admin/menu`)
      if (!res.ok) throw new Error("Failed to fetch menu")
      const data = await res.json()
      setMenuItems(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Failed to load menu items")
      setMenuItems([])
    } finally {
      setLoading(false)
    }
  }

  function openCreateDialog() {
    setEditingItem(null)
    setName("")
    setDescription("")
    setImage("")
    setPrice("")
    setAllergens("")
    setAvailable(true)
    setModifiers([])
    setDialogOpen(true)
  }

  function openEditDialog(item: MenuItem) {
    setEditingItem(item)
    setName(item.name)
    setDescription(item.description || "")
    setImage(item.image || "")
    setPrice((item.price / 100).toFixed(2))
    setAllergens(item.allergens || "")
    setAvailable(item.available)
    setModifiers(item.modifiers.map((m) => ({ ...m, options: [...m.options] })))
    setDialogOpen(true)
  }

  function addModifier() {
    setModifiers([...modifiers, { name: "", options: [] }])
  }

  function removeModifier(index: number) {
    setModifiers(modifiers.filter((_, i) => i !== index))
  }

  function updateModifier(index: number, name: string) {
    setModifiers(
      modifiers.map((m, i) => (i === index ? { ...m, name } : m))
    )
  }

  function addOption(modifierIndex: number) {
    setModifiers(
      modifiers.map((m, i) =>
        i === modifierIndex
          ? { ...m, options: [...m.options, { name: "", priceAdjustment: 0 }] }
          : m
      )
    )
  }

  function removeOption(modifierIndex: number, optionIndex: number) {
    setModifiers(
      modifiers.map((m, i) =>
        i === modifierIndex
          ? { ...m, options: m.options.filter((_, j) => j !== optionIndex) }
          : m
      )
    )
  }

  function updateOption(
    modifierIndex: number,
    optionIndex: number,
    field: "name" | "priceAdjustment",
    value: string | number
  ) {
    setModifiers(
      modifiers.map((m, i) =>
        i === modifierIndex
          ? {
              ...m,
              options: m.options.map((o, j) =>
                j === optionIndex ? { ...o, [field]: value } : o
              ),
            }
          : m
      )
    )
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }

    const priceInCents = parsePriceToCents(price)
    if (priceInCents < 0) {
      toast.error("Price cannot be negative")
      return
    }

    setSaving(true)

    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        image: image.trim() || null,
        price: priceInCents,
        allergens: allergens.trim() || null,
        available,
        modifiers: modifiers
          .filter((m) => m.name.trim())
          .map((m) => ({
            id: m.id,
            name: m.name.trim(),
            options: m.options
              .filter((o) => o.name.trim())
              .map((o) => ({
                id: o.id,
                name: o.name.trim(),
                priceAdjustment:
                  typeof o.priceAdjustment === "string"
                    ? parsePriceToCents(o.priceAdjustment)
                    : o.priceAdjustment,
              })),
          })),
      }

      const url = editingItem
        ? `/api/${org}/admin/menu/${editingItem.id}`
        : `/api/${org}/admin/menu`
      const method = editingItem ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }

      toast.success(editingItem ? "Item updated" : "Item created")
      setDialogOpen(false)
      fetchMenuItems()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this item?")) return

    try {
      const res = await fetch(`/api/${org}/admin/menu/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("Item deleted")
      setMenuItems(menuItems.filter((item) => item.id !== id))
    } catch {
      toast.error("Failed to delete item")
    }
  }

  async function toggleAvailability(item: MenuItem) {
    try {
      const res = await fetch(`/api/${org}/admin/menu/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setMenuItems(
        menuItems.map((i) =>
          i.id === item.id ? { ...i, available: !i.available } : i
        )
      )
      toast.success(item.available ? "Item hidden" : "Item visible")
    } catch {
      toast.error("Failed to update availability")
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Menu Items</h2>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-4xl space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Checkout Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkoutMessage">Checkout Message</Label>
              <Textarea
                id="checkoutMessage"
                value={checkoutMessage}
                onChange={(e) => setCheckoutMessage(e.target.value)}
                placeholder="Payment via Venmo only. You'll pay after placing your order."
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                This message will be shown to customers at checkout. Leave blank for the default Venmo message.
              </p>
            </div>
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Clear all orders from the system. This action cannot be undone.
            </p>
            <Button
              variant="destructive"
              onClick={clearAllOrders}
              disabled={clearing}
            >
              {clearing ? "Clearing..." : "Clear All Orders"}
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Menu Items</h2>
          <Button onClick={openCreateDialog}>Add Item</Button>
        </div>

        {menuItems.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No menu items yet. Add your first item!
          </p>
        ) : (
          <div className="space-y-4">
            {menuItems.map((item) => (
              <Card
                key={item.id}
                className={!item.available ? "opacity-60" : ""}
              >
                <div className="flex">
                  {item.image && (
                    <div className="w-20 h-20 flex-shrink-0 m-4 mr-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">{item.name}</CardTitle>
                          {!item.available && (
                            <Badge variant="secondary">Hidden</Badge>
                          )}
                        </div>
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
                      {item.modifiers.length > 0 && (
                        <div className="flex gap-2 flex-wrap mb-4">
                          {item.modifiers.map((mod) => (
                            <Badge key={mod.id} variant="outline">
                              {mod.name}: {mod.options.map((o) => o.name).join(", ")}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAvailability(item)}
                        >
                          {item.available ? "Hide" : "Show"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Item" : "Add Item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Item name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Item description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Image URL (optional)</Label>
              <Input
                id="image"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="allergens">Allergens (optional)</Label>
              <Input
                id="allergens"
                value={allergens}
                onChange={(e) => setAllergens(e.target.value)}
                placeholder="e.g., Contains nuts, dairy, gluten"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="available"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="available">Available on menu</Label>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Modifiers</Label>
                <Button type="button" variant="outline" size="sm" onClick={addModifier}>
                  Add Modifier
                </Button>
              </div>

              {modifiers.map((modifier, modIndex) => (
                <Card key={modIndex} className="p-4">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={modifier.name}
                        onChange={(e) => updateModifier(modIndex, e.target.value)}
                        placeholder="Modifier name (e.g., Size)"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeModifier(modIndex)}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="pl-4 space-y-2">
                      {modifier.options.map((option, optIndex) => (
                        <div key={optIndex} className="flex gap-2">
                          <Input
                            value={option.name}
                            onChange={(e) =>
                              updateOption(modIndex, optIndex, "name", e.target.value)
                            }
                            placeholder="Option name"
                            className="flex-1"
                          />
                          <Input
                            value={
                              typeof option.priceAdjustment === "number"
                                ? (option.priceAdjustment / 100).toFixed(2)
                                : option.priceAdjustment
                            }
                            onChange={(e) =>
                              updateOption(
                                modIndex,
                                optIndex,
                                "priceAdjustment",
                                e.target.value
                              )
                            }
                            placeholder="+/-$"
                            type="number"
                            step="0.01"
                            className="w-24"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOption(modIndex, optIndex)}
                          >
                            X
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addOption(modIndex)}
                      >
                        + Add Option
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
