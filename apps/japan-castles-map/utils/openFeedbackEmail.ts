import { Linking } from 'react-native';

export const FEEDBACK_EMAIL = 'framers.42clacks@icloud.com';
const FEEDBACK_SUBJECT = '攻城師 意見反映';

export type OpenFeedbackEmailResult = 'composed' | 'opened' | 'unavailable';

async function tryComposeWithNativeMail(): Promise<boolean> {
  try {
    // Defer loading until the user taps feedback so lazy screens (Settings) still load
    // when the native module is missing (Expo Go / stale dev client).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MailComposer = require('expo-mail-composer') as typeof import('expo-mail-composer');
    if (await MailComposer.isAvailableAsync()) {
      await MailComposer.composeAsync({
        recipients: [FEEDBACK_EMAIL],
        subject: FEEDBACK_SUBJECT,
      });
      return true;
    }
  } catch {
    // Native module missing or composer unavailable.
  }

  return false;
}

export async function openFeedbackEmail(): Promise<OpenFeedbackEmailResult> {
  const mailtoWithSubject = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`;
  const mailtoSimple = `mailto:${FEEDBACK_EMAIL}`;

  if (await tryComposeWithNativeMail()) {
    return 'composed';
  }

  for (const mailtoUrl of [mailtoWithSubject, mailtoSimple]) {
    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (!canOpen) {
        continue;
      }

      await Linking.openURL(mailtoUrl);
      return 'opened';
    } catch {
      // Try the next mailto variant.
    }
  }

  return 'unavailable';
}
