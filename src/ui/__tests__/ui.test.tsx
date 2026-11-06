import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import {
  ActionTile,
  Button,
  ButtonRow,
  Chip,
  ConfirmDialog,
  CountStrip,
  EmptyState,
  Field,
  IconButton,
  ListRow,
  SectionHeader,
  StatusPill,
  Stepper,
} from '@/ui';

const flat = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

describe('StatusPill', () => {
  it('expired uses red pill colours', async () => {
    await render(<StatusPill status="expired" label="Expired" />);
    const text = screen.getByText('Expired');
    expect(flat(text).color).toBe('#8A1C1C');
    expect(flat(screen.getByTestId('status-pill')).backgroundColor).toBe('#FDECEC');
  });
  it('soon has amber bg and border', async () => {
    await render(<StatusPill status="soon" label="Soon" />);
    const s = flat(screen.getByTestId('status-pill'));
    expect(s.backgroundColor).toBe('#FFF4E5');
    expect(s.borderColor).toBe('#FCD9A8');
  });
  it('ok has no background and muted colour', async () => {
    await render(<StatusPill status="ok" label="OK" />);
    expect(flat(screen.getByTestId('status-pill')).backgroundColor).toBeUndefined();
    expect(flat(screen.getByText('OK')).color).toBe('#5B6576');
  });
});

describe('Button', () => {
  it('label is one line', async () => {
    await render(<Button label="Save" onPress={() => {}} />);
    expect(screen.getByText('Save').props.numberOfLines).toBe(1);
  });
  it('does not press when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
  });
  it('ButtonRow children have flex 1', async () => {
    await render(
      <ButtonRow>
        <Text>a</Text>
        <Text>b</Text>
      </ButtonRow>,
    );
    expect(screen.getAllByTestId('button-row-cell').map((c) => flat(c).flex)).toEqual([1, 1]);
  });
});

describe('Stepper', () => {
  it('does not go below min', async () => {
    const onChange = jest.fn();
    await render(<Stepper value={0} min={0} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Decrease'));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Increase'));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});

describe('Field', () => {
  it('uncertain shows label and amber border', async () => {
    await render(
      <Field
        label="Batch"
        value=""
        onChangeText={() => {}}
        uncertain
        uncertainLabel="Check this"
      />,
    );
    expect(screen.getByText('Check this')).toBeTruthy();
    expect(flat(screen.getByTestId('field-box')).borderColor).toBe('#D97706');
  });
});

describe('CountStrip', () => {
  it('renders expired tone red and reports presses', async () => {
    const onPress = jest.fn();
    await render(
      <CountStrip
        items={[
          { label: 'Expired', value: 3, tone: 'expired' },
          { label: 'Soon', value: 5, tone: 'soon' },
        ]}
        selectedIndex={0}
        onPress={onPress}
      />,
    );
    expect(flat(screen.getByText('3')).color).toBe('#C4242A');
    await fireEvent.press(screen.getByText('Soon'));
    expect(onPress).toHaveBeenCalledWith(1);
  });
  it('zero is never a warning: 0 renders muted whatever its tone', async () => {
    await render(
      <CountStrip
        large
        items={[
          { label: 'Expired', value: 0, tone: 'expired' },
          { label: 'Soon', value: 0, tone: 'soon' },
          { label: 'Later', value: 2, tone: 'soon' },
        ]}
      />,
    );
    expect(screen.getAllByText('0').map((t) => flat(t).color)).toEqual(['#5B6576', '#5B6576']);
    expect(flat(screen.getByText('2')).color).toBe('#B45309');
    expect(flat(screen.getByText('2')).fontSize).toBe(32);
  });
});

describe('Button variants', () => {
  it('primary is navy, secondary white with a border, text teal with no fill', async () => {
    await render(
      <>
        <Button label="P" onPress={() => {}} />
        <Button label="S" variant="secondary" onPress={() => {}} />
        <Button label="L" variant="text" onPress={() => {}} />
      </>,
    );
    expect(flat(screen.getByRole('button', { name: 'P' })).backgroundColor).toBe('#26344E');
    const sec = flat(screen.getByRole('button', { name: 'S' }));
    expect([sec.backgroundColor, sec.borderWidth]).toEqual(['#FFFFFF', 1]);
    expect(flat(screen.getByRole('button', { name: 'L' })).backgroundColor).toBeUndefined();
    expect(flat(screen.getByText('L')).color).toBe('#0B7280');
  });
});

describe('SectionHeader', () => {
  it('is sentence case in the text colour, with a teal action', async () => {
    const onRightPress = jest.fn();
    await render(<SectionHeader title="Categories" right="See all" onRightPress={onRightPress} />);
    const h = screen.getByRole('header', { name: 'Categories' });
    expect([flat(h).fontSize, flat(h).color]).toEqual([14, '#101828']);
    expect(flat(screen.getByText('See all')).color).toBe('#0B7280');
    await fireEvent.press(screen.getByRole('button', { name: 'See all' }));
    expect(onRightPress).toHaveBeenCalled();
  });
});

describe('Chip', () => {
  it('selected is teal on soft teal', async () => {
    await render(<Chip label="All" selected />);
    const c = flat(screen.getByRole('button', { name: 'All' }));
    expect([c.backgroundColor, c.borderColor]).toEqual(['#E6F6F8', '#2BB3C0']);
  });
});

describe('ListRow', () => {
  it('shows a leading icon tile and can override what a screen reader says', async () => {
    await render(
      <ListRow
        icon="folder"
        title="Balms"
        accessibilityLabel="Balms, Never checked"
        onPress={() => {}}
      />,
    );
    expect(screen.getByTestId('icon-tile')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Balms, Never checked' })).toBeOnTheScreen();
  });
});

describe('EmptyState', () => {
  it('has an icon, a title, a line and its action', async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState icon="folder" title="Nothing here yet" body="Add some stock.">
        <Button label="Add stock" onPress={onPress} />
      </EmptyState>,
    );
    expect(screen.getByTestId('icon-tile')).toBeOnTheScreen();
    expect(screen.getByText('Add some stock.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add stock' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('ActionTile', () => {
  it('is a button named by its label, with the subtitle as a hint, at least 96 tall', async () => {
    const onPress = jest.fn();
    await render(
      <ActionTile icon="scan" label="Scan bill" subtitle="Photo or PDF" onPress={onPress} />,
    );
    const b = screen.getByRole('button', { name: 'Scan bill' });
    expect(b.props.accessibilityHint).toBe('Photo or PDF');
    expect(flat(b).minHeight).toBeGreaterThanOrEqual(96);
    await fireEvent.press(b);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('is a labelled button that reports disabled and ignores presses', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="up" label="Move up" disabled onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Move up' });
    expect(b).toBeDisabled();
    await fireEvent.press(b);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog', () => {
  const show = async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(
      <ConfirmDialog
        title="Delete folder “Cough”?"
        message="This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    return { onConfirm, onCancel };
  };
  it('shows title as a header and the message', async () => {
    await show();
    expect(screen.getByRole('header', { name: 'Delete folder “Cough”?' })).toBeOnTheScreen();
    expect(screen.getByText("This can't be undone.")).toBeOnTheScreen();
  });
  it('Cancel only cancels', async () => {
    const { onConfirm, onCancel } = await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('confirm only confirms, with a red destructive button', async () => {
    const { onConfirm, onCancel } = await show();
    const del = screen.getByRole('button', { name: 'Delete' });
    expect(flat(del).backgroundColor).toBe('#C4242A');
    await fireEvent.press(del);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
