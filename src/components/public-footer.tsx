import Link from "next/link";
import { cn } from "@/lib/utils";

export function PublicFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "border-t border-line py-8 text-xs text-graphite bg-paper",
        className,
      )}
    >
      <div className="mx-auto max-w-wide px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="font-serif font-bold text-ink">Mainline</p>
        <div className="flex flex-wrap items-center gap-6 font-sans">
          <Link
            href="/about"
            className="hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
          >
            About
          </Link>
          <Link
            href="/about#methodology"
            className="hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
          >
            Methodology
          </Link>
          <a
            href="https://github.com/kleinebossie/Mainline"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
          >
            Source code
          </a>
          <Link
            href="/about#privacy"
            className="hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
