import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button } from './Button';
import { Field } from './Field';
import { Icon } from './Icon';
import { ListRow } from './ListRow';
import { Sheet } from './Sheet';
import { T } from './Text';
import { tokens } from './tokens';

export type SelectOption = { id: string; label: string };

// Long lists (folders, units) get a search box.
const SEARCH_FROM = 8;

/**
 * A compact picker: shows the chosen value like a field; tap opens a bottom-sheet list with
 * search and an optional action at the bottom ("+ New folder").
 */
export function Select({
  label,
  options,
  selected,
  onSelect,
  placeholder = 'Choose',
  uncertain,
  uncertainLabel,
  action,
}: {
  label: string;
  options: SelectOption[];
  selected: string | null;
  onSelect: (id: string) => void;
  placeholder?: string;
  uncertain?: boolean;
  uncertainLabel?: string;
  action?: { label: string; onPress: () => void };
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const value = options.find((o) => o.id === selected)?.label ?? '';
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  return (
    <View style={{ gap: tokens.space[1] }}>
      <T size={12} weight="medium" color={uncertain ? tokens.color.soon : tokens.color.muted}>
        {label}
      </T>
      <Pressable
        testID="select-box"
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value || placeholder}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: tokens.touch,
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.space[2],
          paddingHorizontal: tokens.space[3],
          borderWidth: 1,
          borderRadius: tokens.radius.control,
          borderColor: uncertain ? tokens.color.amber : tokens.color.control,
          backgroundColor: uncertain ? tokens.color.soonBg : tokens.color.surface,
          opacity: pressed ? tokens.opacity.pressed : 1,
        })}
      >
        <T
          size={16}
          color={value ? tokens.color.text : tokens.color.muted}
          numberOfLines={1}
          style={{ flex: 1 }}
        >
          {value || placeholder}
        </T>
        <Icon name="down" color={tokens.color.muted} />
      </Pressable>
      {uncertain && uncertainLabel ? (
        <T size={12} color={tokens.color.soon}>
          {uncertainLabel}
        </T>
      ) : null}
      {open ? (
        <Sheet title={label} onClose={close}>
          {options.length >= SEARCH_FROM ? (
            <Field label={`Search ${label.toLowerCase()}`} value={query} onChangeText={setQuery} />
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            {shown.map((o) => (
              <ListRow
                key={o.id}
                title={o.label}
                accessibilityLabel={o.id === selected ? `${o.label}, selected` : o.label}
                right={o.id === selected ? <Icon name="tick" color={tokens.color.tealInk} /> : null}
                onPress={() => {
                  onSelect(o.id);
                  close();
                }}
              />
            ))}
          </ScrollView>
          {action ? (
            <Button
              label={action.label}
              variant="secondary"
              full
              onPress={() => {
                close();
                action.onPress();
              }}
            />
          ) : null}
        </Sheet>
      ) : null}
    </View>
  );
}
