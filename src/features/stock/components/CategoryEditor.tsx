import { useState } from 'react';
import { View } from 'react-native';
import { useRepos } from '@/data/RepoContext';
import { useSession } from '@/features/onboarding/SessionContext';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { Button, ButtonRow, Card, Field, tokens } from '@/ui';

/** Inline "add category" form; the new category goes last. */
export function CategoryEditor({ onDone }: { onDone: () => void }) {
  const { inventory } = useRepos();
  const { categories } = useInventory();
  const shopId = useSession().session?.shopId;
  const [name, setName] = useState('');
  const save = async () => {
    const n = name.trim();
    if (!shopId || !n) return;
    await inventory.upsertCategory(shopId, {
      name: n,
      order: Math.max(-1, ...categories.map((c) => c.order)) + 1,
      lastCheckedAt: null,
    });
    onDone();
  };
  return (
    <Card>
      <View style={{ padding: tokens.space[4], gap: tokens.space[3] }}>
        <Field label="Category name" value={name} onChangeText={setName} />
        <ButtonRow>
          <Button label="Cancel" variant="secondary" onPress={onDone} />
          <Button label="Save" disabled={!name.trim()} onPress={save} />
        </ButtonRow>
      </View>
    </Card>
  );
}
