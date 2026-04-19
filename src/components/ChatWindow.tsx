import React, { useState, useEffect, useRef } from "react";
import { Send, Paperclip, Mic, Square, Loader2, FileText, Image as ImageIcon, MessageSquare } from "lucide-react";
import { Message, fetchMessages, sendMessage, subscribeToMessages, uploadAttachment } from "@/services/chatService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";

interface ChatWindowProps {
  otherUserId: string;
  otherUserName: string;
}

export default function ChatWindow({ otherUserId, otherUserName }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  
  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      setLoading(true);
      const data = await fetchMessages(user.id, otherUserId);
      setMessages(data);
      setLoading(false);
      scrollToBottom();
    };
    loadData();

    // Subscribe to new messages
    const channel = subscribeToMessages(user.id, (newMsg: Message) => {
      // Only append if it's part of this specific chat
      if (
        (newMsg.sender_id === user.id && newMsg.receiver_id === otherUserId) ||
        (newMsg.sender_id === otherUserId && newMsg.receiver_id === user.id)
      ) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        scrollToBottom();
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [user, otherUserId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSendText = async () => {
    if (!inputText.trim() || !user) return;
    setSending(true);
    try {
      await sendMessage(user.id, otherUserId, inputText.trim());
      setInputText("");
    } catch (e: any) {
      toast.error("Échec de l'envoi du message");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setSending(true);
    try {
      const uploadRes = await uploadAttachment(file);
      await sendMessage(user.id, otherUserId, null, uploadRes.url, uploadRes.type, uploadRes.name);
      toast.success("Fichier envoyé");
    } catch (e: any) {
      toast.error("Échec de l'envoi du fichier");
    } finally {
      setSending(false);
    }
  };

  // ---------------- Voice Recording ----------------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        sendVoiceNote(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied", err);
      toast.error("Veuillez autoriser l'accès au microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop all audio tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const sendVoiceNote = async (blob: Blob) => {
    if (!user) return;
    setSending(true);
    try {
      const file = new File([blob], "voice-note.webm", { type: "audio/webm" });
      const uploadRes = await uploadAttachment(file);
      await sendMessage(user.id, otherUserId, null, uploadRes.url, uploadRes.type, uploadRes.name);
    } catch (e: any) {
      toast.error("Message vocal non envoyé");
    } finally {
      setSending(false);
      setAudioBlob(null);
    }
  };

  // ---------------- Renderers ----------------
  const renderAttachment = (msg: Message) => {
    if (!msg.file_url) return null;
    
    if (msg.file_type?.startsWith("image/")) {
      return (
        <a href={msg.file_url} target="_blank" rel="noreferrer" className="block mt-1">
          <img src={msg.file_url} alt="attachment" className="max-w-[200px] rounded-lg border border-border mt-1" />
        </a>
      );
    }
    
    if (msg.file_type?.startsWith("audio/")) {
      return (
        <audio controls src={msg.file_url} className="mt-2 w-[220px] h-10" />
      );
    }

    // Generic file
    return (
      <a href={msg.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-black/5 p-2 rounded-lg mt-1 decoration-transparent text-foreground hover:bg-black/10 transition-colors">
        <FileText className="w-5 h-5 text-primary" />
        <span className="text-sm truncate max-w-[150px]">{msg.file_name}</span>
      </a>
    );
  };

  return (
    <div className="flex flex-col h-[500px] sm:h-full bg-card border border-border shadow-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-3 bg-white">
        <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold">
          {getInitials(otherUserName)}
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-sm">{otherUserName}</h3>
        </div>
      </div>

      {/* Messages View */}
      <div className="flex-1 overflow-y-auto p-5 bg-accent/20 flex flex-col gap-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm flex-col">
            <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
            Aucun message. Envoyez un petit coucou !
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-none" : "bg-white text-foreground rounded-bl-none shadow-sm border border-border"}`}>
                  {msg.content && <p className="break-words">{msg.content}</p>}
                  {msg.file_url && renderAttachment(msg)}
                  <div className={`text-[10px] mt-1 opacity-60 text-right ${!isMe && "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-border flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-muted-foreground hover:bg-accent hover:text-foreground rounded-full transition-colors bg-transparent border-none cursor-pointer"
          title="Joindre un fichier"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendText()}
            placeholder={isRecording ? "Enregistrement en cours..." : "Écrivez un message..."}
            disabled={isRecording || sending}
            className="w-full bg-accent/40 border border-border rounded-full px-4 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50 transition-colors"
          />
        </div>

        {inputText.trim() ? (
          <button
            onClick={handleSendText}
            disabled={sending}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-teal-mid transition-colors disabled:opacity-50 border-none cursor-pointer"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
          </button>
        ) : (
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={sending}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border-none cursor-pointer ${
              isRecording 
                ? "bg-red-500 text-white animate-pulse" 
                : "bg-teal-pale text-primary hover:bg-teal-hero disabled:opacity-50"
            }`}
            title="Maintenir pour enregistrer"
          >
            {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
