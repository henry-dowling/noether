"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Types for backend data
interface ProcessedThought {
  id: number;
  content: string;
  destination: string;
}

interface Document {
  id: number;
  label: string;
  thoughts: ProcessedThought[];
}

// Toggle this to switch between mock data and backend
const USE_MOCK_DATA = true;

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
  
  // Documents state (from backend)
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const selectedDoc = documents.find((doc) => doc.id === selectedDocId);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [errorDocs, setErrorDocs] = useState<string | null>(null);
  const [editThoughtId, setEditThoughtId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Handle drag end for thoughts
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!selectedDoc || !over || active.id === over.id) return;
    const oldIndex = selectedDoc.thoughts.findIndex((t) => t.id === active.id);
    const newIndex = selectedDoc.thoughts.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newThoughts = arrayMove(selectedDoc.thoughts, oldIndex, newIndex);
    setDocuments((docs) =>
      docs.map((doc) =>
        doc.id === selectedDoc.id ? { ...doc, thoughts: newThoughts } : doc
      )
    );
  };

  // Handle edit
  const startEdit = (thought: ProcessedThought) => {
    setEditThoughtId(thought.id);
    setEditValue(thought.content);
  };
  const saveEdit = (thought: ProcessedThought) => {
    setDocuments((docs) =>
      docs.map((doc) =>
        doc.id === selectedDoc?.id
          ? {
              ...doc,
              thoughts: doc.thoughts.map((t) =>
                t.id === thought.id ? { ...t, content: editValue } : t
              ),
            }
          : doc
      )
    );
    setEditThoughtId(null);
    setEditValue("");
  };

  // Handle delete
  const deleteThought = (thoughtId: number) => {
    setDocuments((docs) =>
      docs.map((doc) =>
        doc.id === selectedDoc?.id
          ? {
              ...doc,
              thoughts: doc.thoughts.filter((t) => t.id !== thoughtId),
            }
          : doc
      )
    );
  };

  // Sortable Thought Item
  function SortableThoughtItem({ thought }: { thought: ProcessedThought }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: thought.id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      cursor: "grab",
    };
    return (
      <li
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="bg-white dark:bg-black/30 border border-border rounded px-4 py-3 shadow-sm flex items-center gap-2"
      >
        {editThoughtId === thought.id ? (
          <input
            className="flex-1 bg-transparent border-b border-primary focus:outline-none text-foreground"
            value={editValue}
            autoFocus
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveEdit(thought)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit(thought);
              if (e.key === "Escape") {
                setEditThoughtId(null);
                setEditValue("");
              }
            }}
          />
        ) : (
          <div
            className="flex-1 font-medium text-foreground cursor-pointer"
            onClick={() => startEdit(thought)}
            title="Click to edit"
          >
            {thought.content}
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-1 whitespace-nowrap">
          Destination: {thought.destination}
        </div>
        <button
          className="ml-2 text-red-500 hover:text-red-700 text-lg font-bold px-2 py-0.5 rounded focus:outline-none"
          title="Delete thought"
          onClick={(e) => {
            e.stopPropagation();
            deleteThought(thought.id);
          }}
        >
          ×
        </button>
      </li>
    );
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      // POST to backend
      const res = await fetch("http://localhost:8000/thoughts/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

  // Fetch documents from backend (replaced with mock data for testing)
  useEffect(() => {
    // Fetch allowed destinations from backend
    fetch("http://localhost:8000/destinations/")
      .then(res => res.json())
      .then(data => setDestinations(data))
      .catch(err => console.error("Failed to fetch destinations:", err));
    
    // Fetch existing notes from backend on mount
    fetch("http://localhost:8000/thoughts/")
      .then(res => res.json())
      .then(data => setNotes(data))
      .catch(err => console.error("Failed to fetch thoughts:", err));

    setLoadingDocs(true);
    setErrorDocs(null);
    if (USE_MOCK_DATA) {
      // Example mock data
      const mockDocuments: Document[] = [
        {
          id: 1,
          label: "Project Alpha",
          thoughts: [
            {
              id: 101,
              content: "Summarized the project requirements and next steps.",
              destination: "Summary Section",
            },
            {
              id: 102,
              content: "Identified key stakeholders for the kickoff meeting.",
              destination: "Stakeholders List",
            },
          ],
        },
        {
          id: 2,
          label: "Research Notes",
          thoughts: [
            {
              id: 201,
              content: "Compiled recent findings on AI advancements.",
              destination: "Findings",
            },
          ],
        },
        {
          id: 3,
          label: "Personal Journal",
          thoughts: [],
        },
      ];
      setTimeout(() => {
        setDocuments(mockDocuments);
        if (mockDocuments.length > 0) setSelectedDocId(mockDocuments[0].id);
        setLoadingDocs(false);
      }, 500); // Simulate loading delay
    } else {
      fetch("/documents")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch documents");
          return res.json();
        })
        .then((data) => {
          setDocuments(data);
          if (data.length > 0) setSelectedDocId(data[0].id);
        })
        .catch((err) => setErrorDocs(err.message))
        .finally(() => setLoadingDocs(false));
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-72 min-h-screen border-r border-border bg-white dark:bg-black/40 flex flex-col p-4 gap-2">
        <Card className="mb-2 shadow-none border-none bg-transparent">
          <CardHeader className="p-0 mb-2">
            <CardTitle className="text-xl font-bold text-foreground">Documents</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="flex flex-col gap-1 mb-2">
              <li>
                <Link href="/notes">
                  <Button variant="outline" className="w-full justify-start">Noteworthy Notes</Button>
                </Link>
              </li>
            </ul>
            {loadingDocs && <div className="text-muted-foreground">Loading...</div>}
            {errorDocs && <div className="text-red-500">{errorDocs}</div>}
            <ul className="flex flex-col gap-1">
              {documents.length === 0 && !loadingDocs && (
                <li className="text-muted-foreground select-none">No documents</li>
              )}
              {documents.map((doc) => (
                <li key={doc.id}>
                  <Button
                    variant={selectedDocId === doc.id ? "default" : "ghost"}
                    className={`w-full justify-start ${selectedDocId === doc.id ? "bg-primary text-background" : ""}`}
                    onClick={() => setSelectedDocId(doc.id)}
                  >
                    {doc.label}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </aside>
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-12 gap-8">
        <Separator className="my-8 w-full max-w-xl" />
        {/* Processed Thoughts for selected document */}
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold mb-4 text-foreground">Processed Thoughts</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDoc && <div className="text-muted-foreground">Select a document to view its thoughts.</div>}
            {selectedDoc && selectedDoc.thoughts.length === 0 && (
              <div className="text-muted-foreground">No processed thoughts for this document.</div>
            )}
            {selectedDoc && selectedDoc.thoughts.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={selectedDoc.thoughts.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="flex flex-col gap-2">
                    {selectedDoc.thoughts.map((thought) => (
                      <SortableThoughtItem key={thought.id} thought={thought} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
        <footer className="mt-auto text-xs text-muted-foreground py-4 text-center opacity-70 w-full">
          Built with Next.js. Your notes are private and stored only in your browser.
        </footer>
      </main>
    </div>
  );
}
