import { notFound } from "next/navigation";

// This layout reads the route parameter before anything streams, so a bad id gets a real 404 status.
export const instant = false;

/** A hotel id is a positive whole number of at most 12 digits. */
export const HID = /^[1-9]\d{0,11}$/;

export default async function HotelLayout({ children, params }: LayoutProps<"/hotel/[hid]">) {
  const { hid } = await params;
  if (!HID.test(hid)) notFound();
  return children;
}
