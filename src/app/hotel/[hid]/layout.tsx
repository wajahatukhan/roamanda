import { notFound } from "next/navigation";
import { HID } from "@/lib/hotel/hotel-id";

// This layout reads the route parameter before anything streams, so a bad id gets a real 404 status.
export const instant = false;

export default async function HotelLayout({ children, params }: LayoutProps<"/hotel/[hid]">) {
  const { hid } = await params;
  if (!HID.test(hid)) notFound();
  return children;
}
