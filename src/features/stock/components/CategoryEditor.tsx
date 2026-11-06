import { useState } from 'react';
import { View } from 'react-native';
import { useRepos } from '@/data/RepoContext';
import { nextOrder } from '@/domain/tree';
import type { Category } from '@/domain/types';
import { useSession } from '@/features/onboarding/SessionContext';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useToast } from '@/features/shared/Toast';
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
  const session = useSession().session;
  const toast = useToast();
  const [name, setName] = useState(folder?.name ?? '');
  const save = async () => {
    const n = name.trim();
    if (!session || !n) return;
    const { shopId, deviceId } = session;
    try {
      if (folder) {
        await inventory.renameCategory(shopId, folder.id, n, deviceId);
        return onDone(folder.id);
      }
      onDone(
        await inventory.upsertCategory(shopId, {
          name: n,
          order: nextOrder(categories, parentId),
          lastCheckedAt: null,
          parentId,
        }),
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    }
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
