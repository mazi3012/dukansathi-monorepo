# Dukan Sathi AI Bot - Moltbot

**Purpose:** Llama-powered conversational AI brain for Dukan Sathi.

## Overview

Moltbot is the intelligent brain of Dukan Sathi - a Llama-based conversational agent that:
- Understands Hindi and English voice/text commands (Hinglish optimized)
- Generates SQL queries for database operations
- Creates draft invoices, inventory batches, and purchase orders
- Provides business insights and analytics in natural language
- Maintains conversation context for seamless interactions

## Features

- 🧠 **Llama-4** via Vertex AI for intelligent conversations
- 🔄 **LangGraph** for conversation flow orchestration
- 🗄️ **SQL Query Generation** for data retrieval
- 📝 **Draft Management** for user approval workflows
- 🇮🇳 **Hindi/Regional Language** support
- 🎯 **Context-Aware** responses based on business type

## Installation

```bash
# Install package
pip install -e .

# Or install dependencies directly
pip install -r requirements.txt
```

## Usage

```python
from dukansathi_ai import process_user_input

# Process user message
response = await process_user_input(
    text="राज को 500 रुपये का बिल बनाओ",
    user_token="user_supabase_token_here"
)

# Response is natural language (may include draft JSON)
print(response)
# Output: "जी Boss, मैंने राज के लिए बिल तैयार कर दिया है। कृपया approve करें।"
```

## Architecture

```
ai-bot/
├── setup.py               # Package configuration
├── requirements.txt       # Dependencies
├── dukansathi_ai/        # Main package
│   ├── __init__.py
│   ├── agent.py          # Main Claude agent
│   ├── sql_generator.py  # SQL query generation
│   ├── draft_manager.py  # Draft creation logic
│   └── prompts/          # System prompts
│       ├── base_prompt.txt
│       ├── sql_prompt.txt
│       └── hindi_prompt.txt
└── tests/                # Unit tests
```

## Development

```bash
# Run tests
pytest tests/

# Install in development mode
pip install -e .[dev]
```

## License

Proprietary - Dukan Sathi Team 2026
