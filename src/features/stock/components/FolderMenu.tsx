import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRepos } from '@/data/RepoContext';
import { childrenOf, descendantIds, pathLabel, walk } from '@/domain/tree';
import type { Category } from '@/domain/types';
import { useSession } from '@/features/onboarding/SessionContext';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useToast } from '@/features/shared/Toast';
import { ConfirmDialog, ListRow, Sheet, T } from '@/ui';
import { CategoryEditor } from './CategoryEditor';

/** A folder row's ⋯ menu: Rename · Move to… · Delete (only when empty, and it asks first). */
export function FolderMenu({ folder, onClose }: { folder: Category; onClose: () => void }) {
  const { categories, medicines } = useInventory();
  const { inventory } = useRepos();
  const session = useSession().session;
  const toast = useToast();
  const [mode, setMode] = useState<'menu' | 'rename' | 'move' | 'delete'>('menu');
  if (!session) return null;
  const { shopId, deviceId } = session;
  const run = (p: Promise<void>) => {
    onClose();
    p.catch((e: unknown) =>
      toast(e instanceof Error ? e.message : "Couldn't save. Check the connection and try again."),
    );
  };
  const empty =
    childrenOf(categories, folder.id).length === 0 &&
    !medicines.some((m) => m.categoryId === folder.id);

  if (mode === 'delete')
    return (
      <ConfirmDialog
        title={`Delete folder “${folder.name}”?`}
        message="This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => run(inventory.deleteCategory(shopId, folder.id, deviceId))}
        onCancel={onClose}
      />
    );

  const inside = new Set([folder.id, ...descendantIds(categories, folder.id)]);
  const targets = walk(categories).filter((c) => !inside.has(c.id) && c.id !== folder.parentId);
  const move = (to: string | null) => run(inventory.moveCategory(shopId, folder.id, to, deviceId));

  return (
    <Sheet onClose={onClose}>
      <T size={16} weight="medium" numberOfLines={1}>
        {mode === 'move' ? `Move “${folder.name}” to` : folder.name}
      </T>
      {mode === 'rename' ? (
        <CategoryEditor folder={folder} onDone={onClose} />
      ) : mode === 'move' ? (
        <ScrollView>
          {folder.parentId !== null && <ListRow title="Top level" onPress={() => move(null)} />}
          {targets.map((c) => (
            <ListRow key={c.id} title={pathLabel(categories, c.id)} onPress={() => move(c.id)} />
          ))}
        </ScrollView>
      ) : (
        <>
          <ListRow title="Rename" onPress={() => setMode('rename')} />
          <ListRow title="Move to…" onPress={() => setMode('move')} />
          <ListRow
            title="Delete"
            subtitle={empty ? undefined : "Move or remove what's inside first"}
            disabled={!empty}
            onPress={() => setMode('delete')}
          />
        </>
      )}
    </Sheet>
  );
}
