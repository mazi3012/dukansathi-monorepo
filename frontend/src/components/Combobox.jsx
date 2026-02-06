import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Combobox = ({
    options = [],
    value,
    onChange,
    placeholder = "Select...",
    labelKey = "name",
    valueKey = "id",
    renderItem = null,
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    // Initial value text
    useEffect(() => {
        if (value) {
            const selected = options.find(opt =>
                typeof opt === 'string' ? opt === value : opt[valueKey] === value || opt[labelKey] === value
            );
            if (selected) {
                setSearchTerm(typeof selected === 'string' ? selected : selected[labelKey]);
            }
        }
    }, [value, options, valueKey, labelKey]);


    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                // Reset search term to selected value on close if no match found
                const selected = options.find(opt =>
                    typeof opt === 'string' ? opt === value : opt[valueKey] === value || opt[labelKey] === value
                );
                if (selected) {
                    setSearchTerm(typeof selected === 'string' ? selected : selected[labelKey]);
                } else if (!value) {
                    setSearchTerm('');
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef, value, options, valueKey, labelKey]);

    const filteredOptions = options.filter(option => {
        const label = typeof option === 'string' ? option : option[labelKey];
        return label.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleSelect = (option) => {
        const val = typeof option === 'string' ? option : option; // Return whole object for flexibility if needed, or stick to value
        onChange(val);
        setSearchTerm(typeof option === 'string' ? option : option[labelKey]);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    className="w-full p-2 bg-white rounded-lg border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
                <div className="absolute right-2 top-2.5 text-slate-400 pointer-events-none">
                    <ChevronDown size={16} />
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto"
                    >
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, index) => {
                                const label = typeof option === 'string' ? option : option[labelKey];
                                const isSelected = value === (typeof option === 'string' ? option : option[valueKey]);

                                return (
                                    <button
                                        key={index} // better to use id if available
                                        onClick={() => handleSelect(option)}
                                        className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center justify-between
                                            ${isSelected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}
                                        `}
                                    >
                                        {renderItem ? renderItem(option) : (
                                            <span>{label}</span>
                                        )}
                                        {isSelected && <Check size={16} />}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="p-4 text-center text-xs text-slate-400">
                                No results found
                            </div>
                        )}

                        {/* Add New Option Link (Mock) */}
                        <div className="p-2 border-t border-slate-100 bg-slate-50">
                            <button className="w-full py-2 text-xs font-bold text-indigo-600 bg-white rounded-lg border border-slate-200 shadow-sm hover:bg-indigo-50">
                                + Add New "{searchTerm}"
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Combobox;
