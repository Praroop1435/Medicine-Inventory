import { useState } from 'react';
import { View } from 'react-native';
import { useRepos } from '@/data/RepoContext';
import { nextOrder } from '@/domain/tree';
import type { Category } from '@/domain/types';
import { useSession } from '@/features/onboarding/SessionContext';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { Button, ButtonRow, Field, tokens } from '@/ui';

/** Inline folder name form: renames `folder`, or adds a new folder last under `parentId`. */
export function CategoryEditor({
  parentId = null,
  folder,
  onDone,
}: {
  parentId?: string | null;
  folder?: Category;
  onDone: (id?: string) => void;
}) {
  const { inventory } = useRepos();
  const { categories } = useInventory();
  const shopId = useSession().session?.shopId;
  const [name, setName] = useState(folder?.name ?? '');
  const save = async () => {
    const n = name.trim();
    if (!shopId || !n) return;
    const id = await inventory.upsertCategory(
      shopId,
      folder
        ? { ...folder, name: n }
        : { name: n, order: nextOrder(categories, parentId), lastCheckedAt: null, parentId },
    );
    onDone(id);
  };
  return (
    <View style={{ gap: tokens.space[3] }}>
      <Field label="Folder name" value={name} onChangeText={setName} />
      <ButtonRow>
        <Button label="Cancel" variant="secondary" onPress={() => onDone()} />
        <Button label="Save" disabled={!name.trim()} onPress={save} />
      </ButtonRow>
    </View>
  );
}
