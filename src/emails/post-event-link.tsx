import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components';

export interface Props {
  firstName: string;
  eventTitle: string;
  postEventUrl: string;
}

export default function PostEventLinkEmail({ firstName, eventTitle, postEventUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Did you meet someone at {eventTitle}?</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#fafafa', padding: '24px' }}>
        <Container style={{ maxWidth: 540, background: '#fff', borderRadius: 12, padding: 24 }}>
          <Heading style={{ margin: 0, fontSize: 22 }}>Thanks for coming, {firstName}!</Heading>
          <Text>Pick the people from <strong>{eventTitle}</strong> you&apos;d like to meet again. We&apos;ll only share contact info if it&apos;s mutual and you both consent.</Text>
          <Link href={postEventUrl} style={{ display: 'inline-block', background: '#e11d48', color: '#fff', padding: '10px 16px', borderRadius: 8, textDecoration: 'none' }}>
            Open my list
          </Link>
          <Text style={{ color: '#71717a', fontSize: 12, marginTop: 16 }}>
            Your selections stay private. No one sees who picked them.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
