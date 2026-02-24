"""
File: __init__.py
Purpose: Dukan Sathi AI Bot (Moltbot) package initialization
Author: Dukan Sathi Team
Created: 2026-02-05

This package provides the Llama-powered Moltbot agent for Dukan Sathi.
Moltbot is the brain of the app, handling all natural language interactions.
"""

from .agent_graph import process_user_input, clear_user_memory

__version__ = "1.0.0"
__all__ = ["process_user_input", "clear_user_memory"]
