"""
Language Detection for Multi-lingual Support
Detects: English, Hinglish (Hindi-English mix), Bengali (romanized)
"""

def detect_language(text: str) -> str:
    """
    Detect if text is English, Hinglish, or Bengali
    
    Args:
        text: Input text to analyze
        
    Returns:
        'english', 'hinglish', or 'bengali'
    """
    text_lower = text.lower()
    
    # Bengali patterns (romanized - no Devanagari script)
    bengali_patterns = [
        # Greetings
        'nomoshkar', 'nomoskar', 'ki khabar', 'kemon acho', 'kemon achho',
        # Common words
        'ami', 'tumi', 'apni', 'kore', 'korche', 'korbo', 'ache', 'achhe',
        'bhalo', 'kharap', 'khub', 'onek', 'ektu', 'kichu',
        # Questions
        'keno', 'kothay', 'kobe', 'ki korbo', 'koto',
        # Possessives
        'amar', 'tomar', 'apnar', 'amra', 'tomra'
    ]
    
    # Hinglish patterns (Hindi words in roman script)
    hinglish_patterns = [
        # Greetings
        'namaste', 'namaskar', 'kaise', 'kya', 'hai', 'ho', 'hain',
        # Common Hindi words
        'kar', 'karo', 'kare', 'karenge', 'kiya', 'dekho', 'batao', 'dikhao',
        'mujhe', 'tumhe', 'aapko', 'hum', 'tum', 'aap',
        'acha', 'thik', 'bahut', 'bohot', 'thoda', 'kuch', 'koi',
        # Questions
        'kyun', 'kahan'', 'kab', 'kitna', 'kaun', 'kaise',
        # Business
        'rupay', 'rupaye', 'paisa', 'paise', 'lena', 'dena', 'dukaan'
    ]
    
    # Count pattern matches
    bengali_count = sum(1 for pattern in bengali_patterns if pattern in text_lower)
    hinglish_count = sum(1 for pattern in hinglish_patterns if pattern in text_lower)
    
    # Decision logic
    if bengali_count >= 2:
        return 'bengali'
    elif hinglish_count >= 2:
        return 'hinglish'
    
    # Single strong indicators
    strong_bengali = ['nomoshkar', 'kemon acho', 'ami']
    strong_hinglish = ['namaste', 'kaise ho', 'kya hal']
    
    if any(pattern in text_lower for pattern in strong_bengali):
        return 'bengali'
    if any(pattern in text_lower for pattern in strong_hinglish):
        return 'hinglish'
    
    # Default to English if no clear matches
    return 'english'
