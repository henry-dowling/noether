from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Table
from sqlalchemy.orm import relationship
from db import Base
import enum

class DestinationEnum(str, enum.Enum):
    reading_list = "Reading list"
    todos = "Todos"
    blog = "Blog"
    calendar = "Calendar"

class Thought(Base):
    __tablename__ = "thoughts"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)

class ProcessedThought(Base):
    __tablename__ = "processed_thoughts"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
    destination = Column(Enum(DestinationEnum), nullable=False)
    created_at = Column(DateTime, nullable=False)
    order = Column(Integer, nullable=False)

# Optional: Document and many-to-many relationship
association_table = Table(
    'document_thoughts', Base.metadata,
    Column('document_id', Integer, ForeignKey('documents.id')),
    Column('thought_id', Integer, ForeignKey('processed_thoughts.id'))
)

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, nullable=False)
    thoughts = relationship("ProcessedThought", secondary=association_table) 