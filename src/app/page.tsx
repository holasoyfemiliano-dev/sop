"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("sop_onboarded") !== "true") {
        router.replace("/onboarding");
      } else {
        router.replace("/kanban");
      }
    }
  }, [router]);

  return null;
}
