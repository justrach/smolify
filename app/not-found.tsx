import Link from "next/link";
import { BrandMark } from "@/components/brand";

export default function NotFound() {
  return <main className="not-found"><BrandMark /><h1>These docs wandered off.</h1><p>The project or page does not exist.</p><Link className="button" href="/">Back to Smolify</Link></main>;
}
