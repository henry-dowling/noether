"use client";

import { useState, useRef, useEffect } from "react";

// Define the Thought type to match backend
interface Thought {
  id: number;
  content: string;
  destination: string; // Now dynamic, fetched from backend
}

export default function Home() {
  const [notes, setNotes] = useState<Thought[]>([]);
  const [input, setInput] = useState("");
  const [destinations, setDestinations] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch allowed destinations from backend
    fetch("http://localhost:8000/destinations/")
      .then(res => res.json())
      .then(data => setDestinations(data));
    // Fetch existing notes from backend on mount
    fetch("http://localhost:8000/thoughts/")
      .then(res => res.json())
      .then(data => setNotes(data));
  }, []);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      // POST to backend
      const res = await fetch("http://localhost:8000/thoughts/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() })
      });
      if (res.ok) {
        const newThought: Thought = await res.json();
        setNotes([newThought, ...notes]);
        setInput("");
        inputRef.current?.focus();
      } else {
        // Handle error (optional)
        alert("Failed to add note");
      }
    }
  }

  function deleteNote(idx: number) {
    setNotes(notes.filter((_, i) => i !== idx));
  }

  return (
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
        {notes.map((note, idx) => (
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
              onClick={() => deleteNote(idx)}
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
  );
}
