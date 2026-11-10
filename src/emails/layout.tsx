import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type * as React from "react";

import { siteConfig } from "@/lib/site";

// The frame every Mintly email uses (plan §5: React Email templates).

const styles = {
  body: { backgroundColor: "#f6f7f9", fontFamily: "Helvetica, Arial, sans-serif", margin: 0 },
  container: {
    backgroundColor: "#ffffff",
    margin: "24px auto",
    maxWidth: "560px",
    padding: "32px",
  },
  brand: { color: "#0f766e", fontSize: "20px", fontWeight: 700, margin: "0 0 24px" },
  footer: { color: "#6b7280", fontSize: "12px", lineHeight: "18px" },
} as const;

export const text = { fontSize: "15px", lineHeight: "24px", color: "#111827" } as const;

export function EmailLayout({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>Mintly</Text>
          <Section>{children}</Section>
          <Hr />
          <Text style={styles.footer}>
            Need help? Email {siteConfig.supportEmail}. Mintly, {siteConfig.canonicalUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
