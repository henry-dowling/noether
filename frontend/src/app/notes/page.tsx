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
  
  // Processed thoughts state (from backend)
  const [processedThoughts, setProcessedThoughts] = useState<ProcessedThought[]>([]);
  const [loadingThoughts, setLoadingThoughts] = useState(false);
  const [errorThoughts, setErrorThoughts] = useState<string | null>(null);
  const [editThoughtId, setEditThoughtId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // Destination view state
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [isUserActive, setIsUserActive] = useState(false);

  // Get thoughts for selected destination
  const destinationThoughts = selectedDestination 
    ? processedThoughts.filter(thought => thought.destination === selectedDestination)
    : [];

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
    
    if (!over || active.id === over.id) return;
    
    const activeThought = destinationThoughts.find(t => t.id === active.id);
    const overThought = destinationThoughts.find(t => t.id === over.id);
    
    if (!activeThought || !overThought) return;
    
    const oldIndex = destinationThoughts.findIndex((t) => t.id === active.id);
    const newIndex = destinationThoughts.findIndex((t) => t.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Set user as active during drag operation
    setIsUserActive(true);
    
    // For destination view, we'll just reorder the display
    // The actual reordering would need to be handled by the backend
    // For now, we'll just update the display order
    const newThoughts = arrayMove(destinationThoughts, oldIndex, newIndex);
    // Note: This is a simplified implementation for destination view
    // In a real app, you'd want to persist the order to the backend
    
    // Clear user activity after a short delay to allow for the drag to complete
    setTimeout(() => setIsUserActive(false), 1000);
  };

  // Handle edit
  const startEdit = (thought: ProcessedThought) => {
    setEditThoughtId(thought.id);
    setEditValue(thought.content);
    setIsUserActive(true);
  };
  
  const saveEdit = async (thought: ProcessedThought) => {
    try {
      // Update thought in backend
      const res = await fetch(`http://localhost:8000/processed_thoughts/${thought.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...thought,
          content: editValue
        })
      });
      
      if (res.ok) {
        // Update local state
        setProcessedThoughts((thoughts) =>
          thoughts.map((t) =>
            t.id === thought.id ? { ...t, content: editValue } : t
          )
        );
        setEditThoughtId(null);
        setEditValue("");
        setIsUserActive(false);
      } else {
        console.error("Failed to update thought");
        alert("Failed to update thought");
        setIsUserActive(false);
      }
    } catch (err) {
      console.error("Error updating thought:", err);
      alert("Error updating thought");
      setIsUserActive(false);
    }
  };

  // Handle delete
  const deleteThought = async (thoughtId: number) => {
    try {
      // Delete thought from backend
      const res = await fetch(`http://localhost:8000/processed_thoughts/${thoughtId}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        // Update local state
        setProcessedThoughts((thoughts) =>
          thoughts.filter((t) => t.id !== thoughtId)
        );
      } else {
        console.error("Failed to delete thought");
        alert("Failed to delete thought");
      }
    } catch (err) {
      console.error("Error deleting thought:", err);
      alert("Error deleting thought");
    }
  };

  // Function to refresh processed thoughts from backend
  const refreshProcessedThoughts = async () => {
    try {
      const res = await fetch("http://localhost:8000/processed_thoughts/");
      if (res.ok) {
        const data = await res.json();
        setProcessedThoughts(data);
      } else {
        console.error("Failed to fetch processed thoughts");
      }
    } catch (err) {
      console.error("Error refreshing processed thoughts:", err);
    }
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
            onBlur={async () => await saveEdit(thought)}
            onKeyDown={async (e) => {
              if (e.key === "Enter") await saveEdit(thought);
              if (e.key === "Escape") {
                setEditThoughtId(null);
                setEditValue("");
                setIsUserActive(false);
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
          onClick={async (e) => {
            e.stopPropagation();
            await deleteThought(thought.id);
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
      setIsUserActive(true);
      // POST to backend
      const res = await fetch("http://localhost:8000/thoughts/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: input.trim() })
      });
      if (res.ok) {
        const newProcessedThought: ProcessedThought = await res.json();
        // Refresh the processed thoughts to get the latest data
        await refreshProcessedThoughts();
        setInput("");
        inputRef.current?.focus();
        setIsUserActive(false);
      } else {
        // Handle error (optional)
        alert("Failed to add note");
        setIsUserActive(false);
      }
    }
  }

  // Fetch data from backend 
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

    setLoadingThoughts(true);
    setErrorThoughts(null);

    // Fetch processed thoughts from backend
    fetch("http://localhost:8000/processed_thoughts/")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch processed thoughts");
        return res.json();
      })
      .then((data) => {
        setProcessedThoughts(data);
      })
      .catch((err) => setErrorThoughts(err.message))
      .finally(() => setLoadingThoughts(false));
    
  }, []);

  // Polling effect to refresh processed thoughts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isUserActive) {
        refreshProcessedThoughts();
      }
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [isUserActive]);

  return (
    <div className="min-h-screen flex flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-72 min-h-screen border-r border-border bg-white dark:bg-black/40 flex flex-col p-4 gap-2">
        {/* Destinations Section */}
        <Card className="shadow-none border-none bg-transparent">
          <CardHeader className="p-0 mb-2">
            <CardTitle className="text-xl font-bold text-foreground">Destinations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="flex flex-col gap-1">
              {destinations.length === 0 && (
                <li className="text-muted-foreground select-none">No destinations</li>
              )}
              {destinations.map((destination, index) => (
                <li key={index}>
                  <Button
                    variant={selectedDestination === destination ? "default" : "ghost"}
                    className={`w-full justify-start text-sm ${selectedDestination === destination ? "bg-primary text-background" : ""}`}
                    onClick={() => {
                      setSelectedDestination(destination);
                    }}
                  >
                    {destination}
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
        {/* Processed Thoughts for selected destination */}
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold mb-4 text-foreground">
              {selectedDestination 
                ? `Thoughts for "${selectedDestination}"` 
                : 'Processed Thoughts'
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDestination && (
              <div className="text-muted-foreground">Select a destination to view its thoughts.</div>
            )}
            {selectedDestination && destinationThoughts.length === 0 && (
              <div className="text-muted-foreground">No thoughts found for this destination.</div>
            )}
            {selectedDestination && destinationThoughts.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={destinationThoughts.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="flex flex-col gap-2">
                    {destinationThoughts.map((thought) => (
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
