"use client";

import { useState, useRef, useEffect } from "react";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";

// Define the ProcessedThought type to match backend
interface ProcessedThought {
  id: number;
  content: string;
  destination: string;
  created_at: string;
}

export default function Home() {
  const [notes, setNotes] = useState<ProcessedThought[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch processed thoughts from backend on mount
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    if (!API_URL) {
      throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
    }
    fetch(`${API_URL}/processed_thoughts/`)
      .then(res => res.json())
      .then(data => setNotes(data));
  }, []);

  // Polling effect to refresh notes every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      if (!API_URL) {
        throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
      }
      fetch(`${API_URL}/processed_thoughts/`)
        .then(res => res.json())
        .then(data => setNotes(data));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      // POST to backend
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      if (!API_URL) {
        throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
      }
      const res = await fetch(`${API_URL}/thoughts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() })
      });
      if (res.ok) {
        // Refresh the processed thoughts to get the latest data
        fetch(`${API_URL}/processed_thoughts/`)
          .then(res => res.json())
          .then(data => setNotes(data));
        setInput("");
        inputRef.current?.focus();
      } else {
        // Handle error (optional)
        alert("Failed to add note");
      }
    }
  }

  async function deleteNote(id: number) {
    // Delete from backend
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    if (!API_URL) {
      throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
    }
    const res = await fetch(`${API_URL}/processed_thoughts/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      // Refresh the processed thoughts to get the latest data
      fetch(`${API_URL}/processed_thoughts/`)
        .then(res => res.json())
        .then(data => setNotes(data));
    } else {
      alert("Failed to delete note");
    }
  }

  return (
    <>
      <SignedIn>
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12 gap-8">
          <div className="w-full max-w-xl flex flex-col items-center gap-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-1">Noteworthy</h1>
            <p className="text-lg text-muted-foreground mb-4 text-center">A simple, beautiful note-taking app. Your notes are saved in your browser.</p>
            <form onSubmit={addNote} className="flex w-full gap-2">
              <input
                className="flex-1 bg-transparent border-b border-primary focus:outline-none text-foreground"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                ref={inputRef}
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-2 rounded bg-primary text-background font-semibold shadow hover:bg-primary/90 transition disabled:opacity-50"
                disabled={!input.trim()}
              >
                Add
              </button>
            </form>
          </div>
          <ul className="w-full max-w-xl flex flex-col gap-2 mt-4">
            {notes.length === 0 && (
              <li className="text-center text-muted-foreground py-8 select-none">No notes yet. Add your first note above!</li>
            )}
            {notes.map((note) => (
              <li
                key={note.id}
                className="flex items-center justify-between bg-white dark:bg-black/30 border border-border rounded px-4 py-3 shadow-sm group hover:shadow-md transition"
              >
                <div className="flex-1 pr-4">
                  <span className="break-words block font-medium">{note.content}</span>
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                    {note.destination}
                  </span>
                </div>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="opacity-60 group-hover:opacity-100 text-red-500 hover:text-red-700 transition ml-2"
                  aria-label="Delete note"
                  title="Delete note"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <footer className="mt-auto text-xs text-muted-foreground py-4 text-center opacity-70">
            Built with Next.js. Your notes are private and stored only in your browser.
          </footer>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-background px-4 py-12">
          <div className="w-full max-w-sm bg-white dark:bg-black/80 rounded-2xl shadow-xl border border-border p-8 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/90 mb-2 shadow">
                <Sparkles className="w-8 h-8 text-background" />
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Sign in to use Noether</h1>
              <p className="text-base text-muted-foreground text-center max-w-xs">Capture, organize, and revisit your thoughts. Sign in or create an account to get started.</p>
            </div>
            <div className="flex flex-col gap-3 w-full mt-2">
              <SignInButton>
                <button className="w-full px-6 py-2 rounded-lg bg-primary text-background font-semibold shadow hover:bg-primary/90 transition text-lg">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="w-full px-6 py-2 rounded-lg bg-secondary text-foreground font-semibold shadow hover:bg-secondary/90 transition text-lg border border-primary">
                  Sign up
                </button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </SignedOut>
    </>
  );
}
