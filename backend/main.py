from fastapi import FastAPI, HTTPException, Body, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from enum import Enum
import os
import httpx
from dotenv import load_dotenv
from datetime import datetime
from db import Base, engine, SessionLocal
from models import Thought as ThoughtModel, ProcessedThought as ProcessedThoughtModel, DestinationEnum, Document
from openai import OpenAI

load_dotenv()

app = FastAPI()

# Telegram tokens
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")  # set this in your .env or env vars
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/"


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://noether.to", "https://www.noether.to"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create all tables
Base.metadata.create_all(bind=engine)

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
    order: int

class Document(BaseModel):
    id: int
    label: str
    thoughts: List[ProcessedThought]

class ThoughtCreate(BaseModel):
    content: str
    destination: Optional[str] = None  # Allow client to specify destination
    order: Optional[int] = None        # Allow client to specify order

# --- In-memory storage (for demo purposes) ---

# --- Endpoints ---

# Dependency to get DB session

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/thoughts/", response_model=ProcessedThought)
def create_thought(thought: ThoughtCreate, db: SessionLocal = Depends(get_db)):
    now = datetime.utcnow()
    new_thought = ThoughtModel(content=thought.content, created_at=now)
    db.add(new_thought)
    db.commit()
    db.refresh(new_thought)
    # Use provided destination if present, else OpenAI
    if thought.destination is not None:
        destination = thought.destination
    else:
        destination = categorize_thought_with_openai(new_thought.content)
    # Use provided order if present, else max+1
    if thought.order is not None:
        order = thought.order
    else:
        max_order = db.query(ProcessedThoughtModel).filter(ProcessedThoughtModel.destination == destination).order_by(ProcessedThoughtModel.order.desc()).first()
        order = (max_order.order + 1) if max_order else 0
    processed = ProcessedThoughtModel(
        id=new_thought.id,
        content=new_thought.content,
        destination=destination,
        created_at=now,
        order=order
    )
    db.add(processed)
    db.commit()
    db.refresh(processed)
    return processed

@app.get("/thoughts/", response_model=List[Thought])
def list_thoughts(db: SessionLocal = Depends(get_db)):
    return db.query(ThoughtModel).all()

@app.post("/processed_thoughts/", response_model=ProcessedThought)
def process_thought(thought: Thought, db: SessionLocal = Depends(get_db)):
    # Placeholder: In reality, call OpenAI to label the thought
    destination = "example_destination"  # Dummy label
    now = getattr(thought, 'created_at', datetime.utcnow())
    processed = ProcessedThoughtModel(id=thought.id, content=thought.content, destination=destination, created_at=now, order=0)
    db.add(processed)
    db.commit()
    db.refresh(processed)
    return processed

@app.get("/processed_thoughts/", response_model=List[ProcessedThought])
def list_processed_thoughts(db: SessionLocal = Depends(get_db)):
    return db.query(ProcessedThoughtModel).order_by(ProcessedThoughtModel.destination, ProcessedThoughtModel.order).all()

@app.put("/processed_thoughts/{thought_id}", response_model=ProcessedThought)
def update_processed_thought(thought_id: int, updated_thought: ProcessedThought, db: SessionLocal = Depends(get_db)):
    processed_thought = db.query(ProcessedThoughtModel).filter(ProcessedThoughtModel.id == thought_id).first()
    if not processed_thought:
        raise HTTPException(status_code=404, detail="Thought not found")

    # If destination changed, set order to end of new destination
    if processed_thought.destination != updated_thought.destination:
        max_order = db.query(ProcessedThoughtModel).filter(ProcessedThoughtModel.destination == updated_thought.destination).order_by(ProcessedThoughtModel.order.desc()).first()
        updated_thought.order = (max_order.order + 1) if max_order else 0

    # Preserve created_at if not provided
    if not hasattr(updated_thought, 'created_at') or updated_thought.created_at is None:
        updated_thought.created_at = processed_thought.created_at

    for key, value in updated_thought.dict(exclude_unset=True).items():
        setattr(processed_thought, key, value)

    db.commit()
    db.refresh(processed_thought)
    return processed_thought

@app.delete("/processed_thoughts/{thought_id}")
def delete_processed_thought(thought_id: int, db: SessionLocal = Depends(get_db)):
    processed_thought = db.query(ProcessedThoughtModel).filter(ProcessedThoughtModel.id == thought_id).first()
    if not processed_thought:
        raise HTTPException(status_code=404, detail="Thought not found")
    db.delete(processed_thought)
    db.commit()
    return {"message": "Thought deleted successfully"}

@app.put("/processed_thoughts/reorder/", response_model=List[ProcessedThought])
def reorder_processed_thoughts(
    destination: str = Body(...),
    ordered_ids: List[int] = Body(...),
    db: SessionLocal = Depends(get_db)
):
    # Only reorder thoughts in the given destination
    reordered = []
    for idx, thought_id in enumerate(ordered_ids):
        processed_thought = db.query(ProcessedThoughtModel).filter(ProcessedThoughtModel.id == thought_id, ProcessedThoughtModel.destination == destination).first()
        if processed_thought:
            processed_thought.order = idx
            reordered.append(processed_thought)
    db.commit()
    return reordered

@app.post("/documents/", response_model=Document)
def create_document(label: str, thought_ids: List[int], db: SessionLocal = Depends(get_db)):
    selected_thoughts = db.query(ProcessedThoughtModel).filter(ProcessedThoughtModel.id.in_(thought_ids)).all()
    if not selected_thoughts:
        raise HTTPException(status_code=404, detail="No processed thoughts found for given IDs")
    doc = Document(id=None, label=label, thoughts=selected_thoughts)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc

@app.get("/documents/", response_model=List[Document])
def list_documents(db: SessionLocal = Depends(get_db)):
    return db.query(Document).all()

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
        client = OpenAI(api_key=api_key)  # No proxies argument!
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


async def send_message(chat_id: int, text: str):
    async with httpx.AsyncClient() as client:
        await client.post(
            TELEGRAM_API_URL + "sendMessage",
            json={"chat_id": chat_id, "text": text}
        )


@app.post("/webhook")
async def telegram_webhook(request: Request, db: SessionLocal = Depends(get_db)):
    print("telegram recieved")
    data = await request.json()
    message = data.get("message", {})
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text")

    if not chat_id or not text:
        return {"ok": True}

    # Create a new Thought from the Telegram message
    thought_data = ThoughtCreate(content=text)
    created = create_thought(thought=thought_data, db=db)

    await send_message(chat_id, f"💡 Added to your {created.destination}: {created.content}")
    return {"ok": True}