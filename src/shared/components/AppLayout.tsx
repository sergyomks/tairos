"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/shared/components/Sidebar";
import ThemeToggle from "@/shared/components/ThemeToggle";
import Notifications from "@/shared/components/Notifications";
import AuthGuard from "@/shared/components/AuthGuard";
import { supabase } from "@/shared/supabase";

interface UserProfile {
  name: string;
  avatar: string;
  color: string;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: "Usuario",
    avatar: "U",
    color: "#8b5cf6",
  });

  useEffect(() => {
    const loadUserProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Extraer nombre del email (antes del @)
        const emailName =
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Usuario";
        const displayName =
          emailName.charAt(0).toUpperCase() + emailName.slice(1);

        // Buscar el rol en la tabla members para obtener el color
        const { data: memberData } = await supabase
          .from("members")
          .select("role")
          .eq("id", user.id)
          .single();

        const role = memberData?.role || "Miembro";

        // Asignar color según el rol
        const roleColors: Record<string, string> = {
          Backend: "#8b5cf6",
          Frontend: "#06b6d4",
          Negocio: "#10b981",
        };

        setUserProfile({
          name: displayName,
          avatar: displayName.charAt(0).toUpperCase(),
          color: roleColors[role] || "#64748b",
        });
      }
    };

    loadUserProfile();
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-tairos-bg bg-gradient-mesh">
        <Sidebar />
        <div className="ml-64">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex items-center justify-end gap-4 px-8 py-4 bg-tairos-bg/60 backdrop-blur-xl border-b border-tairos-border">
            <ThemeToggle />
            <Notifications />
            <div className="flex items-center gap-2 pl-3 border-l border-tairos-border">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: `${userProfile.color}20`,
                  color: userProfile.color,
                }}
              >
                {userProfile.avatar}
              </div>
              <span className="text-sm text-tairos-muted">
                {userProfile.name}
              </span>
            </div>
          </header>
          {/* Page Content */}
          <main className="p-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
