import twilio from 'twilio';

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
  }
  return twilio(accountSid, authToken);
}

export async function sendWhatsAppMessage(to: string, body: string) {
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) {
    throw new Error('TWILIO_WHATSAPP_NUMBER (or TWILIO_PHONE_NUMBER) is not set');
  }
  const from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
  return getClient().messages.create({
    body,
    from,
    to: `whatsapp:${to}`,
  });
}

export function processIncomingWhatsAppMessage(payload: Record<string, unknown>) {
  const from = String(payload.From || '').replace('whatsapp:', '');
  const messageBody = String(payload.Body || '');
  return { from, messageBody };
}

export function isValidTwilioRequest(signature: string | null, url: string, params: Record<string, unknown>) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken || !signature) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}
