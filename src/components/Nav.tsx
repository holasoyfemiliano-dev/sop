"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, MessageSquare, Calendar, BarChart2, Settings } from "lucide-react";

const links = [
  { href: "/", label: "Hoy", icon: Sun },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/calendar", label: "Agenda", icon: Calendar },
  { href: "/analytics", label: "Stats", icon: BarChart2 },
  { href: "/settings", label: "Config", icon: Settings },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/8 px-4 py-2 md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      <div className="max-w-5xl mx-auto flex items-center justify-around md:justify-start md:gap-6 md:h-14">
        <span className="hidden md:flex items-center gap-2 text-white font-bold text-lg mr-6 tracking-tight flex-shrink-0">
          <span className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-sm">S</span>
          SOP
        </span>
        {links.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-1 rounded-lg text-xs md:text-sm font-medium transition-all ${
                active
                  ? "text-indigo-400 bg-indigo-500/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={18} />
              <span className="md:inline">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
