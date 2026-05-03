import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components';

export interface Props {
  firstName: string;
  eventTitle: string;
  startsAt: string;
  venue: string;
  checkInUrl: string;
  window: '24h' | '1h';
}

export default function EventReminderEmail({ firstName, eventTitle, startsAt, venue, checkInUrl, window }: Props) {
  const hed = window === '24h' ? `Tomorrow: ${eventTitle}` : `Starting soon: ${eventTitle}`;
  return (
    <Html>
      <Head />
      <Preview>{hed}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#fafafa', padding: '24px' }}>
        <Container style={{ maxWidth: 540, background: '#fff', borderRadius: 12, padding: 24 }}>
          <Heading style={{ margin: 0, fontSize: 22 }}>Hey {firstName},</Heading>
          <Text>{hed} — {startsAt}{venue ? ` at ${venue}` : ''}.</Text>
          <Link href={checkInUrl} style={{ display: 'inline-block', background: '#e11d48', color: '#fff', padding: '10px 16px', borderRadius: 8, textDecoration: 'none' }}>
            Open your check-in link
          </Link>
          <Text style={{ color: '#71717a', fontSize: 12, marginTop: 16 }}>
            See you there 💛
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
