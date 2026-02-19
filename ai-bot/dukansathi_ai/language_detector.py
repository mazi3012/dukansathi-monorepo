"""
Language Detection for Dukan Sathi
Detects: English or Hinglish (Hindi-English mix written in Roman script)
Only English and Hinglish are supported — no other languages needed.
"""

def detect_language(text: str) -> str:
    """
    Detect if text is English or Hinglish.

    Args:
        text: Input text to analyze (always expected in Roman/Latin script
              since Whisper STT is locked to language='en')

    Returns:
        'hinglish' if Hindi-English mix is detected, else 'english'
    """
    # Handle None or empty input
    if not text or not isinstance(text, str):
        return 'english'

    text_lower = text.lower().strip()

    if not text_lower:
        return 'english'

    # Hinglish patterns — Hindi words commonly written in Roman script
    hinglish_patterns = [
        # Greetings
        'namaste', 'namaskar', 'kaise', 'kya', 'hai', 'ho', 'hain',
        # Common Hindi words
        'kar', 'karo', 'kare', 'karenge', 'kiya', 'dekho', 'batao', 'dikhao',
        'mujhe', 'tumhe', 'aapko', 'hum', 'tum', 'aap',
        'acha', 'thik', 'bahut', 'bohot', 'thoda', 'kuch', 'koi',
        # Questions
        'kyun', 'kahan', 'kab', 'kitna', 'kaun',
        # Business / Shop
        'rupay', 'rupaye', 'paisa', 'paise', 'lena', 'dena', 'dukaan',
        # Extra common Hinglish
        'bhai', 'yaar', 'boss', 'theek', 'sahi', 'bilkul', 'zaroor',
        'wala', 'wali', 'wale', 'bata', 'dikha', 'nikal',
    ]

    # Count matches
    hinglish_count = sum(1 for pattern in hinglish_patterns if pattern in text_lower)

    # Strong single-word indicators
    strong_hinglish = ['namaste', 'kaise ho', 'kya hal', 'kya haal', 'bhai']

    if hinglish_count >= 2 or any(pattern in text_lower for pattern in strong_hinglish):
        return 'hinglish'

    # Default to English
    return 'english'
