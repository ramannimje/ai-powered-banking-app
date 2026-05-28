"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Send, Bot, Loader2, Lightbulb, Trash2, ChevronLeft, MessageSquare, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  model?: string;
  tokens_used?: number;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

const SUGGESTIONS = [
  "Why did I spend more this month?",
  "Show my top spending categories",
  "Any unusual transactions?",
  "Can I afford a ₹50,000 purchase?",
];

export default function AICopilotPage() {
  const { accessToken } = useAuthStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    startNewChat();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await api.get("/ai/conversations", { token: accessToken! }) as any;
      setConversations(data?.items || []);
    } catch (err) {
      // silent
    }
  };

  const startNewChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "ai",
        content: "👋 Hey! I'm your AI Financial Copilot — powered by GPT-4o. Ask me anything about your spending, savings, or financial health. What would you like to know?",
        created_at: new Date().toISOString(),
      },
    ]);
    setConversationId(null);
  };

  const loadConversation = async (convId: string) => {
    try {
      const data = await api.get(`/ai/conversations/${convId}`, { token: accessToken! }) as any;
      if (data?.messages) {
        setMessages(data.messages.map((m: any) => ({
          id: m.id,
          role: m.role as "user" | "ai",
          content: m.content,
          model: m.model,
          tokens_used: m.tokens_used,
          created_at: m.created_at,
        })));
        setConversationId(convId);
        setShowHistory(false);
      }
    } catch (err) {
      toast.error("Failed to load conversation");
    }
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.request(`/ai/conversations/${convId}`, { method: "DELETE", token: accessToken! });
      setConversations(conversations.filter((c) => c.id !== convId));
      toast.success("Conversation deleted");
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const send = async (text?: string) => {
    const textToSend = (text || input).trim();
    if (!textToSend || loading) return;

    // Add user message immediately
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: textToSend,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await api.chat(textToSend, accessToken!) as any;

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== userMsg.id);
        return [
          ...withoutTemp,
          { ...userMsg, id: `msg-${Date.now()}` },
          {
            id: `ai-${Date.now()}`,
            role: "ai",
            content: data.reply,
            model: data.model,
            tokens_used: data.tokens_used,
            created_at: new Date().toISOString(),
          },
        ];
      });

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
        loadConversations(); // refresh sidebar list
      }
    } catch (err: any) {
      toast.error(err.message || "AI is taking a break. Try again.");
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6" /> AI Financial Copilot
          </h1>
          <p className="text-muted-foreground text-sm">
            {conversationId ? `Conversation · ${messages.length} messages` : "Powered by GPT-4o · Your financial data is private"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowHistory(!showHistory)}>
            <MessageSquare className="w-4 h-4" /> History
            {conversations.length > 0 && (
              <Badge variant="secondary" className="ml-1">{conversations.length}</Badge>
            )}
          </Button>
          {conversationId && (
            <Button variant="outline" size="sm" className="gap-2" onClick={startNewChat}>
              <span className="text-lg">+</span> New Chat
            </Button>
          )}
        </div>
      </div>

      {/* Conversation History Sidebar */}
      {showHistory && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            <div className="p-4 border-b font-medium text-sm flex items-center justify-between">
              <span>Conversation History</span>
              <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No conversations yet. Start chatting!</div>
            ) : (
              <div className="divide-y max-h-80 overflow-y-auto">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">{conv.message_count} messages · {formatRelativeTime(conv.updated_at)}</p>
                    </div>
                    <button
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chat Messages */}
      <Card className="border-0 shadow-md flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
        <CardContent className="flex flex-col p-0 flex-1">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === "ai" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {msg.role === "ai" ? "🤖" : "👤"}
                </div>
                <div className={`max-w-[75%] ${msg.role === "ai" ? "" : "items-end"}`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "ai" ? "bg-muted" : "bg-primary text-primary-foreground"
                  }`}>
                    {msg.content.split("\n").map((line, i) => (
                      <span key={i}>{line}{i < msg.content.split("\n").length - 1 ? <br /> : ""}</span>
                    ))}
                  </div>
                  {msg.model && msg.role === "ai" && (
                    <p className="text-xs text-muted-foreground mt-1 px-1">
                      {msg.model} · {msg.tokens_used ? `${msg.tokens_used} tokens` : ""}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">🤖</div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && (
            <div className="px-6 pb-3 flex gap-2 flex-wrap">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs bg-muted hover:bg-muted/80 rounded-full px-3 py-1.5 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Lightbulb className="w-3 h-3" /> {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t p-4 flex gap-2">
            <Input
              placeholder="Ask about your finances..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              className="flex-1"
              disabled={loading}
            />
            <Button onClick={() => send()} disabled={loading || !input.trim()} className="gap-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}