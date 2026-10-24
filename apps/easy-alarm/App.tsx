import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AlarmEditorScreen } from './components/AlarmEditorScreen';
import { AlarmListScreen } from './components/AlarmListScreen';
import { RingingScreen } from './components/RingingScreen';
import { useEasyAlarm } from './hooks/useEasyAlarm';
import { colors } from './theme';

export default function App() {
  const alarm = useEasyAlarm();

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {alarm.ringing ? (
          <RingingScreen alarm={alarm.ringing} onDismiss={() => void alarm.dismissRinging()} />
        ) : (
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            {!alarm.ready ? (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.blue} />
              </View>
            ) : alarm.editor ? (
              <AlarmEditorScreen
                alarm={alarm.editor}
                isNew={!alarm.alarms.some((item) => item.id === alarm.editor?.id)}
                onCancel={alarm.closeEditor}
                onSave={(draft) => void alarm.saveEditor(draft)}
                onDelete={(id) => void alarm.deleteEditor(id)}
              />
            ) : (
              <AlarmListScreen
                now={alarm.now}
                alarms={alarm.alarms}
                settings={alarm.settings}
                permissionGranted={alarm.permissionGranted}
                onAdd={alarm.openNew}
                onOpen={alarm.openExisting}
                onToggle={(id) => void alarm.toggleEnabled(id)}
                onToggleKeepScreenOn={() => void alarm.toggleKeepScreenOn()}
              />
            )}
          </SafeAreaView>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
