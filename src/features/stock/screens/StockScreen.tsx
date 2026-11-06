import { useState } from 'react';
import { CategoryList } from '@/features/home/components/CategoryList';
import { Button, ButtonRow, Screen, SectionHeader } from '@/ui';
import { CategoryEditor } from '../components/CategoryEditor';

export function StockScreen() {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <Screen title="Stock">
      <SectionHeader
        title="Categories"
        right={editing ? 'Done' : 'Edit order'}
        onRightPress={() => setEditing((e) => !e)}
      />
      <CategoryList editable={editing} />
      {adding ? (
        <CategoryEditor onDone={() => setAdding(false)} />
      ) : (
        <ButtonRow>
          <Button label="+ Add category" variant="secondary" onPress={() => setAdding(true)} />
        </ButtonRow>
      )}
    </Screen>
  );
}
