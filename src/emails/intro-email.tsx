import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';

export interface Props {
  toFirstName: string;
  otherFirstName: string;
  otherLastName: string;
  otherEmail: string;
  eventTitle: string;
}

export default function IntroEmail({ toFirstName, otherFirstName, otherLastName, otherEmail, eventTitle }: Props) {
  return (
    <Html>
      <Head />
      <Preview>You both said yes — meet {otherFirstName}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#fafafa', padding: '24px' }}>
        <Container style={{ maxWidth: 540, background: '#fff', borderRadius: 12, padding: 24 }}>
          <Heading style={{ margin: 0, fontSize: 22 }}>It&apos;s a match, {toFirstName} 🎉</Heading>
          <Text>You and <strong>{otherFirstName} {otherLastName}</strong> both expressed interest after <strong>{eventTitle}</strong> and consented to share contact info.</Text>
          <Text>Here&apos;s their email so you can say hi: <strong>{otherEmail}</strong></Text>
          <Text style={{ color: '#71717a', fontSize: 12, marginTop: 16 }}>
            Be respectful. If they don&apos;t respond, please don&apos;t reach out again.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
