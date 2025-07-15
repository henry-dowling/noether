"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  created_at: string;
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
  const [selectedDestination, setSelectedDestination] = useState<string | null>("__all__");
  const [isUserActive, setIsUserActive] = useState(false);

  // Spotlight modal state
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [spotlightInput, setSpotlightInput] = useState("");
  const spotlightInputRef = useRef<HTMLInputElement>(null);
  // Search bar state
  const [searchQuery, setSearchQuery] = useState("");

  // Get thoughts for selected destination
  const destinationThoughts = selectedDestination === "__all__"
    ? processedThoughts
    : selectedDestination
      ? processedThoughts.filter(thought => thought.destination === selectedDestination)
      : [];
  // Filtered by search
  const filteredThoughts = searchQuery.trim() === ""
    ? destinationThoughts
    : destinationThoughts.filter(thought =>
        thought.content.toLowerCase().includes(searchQuery.trim().toLowerCase())
      );

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
        await refreshProcessedThoughts();
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
        await refreshProcessedThoughts();
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
    // Format date
    const dateStr = thought.created_at ? new Date(thought.created_at).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : "";
    return (
      <li
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="bg-white dark:bg-black/30 border border-border rounded px-4 py-3 shadow-sm flex flex-col gap-1 group"
      >
        <div className="flex flex-row items-start justify-between w-full mb-1">
          <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
            {thought.destination}
          </span>
          <div className="text-xs text-muted-foreground ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {dateStr}
          </div>
        </div>
        <div className="flex flex-row items-center gap-2 w-full">
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
          <button
            className="ml-2 text-red-500 hover:text-red-700 text-lg font-bold px-2 py-0.5 rounded focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            title="Delete thought"
            onClick={async (e) => {
              e.stopPropagation();
              await deleteThought(thought.id);
            }}
          >
            ×
          </button>
        </div>
      </li>
    );
  }

  // Refactor addNote logic so it can be reused
  const handleAddNote = useCallback(
    async (content: string) => {
      if (content.trim()) {
        setIsUserActive(true);
        const res = await fetch("http://localhost:8000/thoughts/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: content.trim() })
        });
        if (res.ok) {
          await refreshProcessedThoughts();
          setInput("");
          setSpotlightInput("");
          inputRef.current?.focus();
          setIsUserActive(false);
          setShowSpotlight(false);
        } else {
          alert("Failed to add note");
          setIsUserActive(false);
        }
      }
    },
    [refreshProcessedThoughts]
  );

  // Keyboard shortcut for Spotlight (Cmd+N)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setShowSpotlight(true);
        setTimeout(() => {
          spotlightInputRef.current?.focus();
        }, 10);
      }
      // Close modal on Escape
      if (e.key === "Escape" && showSpotlight) {
        setShowSpotlight(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSpotlight]);

  // Close modal on outside click
  useEffect(() => {
    if (!showSpotlight) return;
    function handleClick(e: MouseEvent) {
      const modal = document.getElementById("spotlight-modal");
      if (modal && !modal.contains(e.target as Node)) {
        setShowSpotlight(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSpotlight]);

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
      {/* Spotlight Modal */}
      {showSpotlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" style={{backdropFilter: 'blur(2px)'}}>
          <div
            id="spotlight-modal"
            className="bg-white dark:bg-black/90 rounded-xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4 border border-border"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-lg font-semibold mb-2 text-foreground">New Note</div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleAddNote(spotlightInput);
              }}
              className="flex flex-row gap-2"
            >
              <textarea
                ref={spotlightInputRef as any}
                className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none min-h-[60px] max-h-40"
                placeholder="Type your note..."
                value={spotlightInput}
                onChange={e => setSpotlightInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Escape") {
                    setShowSpotlight(false);
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    await handleAddNote(spotlightInput);
                  }
                }}
                autoFocus
                rows={3}
              />
              <Button type="submit" className="shrink-0">Add</Button>
            </form>
            <div className="text-xs text-muted-foreground mt-1">Press <kbd>Esc</kbd> to close</div>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <aside className="w-72 min-h-screen border-r border-border bg-white dark:bg-black/40 flex flex-col p-4 gap-2">
        {/* Destinations Section */}
        <Card className="shadow-none border-none bg-transparent">
          <CardHeader className="p-0 mb-2">
            <CardTitle className="text-xl font-bold text-foreground">Lists</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="flex flex-col gap-1">
              <li>
                <Button
                  variant={selectedDestination === "__all__" ? "default" : "ghost"}
                  className={`w-full justify-start text-sm ${selectedDestination === "__all__" ? "bg-primary text-background" : ""}`}
                  onClick={() => setSelectedDestination("__all__")}
                >
                  All Notes
                </Button>
              </li>
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
        {/* Search Bar */}
        <div className="w-full max-w-xl flex flex-row items-center gap-2 mb-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        {/* Processed Thoughts for selected destination (no Card) */}
        <div className="w-full max-w-xl flex flex-col gap-4">
          <div className="text-2xl font-semibold mb-4 text-foreground">
            {selectedDestination === "__all__"
              ? 'All Notes'
              : selectedDestination
                ? `${selectedDestination}`
                : 'Notes'}
          </div>
          {selectedDestination === null && (
            <div className="text-muted-foreground">Select a list to view its notes.</div>
          )}
          {selectedDestination !== null && filteredThoughts.length === 0 && (
            <div className="text-muted-foreground">No notes found for this list.</div>
          )}
          {selectedDestination !== null && filteredThoughts.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredThoughts.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col gap-2">
                  {filteredThoughts.map((thought) => (
                    <SortableThoughtItem key={thought.id} thought={thought} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>
        <footer className="mt-auto text-xs text-muted-foreground py-4 text-center opacity-70 w-full">
          Noether: Think it. Capture it. Organize it.
        </footer>
      </main>
    </div>
  );
}
