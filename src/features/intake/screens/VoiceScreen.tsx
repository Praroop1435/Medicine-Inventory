import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { draftIssues, type DraftBatch, type DraftField } from '@/domain/draft';
import { formatExpiry } from '@/domain/expiry';
import { shopUnits } from '@/domain/types';
import { useShop } from '@/features/shared/hooks/useShop';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { PermissionPrompt, usePermissionGate } from '@/features/shared/PermissionGate';
import { useToast } from '@/features/shared/Toast';
import { PermissionDenied, type SpeechEngine } from '@/services/speech/SpeechEngine';
import { nativeSpeechEngine } from '@/services/speech/native';
import { parseVoiceEntry } from '@/services/speech/voiceParser';
import {
  Button,
  ButtonRow,
  Card,
  IconButton,
  KeyValueRow,
  ListRow,
  MicButton,
  Screen,
  SectionHeader,
  T,
  tokens,
} from '@/ui';
import { useIntake } from '../IntakeContext';

/** Stop this long after the last word heard. */
export const SILENCE_MS = 2000;
/** Before anything is heard, give up after this long so the mic is never left open. */
export const NO_SPEECH_MS = 8000;

type Phase = 'idle' | 'starting' | 'listening' | 'stopping';

/** Tap to start, tap (or pause) to stop; check what was heard, add it, then review them all. */
export function VoiceScreen({ engine = nativeSpeechEngine }: { engine?: SpeechEngine }) {
  const { medicines, companies } = useInventory();
  const shop = useShop();
  const { setDrafts } = useIntake();
  const toast = useToast();
  const mic = usePermissionGate('mic', engine);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [transcript, setTranscript] = useState('');
  const [heard, setHeard] = useState<DraftBatch | null>(null);
  const [list, setList] = useState<DraftBatch[]>([]);
  const [listening, setListening] = useState(false);
  // Refs, not state: taps and engine callbacks land between renders.
  const phase = useRef<Phase>('idle');
  const stopWanted = useRef(false);
  const live = useRef(true);
  const said = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    engine.isAvailable().then(setAvailable, () => setAvailable(false));
  }, [engine]);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const finish = async () => {
    clearTimer();
    phase.current = 'stopping';
    const t = await engine.stop().catch(() => '');
    phase.current = 'idle';
    if (!live.current) return;
    setListening(false);
    const text = (t || said.current).trim();
    if (!text) return toast("Didn't catch that. Tap the mic and try again.");
    setTranscript(text);
    setHeard(parseVoiceEntry(text, medicines, companies, shopUnits(shop)));
  };
  const arm = (ms: number) => {
    clearTimer();
    timer.current = setTimeout(() => phase.current === 'listening' && void finish(), ms);
  };

  // Leaving the screen never leaves the mic open, even mid-start.
  useEffect(
    () => () => {
      live.current = false;
      clearTimer();
      if (phase.current === 'starting') stopWanted.current = true;
      else if (phase.current === 'listening') void engine.stop().catch(() => '');
    },
    [engine],
  );

  const start = async () => {
    phase.current = 'starting';
    stopWanted.current = false;
    said.current = '';
    setTranscript('');
    setHeard(null);
    setListening(true);
    try {
      await engine.start((t) => {
        said.current = t;
        if (live.current) setTranscript(t);
        if (phase.current === 'listening') arm(SILENCE_MS);
      });
    } catch (e) {
      phase.current = 'idle';
      if (!live.current) return;
      setListening(false);
      toast(
        e instanceof PermissionDenied
          ? 'Turn on the microphone to add stock by voice.'
          : "Couldn't start listening. Try again, or use Type.",
      );
      return;
    }
    phase.current = 'listening';
    // Tapped stop (or left) while the permission prompt or engine was starting.
    if (stopWanted.current || !live.current) return finish();
    arm(said.current ? SILENCE_MS : NO_SPEECH_MS);
  };
  const tap = () => {
    if (phase.current === 'idle') return start();
    if (phase.current === 'starting') stopWanted.current = true;
    else if (phase.current === 'listening') return finish();
  };
  const add = () => {
    if (!heard) return;
    setList((l) => [...l, heard]);
    setHeard(null);
    setTranscript('');
  };
  const review = () => {
    setDrafts(list);
    router.push('/intake/review');
  };

  if (available === false) {
    return (
      <Screen back="Back" title="Speak">
        <View style={{ gap: tokens.space[3] }}>
          <T color={tokens.color.muted}>Voice isn&apos;t available right now. Use Type instead.</T>
          <Button label="Type instead" onPress={() => router.replace('/intake/manual')} />
        </View>
      </Screen>
    );
  }

  if (mic.state !== 'granted')
    return (
      <Screen back="Back" title="Speak">
        <PermissionPrompt
          gate={mic}
          icon="mic"
          reason="The microphone is used to add stock by voice."
          off="Microphone permission is off. Turn it on to add stock by voice, or use Type instead."
        />
      </Screen>
    );

  const unsure = (f: DraftField) =>
    !!heard && (heard.uncertain.includes(f) || draftIssues(heard).includes(f));

  return (
    <Screen
      back="Back"
      title="Speak"
      footer={
        list.length ? <Button label={`Review ${list.length}`} full onPress={review} /> : undefined
      }
    >
      <View style={{ gap: tokens.space[4] }}>
        <View style={{ alignItems: 'center', gap: tokens.space[3] }}>
          <MicButton listening={listening} onPress={() => void tap()} />
          <T size={14} color={tokens.color.muted} style={{ textAlign: 'center' }}>
            {listening
              ? 'Listening… tap to stop'
              : 'Tap and say: name, company, batch, expiry, quantity'}
          </T>
          {transcript ? (
            <T size={16} style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
              {transcript}
            </T>
          ) : null}
        </View>
        {heard && !listening ? (
          <Card>
            <View style={{ padding: tokens.space[4], gap: tokens.space[3] }}>
              <View>
                <KeyValueRow
                  label="Name"
                  value={heard.medicineName}
                  uncertain={unsure('medicineName')}
                />
                <KeyValueRow
                  label="Company"
                  value={heard.companyName}
                  uncertain={!heard.matchedMedicineId && unsure('companyName')}
                />
                <KeyValueRow label="Batch" value={heard.batchNo} uncertain={unsure('batchNo')} />
                <KeyValueRow
                  label="Expiry"
                  value={heard.expiry ? formatExpiry(heard.expiry) : ''}
                  uncertain={unsure('expiry')}
                />
                <KeyValueRow
                  label="Qty"
                  value={heard.qty === null ? '' : String(heard.qty)}
                  uncertain={unsure('qty')}
                />
              </View>
              <ButtonRow>
                <Button label="Try again" variant="secondary" onPress={() => void start()} />
                <Button label="Add to list" onPress={add} />
              </ButtonRow>
            </View>
          </Card>
        ) : null}
        {list.length ? (
          <View>
            <SectionHeader title={`Added (${list.length})`} />
            <Card>
              {list.map((d) => (
                <ListRow
                  key={d.key}
                  title={`${d.medicineName || '—'} · ${d.batchNo || '—'} · ${d.qty ?? '—'}`}
                  right={
                    <IconButton
                      icon="close"
                      label={`Remove ${d.medicineName || 'entry'}`}
                      onPress={() => setList((l) => l.filter((x) => x.key !== d.key))}
                    />
                  }
                />
              ))}
            </Card>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
