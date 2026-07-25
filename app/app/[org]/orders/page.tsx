"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatPrice } from "@/lib/format"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  ChefHatIcon,
  CircleCheckIcon,
  CircleIcon,
  Clock3Icon,
  InboxIcon,
  Loader2Icon,
  Settings2Icon,
  UtensilsIcon,
} from "lucide-react"

interface OrderItemModifier {
  id: string
  priceAdjustment: number
  modifierOption: {
    name: string
  }
}

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  completed: boolean
  menuItem: {
    name: string
  }
  modifiers: OrderItemModifier[]
}

interface Order {
  id: string
  orderNumber: number
  customerName: string
  status: "RECEIVED" | "PREPARING" | "READY"
  total: number
  createdAt: string
  items: OrderItem[]
}

const STATUS_LABELS = {
  RECEIVED: "Received",
  PREPARING: "Preparing",
  READY: "Ready",
}

const STATUS_STYLES = {
  RECEIVED: {
    rail: "bg-amber-400",
    badge:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    icon: InboxIcon,
  },
  PREPARING: {
    rail: "bg-sky-500",
    badge:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
    icon: ChefHatIcon,
  },
  READY: {
    rail: "bg-emerald-500",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: CircleCheckIcon,
  },
}

function formatOrderAge(createdAt: string) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
  )

  if (elapsedMinutes < 1) return "Just now"
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`

  const hours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60
  return minutes > 0 ? `${hours}h ${minutes}m ago` : `${hours}h ago`
}

export default function OrdersPage() {
  const params = useParams()
  const org = params.org as string
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("active")
  const [updating, setUpdating] = useState<string | null>(null)
  const [updatingItem, setUpdatingItem] = useState<string | null>(null)
  const [pollStatus, setPollStatus] = useState<"ok" | "error">("ok")
  const activeMutations = useRef(0)
  const mutationVersion = useRef(0)

  const fetchOrders = useCallback(async () => {
    if (activeMutations.current > 0) return

    const versionAtRequestStart = mutationVersion.current

    try {
      const res = await fetch(`/api/${org}/orders`)
      if (!res.ok) throw new Error("Failed to fetch orders")
      const data = await res.json()

      if (
        activeMutations.current === 0 &&
        versionAtRequestStart === mutationVersion.current
      ) {
        setOrders(Array.isArray(data) ? data : [])
      }
      setPollStatus("ok")
    } catch {
      setPollStatus("error")
    } finally {
      setLoading(false)
    }
  }, [org])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  async function updateStatus(
    orderId: string,
    status: "RECEIVED" | "PREPARING" | "READY"
  ) {
    activeMutations.current += 1
    mutationVersion.current += 1
    setUpdating(orderId)

    try {
      const res = await fetch(`/api/${org}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) throw new Error("Failed to update status")

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
                items:
                  status === "READY"
                    ? order.items.map((item) => ({
                        ...item,
                        completed: true,
                      }))
                    : status === "RECEIVED"
                      ? order.items.map((item) => ({
                          ...item,
                          completed: false,
                        }))
                      : order.items,
              }
            : order
        )
      )
      toast.success(`Order marked as ${STATUS_LABELS[status]}`)
    } catch {
      toast.error("Failed to update order status")
    } finally {
      activeMutations.current -= 1
      setUpdating(null)
    }
  }

  async function toggleItemCompletion(orderId: string, item: OrderItem) {
    const completed = !item.completed
    activeMutations.current += 1
    mutationVersion.current += 1
    setUpdatingItem(item.id)

    try {
      const res = await fetch(
        `/api/${org}/orders/${orderId}/items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed }),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to update item")
      }

      const data = await res.json()
      const orderStatus = data.orderStatus as Order["status"]
      const orderReady = orderStatus === "READY"
      const orderStarted = data.orderStarted === true

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: orderStatus,
                items: order.items.map((orderItem) =>
                  orderItem.id === item.id
                    ? { ...orderItem, completed }
                    : orderItem
                ),
              }
            : order
        )
      )
      toast.success(
        orderReady
          ? `${item.menuItem.name} crossed off — order ready`
          : orderStarted
          ? `${item.menuItem.name} crossed off — preparation started`
          : completed
          ? `${item.menuItem.name} crossed off`
          : `${item.menuItem.name} reopened`
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update item"
      )
    } finally {
      activeMutations.current -= 1
      setUpdatingItem(null)
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (filter === "active") return order.status !== "READY"
    if (filter === "finished") return order.status === "READY"
    return true
  })
  const activeCount = orders.filter((order) => order.status !== "READY").length
  const receivedCount = orders.filter(
    (order) => order.status === "RECEIVED"
  ).length
  const preparingCount = orders.filter(
    (order) => order.status === "PREPARING"
  ).length
  const finishedCount = orders.filter((order) => order.status === "READY").length

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Skeleton className="mb-8 h-64 w-full rounded-[1.75rem]" />
          <div className="mb-5 flex items-end justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-4 w-52" />
            </div>
            <Skeleton className="h-12 w-64 rounded-2xl" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[28rem] w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-5 pb-12 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[1.75rem] border border-[#4d382f] bg-[#2d211c] text-[#fffaf4] shadow-[0_24px_60px_-36px_rgba(45,33,28,0.8)]">
          <div className="flex flex-col gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#ead9cb]">
                  <UtensilsIcon className="size-3.5" aria-hidden="true" />
                  Kitchen display
                </span>
                <span
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-[#ead9cb]"
                  title={
                    pollStatus === "ok" ? "Connected" : "Connection error"
                  }
                >
                  <span
                    className={`size-2 rounded-full ${
                      pollStatus === "ok" ? "bg-emerald-400" : "bg-red-400"
                    }`}
                  />
                  {pollStatus === "ok" ? "Live updates" : "Connection issue"}
                </span>
              </div>
              <h1 className="font-display text-4xl leading-none font-semibold tracking-tight sm:text-5xl">
                Order queue
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#d9c8bb] sm:text-base">
                Keep every ticket moving from received to ready. Check off each
                item as the kitchen finishes it.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="grid min-w-0 flex-1 grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:min-w-[25rem]">
                <div className="bg-[#2d211c] px-4 py-3">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#bfa99a]">
                    Active
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{activeCount}</p>
                </div>
                <div className="border-x border-white/10 bg-[#2d211c] px-4 py-3">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#bfa99a]">
                    Waiting
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{receivedCount}</p>
                </div>
                <div className="bg-[#2d211c] px-4 py-3">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#bfa99a]">
                    Cooking
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {preparingCount}
                  </p>
                </div>
              </div>

              <Button
                asChild
                variant="outline"
                className="h-12 border-white/20 bg-white/5 px-4 text-[#fffaf4] hover:bg-white/10 hover:text-white"
              >
                <Link href={`/${org}/admin`}>
                  <Settings2Icon aria-hidden="true" />
                  Admin
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Tickets
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredOrders.length}{" "}
              {filteredOrders.length === 1 ? "order" : "orders"} in this view
            </p>
          </div>

          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="h-auto w-full rounded-2xl border bg-card/90 p-1.5 shadow-sm sm:w-auto">
              <TabsTrigger
                value="active"
                className="group h-10 rounded-xl px-4 data-[state=active]:bg-[#2d211c] data-[state=active]:text-white"
              >
                Active
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs tabular-nums group-data-[state=active]:bg-white/15">
                  {activeCount}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="finished"
                className="group h-10 rounded-xl px-4 data-[state=active]:bg-[#2d211c] data-[state=active]:text-white"
              >
                Finished
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs tabular-nums group-data-[state=active]:bg-white/15">
                  {finishedCount}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {filteredOrders.length === 0 ? (
          <Card className="items-center gap-0 rounded-2xl border-dashed bg-card/65 px-6 py-16 text-center shadow-none">
            <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
              <UtensilsIcon className="size-6" aria-hidden="true" />
            </div>
            <CardTitle className="font-display text-2xl">
              {filter === "active" ? "The queue is clear" : "Nothing here yet"}
            </CardTitle>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {filter === "active"
                ? "New customer orders will appear here automatically."
                : "Completed orders will collect here after they are marked ready."}
            </p>
          </Card>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {filteredOrders.map((order) => {
              const completedItems = order.items.filter(
                (item) => item.completed
              ).length
              const totalItems = order.items.length
              const progress =
                totalItems === 0
                  ? 0
                  : Math.round((completedItems / totalItems) * 100)
              const statusStyle = STATUS_STYLES[order.status]
              const StatusIcon = statusStyle.icon

              return (
                <Card
                  key={order.id}
                  className="relative gap-0 overflow-hidden rounded-2xl border bg-card py-0 shadow-[0_14px_35px_-28px_rgba(45,33,28,0.7)]"
                >
                  <div className={`h-1.5 w-full ${statusStyle.rail}`} />
                  <CardHeader className="gap-4 border-b bg-muted/20 px-5 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Order #{order.orderNumber}
                        </p>
                        <CardTitle className="truncate font-display text-2xl font-semibold tracking-tight">
                          {order.customerName}
                        </CardTitle>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock3Icon className="size-3.5" aria-hidden="true" />
                          {formatOrderAge(order.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle.badge}`}
                      >
                        <StatusIcon className="size-3.5" aria-hidden="true" />
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 py-5">
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground">
                          Items ready
                        </span>
                        <span className="font-semibold tabular-nums">
                          {completedItems} / {totalItems}
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label={`${completedItems} of ${totalItems} items ready`}
                        aria-valuemin={0}
                        aria-valuemax={totalItems}
                        aria-valuenow={completedItems}
                      >
                        <div
                          className={`h-full rounded-full transition-[width] duration-300 ${statusStyle.rail}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="divide-y divide-border/70 border-y text-sm">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 py-3 transition-colors ${
                            item.completed
                              ? "text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={`-ml-1 shrink-0 rounded-full ${
                              item.completed
                                ? "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() =>
                              toggleItemCompletion(order.id, item)
                            }
                            disabled={
                              order.status === "READY" ||
                              updatingItem === item.id
                            }
                            aria-label={
                              item.completed
                                ? `Reopen ${item.menuItem.name}`
                                : `Cross off ${item.menuItem.name}`
                            }
                            aria-pressed={item.completed}
                          >
                            {updatingItem === item.id ? (
                              <Loader2Icon className="size-5 animate-spin" />
                            ) : item.completed ? (
                              <CircleCheckIcon className="size-5" />
                            ) : (
                              <CircleIcon className="size-5" />
                            )}
                          </Button>
                          <span
                            className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
                              item.completed
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-secondary text-secondary-foreground"
                            }`}
                          >
                            {item.quantity}×
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`leading-8 ${
                                item.completed
                                  ? "line-through decoration-2 decoration-emerald-500/50"
                                  : "font-medium"
                              }`}
                            >
                              {item.menuItem.name}
                            </p>
                            {item.modifiers.length > 0 && (
                              <p
                                className={`-mt-1 text-xs leading-5 text-muted-foreground ${
                                  item.completed ? "line-through" : ""
                                }`}
                              >
                                {item.modifiers
                                  .map((m) => m.modifierOption.name)
                                  .join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.status === "RECEIVED" && (
                      <p className="mt-3 flex items-center gap-2 text-xs leading-5 text-muted-foreground">
                        <ChefHatIcon
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        Crossing off an item will start this ticket automatically.
                      </p>
                    )}
                  </CardContent>

                  <div className="mt-auto border-t bg-muted/20 px-5 py-4">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Order total
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatPrice(order.total)}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {order.status === "RECEIVED" && (
                        <Button
                          className="h-11 flex-1"
                          onClick={() => updateStatus(order.id, "PREPARING")}
                          disabled={updating === order.id}
                        >
                          {updating === order.id ? (
                            <Loader2Icon className="animate-spin" />
                          ) : (
                            <ChefHatIcon />
                          )}
                          Start Preparing
                        </Button>
                      )}
                      {order.status === "PREPARING" && (
                        <>
                          <Button
                            variant="outline"
                            className="h-11"
                            onClick={() => updateStatus(order.id, "RECEIVED")}
                            disabled={updating === order.id}
                          >
                            <ArrowLeftIcon />
                            Back
                          </Button>
                          <Button
                            className="h-11 flex-1"
                            onClick={() => updateStatus(order.id, "READY")}
                            disabled={updating === order.id}
                          >
                            {updating === order.id ? (
                              <Loader2Icon className="animate-spin" />
                            ) : (
                              <CircleCheckIcon />
                            )}
                            Mark Ready
                          </Button>
                        </>
                      )}
                      {order.status === "READY" && (
                        <Button
                          variant="outline"
                          className="h-11 flex-1"
                          onClick={() => updateStatus(order.id, "PREPARING")}
                          disabled={updating === order.id}
                        >
                          {updating === order.id ? (
                            <Loader2Icon className="animate-spin" />
                          ) : (
                            <ArrowLeftIcon />
                          )}
                          Back to Preparing
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
