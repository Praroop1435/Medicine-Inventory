import { useState } from 'react';
import { View } from 'react-native';
import { normalizeName } from '@/domain/matching';
import type { Medicine } from '@/domain/types';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { Card, Field, ListRow, tokens } from '@/ui';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onPick: (m: Medicine) => void;
  /** Hides suggestions once the name already matches a medicine. */
  matched: boolean;
  uncertainLabel?: string;
};

/** Medicine name field that suggests up to 5 existing medicines while typing. */
export function MedicineAutocomplete({
  value,
  onChangeText,
  onPick,
  matched,
  uncertainLabel,
}: Props) {
  const { medicines } = useInventory();
  const [typed, setTyped] = useState(false);
  const q = normalizeName(value);
  const hits =
    typed && q && !matched
      ? medicines.filter((m) => normalizeName(m.name).includes(q)).slice(0, 5)
      : [];
  return (
    <View style={{ gap: tokens.space[2] }}>
      <Field
        label="Medicine name"
        value={value}
        onChangeText={(t) => {
          setTyped(true);
          onChangeText(t);
        }}
        uncertain={!!uncertainLabel}
        uncertainLabel={uncertainLabel}
      />
      {hits.length ? (
        <Card>
          {hits.map((m) => (
            <ListRow
              key={m.id}
              title={m.name}
              onPress={() => {
                setTyped(false);
                onPick(m);
              }}
            />
          ))}
        </Card>
      ) : null}
    </View>
  );
}
