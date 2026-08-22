import * as MailComposer from 'expo-mail-composer';
import { Linking } from 'react-native';

export const FEEDBACK_EMAIL = 'framers.42clacks@icloud.com';
const FEEDBACK_SUBJECT = '日本道之駅磁鐵收集帳 意見反映';

export type OpenFeedbackEmailResult = 'composed' | 'opened' | 'unavailable';

export async function openFeedbackEmail(): Promise<OpenFeedbackEmailResult> {
  const mailtoWithSubject = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`;
  const mailtoSimple = `mailto:${FEEDBACK_EMAIL}`;

  try {
    if (await MailComposer.isAvailableAsync()) {
      await MailComposer.composeAsync({
        recipients: [FEEDBACK_EMAIL],
        subject: FEEDBACK_SUBJECT,
      });
      return 'composed';
    }
  } catch {
    // Fall through to mailto links.
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
