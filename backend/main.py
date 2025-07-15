from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from enum import Enum
import os
import openai
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

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
    created_at: datetime

class DestinationEnum(str, Enum):
    reading_list = "Reading list"
    todos = "Todos"
    blog = "Blog"
    calendar = "Calendar"

class ProcessedThought(BaseModel):
    id: int
    content: str
    destination: DestinationEnum
    created_at: datetime

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

@app.post("/thoughts/", response_model=ProcessedThought)
def create_thought(thought: ThoughtCreate):
    new_id = (thoughts_db[-1].id + 1) if thoughts_db else 1
    now = datetime.utcnow()
    new_thought = Thought(id=new_id, content=thought.content, created_at=now)
    print(f"Received thought: {new_thought}")  # Debug print
    thoughts_db.append(new_thought)
    # Use OpenAI to categorize the thought with Enum
    destination = categorize_thought_with_openai(new_thought.content)
    processed = ProcessedThought(id=new_thought.id, content=new_thought.content, destination=destination, created_at=now)
    processed_thoughts_db.append(processed)
    return processed

@app.get("/thoughts/", response_model=List[Thought])
def list_thoughts():
    return thoughts_db

@app.post("/processed_thoughts/", response_model=ProcessedThought)
def process_thought(thought: Thought):
    # Placeholder: In reality, call OpenAI to label the thought
    destination = "example_destination"  # Dummy label
    now = getattr(thought, 'created_at', datetime.utcnow())
    processed = ProcessedThought(id=thought.id, content=thought.content, destination=destination, created_at=now)
    processed_thoughts_db.append(processed)
    return processed

@app.get("/processed_thoughts/", response_model=List[ProcessedThought])
def list_processed_thoughts():
    return processed_thoughts_db

@app.put("/processed_thoughts/{thought_id}", response_model=ProcessedThought)
def update_processed_thought(thought_id: int, updated_thought: ProcessedThought):
    for i, thought in enumerate(processed_thoughts_db):
        if thought.id == thought_id:
            # Preserve the original created_at if not provided
            if not hasattr(updated_thought, 'created_at') or updated_thought.created_at is None:
                updated_thought.created_at = thought.created_at
            processed_thoughts_db[i] = updated_thought
            return updated_thought
    raise HTTPException(status_code=404, detail="Thought not found")

@app.delete("/processed_thoughts/{thought_id}")
def delete_processed_thought(thought_id: int):
    for i, thought in enumerate(processed_thoughts_db):
        if thought.id == thought_id:
            del processed_thoughts_db[i]
            return {"message": "Thought deleted successfully"}
    raise HTTPException(status_code=404, detail="Thought not found")

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

@app.get("/destinations/", response_model=List[str])
def get_destinations():
    return [e.value for e in DestinationEnum]

def categorize_thought_with_openai(content: str) -> DestinationEnum:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable not set.")
    categories = [e.value for e in DestinationEnum]
    prompt = (
        f"Categorize the following thought into one of these categories: {categories}. "
        f"Return only the category name.\nThought: '{content}'\nCategory:"
    )
    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that categorizes thoughts."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=5,
            temperature=0
        )
        label = response.choices[0].message.content.strip()
        if label in categories:
            return DestinationEnum(label)
        else:
            print(f"OpenAI returned unknown category: {label}")
            return DestinationEnum.reading_list  # Default fallback
    except Exception as e:
        print(f"OpenAI error: {e}")
        return DestinationEnum.reading_list  # Default fallback
