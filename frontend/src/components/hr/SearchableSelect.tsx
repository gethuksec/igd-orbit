import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface SearchOption {
  value: string;
  label: string;
  sub?: string;
}

interface SingleProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
}

interface MultiProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

interface BaseProps {
  options: SearchOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Searchable dropdown (single or multi) built on cmdk + popover.
 * Used across HR intake for employee / position / grade / branch / location picks.
 */
export default function SearchableSelect(props: BaseProps & (SingleProps | MultiProps)) {
  const [open, setOpen] = useState(false);
  const {
    options,
    placeholder = "Pilih…",
    searchPlaceholder = "Cari…",
    emptyText = "Tidak ada hasil",
    disabled,
    className,
  } = props;

  const byValue = new Map(options.map((o) => [o.value, o]));

  const display =
    props.multiple
      ? props.value.length === 0
        ? placeholder
        : props.value.length === 1
          ? (byValue.get(props.value[0])?.label ?? props.value[0])
          : `${byValue.get(props.value[0])?.label ?? props.value[0]} +${props.value.length - 1}`
      : props.value
        ? (byValue.get(props.value)?.label ?? props.value)
        : placeholder;

  const isSelected = (v: string) =>
    props.multiple ? props.value.includes(v) : props.value === v;

  const pick = (v: string) => {
    if (props.multiple) {
      const next = props.value.includes(v)
        ? props.value.filter((x) => x !== v)
        : [...props.value, v];
      props.onChange(next);
    } else {
      props.onChange(v);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">{display}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={`${o.label} ${o.sub ?? ""} ${o.value}`} onSelect={() => pick(o.value)}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isSelected(o.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                  {o.sub && <span className="ml-auto text-xs text-muted-foreground pl-2">{o.sub}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
