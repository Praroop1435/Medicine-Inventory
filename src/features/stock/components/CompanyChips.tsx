import { Chip, ChipRow } from '@/ui';

/** Single-select company filter; `selected` null means "All companies". */
export function CompanyChips({
  companies,
  selected,
  onSelect,
}: {
  companies: { id: string; name: string }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <ChipRow>
      <Chip label="All companies" selected={selected === null} onPress={() => onSelect(null)} />
      {companies.map((c) => (
        <Chip
          key={c.id}
          label={c.name}
          selected={selected === c.id}
          onPress={() => onSelect(c.id)}
        />
      ))}
    </ChipRow>
  );
}
