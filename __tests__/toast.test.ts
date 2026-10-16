import { useToastStore, toast } from '../src/store/toastStore';

describe('Toast System', () => {
  beforeEach(() => {
    useToastStore.getState().dismissAll();
  });

  it('initially has no toasts', () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('adds success toast correctly', () => {
    toast.success('Medication taken', 'Success');
    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('Medication taken');
    expect(toasts[0].title).toBe('Success');
  });

  it('adds error toast correctly', () => {
    toast.error('Failed to save reading', 'Error');
    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].message).toBe('Failed to save reading');
    expect(toasts[0].title).toBe('Error');
  });

  it('adds warning and info toasts correctly', () => {
    toast.warning('Drug conflict detected');
    toast.info('Alarm turned off');
    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(2);
    expect(toasts[0].type).toBe('warning');
    expect(toasts[1].type).toBe('info');
  });

  it('respects maximum concurrent toasts constraint', () => {
    toast.info('Message 1');
    toast.info('Message 2');
    toast.info('Message 3');
    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(2);
    expect(toasts.map((t) => t.message)).toEqual(['Message 2', 'Message 3']);
  });

  it('dismisses specific toast by id', () => {
    const id1 = toast.success('First');
    const id2 = toast.success('Second');
    expect(useToastStore.getState().toasts.length).toBe(2);

    toast.dismiss(id1);
    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].id).toBe(id2);
  });

  it('dismisses all toasts', () => {
    toast.success('One');
    toast.error('Two');
    expect(useToastStore.getState().toasts.length).toBe(2);

    toast.dismissAll();
    expect(useToastStore.getState().toasts.length).toBe(0);
  });

  it('supports action callback in toast item', () => {
    const onAction = jest.fn();
    toast.show({
      type: 'info',
      message: 'Item archived',
      action: {
        label: 'Undo',
        onPress: onAction,
      },
    });

    const currentToast = useToastStore.getState().toasts[0];
    expect(currentToast.action).toBeDefined();
    expect(currentToast.action?.label).toBe('Undo');
    currentToast.action?.onPress();
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
