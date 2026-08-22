import * as MailComposer from 'expo-mail-composer';
import { Linking } from 'react-native';

import { FEEDBACK_EMAIL, openFeedbackEmail } from '../openFeedbackEmail';

jest.mock('expo-mail-composer', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(),
  composeAsync: jest.fn(),
}));

const mockedMailComposer = MailComposer as jest.Mocked<typeof MailComposer>;

describe('openFeedbackEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedMailComposer.isAvailableAsync.mockResolvedValue(false);
    mockedMailComposer.composeAsync.mockResolvedValue({ status: 'sent' });
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the native mail composer when available', async () => {
    mockedMailComposer.isAvailableAsync.mockResolvedValue(true);

    await expect(openFeedbackEmail()).resolves.toBe('composed');
    expect(mockedMailComposer.composeAsync).toHaveBeenCalledWith({
      recipients: [FEEDBACK_EMAIL],
      subject: '攻城師 意見反映',
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('falls back to mailto when the composer is unavailable', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockImplementation(async (url: string) =>
      url.startsWith(`mailto:${FEEDBACK_EMAIL}`),
    );

    await expect(openFeedbackEmail()).resolves.toBe('opened');
    expect(Linking.openURL).toHaveBeenCalledWith(
      `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('攻城師 意見反映')}`,
    );
  });

  it('returns unavailable when no mail handler can be opened', async () => {
    await expect(openFeedbackEmail()).resolves.toBe('unavailable');
  });
});
