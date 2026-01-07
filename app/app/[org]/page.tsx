import { redirect } from "next/navigation"

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const { org } = await params
  redirect(`/${org}/menu`)
}
