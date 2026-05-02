import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components';

export interface Props {
  firstName: string;
  eventTitle: string;
  checkInUrl: string;
}

export default function ApplicationReceivedEmail({ firstName, eventTitle, checkInUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>You&apos;re on the list for {eventTitle}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#fafafa', padding: '24px' }}>
        <Container style={{ maxWidth: 540, background: '#fff', borderRadius: 12, padding: 24 }}>
          <Heading style={{ margin: 0, fontSize: 22 }}>Thanks, {firstName} 💛</Heading>
          <Text>Your application for <strong>{eventTitle}</strong> is in. We&apos;ll email you once the host approves your spot.</Text>
          <Section style={{ marginTop: 16 }}>
            <Text>When the event starts, use this private link to check in:</Text>
            <Link href={checkInUrl} style={{ display: 'inline-block', background: '#e11d48', color: '#fff', padding: '10px 16px', borderRadius: 8, textDecoration: 'none' }}>
              Open check-in
            </Link>
          </Section>
          <Text style={{ color: '#71717a', fontSize: 12, marginTop: 24 }}>
            Powered by DateOps Live. Your contact info stays private until both you and another attendee consent to share.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
