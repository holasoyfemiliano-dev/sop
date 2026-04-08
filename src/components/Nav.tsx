"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Columns, Calendar, MessageSquare, Settings } from "lucide-react";

const mainLinks = [
  { href: "/kanban",   label: "Kanban",     icon: Columns },
  { href: "/calendar", label: "Calendario", icon: Calendar },
  { href: "/chat",     label: "Chat",       icon: MessageSquare },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:top-0 md:bottom-auto px-5 py-2 md:py-0"
      style={{
        background: "rgba(8, 12, 59, 0.95)",
        borderTop: "1px solid rgba(35,14,255,0.2)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between md:h-14">
        {/* Logo */}
        <Link href="/kanban" className="hidden md:flex items-center gap-2.5 flex-shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black text-white"
            style={{ background: "#230EFF" }}
          >
            S
          </div>
          <span className="font-bold text-lg tracking-tight" style={{ color: "#EAEBEF" }}>
            SOP
          </span>
        </Link>

        {/* Main links */}
        <div className="flex items-center justify-around flex-1 md:flex-none md:justify-start md:gap-1 md:ml-8">
          {mainLinks.map(({ href, label, icon: Icon }) => {
            const active = path === href || (href === "/kanban" && path === "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col md:flex-row items-center gap-1 md:gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-all"
                style={{
                  color: active ? "#EAEBEF" : "#818BA6",
                  background: active ? "rgba(35,14,255,0.2)" : "transparent",
                  border: active ? "1px solid rgba(35,14,255,0.3)" : "1px solid transparent",
                }}
              >
                <Icon size={19} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Settings */}
        <Link
          href="/settings"
          className="p-2 rounded-lg transition-colors"
          style={{ color: path === "/settings" ? "#230EFF" : "#3D4466" }}
        >
          <Settings size={16} />
        </Link>
      </div>
    </nav>
  );
}
