import re
import os

filepath = 'e:/dukanv22/frontend/src/components/ActionCard.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Very specific wrapper replacements to ensure we hit the exact outer containers
wrapper_replacements = [
    # Invoice Draft
    (r'bg-white rounded-3xl shadow-\[0_8px_30px_rgb\(0,0,0,0\.08\)\] border border-indigo-100/50 overflow-hidden mt-4 w-full max-w-2xl mx-auto transition-all',
     r'glass-card rounded-[28px] shadow-xl border border-card-border/50 overflow-hidden mt-4 w-full max-w-2xl mx-auto transition-all'),
    
    # Product Draft / Customer Draft
    (r'bg-white rounded-\[24px\] shadow-\[0_8px_30px_rgb\(0,0,0,0\.06\)\] border border-indigo-100/50 overflow-hidden w-full max-w-md mx-auto my-4 transition-all duration-300 hover:shadow-\[0_8px_30px_rgb\(0,0,0,0\.12\)\]',
     r'glass-card rounded-[28px] overflow-hidden w-full max-w-md mx-auto my-4 border border-card-border/50 shadow-lg transition-all duration-300 hover:shadow-indigo-500/10 hover:border-indigo-500/30'),
    
    # Customer Draft (It might use the exact same string as Product draft, if not we catch it with a broader regex later)

    # Payment Draft
    (r'bg-white rounded-\[24px\] shadow-\[0_8px_30px_rgb\(0,0,0,0\.06\)\] border overflow-hidden w-full max-w-md mx-auto my-4 transition-all duration-300 hover:shadow-\[0_8px_30px_rgb\(0,0,0,0\.12\)\] \$\{isCredit \? \'border-red-200\' : \'border-emerald-200\'\}',
     r'glass-card rounded-[28px] border overflow-hidden w-full max-w-md mx-auto my-4 shadow-lg transition-all duration-300 hover:shadow-lg ${isCredit ? \'border-red-500/30 hover:border-red-500/50 hover:shadow-red-500/10\' : \'border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-emerald-500/10\'}'),

    # Restock Draft
    (r'rounded-2xl border border-green-200 shadow-lg overflow-hidden bg-white',
     r'glass-card rounded-[28px] border border-card-border/50 shadow-lg overflow-hidden'),

    # Batch Draft
    (r'rounded-2xl border border-indigo-200 shadow-lg overflow-hidden bg-white',
     r'glass-card rounded-[28px] border border-card-border/50 shadow-lg overflow-hidden'),

    # Specific color tokens for dark/light theme compat
    (r'bg-slate-50\b', r'bg-card-bg/40'),
    (r'bg-slate-100\b', r'bg-bg-main/50'),
    (r'bg-indigo-50\b', r'bg-indigo-500/10'),
    (r'bg-blue-50\b', r'bg-blue-500/10'),
    (r'bg-red-50\b', r'bg-red-500/10'),
    (r'bg-emerald-50\b', r'bg-emerald-500/10'),

    (r'border-slate-300\b', r'border-card-border/80'),
    (r'border-slate-200\b', r'border-card-border/50'),
    (r'border-slate-100\b', r'border-card-border/30'),
    
    (r'border-indigo-100\b', r'border-indigo-500/20'),
    (r'border-blue-100\b', r'border-blue-500/20'),
    (r'border-red-100\b', r'border-red-500/20'),
    (r'border-emerald-100\b', r'border-emerald-500/20'),
    
    (r'border-indigo-200\b', r'border-indigo-500/30'),
    (r'border-blue-200\b', r'border-blue-500/30'),
    (r'border-red-200\b', r'border-red-500/30'),
    (r'border-emerald-200\b', r'border-emerald-500/30'),

    (r'text-slate-800\b', r'text-text-main'),
    (r'text-slate-700\b', r'text-text-main'),
    (r'text-slate-600\b', r'text-text-main'),
    (r'text-slate-500\b', r'text-text-muted'),
    (r'text-slate-400\b', r'text-text-muted/70'),
    (r'text-slate-300\b', r'text-text-muted/50'),
    
    (r'text-indigo-900\b', r'text-text-main font-bold'),
    (r'text-blue-900\b', r'text-text-main font-bold'),

    # Make inner inputs transparent so they don't break dark mode
    (r'bg-white\b', r'bg-transparent'), # Default inner bg-white replacements to transparent, except for specific places.
    (r'bg-transparent border border-card-border/50\b', r'bg-bg-main/30 border border-card-border/50'), # If it was a button that just became transparent, maybe it needs a tint. We'll refine buttons manually if needed.
]

for old, new in wrapper_replacements:
    code = re.sub(old, new, code)

# Ensure select elements don't look weird with bg-transparent in dark mode. 
# They usually need bg-bg-main
code = code.replace('bg-transparent font-medium text-text-main', 'bg-bg-main/50 font-medium text-text-main') # Fix for selects that might have been hit

# Let's write the modified code back
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Theme overrides applied.")
