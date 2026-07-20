"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/shared/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setIsLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setErrorMsg("Ocurrió un error inesperado al intentar iniciar sesión.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-tairos-bg bg-gradient-mesh relative overflow-hidden">
      {/* Animated orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-tairos-accent/10 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-tairos-cyan/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />

      <div className="relative z-10 w-full max-w-md px-4 animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-tairos-accent to-tairos-cyan shadow-neon mb-5">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-tairos-text tracking-tight">
            Tairos OS
          </h1>
          <p className="text-sm text-tairos-muted mt-1">
            Collaborative AI Software Factory
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8">
          <h2 className="text-lg font-semibold text-tairos-text mb-1">
            Bienvenido de vuelta
          </h2>
          <p className="text-sm text-tairos-muted mb-6">
            Ingresa tus credenciales para acceder al panel de control
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-tairos-red/10 border border-tairos-red/20 text-xs font-semibold text-tairos-red">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-tairos-muted mb-1.5 uppercase tracking-wider">
                Correo Electrónico
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sergio@tayros.dev"
                className="glass-input"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-tairos-muted mb-1.5 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="glass-input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tairos-muted hover:text-tairos-text transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-tairos-border bg-transparent accent-tairos-accent"
                />
                <span className="text-xs text-tairos-muted">Recordarme</span>
              </label>
              <button
                type="button"
                className="text-xs text-tairos-accent hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full glass-button-primary py-3 mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar al Panel"
              )}
            </button>
          </form>

          <div className="neon-divider mt-6 mb-4" />

          <p className="text-center text-xs text-tairos-muted">
            Acceso exclusivo para el equipo de ingeniería Tayros
          </p>
        </div>

        {/* Team indicator */}
        <div className="flex items-center justify-center gap-3 mt-6">
          {["S", "C", "A"].map((initial, i) => (
            <div
              key={initial}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-tairos-border bg-tairos-surface text-tairos-muted"
              style={{
                borderColor:
                  i === 0
                    ? "rgba(139,92,246,0.4)"
                    : i === 1
                    ? "rgba(6,182,212,0.4)"
                    : "rgba(16,185,129,0.4)",
                color:
                  i === 0
                    ? "#8b5cf6"
                    : i === 1
                    ? "#06b6d4"
                    : "#10b981",
              }}
            >
              {initial}
            </div>
          ))}
          <span className="text-xs text-tairos-muted ml-1">
            3 miembros activos
          </span>
        </div>
      </div>
    </div>
  );
}
