# What OpenClawd (The AI Core) Does

OpenClawd acts as the **Intelligence Layer** of your Dukan Sathi application. It bridges the gap between natural language (what you say) and structured data (your database).

## Core Responsibilities Diagram

```mermaid
graph TB
    subgraph "OpenClawd Intelligence Core"
        direction TB
        Input[User Request] --> Intent{Understand Intent}
        
        Intent -- "Who is X?" --> Identity[Identity Engine]
        Intent -- "How much for X?" --> Business[SQL Generator]
        Intent -- "Create Invoice..." --> Action[Action Planner]
        Intent -- "Hi/Hello" --> Chat[Conversational AI]
        
        subgraph "Capabilities"
            Identity -->|Self-Aware| Response["I am Sathi AI"]
            Business -->|Text-to-SQL| Query["SELECT * FROM sales..."]
            Action -->|Parallel Search| Draft["Create JSON Draft"]
            Chat -->|Persona| Reply["Friendly Response"]
        end
        
        Query --> DB[(Database Execution)]
        Draft --> Frontend[Frontend Action Card]
    end
```

## Key Functions

### 1. Intent Recognition (The Brain)
It decides *what* you are asking for.
-   **Conversation:** "Hello", "How are you?" -> Routed to Chat.
-   **Data Query:** "Show me sales" -> Routed to SQL Generator.
-   **Action:** "Create bill" -> Routed to Action Planner.

### 2. Parallel Data Fetching (The Speed)
When you ask for complex actions (e.g., "Bill for Rahul: 2 Rice, 1 Oil"), OpenClawd now:
-   Splits the request into parts.
-   **Fetches all product details simultaneously** (Parallel Execution).
-   Assembles the final draft instantly.

### 3. Verification & Safety
-   It ensures you don't execute dangerous SQL commands.
-   It verifies products exist before adding them to a bill.
-   It formats data strictly as JSON for the frontend to render.
