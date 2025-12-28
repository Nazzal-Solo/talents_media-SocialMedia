import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface ChipInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxLength?: number;
}

export function ChipInput({ value, onChange, placeholder = 'Type and press Enter', maxLength = 50 }: ChipInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed.length > 0 && trimmed.length <= maxLength && !value.includes(trimmed)) {
        onChange([...value, trimmed]);
        setInputValue('');
      }
    }
  };

  const removeChip = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-tm-bg border border-tm-border rounded-lg min-h-[44px]">
      {value.map((chip, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-tm-primary-from/20 text-tm-primary-from rounded"
        >
          {chip}
          <button
            type="button"
            onClick={() => removeChip(index)}
            className="hover:text-tm-primary-to transition"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-tm-text placeholder:text-tm-text-muted"
        maxLength={maxLength}
      />
    </div>
  );
}

