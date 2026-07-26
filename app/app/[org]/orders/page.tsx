"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPrice } from "@/lib/format"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  BarChart3Icon,
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
  updatedAt: string
  items: OrderItem[]
}

const STATUS_LABELS = {
  RECEIVED: "Not started",
  PREPARING: "Preparing",
  READY: "Finished",
}

const STATUS_STYLES = {
  RECEIVED: {
    accent: "bg-amber-400",
    cardBorder: "border-l-amber-400",
    lane:
      "border-amber-200/80 bg-amber-50/45 dark:border-amber-900/70 dark:bg-amber-950/15",
    iconWrap:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300",
    icon: InboxIcon,
  },
  PREPARING: {
    accent: "bg-sky-500",
    cardBorder: "border-l-sky-500",
    lane:
      "border-sky-200/80 bg-sky-50/45 dark:border-sky-900/70 dark:bg-sky-950/15",
    iconWrap:
      "bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300",
    icon: ChefHatIcon,
  },
  READY: {
    accent: "bg-emerald-500",
    cardBorder: "border-l-emerald-500",
    lane:
      "border-emerald-200/80 bg-emerald-50/45 dark:border-emerald-900/70 dark:bg-emerald-950/15",
    iconWrap:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
    icon: CircleCheckIcon,
  },
}

const QUEUE_SECTIONS: Array<{
  status: Order["status"]
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
}> = [
  {
    status: "RECEIVED",
    title: "Not started",
    description: "Waiting to begin",
    emptyTitle: "Nothing waiting",
    emptyDescription: "New orders will land here.",
  },
  {
    status: "PREPARING",
    title: "Preparing",
    description: "Currently in progress",
    emptyTitle: "Nothing in progress",
    emptyDescription: "Start an order when you’re ready.",
  },
  {
    status: "READY",
    title: "Finished",
    description: "Ready for pickup",
    emptyTitle: "Nothing finished yet",
    emptyDescription: "Completed orders will collect here.",
  },
]

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

interface OrderTicketProps {
  order: Order
  updating: string | null
  updatingItem: string | null
  onStatusChange: (
    orderId: string,
    status: "RECEIVED" | "PREPARING" | "READY"
  ) => void
  onToggleItem: (orderId: string, item: OrderItem) => void
}

function OrderTicket({
  order,
  updating,
  updatingItem,
  onStatusChange,
  onToggleItem,
}: OrderTicketProps) {
  const totalItems = order.items.length
  const completedItems =
    order.status === "READY"
      ? totalItems
      : order.items.filter((item) => item.completed).length
  const progress =
    totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100)
  const statusStyle = STATUS_STYLES[order.status]

  return (
    <Card
      className={`gap-0 overflow-hidden rounded-xl border-l-4 bg-card py-0 shadow-[0_10px_24px_-22px_rgba(45,33,28,0.9)] ${statusStyle.cardBorder}`}
    >
      <div className="px-3.5 pt-3 pb-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Order #{order.orderNumber}</span>
              <span className="inline-flex items-center gap-1 font-medium normal-case tracking-normal">
                <Clock3Icon className="size-3" aria-hidden="true" />
                {formatOrderAge(order.createdAt)}
              </span>
            </p>
            <CardTitle className="mt-1 truncate font-display text-lg leading-tight font-semibold tracking-tight">
              {order.customerName}
            </CardTitle>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[0.68rem] font-semibold tabular-nums text-muted-foreground">
            {completedItems}/{totalItems}
          </span>
        </div>

        <div
          className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`${completedItems} of ${totalItems} items ready`}
          aria-valuemin={0}
          aria-valuemax={totalItems}
          aria-valuenow={completedItems}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${statusStyle.accent}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-border/60 border-y px-3.5 text-sm">
        {order.items.map((item) => {
          const displayCompleted = order.status === "READY" || item.completed

          return (
            <div
              key={item.id}
              className={`flex items-start gap-2 py-2 transition-colors ${
                displayCompleted ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={`-ml-1 size-7 shrink-0 rounded-full ${
                  displayCompleted
                    ? "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => onToggleItem(order.id, item)}
                disabled={
                  order.status === "READY" || updatingItem === item.id
                }
                aria-label={
                  item.completed
                    ? `Reopen ${item.menuItem.name}`
                    : `Cross off ${item.menuItem.name}`
                }
                aria-pressed={displayCompleted}
              >
                {updatingItem === item.id ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : displayCompleted ? (
                  <CircleCheckIcon className="size-4" />
                ) : (
                  <CircleIcon className="size-4" />
                )}
              </Button>
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-md text-[0.68rem] font-bold tabular-nums ${
                  displayCompleted
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {item.quantity}×
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={`leading-5 ${
                    displayCompleted
                      ? "line-through decoration-1 decoration-emerald-500/50"
                      : "font-medium"
                  }`}
                >
                  {item.menuItem.name}
                </p>
                {item.modifiers.length > 0 && (
                  <p
                    className={`text-[0.68rem] leading-4 text-muted-foreground ${
                      displayCompleted ? "line-through" : ""
                    }`}
                  >
                    {item.modifiers
                      .map((modifier) => modifier.modifierOption.name)
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 bg-muted/20 px-3.5 py-2.5">
        <span className="mr-auto text-xs font-semibold tabular-nums text-muted-foreground">
          {formatPrice(order.total)}
        </span>

        {order.status === "RECEIVED" && (
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => onStatusChange(order.id, "PREPARING")}
            disabled={updating === order.id}
          >
            {updating === order.id ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <ChefHatIcon />
            )}
            Start
          </Button>
        )}

        {order.status === "PREPARING" && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => onStatusChange(order.id, "RECEIVED")}
              disabled={updating === order.id}
              aria-label="Move back to Not started"
            >
              <ArrowLeftIcon />
              Back
            </Button>
            <Button
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => onStatusChange(order.id, "READY")}
              disabled={updating === order.id}
            >
              {updating === order.id ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <CircleCheckIcon />
              )}
              Finish
            </Button>
          </>
        )}

        {order.status === "READY" && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => onStatusChange(order.id, "PREPARING")}
            disabled={updating === order.id}
          >
            {updating === order.id ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <ArrowLeftIcon />
            )}
            Reopen
          </Button>
        )}
      </div>
    </Card>
  )
}

export default function OrdersPage() {
  const params = useParams()
  const org = params.org as string
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
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

      const updatedOrder = await res.json()

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
                updatedAt: updatedOrder.updatedAt ?? new Date().toISOString(),
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
                updatedAt:
                  data.orderUpdatedAt ??
                  (orderReady ? new Date().toISOString() : order.updatedAt),
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

  const oldestFirstOrders = [...orders].sort((a, b) => {
    const createdAtDifference =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

    return createdAtDifference || a.orderNumber - b.orderNumber
  })
  const ordersByStatus: Record<Order["status"], Order[]> = {
    RECEIVED: oldestFirstOrders.filter(
      (order) => order.status === "RECEIVED"
    ),
    PREPARING: oldestFirstOrders.filter(
      (order) => order.status === "PREPARING"
    ),
    READY: orders
      .filter((order) => order.status === "READY")
      .sort((a, b) => {
        const updatedAtDifference =
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()

        return updatedAtDifference || b.orderNumber - a.orderNumber
      }),
  }

  if (loading) {
    return (
      <div className="min-h-screen px-3 py-3 sm:px-5 sm:py-4 lg:px-6">
        <div className="mx-auto max-w-[100rem]">
          <Skeleton className="mb-4 h-40 w-full rounded-2xl" />
          <div className="mb-3 space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {[1, 2, 3].map((lane) => (
              <div
                key={lane}
                className="rounded-2xl border bg-muted/20 p-3"
              >
                <Skeleton className="mb-3 h-12 w-full rounded-xl" />
                <div className="space-y-3">
                  {[1, 2].map((ticket) => (
                    <Skeleton
                      key={ticket}
                      className="h-56 w-full rounded-xl"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(180,128,86,0.08),transparent_26rem)] px-3 py-3 sm:px-5 sm:py-4 lg:px-6">
      <div className="mx-auto max-w-[100rem]">
        <header className="mb-4 overflow-hidden rounded-2xl border border-[#4d382f] bg-[#2d211c] text-[#fffaf4] shadow-[0_20px_50px_-38px_rgba(45,33,28,0.9)]">
          <div className="flex flex-col gap-5 px-5 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
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
              <h1 className="font-display text-3xl leading-none font-semibold tracking-tight sm:text-4xl">
                Order queue
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-5 text-[#d9c8bb]">
                Work left to right. Active tickets stay oldest-first, while
                newly finished orders appear at the top.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="grid min-w-0 flex-1 grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:min-w-[27rem]">
                {QUEUE_SECTIONS.map((section, index) => (
                  <div
                    key={section.status}
                    className={`bg-[#2d211c] px-3.5 py-2.5 ${
                      index > 0 ? "border-l border-white/10" : ""
                    }`}
                  >
                    <p className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#bfa99a]">
                      {section.title}
                    </p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums">
                      {ordersByStatus[section.status].length}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  asChild
                  variant="outline"
                  className="h-10 border-white/20 bg-white/5 px-3.5 text-[#fffaf4] hover:bg-white/10 hover:text-white"
                >
                  <Link href={`/${org}/admin/analytics`}>
                    <BarChart3Icon aria-hidden="true" />
                    Analytics
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-10 border-white/20 bg-white/5 px-3.5 text-[#fffaf4] hover:bg-white/10 hover:text-white"
                >
                  <Link href={`/${org}/admin`}>
                    <Settings2Icon aria-hidden="true" />
                    Admin
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Service board
            </h2>
            <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
              Active orders oldest-first, newest finished orders first
            </p>
          </div>
          <p className="hidden text-xs font-semibold text-muted-foreground sm:block">
            {orders.length} {orders.length === 1 ? "order" : "orders"} total
          </p>
        </div>

        <div className="grid gap-4 lg:h-[calc(100vh-14rem)] lg:grid-cols-3">
          {QUEUE_SECTIONS.map((section) => {
            const sectionOrders = ordersByStatus[section.status]
            const statusStyle = STATUS_STYLES[section.status]
            const SectionIcon = statusStyle.icon
            const headingId = `${section.status.toLowerCase()}-orders-heading`

            return (
              <section
                key={section.status}
                className={`flex min-h-[18rem] min-w-0 flex-col overflow-hidden rounded-2xl border ${statusStyle.lane}`}
                aria-labelledby={headingId}
              >
                <div className="flex items-center gap-3 border-b border-current/10 bg-background/70 px-3.5 py-3 backdrop-blur-sm">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${statusStyle.iconWrap}`}
                  >
                    <SectionIcon className="size-4.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3
                      id={headingId}
                      className="font-display text-lg leading-tight font-semibold"
                    >
                      {section.title}
                    </h3>
                    <p className="truncate text-[0.7rem] text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <span className="ml-auto flex min-w-8 items-center justify-center rounded-full bg-background px-2 py-1 text-xs font-bold tabular-nums shadow-sm">
                    {sectionOrders.length}
                  </span>
                </div>

                <div className="min-h-0 flex-1 space-y-2.5 p-2.5 lg:overflow-y-auto">
                  {sectionOrders.length === 0 ? (
                    <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-current/15 bg-background/40 px-5 text-center">
                      <SectionIcon
                        className="mb-3 size-6 text-muted-foreground/70"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-semibold">
                        {section.emptyTitle}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {section.emptyDescription}
                      </p>
                    </div>
                  ) : (
                    sectionOrders.map((order) => (
                      <OrderTicket
                        key={order.id}
                        order={order}
                        updating={updating}
                        updatingItem={updatingItem}
                        onStatusChange={updateStatus}
                        onToggleItem={toggleItemCompletion}
                      />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
