"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/shared/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  // 🔐 AUTENTICACIÓN REAL ACTIVADA
  // Para modo desarrollo (sin auth), cambia a: const DEV_MODE = true;
  const DEV_MODE = false;

  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si está en modo desarrollo, saltear autenticación
    if (DEV_MODE) {
      setLoading(false);
      setUser({ id: "dev-user" } as User); // Usuario mock
      return;
    }

    // Obtener sesión actual
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
      } else {
        router.push("/login");
      }
      setLoading(false);
    };

    getSession();

    // Escuchar cambios de sesión (login / logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        if (pathname !== "/login") {
          router.push("/login");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router, pathname, DEV_MODE]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tairos-bg bg-gradient-mesh">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-tairos-accent/30 border-t-tairos-accent rounded-full animate-spin" />
          <p className="text-sm text-tairos-muted">Cargando Tairos OS...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
