"""
Language Detection for Dukan Sathi
Detects: English, Hinglish, or Bangla (Bengali)
Supports both Roman/Latin script and native scripts (Hindi/Bengali).
"""

import re

def detect_language(text: str) -> str:
    """
    Detect if text is English, Hinglish, or Bangla.

    Args:
        text: Input text to analyze.

    Returns:
        'bangla', 'hinglish', or 'english'
    """
    if not text or not isinstance(text, str):
        return 'english'

    text_lower = text.lower().strip()
    if not text_lower:
        return 'english'

    # 1. Native Script Detection (Fast Path)
    # Bengali script range: \u0980-\u09FF
    if re.search(r'[\u0980-\u09FF]', text):
        return 'bangla'
    
    # Devanagari (Hindi) script range: \u0900-\u097F
    if re.search(r'[\u0900-\u097F]', text):
        return 'hinglish'

    # 2. Romanized Bangla Patterns
    bangla_roman_patterns = [
        'kemon', 'taka', 'dilam', 'nilam', 'hobe', 'koro', 'ami', 'tumi',
        'apni', 'kori', 'kore', 'dakho', 'bolo', 'asho', 'khaba', 'bari',
        'naam', 'ki', 'keno', 'kothay', 'kokhon', 'koto', 'ke',
        'shudhu', 'ekhon', 'pore', 'shathe', 'bangla', 'dada', 'didi'
    ]

    # 3. Hinglish patterns — Hindi words commonly written in Roman script
    hinglish_patterns = [
        'namaste', 'namaskar', 'kaise', 'kya', 'hai', 'ho', 'hain', 'mein',
        'kar', 'karo', 'kare', 'karenge', 'kiya', 'dekho', 'batao', 'dikhao',
        'mujhe', 'tumhe', 'aapko', 'hum', 'tum', 'aap',
        'acha', 'thik', 'bahut', 'bohot', 'thoda', 'kuch', 'koi',
        'kyun', 'kahan', 'kab', 'kitna', 'kaun',
        'rupay', 'rupaye', 'paisa', 'paise', 'lena', 'dena', 'dukaan',
        'bhai', 'yaar', 'boss', 'theek', 'sahi', 'bilkul', 'zaroor',
        'wala', 'wali', 'wale', 'bata', 'dikha', 'nikal', 'gaya', 'diya'
    ]

    # Count matches
    bangla_count = sum(1 for pattern in bangla_roman_patterns if f" {pattern} " in f" {text_lower} ")
    hinglish_count = sum(1 for pattern in hinglish_patterns if f" {pattern} " in f" {text_lower} ")

    # Check for strong indicators
    strong_bangla = ['taka', 'kemon acho', 'ami ', 'apni ']
    strong_hinglish = ['namaste', 'kaise ho', 'kya hal', 'kya haal', 'bhai']

    if bangla_count >= 1 or any(pattern in text_lower for pattern in strong_bangla):
        return 'bangla'
        
    if hinglish_count >= 2 or any(pattern in text_lower for pattern in strong_hinglish):
        return 'hinglish'

    return 'english'
