import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { Button, ButtonRow, CountStrip, Field, StatusPill, Stepper } from '@/ui';

const flat = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

describe('StatusPill', () => {
  it('expired uses red pill colours', async () => {
    await render(<StatusPill status="expired" label="Expired" />);
    const text = screen.getByText('Expired');
    expect(flat(text).color).toBe('#831c1e');
    expect(flat(screen.getByTestId('status-pill')).backgroundColor).toBe('#ffedea');
  });
  it('soon has amber bg and border', async () => {
    await render(<StatusPill status="soon" label="Soon" />);
    const s = flat(screen.getByTestId('status-pill'));
    expect(s.backgroundColor).toBe('#fffbeb');
    expect(s.borderColor).toBe('#fde68a');
  });
  it('ok has no background and muted colour', async () => {
    await render(<StatusPill status="ok" label="OK" />);
    expect(flat(screen.getByTestId('status-pill')).backgroundColor).toBeUndefined();
    expect(flat(screen.getByText('OK')).color).toBe('#6b6b6b');
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
    expect(flat(screen.getByTestId('field-box')).borderColor).toBe('#d97706');
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
    expect(flat(screen.getByText('3')).color).toBe('#c4242a');
    await fireEvent.press(screen.getByText('Soon'));
    expect(onPress).toHaveBeenCalledWith(1);
  });
});
