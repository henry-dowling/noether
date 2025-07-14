"use client";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

export default function NoteworthyNotes() {
  const [notes, setNotes] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("notes");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("notes", JSON.stringify(notes));
  }, [notes]);

  function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      setNotes([input.trim(), ...notes]);
      setInput("");
      inputRef.current?.focus();
    }
  }

  function deleteNote(idx: number) {
    setNotes(notes.filter((_, i) => i !== idx));
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle className="text-4xl font-bold tracking-tight text-foreground mb-1">Noteworthy</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg text-muted-foreground mb-4 text-center">A simple, beautiful note-taking app. Your notes are saved in your browser.</p>
        <form onSubmit={addNote} className="flex w-full gap-2 mb-4">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Write a new note..."
            className="flex-1 px-4 py-2 rounded border border-border bg-white dark:bg-black/40 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition"
            maxLength={200}
            aria-label="New note"
            autoFocus
          />
          <Button type="submit" disabled={!input.trim()}>
            Add
          </Button>
        </form>
        <ul className="flex flex-col gap-2">
          {notes.length === 0 && (
            <li className="text-center text-muted-foreground py-8 select-none">No notes yet. Add your first note above!</li>
          )}
          {notes.map((note, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between bg-white dark:bg-black/30 border border-border rounded px-4 py-3 shadow-sm group hover:shadow-md transition"
            >
              <span className="break-words flex-1 pr-4">{note}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteNote(idx)}
                className="opacity-60 group-hover:opacity-100 text-red-500 hover:text-red-700 transition ml-2"
                aria-label="Delete note"
                title="Delete note"
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
} 