import React from "react";
import { Anchor, Container, Text } from "@mantine/core";
import {
  IconCoffee,
  IconHeart,
  IconHeartFilled,
  IconStar,
} from "@tabler/icons-react";
import { DiscordIcon, GitHubIcon } from "../../icons";
import classes from "./Footer.module.css";

const supportLinks = [
  {
    label: "Buy me a coffee",
    href: "https://ko-fi.com/zatdev",
    external: true,
    icon: <IconCoffee size={14} />,
  },
  {
    label: "Sponsor on GitHub",
    href: "https://github.com/sponsors/coleestrin",
    external: true,
    icon: <IconHeart size={14} />,
  },
  {
    label: "Star on GitHub",
    href: "https://github.com/coleestrin/pd2-tools",
    external: true,
    icon: <IconStar size={14} />,
  },
];

const aboutLinks = [
  {
    label: "Discord",
    href: "https://discord.gg/TVTExqWRhK",
    external: true,
    icon: <DiscordIcon size={14} />,
  },
  {
    label: "GitHub",
    href: "https://github.com/coleestrin/pd2-tools",
    external: true,
    icon: <GitHubIcon size={14} />,
  },
  { label: "About", href: "/about" },
];

const resourceLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Contact", href: "/about" },
];

const exploreLinks = [
  { label: "Builds", href: "/builds" },
  { label: "Economy", href: "/economy/currency" },
  { label: "Statistics", href: "/statistics" },
  { label: "Leaderboard", href: "/leaderboard" },
];

export function Footer() {
  return (
    <footer className={classes.footer} style={{ marginTop: "auto" }}>
      <Container size={1280} className={classes.shell}>
        <div className={classes.primaryRow}>
          <section className={classes.section}>
            <h2 className={classes.sectionTitle}>
              Support{" "}
              <span className={classes.heartIcon}>
                <IconHeartFilled size={16} />
              </span>
            </h2>
            <div className={classes.linkList}>
              {supportLinks.map((link) => (
                <Anchor
                  key={link.label}
                  className={classes.footerLink}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                >
                  <span className={classes.linkInner}>
                    {link.icon ? (
                      <span className={classes.linkIcon}>{link.icon}</span>
                    ) : null}
                    <span className={classes.linkLabel}>{link.label}</span>
                  </span>
                </Anchor>
              ))}
            </div>
          </section>

          <section className={classes.section}>
            <h2 className={classes.sectionTitle}>About</h2>
            <div className={classes.linkList}>
              {aboutLinks.map((link) => (
                <Anchor
                  key={link.label}
                  className={classes.footerLink}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                >
                  <span className={classes.linkInner}>
                    {link.icon ? (
                      <span className={classes.linkIcon}>{link.icon}</span>
                    ) : null}
                    <span className={classes.linkLabel}>{link.label}</span>
                  </span>
                </Anchor>
              ))}
            </div>
          </section>

          <section className={classes.section}>
            <h2 className={classes.sectionTitle}>Resources</h2>
            <div className={classes.linkList}>
              {resourceLinks.map((link) => (
                <Anchor
                  key={link.label}
                  className={classes.footerLink}
                  href={link.href}
                >
                  <span className={classes.linkLabel}>{link.label}</span>
                </Anchor>
              ))}
            </div>
          </section>

          <section className={classes.section}>
            <h2 className={classes.sectionTitle}>Explore</h2>
            <div className={classes.linkList}>
              {exploreLinks.map((link) => (
                <Anchor
                  key={link.label}
                  className={classes.footerLink}
                  href={link.href}
                >
                  <span className={classes.linkLabel}>{link.label}</span>
                </Anchor>
              ))}
            </div>
          </section>
        </div>

        <div className={classes.bottomBar}>
          <Text className={classes.disclaimer}>
            pd2.tools is not affiliated with or endorsed by the Project Diablo 2 team.
          </Text>
        </div>
      </Container>
    </footer>
  );
}
