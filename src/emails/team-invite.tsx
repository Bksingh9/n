import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components';

export interface Props {
  inviterName: string;
  organizationName: string;
  acceptUrl: string;
  role: string;
}

export default function TeamInviteEmail({ inviterName, organizationName, acceptUrl, role }: Props) {
  return (
    <Html>
      <Head />
      <Preview>You&apos;ve been invited to {organizationName}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#fafafa', padding: '24px' }}>
        <Container style={{ maxWidth: 540, background: '#fff', borderRadius: 12, padding: 24 }}>
          <Heading style={{ margin: 0, fontSize: 22 }}>Join {organizationName}</Heading>
          <Text>{inviterName} invited you to collaborate on DateOps Live as <strong>{role}</strong>.</Text>
          <Section style={{ marginTop: 16 }}>
            <Link href={acceptUrl} style={{ display: 'inline-block', background: '#e11d48', color: '#fff', padding: '10px 16px', borderRadius: 8, textDecoration: 'none' }}>
              Accept invitation
            </Link>
          </Section>
          <Text style={{ color: '#71717a', fontSize: 12, marginTop: 24 }}>
            This invite expires in 14 days. If you didn&apos;t expect this email, you can ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
