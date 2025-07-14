from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---

class Thought(BaseModel):
    id: int
    content: str

class ProcessedThought(BaseModel):
    id: int
    content: str
    destination: str

class Document(BaseModel):
    id: int
    label: str
    thoughts: List[ProcessedThought]

class ThoughtCreate(BaseModel):
    content: str

# --- In-memory storage (for demo purposes) ---

thoughts_db: List[Thought] = []
processed_thoughts_db: List[ProcessedThought] = []
documents_db: List[Document] = []

# --- Endpoints ---

@app.post("/thoughts/", response_model=Thought)
def create_thought(thought: ThoughtCreate):
    new_id = (thoughts_db[-1].id + 1) if thoughts_db else 1
    new_thought = Thought(id=new_id, content=thought.content)
    print(f"Received thought: {new_thought}")  # Debug print
    thoughts_db.append(new_thought)
    return new_thought

@app.get("/thoughts/", response_model=List[Thought])
def list_thoughts():
    return thoughts_db

@app.post("/processed_thoughts/", response_model=ProcessedThought)
def process_thought(thought: Thought):
    # Placeholder: In reality, call OpenAI to label the thought
    destination = "example_destination"  # Dummy label
    processed = ProcessedThought(id=thought.id, content=thought.content, destination=destination)
    processed_thoughts_db.append(processed)
    return processed

@app.get("/processed_thoughts/", response_model=List[ProcessedThought])
def list_processed_thoughts():
    return processed_thoughts_db

@app.post("/documents/", response_model=Document)
def create_document(label: str, thought_ids: List[int]):
    selected_thoughts = [pt for pt in processed_thoughts_db if pt.id in thought_ids]
    if not selected_thoughts:
        raise HTTPException(status_code=404, detail="No processed thoughts found for given IDs")
    doc = Document(id=len(documents_db)+1, label=label, thoughts=selected_thoughts)
    documents_db.append(doc)
    return doc

@app.get("/documents/", response_model=List[Document])
def list_documents():
    return documents_db
