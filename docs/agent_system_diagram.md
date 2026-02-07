# Dukan Sathi Agentic System Architecture

This diagram visualizes the flow of the Moltbot Agent, highlighting the **new Parallel Search** capability.

```mermaid
graph TD
    User["User Input"] --> Router{"Router Node"}
    
    %% Router Logic
    Router -- "Hi / Hello" --> Greeting["Greeting Logic"]
    Router -- "What can you do?" --> Capability["Capability Logic"]
    Router -- "Who are you?" --> Identity["Identity Logic"]
    Router -- "General Chat" --> ChatAgent["Chat Agent Node"]
    Router -- "Create Invoice or Add Product" --> ActionAgent["Action Agent Node"]
    
    %% Chat Agent Flow
    ChatAgent --> Context{"Has Business Intent?"}
    Context -- No --> LLM_Chat["Gemini 2.0 Flash (General Chat)"]
    Context -- Yes --> SQL_Gen["Generate SQL"]
    SQL_Gen --> DB_Exec[("Supabase DB")]
    DB_Exec --> LLM_Response["Gemini Response"]
    
    %% Action Agent Flow (The Optimization)
    ActionAgent --> Extract["Extract JSON Params"]
    
    subgraph ParallelExec ["PARALLEL EXECUTION (New)"]
        Extract --> Loop{"For Each Item"}
        Loop -->|Item 1| Task1["Async Fetch Product 1"]
        Loop -->|Item 2| Task2["Async Fetch Product 2"]
        Loop -->|Item 3| Task3["Async Fetch Product 3"]
        Loop -->|Customer| TaskCust["Async Fetch Customer"]
        
        Task1 --> Gather["Asyncio Gather"]
        Task2 --> Gather
        Task3 --> Gather
        TaskCust --> Gather
    end
    
    Gather --> Hydrate["Hydrate JSON Draft"]
    Hydrate --> Review["Generate Review Request"]
    
    %% Outputs
    Greeting --> Output["Final Response"]
    Capability --> Output
    Identity --> Output
    LLM_Chat --> Output
    LLM_Response --> Output
    Review --> Output
    
    %% Frontend Handling
    Output --> Frontend["Frontend Chat UI"]
    Frontend -->|"User Approves"| AutoCreate{"Customer Exists?"}
    AutoCreate -- No --> CreateCust["Auto-Create Customer"]
    CreateCust --> Finalize["Finalize Transaction"]
    AutoCreate -- Yes --> Finalize
```

## Key Improvements
1.  **Parallel Execution**: The "Async Fetch" nodes now run simultaneously, reducing wait time from $O(N)$ to $O(1)$.
2.  **Auto-Create**: The Frontend now handles new customers automatically during the approval phase.
