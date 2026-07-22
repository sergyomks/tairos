"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/shared/components/AppLayout";
import { PRP_VOTE } from "@/shared/data/mock";
import {
  Send,
  Smile,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  Clock,
  FileText,
  Zap,
  Trash2,
  Loader2,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { supabase } from "@/shared/supabase";

const getSenderMetadata = (name: string, senderId: string | null) => {
  const lowerName = name.toLowerCase();
  if (!senderId || lowerName.includes("agent") || lowerName.includes("tairos") || lowerName.includes("system")) {
    return {
      avatar: "T",
      role: "System Agent",
      color: "#8b5cf6",
      isAgent: true
    };
  }
  if (lowerName.includes("sergio")) {
    return { avatar: "S", role: "Backend", color: "#8b5cf6", isAgent: false };
  }
  if (lowerName.includes("carlos")) {
    return { avatar: "C", role: "Frontend", color: "#06b6d4", isAgent: false };
  }
  if (lowerName.includes("ana")) {
    return { avatar: "A", role: "Negocio", color: "#10b981", isAgent: false };
  }
  return {
    avatar: name[0]?.toUpperCase() || "U",
    role: "Miembro",
    color: "#64748b",
    isAgent: false
  };
};

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const [showPRP, setShowPRP] = useState(false);
  const [activePRP, setActivePRP] = useState<any>(null);
  const [votes, setVotes] = useState<any[]>([]);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // 1. Get user session
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();

    // 2. Fetch messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(data);
      }
    };
    fetchMessages();

    // 3. Fetch active PRP — si hay un PRP pendiente, mostrar panel para TODOS
    // Esto es crítico: cualquier usuario que abra el chat debe ver el panel
    // de votación si hay un PRP esperando aprobación democrática (2/3).
    const fetchActivePRP = async () => {
      const { data: prpData, error } = await supabase
        .from("prps")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.log("No hay PRPs activas o error:", error.message);
        return;
      }

      if (prpData && prpData.length > 0) {
        const prp = prpData[0];
        setActivePRP(prp);
        setShowPRP(true); // Mostrar panel para TODOS los usuarios

        const { data: votesData } = await supabase
          .from("prp_votes")
          .select("*")
          .eq("prp_id", prp.id);

        if (votesData) {
          setVotes(votesData);
        }
      } else {
        setActivePRP(null);
        setVotes([]);
        setShowPRP(false);
      }
    };
    fetchActivePRP();

    // 4. Realtime messages subscription
    const channelMessages = supabase
      .channel("realtime-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const newMsg = payload.new;
          setMessages((prev) => [...prev, newMsg]);

          // Si es un mensaje del agente, ocultar indicador de "escribiendo"
          const meta = getSenderMetadata(newMsg.sender_name, newMsg.sender_id);
          if (meta.isAgent) {
            setIsAgentTyping(false);
          }
        }
      )
      .subscribe();

    // 5. Realtime PRPs subscription
    const channelPRPs = supabase
      .channel("realtime-prps")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prps" },
        async (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const prp = payload.new;
            if (prp.status === "pending") {
              setActivePRP(prp);
              setShowPRP(true);
              // Fetch votes for this PRP
              const { data: votesData } = await supabase
                .from("prp_votes")
                .select("*")
                .eq("prp_id", prp.id);
              if (votesData) {
                setVotes(votesData);
              }
            } else if (prp.status === "approved" || prp.status === "rejected") {
              // Si el PRP activo cambió de estado, limpiar el panel
              setActivePRP((prev: any) => {
                if (prev && prev.id === prp.id) {
                  setVotes([]);
                  setShowPRP(false);
                  return null;
                }
                return prev;
              });
            }
          } else if (payload.eventType === "DELETE") {
            setActivePRP((prev: any) => {
              if (prev && prev.id === payload.old.id) {
                setVotes([]);
                setShowPRP(false);
                return null;
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    // 6. Realtime votes subscription
    const channelVotes = supabase
      .channel("realtime-votes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prp_votes" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setVotes((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setVotes((prev) =>
              prev.map((v) => (v.id === payload.new.id ? payload.new : v))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelMessages);
      supabase.removeChannel(channelPRPs);
      supabase.removeChannel(channelVotes);
    };
  }, []);

  const sendMessage = async () => {
    if (!message.trim() && !selectedImage) return;

    setIsUploading(true);
    const rawName = user?.email?.split("@")[0] || "Sergio";
    const senderName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    let imageUrl = null;

    // Subir imagen si existe
    if (selectedImage) {
      const fileName = `${Date.now()}-${selectedImage.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(fileName, selectedImage, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Error al subir imagen:", uploadError);
        alert("Error al subir la imagen. Verifica que el bucket 'chat-images' exista en Supabase Storage.");
        setIsUploading(false);
        return;
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from("chat-images")
        .getPublicUrl(fileName);

      imageUrl = urlData.publicUrl;
    }

    // Detectar si es un comando que trigger al agente
    const isCommand = message.includes("@tairos") || message.startsWith("/") || imageUrl !== null;
    if (isCommand) {
      setIsAgentTyping(true);
    }

    const { error } = await supabase.from("chat_messages").insert({
      sender_id: user?.id || null,
      sender_name: senderName,
      content: message.trim() || (imageUrl ? "[Imagen]" : ""),
      image_url: imageUrl,
      project_id: null,
    });

    if (!error) {
      setMessage("");
      setSelectedImage(null);
      setImagePreview(null);
    }
    setIsUploading(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("La imagen es muy grande. Máximo 5 MB.");
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const clearChat = async () => {
    if (!confirm("¿Estás seguro de que quieres limpiar el chat? Esta acción no se puede deshacer.")) {
      return;
    }

    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

    if (!error) {
      setMessages([]);
      // También ocultar el panel de votación
      setShowPRP(false);
      setActivePRP(null);
      setVotes([]);
    } else {
      console.error("Error al limpiar chat:", error);
      alert("Error al limpiar el chat. Verifica los permisos en Supabase.");
    }
  };

  const handleVote = async (decision: "approved" | "rejected") => {
    if (!user || !activePRP) return;

    const rawName = user.email?.split("@")[0] || "Usuario";
    const memberName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    // Upsert vote (insert or update if exists)
    const { error } = await supabase
      .from("prp_votes")
      .upsert({
        prp_id: activePRP.id,
        member_id: user.id,
        member_name: memberName,
        vote: decision,
      }, {
        onConflict: 'prp_id,member_id'
      });

    if (error) {
      console.error("Error al votar:", error);
    } else {
      // Actualizar estado de la PRP si hay quórum (2+ aprobaciones)
      const updatedVotes = [...votes.filter(v => v.member_id !== user.id), {
        prp_id: activePRP.id,
        member_id: user.id,
        member_name: memberName,
        vote: decision,
      }];
      
      const approvedCount = updatedVotes.filter((v) => v.vote === "approved").length;
      
      if (approvedCount >= 2 && activePRP.status === "pending") {
        // Actualizar status de PRP a approved
        await supabase
          .from("prps")
          .update({ status: "approved" })
          .eq("id", activePRP.id);
        
        setActivePRP({ ...activePRP, status: "approved" });

        // Auto-ocultar panel después de 5 segundos
        setTimeout(() => {
          setShowPRP(false);
          setActivePRP(null);
          setVotes([]);
        }, 5000);
      }
    }
  };

  const approvedCount = votes.filter((v) => v.vote === "approved").length;
  const userVote = votes.find((v) => v.member_id === user?.id);

  return (
    <AppLayout>
      <div className="flex gap-6 h-[calc(100vh-130px)]">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col glass-card overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-tairos-border">
            <div>
              <h2 className="text-base font-semibold text-tairos-text">
                Sala de Chat — Tairos OS
              </h2>
              <p className="text-xs text-tairos-muted">
                3 miembros · 1 agente activo
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                className="glass-button flex items-center gap-2 text-tairos-red hover:bg-tairos-red/10"
                title="Limpiar chat"
              >
                <Trash2 className="w-4 h-4" />
                Limpiar
              </button>
              <button
                onClick={() => setShowPRP(!showPRP)}
                className="glass-button flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                PRP Activo
                {activePRP && activePRP.status === "pending" && (
                  <span className="w-2 h-2 rounded-full bg-tairos-amber animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {messages.map((msg) => {
              const meta = getSenderMetadata(msg.sender_name, msg.sender_id);
              const formattedTime = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 animate-slide-in ${
                    meta.isAgent ? "pl-4 border-l-2 border-tairos-accent/30" : ""
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      backgroundColor: meta.color + "20",
                      color: meta.color,
                      border: meta.isAgent
                        ? `1px solid ${meta.color}40`
                        : "none",
                    }}
                  >
                    {meta.isAgent ? (
                      <Zap className="w-4 h-4" />
                    ) : (
                      meta.avatar
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: meta.isAgent ? meta.color : undefined }}
                      >
                        {msg.sender_name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-tairos-muted">
                        {meta.role}
                      </span>
                      <span className="text-[10px] text-tairos-muted">
                        {formattedTime}
                      </span>
                    </div>
                    <p className="text-sm text-tairos-muted mt-1 leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    {msg.image_url && (
                      <div className="mt-2">
                        <img
                          src={msg.image_url}
                          alt="Imagen compartida"
                          className="max-w-sm rounded-xl border border-tairos-border cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(msg.image_url, "_blank")}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Indicador de "escribiendo..." */}
            {isAgentTyping && (
              <div className="flex gap-3 animate-slide-in pl-4 border-l-2 border-tairos-accent/30">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    backgroundColor: "#8b5cf620",
                    color: "#8b5cf6",
                    border: "1px solid #8b5cf640",
                  }}
                >
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: "#8b5cf6" }}>
                      @tairos-architect
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-tairos-muted">
                      System Agent
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="w-4 h-4 text-tairos-accent animate-spin" />
                    <span className="text-sm text-tairos-muted italic">
                      Analizando tu solicitud...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-tairos-border">
            {/* Image Preview */}
            {imagePreview && (
              <div className="mb-3 relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-32 rounded-xl border border-tairos-border"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-tairos-red text-white hover:bg-tairos-red/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                id="chat-input"
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isUploading && sendMessage()}
                placeholder="Escribe un mensaje o intención..."
                className="glass-input flex-1"
                disabled={isUploading}
              />
              
              {/* Image Upload Button */}
              <label className="p-2.5 rounded-xl text-tairos-muted hover:text-tairos-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
                <ImageIcon className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>

              <button className="p-2.5 rounded-xl text-tairos-muted hover:text-tairos-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <Smile className="w-5 h-5" />
              </button>
              
              <button
                id="chat-send"
                onClick={sendMessage}
                disabled={isUploading || (!message.trim() && !selectedImage)}
                className="p-2.5 rounded-xl bg-tairos-accent text-white hover:bg-tairos-accent/80 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* PRP Voting Panel */}
        {showPRP && activePRP && (
          <div className="w-96 flex-shrink-0 glass-card p-6 animate-slide-in overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-tairos-amber" />
                <span className="text-[10px] font-semibold text-tairos-amber uppercase tracking-wider">
                  Propuesta de Requisitos (PRP) — {activePRP.sprint || "Sprint Actual"}
                </span>
              </div>
              <button
                onClick={() => setShowPRP(false)}
                className="text-tairos-muted hover:text-tairos-text transition-colors"
                title="Cerrar panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-tairos-text mt-3 mb-2">
              {activePRP.title}
            </h3>
            <p className="text-sm text-tairos-muted leading-relaxed mb-5">
              {activePRP.description}
            </p>

            <div className="neon-divider mb-5" />

            {/* Voting Status */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-tairos-muted">Estatus</span>
              <span className={`text-xs font-semibold ${
                activePRP.status === "approved" 
                  ? "text-tairos-green" 
                  : activePRP.status === "rejected"
                  ? "text-tairos-red"
                  : "text-tairos-amber"
              }`}>
                {activePRP.status === "approved" 
                  ? "✓ Aprobado" 
                  : activePRP.status === "rejected"
                  ? "✗ Rechazado"
                  : "Esperando Votación"}
              </span>
            </div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs text-tairos-muted">Aprobaciones</span>
              <span className="text-sm font-bold text-tairos-text">
                {approvedCount} de {votes.length || 3}
              </span>
            </div>

            {/* Vote List */}
            <div className="space-y-3 mb-6">
              {votes.map((vote) => (
                <div
                  key={vote.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-tairos-border/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-tairos-accent/15 flex items-center justify-center text-xs font-bold text-tairos-accent">
                      {vote.member_name[0]}
                    </div>
                    <span className="text-sm font-medium text-tairos-text">
                      {vote.member_name}
                    </span>
                  </div>
                  {vote.vote === "approved" ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-tairos-green">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Aprobado
                    </span>
                  ) : vote.vote === "rejected" ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-tairos-red">
                      <ThumbsDown className="w-3.5 h-3.5" /> Rechazado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-tairos-amber">
                      <Clock className="w-3.5 h-3.5" /> Pendiente
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            {!userVote && activePRP.status === "pending" && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  id="prp-approve"
                  onClick={() => handleVote("approved")}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm bg-tairos-green/15 border border-tairos-green/30 text-tairos-green hover:bg-tairos-green/25 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all active:scale-95"
                >
                  <ThumbsUp className="w-5 h-5" /> Aprobar
                </button>
                <button
                  id="prp-reject"
                  onClick={() => handleVote("rejected")}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm bg-tairos-red/15 border border-tairos-red/30 text-tairos-red hover:bg-tairos-red/25 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all active:scale-95"
                >
                  <ThumbsDown className="w-5 h-5" /> Rechazar
                </button>
              </div>
            )}

            {userVote && activePRP.status === "pending" && (
              <div className="p-3 rounded-xl bg-tairos-cyan/10 border border-tairos-cyan/20 text-center">
                <p className="text-xs font-semibold text-tairos-cyan">
                  ✓ Ya votaste: {userVote.vote === "approved" ? "Aprobado" : "Rechazado"}
                </p>
              </div>
            )}

            {activePRP.status === "approved" && (
              <div className="p-3 rounded-xl bg-tairos-green/10 border border-tairos-green/20 text-center animate-fade-in">
                <p className="text-xs font-semibold text-tairos-green">
                  ✓ PRP Aprobado — El pipeline A2A puede comenzar
                </p>
              </div>
            )}

            {activePRP.status === "rejected" && (
              <div className="p-3 rounded-xl bg-tairos-red/10 border border-tairos-red/20 text-center">
                <p className="text-xs font-semibold text-tairos-red">
                  ✗ PRP Rechazado — Se requiere nueva propuesta
                </p>
              </div>
            )}

            {approvedCount >= 2 && activePRP.status === "pending" && (
              <div className="mt-4 p-3 rounded-xl bg-tairos-green/10 border border-tairos-green/20 text-center animate-fade-in">
                <p className="text-xs font-semibold text-tairos-green">
                  ✓ Quórum alcanzado — El agente puede proceder a codificar
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
