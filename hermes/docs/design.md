# Design: Architecture & OOP Overview

## Architecture

### High-level overview
- **UI/Interface layer**: triggers practice flows and renders results.
- **Application layer**: coordinates a practice session (start session, record turns, request next item).
- **Domain layer**: core learning/practice concepts (PracticeItem types, scoring/evaluation rules).
- **Ports (interfaces)**: repositories and external dependencies modeled as interfaces.
- **Adapters (implementations)**: DB/network implementations of ports.

### Architecture diagram
```mermaid
flowchart TB
  UI[UI / Controllers] --> APP[Application Services]
  APP --> DOM[Domain]
  APP --> PORTS[Ports (Interfaces)]
  PORTS --> ADAPT[Adapters (Implementations)]
  ADAPT --> DB[(Persistence)]
  ADAPT --> EXT[(External APIs)]
  DOM -->|pure logic| APP
```
### OOP Design
Class diagram
````mermaid
classDiagram
  class PracticeItem {
    +id: string
    +mode: PracticeMode
    +skill: Skill
    +prompt: string
    +validate(): ValidationResult
    +evaluate(response): EvaluationResult
  }

  class PracticeItemRepository {
    <<interface>>
    +getById(id): PracticeItem
    +search(filters): PracticeItem[]
    +save(item): void
  }

  class PracticeSession {
    +id: string
    +turns: PracticeTurn[]
    +addTurn(turn): void
  }

  class PracticeTurn {
    +itemId: string
    +response: string
    +evaluation: EvaluationResult
  }

  PracticeSession "1" o-- "*" PracticeTurn
  PracticeTurn "*" --> "1" PracticeItem

  PracticeItem <|-- MultipleChoiceItem
  PracticeItem <|-- ClozeItem
  PracticeItem <|-- FreeResponseItem

  PracticeItemRepository ..> PracticeItem
```
