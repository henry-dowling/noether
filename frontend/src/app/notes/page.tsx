"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
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
  order: number;
}

export default function Home() {
  const [destinations, setDestinations] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Processed thoughts state (from backend)
  const [processedThoughts, setProcessedThoughts] = useState<ProcessedThought[]>([]);
  const [editThoughtId, setEditThoughtId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // Destination view state
  const [selectedDestination, setSelectedDestination] = useState<string | null>("__all__");
  const [isUserActive, setIsUserActive] = useState(false);

  // Spotlight modal state
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [spotlightInput, setSpotlightInput] = useState("");
  const spotlightInputRef = useRef<HTMLTextAreaElement>(null);
  // Search bar state
  const [searchQuery, setSearchQuery] = useState("");

  // Add state for new note input at the bottom
  const [newNoteInput, setNewNoteInput] = useState("");
  const newNoteInputRef = useRef<HTMLTextAreaElement>(null);
  // Mobile add note modal state
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);

  // Add state for sorting mode
  const [sortMode, setSortMode] = useState<'manual' | 'chronological'>('manual');
  const [showSidebar, setShowSidebar] = useState(false); // For mobile sidebar
  // Mobile move modal state
  const [moveModal, setMoveModal] = useState<{ open: boolean, thought: ProcessedThought | null }>({ open: false, thought: null });

  // Get thoughts for selected destination, sorted by chosen mode
  const destinationThoughts = selectedDestination === "__all__"
    ? processedThoughts
    : selectedDestination
      ? processedThoughts.filter(thought => thought.destination === selectedDestination)
      : [];
  let sortedDestinationThoughts: ProcessedThought[];
  if (sortMode === 'manual') {
    // Manual order (drag-and-drop)
    sortedDestinationThoughts = [...destinationThoughts].sort((a, b) => b.order - a.order);
  } else {
    // Reverse chronological
    sortedDestinationThoughts = [...destinationThoughts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  // Filtered by search
  const filteredThoughts = searchQuery.trim() === ""
    ? sortedDestinationThoughts
    : sortedDestinationThoughts.filter(thought =>
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
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // If dropped on a destination (sidebar)
    if (over.id && typeof over.id === 'string' && destinations.includes(over.id)) {
      const thought = processedThoughts.find(t => t.id === active.id);
      if (!thought) return;
      // Update backend with new destination
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      if (!API_URL) {
        throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
      }
      await fetch(`${API_URL}/processed_thoughts/${thought.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...thought, destination: over.id })
      });
      await refreshProcessedThoughts();
      return;
    }

    // Reordering within a destination
    const oldIndex = sortedDestinationThoughts.findIndex((t) => t.id === active.id);
    const newIndex = sortedDestinationThoughts.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newThoughts = arrayMove(sortedDestinationThoughts, oldIndex, newIndex);

    // Assign highest order to top, descending
    const maxOrder = newThoughts.length > 0 ? Math.max(...newThoughts.map(t => t.order)) : 0;
    const ordered_ids = newThoughts.map((t, idx) => ({ id: t.id, order: maxOrder - idx }));

    // Send new order to backend
    await Promise.all(ordered_ids.map(async ({ id, order }) => {
      const thought = processedThoughts.find(t => t.id === id);
      if (thought) {
        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        if (!API_URL) {
          throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
        }
        await fetch(`${API_URL}/processed_thoughts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...thought, order })
        });
      }
    }));

    // Refresh from backend
    await refreshProcessedThoughts();
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
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      if (!API_URL) {
        throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
      }
      const res = await fetch(`${API_URL}/processed_thoughts/${thought.id}`, {
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
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      if (!API_URL) {
        throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
      }
      const res = await fetch(`${API_URL}/processed_thoughts/${thoughtId}`, {
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
  const refreshProcessedThoughts = useCallback(async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      if (!API_URL) {
        throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
      }
      const res = await fetch(`${API_URL}/processed_thoughts/`);
      if (res.ok) {
        const data = await res.json();
        setProcessedThoughts(data);
      } else {
        console.error("Failed to fetch processed thoughts");
      }
    } catch (err) {
      console.error("Error refreshing processed thoughts:", err);
    }
  }, []);

  // Add note to specific destination
  const handleAddNoteToDestination = async (content: string) => {
    if (!selectedDestination || selectedDestination === "__all__") return;
    if (content.trim()) {
      setIsUserActive(true);
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      if (!API_URL) {
        throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
      }
      const res = await fetch(`${API_URL}/thoughts/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: content.trim(), destination: selectedDestination })
      });
      if (res.ok) {
        await refreshProcessedThoughts();
        setNewNoteInput("");
        newNoteInputRef.current?.focus();
        setIsUserActive(false);
      } else {
        alert("Failed to add note");
        setIsUserActive(false);
      }
    }
  };

  // Helper to move a thought to a new destination
  const moveThoughtToDestination = async (thought: ProcessedThought, destination: string) => {
    if (thought.destination === destination) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    if (!API_URL) {
      throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
    }
    await fetch(`${API_URL}/processed_thoughts/${thought.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...thought, destination })
    });
    await refreshProcessedThoughts();
    setMoveModal({ open: false, thought: null });
  };

  // Sortable Thought Item
  function SortableThoughtItem({ thought }: { thought: ProcessedThought }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      setActivatorNodeRef,
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
    // Detect mobile/desktop for drag handle logic
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }, []);
    // Format date
    const dateStr = thought.created_at ? new Date(thought.created_at).toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }) : "";
    // Mobile long-press handler for move icon
    const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
    return (
      <li
        ref={setNodeRef}
        style={style}
        {...attributes}
        className="bg-white dark:bg-black/30 border border-border rounded px-4 py-3 shadow-sm flex flex-col gap-1 group relative overflow-hidden"
        onTouchStart={(e) => {
          if (window.innerWidth >= 768) return;
          // Only allow long-press if not on drag handle or delete button
          const target = e.target as HTMLElement;
          if (target.closest('.drag-handle') || target.closest('.delete-button')) return;
          // Long press for move modal
          if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
          longPressTimeout.current = setTimeout(() => {
            setMoveModal({ open: true, thought });
          }, 500);
        }}
        onTouchEnd={(e) => {
          if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
        }}
        {...(!isMobile ? listeners : {})}
      >
        <div className="flex flex-row items-start justify-between w-full">
          <span className="hidden md:inline mt-1 mb-1 px-2 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
            {thought.destination}
          </span>
          {/* Timestamp: only visible on desktop on hover/focus */}
          <div
            className={
              `hidden md:flex ml-2 text-xs text-muted-foreground whitespace-nowrap items-center transition-opacity duration-150 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`
            }
            style={{ minWidth: 80 }}
          >
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
          {/* Delete button: only render on desktop (md and up), only visible on hover/focus */}
          {!isMobile && (
            <button
              className={
                `ml-2 text-gray-400 hover:text-gray-600 text-lg font-bold px-2 py-0.5 rounded focus:outline-none transition-opacity duration-150 delete-button opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`
              }
              title="Delete thought"
              onClick={async (e) => {
                e.stopPropagation();
                await deleteThought(thought.id);
              }}
            >
              ×
            </button>
          )}
          {/* Drag handle: only visible on mobile and manual sort mode, right side, vertically centered */}
          {isMobile && sortMode === 'manual' && (
            <span
              className="drag-handle flex items-center ml-2 text-gray-300 select-none md:hidden cursor-grab"
              ref={setActivatorNodeRef}
              {...listeners}
              style={{ touchAction: 'none' }}
              tabIndex={-1}
              aria-label="Drag to reorder"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="6" cy="7" r="1.1" fill="currentColor"/>
                <circle cx="6" cy="13" r="1.1" fill="currentColor"/>
                <circle cx="10" cy="7" r="1.1" fill="currentColor"/>
                <circle cx="10" cy="13" r="1.1" fill="currentColor"/>
                <circle cx="14" cy="7" r="1.1" fill="currentColor"/>
                <circle cx="14" cy="13" r="1.1" fill="currentColor"/>
              </svg>
            </span>
          )}
        </div>
      </li>
    );
  }

  // Highlight destination on drag-over
  function DestinationDropTarget({ destination, children }: { destination: string, children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: destination });
    return (
      <div
        ref={setNodeRef}
        className={
          isOver
            ? 'ring-2 ring-primary ring-offset-2 bg-primary/10 transition-all duration-150'
            : ''
        }
      >
        {children}
      </div>
    );
  }

  // Refactor addNote logic so it can be reused
  const handleAddNote = useCallback(
    async (content: string) => {
      if (content.trim()) {
        setIsUserActive(true);

        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        if (!API_URL) {
          throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
        }

        const res = await fetch(`${API_URL}/thoughts/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: content.trim() })
        });
        if (res.ok) {
          await refreshProcessedThoughts();
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
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    if (!API_URL) {
      throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
    }
    fetch(`${API_URL}/destinations/`)
      .then(res => res.json())
      .then(data => setDestinations(data))
      .catch(err => console.error("Failed to fetch destinations:", err));
    
    // Fetch processed thoughts from backend
    refreshProcessedThoughts();
  }, [refreshProcessedThoughts]);

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
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
                  ref={spotlightInputRef}
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
        {/* Mobile sidebar toggle and add note buttons */}
        <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-row gap-3">
          <button
            className="p-3 rounded-full bg-primary text-background shadow-lg focus:outline-none"
            onClick={() => setShowSidebar((prev) => !prev)}
            aria-label={showSidebar ? "Close sidebar" : "Open sidebar"}
          >
            {/* Hamburger icon */}
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="10" x2="24" y2="10" /><line x1="4" y1="16" x2="24" y2="16" /></svg>
          </button>
          <button
            className="p-3 rounded-full bg-primary text-background shadow-lg focus:outline-none"
            onClick={() => setShowAddNoteModal(true)}
            aria-label="Add note"
          >
            {/* Plus icon */}
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="14" y1="6" x2="14" y2="22" /><line x1="6" y1="14" x2="22" y2="14" /></svg>
          </button>
        </div>
        {/* Sidebar (hidden on mobile, visible on md+) */}
        <aside className="w-72 min-h-screen border-r border-border bg-white dark:bg-black/40 flex flex-col p-4 gap-2 hidden md:flex">
          {/* Destinations Section */}
          <Card className="shadow-none border-none bg-transparent">
            <CardHeader className="p-0 mb-2">
              <CardTitle className="text-xl font-bold text-foreground">Lists</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="flex flex-col gap-1">
                <li>
                  <DestinationDropTarget destination="__all__">
                    <Button
                      variant={selectedDestination === "__all__" ? "default" : "ghost"}
                      className={`w-full justify-start text-sm ${selectedDestination === "__all__" ? "bg-primary text-background" : ""}`}
                      onClick={() => setSelectedDestination("__all__")}
                    >
                      All Notes
                    </Button>
                  </DestinationDropTarget>
                </li>
                {destinations.length === 0 && (
                  <li className="text-muted-foreground select-none">No destinations</li>
                )}
                {destinations.map((destination, index) => (
                  <li key={index}>
                    <DestinationDropTarget destination={destination}>
                      <Button
                        variant={selectedDestination === destination ? "default" : "ghost"}
                        className={`w-full justify-start text-sm ${selectedDestination === destination ? "bg-primary text-background" : ""}`}
                        onClick={() => {
                          setSelectedDestination(destination);
                        }}
                      >
                        {destination}
                      </Button>
                    </DestinationDropTarget>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
        {/* Mobile Sidebar Drawer */}
        {showSidebar && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSidebar(false)} />
            {/* Sidebar content */}
            <aside className="relative w-64 max-w-full min-h-screen bg-white dark:bg-black/90 border-r border-border flex flex-col p-4 gap-2 z-50 animate-slide-in-left">
              <Card className="shadow-none border-none bg-transparent">
                <CardHeader className="p-0 mb-2">
                  <CardTitle className="text-xl font-bold text-foreground">Lists</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="flex flex-col gap-1">
                    <li>
                      <DestinationDropTarget destination="__all__">
                        <Button
                          variant={selectedDestination === "__all__" ? "default" : "ghost"}
                          className={`w-full justify-start text-sm ${selectedDestination === "__all__" ? "bg-primary text-background" : ""}`}
                          onClick={() => {
                            setSelectedDestination("__all__");
                            if (typeof window !== 'undefined' && window.innerWidth < 768) {
                              setShowSidebar(false);
                            }
                          }}
                        >
                          All Notes
                        </Button>
                      </DestinationDropTarget>
                    </li>
                    {destinations.length === 0 && (
                      <li className="text-muted-foreground select-none">No destinations</li>
                    )}
                    {destinations.map((destination, index) => (
                      <li key={index}>
                        <DestinationDropTarget destination={destination}>
                          <Button
                            variant={selectedDestination === destination ? "default" : "ghost"}
                            className={`w-full justify-start text-sm ${selectedDestination === destination ? "bg-primary text-background" : ""}`}
                            onClick={() => {
                              setSelectedDestination(destination);
                              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                setShowSidebar(false);
                              }
                            }}
                          >
                            {destination}
                          </Button>
                        </DestinationDropTarget>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
        {/* Main content */}
        <main className="flex-1 flex flex-col items-center justify-start px-4 py-12 gap-8">
          {/* Search Bar */}
          <div className="w-full max-w-xl flex flex-row items-center gap-0 mb-0 md:gap-2 md:mb-2 h-10 md:h-auto">
            <input
              type="text"
              className="flex-1 h-full px-2 py-0 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:px-3 md:py-2 md:text-base md:text-left"
              placeholder="Find your notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {/* Processed Thoughts for selected destination (no Card) */}
          <div className="w-full max-w-xl flex flex-col gap-1 md:gap-4">
            <div className="text-2xl font-semibold mb-4 text-foreground flex items-center justify-between gap-4">
              <span>
                {selectedDestination === "__all__"
                  ? 'All Notes'
                  : selectedDestination
                    ? `${selectedDestination}`
                    : 'Notes'}
              </span>
              {/* Toggle sort mode button (right side, small, icon) */}
              <button
                className="ml-2 p-1.5 rounded border border-border text-muted-foreground bg-background hover:bg-primary/20 hover:text-primary hover:border-primary transition-colors transition-shadow duration-150 flex items-center justify-center text-base shadow-sm group"
                style={{ fontSize: '1.1rem' }}
                onClick={() => setSortMode(sortMode === 'manual' ? 'chronological' : 'manual')}
                title={sortMode === 'manual' ? 'Switch to reverse chronological order' : 'Switch to manual order'}
              >
                {/* Icon matches the current mode */}
                <span className="transition-transform duration-150 group-hover:rotate-12">
                {sortMode === 'manual' ? (
                  // Manual/drag handle icon (six dots)
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="6" cy="7" r="1.2" fill="currentColor"/>
                    <circle cx="6" cy="13" r="1.2" fill="currentColor"/>
                    <circle cx="10" cy="7" r="1.2" fill="currentColor"/>
                    <circle cx="10" cy="13" r="1.2" fill="currentColor"/>
                    <circle cx="14" cy="7" r="1.2" fill="currentColor"/>
                    <circle cx="14" cy="13" r="1.2" fill="currentColor"/>
                  </svg>
                ) : (
                  // Clock/chronological icon
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
                </span>
              </button>
            </div>
            {/* Desktop new note entry box remains at the top */}
            <form
              className="mb-1 md:mb-4 hidden md:block"
              onSubmit={async (e) => {
                e.preventDefault();
                if (selectedDestination === "__all__") {
                  // All Notes: let backend categorize
                  if (newNoteInput.trim()) {
                    setIsUserActive(true);
                    const API_URL = process.env.NEXT_PUBLIC_API_URL;
                    if (!API_URL) {
                      throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
                    }
                    const res = await fetch(`${API_URL}/thoughts/`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ content: newNoteInput.trim() })
                    });
                    if (res.ok) {
                      await refreshProcessedThoughts();
                      setNewNoteInput("");
                      newNoteInputRef.current?.focus();
                      setIsUserActive(false);
                    } else {
                      alert("Failed to add note");
                      setIsUserActive(false);
                    }
                  }
                } else {
                  await handleAddNoteToDestination(newNoteInput);
                }
              }}
            >
              <div className="bg-white dark:bg-black/30 border border-border rounded px-3 py-1 md:px-4 md:py-3 shadow-sm flex flex-col gap-1 group">
                <textarea
                  ref={newNoteInputRef}
                  className="flex-1 bg-transparent border-none focus:outline-none text-foreground font-medium text-sm md:text-base resize-none min-h-[28px] max-h-28 md:min-h-[32px] md:max-h-32 placeholder:text-muted-foreground pt-2 md:pt-0"
                  placeholder={selectedDestination === "__all__" ? "Add a note..." : `Add a note to '${selectedDestination}'`}
                  value={newNoteInput}
                  onChange={e => setNewNoteInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (selectedDestination === "__all__") {
                        if (newNoteInput.trim()) {
                          setIsUserActive(true);
                          const API_URL = process.env.NEXT_PUBLIC_API_URL;
                          if (!API_URL) {
                            throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
                          }
                          const res = await fetch(`${API_URL}/thoughts/`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ content: newNoteInput.trim() })
                          });
                          if (res.ok) {
                            await refreshProcessedThoughts();
                            setNewNoteInput("");
                            newNoteInputRef.current?.focus();
                            setIsUserActive(false);
                          } else {
                            alert("Failed to add note");
                            setIsUserActive(false);
                          }
                        }
                      } else {
                        await handleAddNoteToDestination(newNoteInput);
                      }
                    }
                  }}
                  rows={1}
                />
              </div>
            </form>
            {selectedDestination === null && (
              <div className="text-muted-foreground">Select a list to view its notes.</div>
            )}
            {selectedDestination !== null && filteredThoughts.length === 0 && (
              <div className="text-muted-foreground">No notes found for this list.</div>
            )}
            {selectedDestination !== null && filteredThoughts.length > 0 && (
              sortMode === 'manual' ? (
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
              ) : (
                <ul className="flex flex-col gap-2">
                  {filteredThoughts.map((thought) => (
                    <SortableThoughtItem key={thought.id} thought={thought} />
                  ))}
                </ul>
              )
            )}
          </div>
          <footer className="mt-auto text-xs text-muted-foreground py-4 text-center opacity-70 w-full">
            Noether: Think It. Capture It.
          </footer>
        </main>
        {/* Mobile Move Modal */}
        {moveModal.open && moveModal.thought && (
          <div className="fixed inset-0 z-50 flex items-end md:hidden bg-black/40 backdrop-blur-sm" onClick={() => setMoveModal({ open: false, thought: null })}>
            <div className="w-full bg-white dark:bg-black/90 rounded-t-2xl p-4 pb-8 shadow-2xl border-t border-border" onClick={e => e.stopPropagation()}>
              <div className="text-lg font-semibold mb-4 text-foreground text-center">Move to...</div>
              <ul className="flex flex-col gap-2">
                {destinations.map((destination, idx) => (
                  <li key={destination}>
                    <button
                      className={`w-full px-4 py-2 rounded text-left ${moveModal.thought && moveModal.thought.destination === destination ? 'bg-primary text-background' : 'hover:bg-primary/10'}`}
                      onClick={() => moveModal.thought && moveThoughtToDestination(moveModal.thought, destination)}
                    >
                      {destination}
                    </button>
                  </li>
                ))}
              </ul>
              <button className="mt-6 w-full py-2 rounded bg-muted text-foreground font-medium" onClick={() => setMoveModal({ open: false, thought: null })}>Cancel</button>
              {/* Delete note button */}
              {moveModal.thought && (
                <button
                  className="mt-3 w-full py-2 rounded bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition disabled:opacity-50"
                  onClick={async () => {
                    if (moveModal.thought?.id) {
                      await deleteThought(moveModal.thought.id);
                    }
                    setMoveModal({ open: false, thought: null });
                  }}
                >
                  Delete Note
                </button>
              )}
            </div>
          </div>
        )}
        {/* Mobile Add Note Modal */}
        {showAddNoteModal && (
          <div className="fixed inset-0 z-50 flex items-end md:hidden bg-black/40 backdrop-blur-sm" onClick={() => setShowAddNoteModal(false)}>
            <div className="w-full bg-white dark:bg-black/90 rounded-t-2xl p-4 pb-8 shadow-2xl border-t border-border" onClick={e => e.stopPropagation()}>
              <div className="text-lg font-semibold mb-4 text-foreground text-center">Add a Note</div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (selectedDestination === "__all__") {
                    if (newNoteInput.trim()) {
                      setIsUserActive(true);
                      const API_URL = process.env.NEXT_PUBLIC_API_URL;
                      if (!API_URL) {
                        throw new Error("NEXT_PUBLIC_API_URL is not set in the environment variables.");
                      }
                      const res = await fetch(`${API_URL}/thoughts/`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content: newNoteInput.trim() })
                      });
                      if (res.ok) {
                        await refreshProcessedThoughts();
                        setNewNoteInput("");
                        setShowAddNoteModal(false);
                        setIsUserActive(false);
                      } else {
                        alert("Failed to add note");
                        setIsUserActive(false);
                      }
                    }
                  } else {
                    await handleAddNoteToDestination(newNoteInput);
                    setShowAddNoteModal(false);
                  }
                }}
              >
                <textarea
                  ref={newNoteInputRef}
                  className="w-full bg-transparent border border-border rounded px-3 py-2 focus:outline-none text-foreground font-medium text-base resize-none min-h-[40px] max-h-40 placeholder:text-muted-foreground mb-4"
                  placeholder={selectedDestination === "__all__" ? "Add a note..." : `Add a note to '${selectedDestination}'`}
                  value={newNoteInput}
                  onChange={e => setNewNoteInput(e.target.value)}
                  rows={3}
                  autoFocus
                />
                <button type="submit" className="w-full py-2 rounded bg-primary text-background font-semibold shadow hover:bg-primary/90 transition disabled:opacity-50">Add</button>
                <button type="button" className="mt-2 w-full py-2 rounded bg-muted text-foreground font-medium" onClick={() => setShowAddNoteModal(false)}>Cancel</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
