import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { DraftBatch } from '@/domain/draft';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useToast } from '@/features/shared/Toast';
import { PermissionDenied, type SpeechEngine } from '@/services/speech/SpeechEngine';
import { nativeSpeechEngine } from '@/services/speech/native';
import { parseVoiceEntry } from '@/services/speech/voiceParser';
import { Button, ButtonRow, Card, Icon, IconButton, ListRow, Screen, T, tokens } from '@/ui';
import { useIntake } from '../IntakeContext';

/** Hold to speak one batch at a time ("Next" keeps listening), then review them all. */
export function VoiceScreen({ engine = nativeSpeechEngine }: { engine?: SpeechEngine }) {
  const { medicines, companies } = useInventory();
  const { setDrafts } = useIntake();
  const toast = useToast();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [transcript, setTranscript] = useState('');
  const [list, setList] = useState<DraftBatch[]>([]);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    engine.isAvailable().then(setAvailable, () => setAvailable(false));
  }, [engine]);

  const press = async () => {
    setListening(true);
    try {
      await engine.start(setTranscript);
    } catch (e) {
      setListening(false);
      toast(
        e instanceof PermissionDenied
          ? 'Microphone permission is needed for voice'
          : 'Could not start listening',
      );
    }
  };
  const release = async () => {
    if (!listening) return;
    setListening(false);
    const t = await engine.stop().catch(() => '');
    if (t) setTranscript(t);
  };
  const next = () => {
    setList((l) => [...l, parseVoiceEntry(transcript, medicines, companies)]);
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

  return (
    <Screen back="Back" title="Speak">
      <View style={{ gap: tokens.space[3] }}>
        <T color={tokens.color.muted}>
          Say name, company, batch, expiry and quantity, e.g. &quot;Azithral 500, Alembic, batch A Z
          8 8, expiry November 2026, 2 cartons&quot;.
        </T>
        <View style={{ alignItems: 'center' }}>
          <Icon name="mic" />
        </View>
        <Button
          label="Hold to speak"
          full
          onPress={() => {}}
          onPressIn={press}
          onPressOut={release}
        />
        <Card>
          <T>{transcript || (listening ? 'Listening…' : 'Nothing heard yet')}</T>
        </Card>
        <ButtonRow>
          <Button label="Next" variant="secondary" disabled={!transcript.trim()} onPress={next} />
          <Button label={`Review ${list.length}`} disabled={!list.length} onPress={review} />
        </ButtonRow>
        {list.length ? (
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
        ) : null}
      </View>
    </Screen>
  );
}
