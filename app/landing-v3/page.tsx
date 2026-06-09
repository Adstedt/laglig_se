import { redirect } from 'next/navigation'

// /landing-v3 was promoted to / on 2026-06-06. This route now permanently
// redirects to the homepage so any external links / bookmarks / cached search
// results pointing at /landing-v3 still land on the live page.
export default function LandingV3Page() {
  redirect('/')
}
