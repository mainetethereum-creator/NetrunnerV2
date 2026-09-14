'use client';

import Link from 'next/link';
import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {useAccount, useConnect, useDisconnect} from 'wagmi';
import {ASSET_URLS} from '../../assets/registry.ts';
import {HUB_CARDS, HUB_NAV, shortAddress, type HubCard, type HubNavItem} from './hub-content.ts';
import HubIcon from './HubIcon';
import styles from './Hub.module.css';

// Layers (UI kit rule): backdrop and character are separate, replaceable images;
// panels, buttons and text are HTML/CSS. Three layouts: desktop, mobile landscape,
// mobile portrait (see docs/ui-kits/README.md).

function NavEntry({item}: {item: HubNavItem}) {
  const content = (
    <>
      <HubIcon name={item.icon} />
      <span>{item.label}</span>
      {!item.href && <em>Soon</em>}
    </>
  );
  if (!item.href) {
    return <span className={`${styles.navItem} ${styles.navSoon}`} aria-disabled="true">{content}</span>;
  }
  return (
    <Link href={item.href} className={styles.navItem} aria-current={item.href === '/' ? 'page' : undefined}>
      {content}
    </Link>
  );
}

function CardEntry({card}: {card: HubCard}) {
  const className = `${styles.card} ${styles[card.tone]}`;
  const style = {'--art': `url(${card.art})`} as CSSProperties;
  const body = (
    <>
      <span className={styles.cardText}>
        {card.eyebrow && <small className={styles.eyebrow}>{card.eyebrow}</small>}
        <strong>{card.title}</strong>
        <span className={styles.subtitle}>{card.subtitle}</span>
        {card.note && <span className={styles.note}>{card.note}</span>}
      </span>
      {card.href ? (
        <i className={styles.cardArrow} aria-hidden="true"><HubIcon name="chevron" /></i>
      ) : (
        card.status && <em className={styles.status}>{card.status}</em>
      )}
    </>
  );
  return card.href ? (
    <Link href={card.href} className={className} style={style}>{body}</Link>
  ) : (
    <div className={className} style={style} aria-disabled="true">{body}</div>
  );
}

function WalletControl() {
  const {address, isConnected} = useAccount();
  const {connectors, connectAsync, isPending} = useConnect();
  const {disconnect} = useDisconnect();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className={styles.walletWrap} ref={root}>
      <button
        type="button"
        className={styles.wallet}
        aria-expanded={open}
        onClick={() => {
          setError('');
          setOpen((value) => !value);
        }}
      >
        <HubIcon name="wallet" />
        <span>{isConnected && address ? shortAddress(address) : 'Connect wallet'}</span>
        <HubIcon name="chevron" />
      </button>
      {open && (
        <div className={styles.walletMenu} role="dialog" aria-label="Wallet">
          {isConnected && address ? (
            <>
              <small>Connected wallet</small>
              <code>{address}</code>
              <button type="button" onClick={() => { disconnect(); setOpen(false); }}>Disconnect</button>
            </>
          ) : (
            <>
              <small>Connect a wallet or play as a guest. Connecting signs no transaction.</small>
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  type="button"
                  disabled={isPending}
                  onClick={async () => {
                    setError('');
                    try {
                      await connectAsync({connector});
                      setOpen(false);
                    } catch {
                      setError('Connection was cancelled or unavailable.');
                    }
                  }}
                >
                  {connector.name}
                </button>
              ))}
              {!connectors.length && <p>No wallet connector is available.</p>}
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function HubApp() {
  const layers = {
    '--hub-backdrop': `url(${ASSET_URLS.ui.hubBackdrop})`,
    '--hub-character': `url(${ASSET_URLS.ui.hubCharacter})`,
    '--hub-avatar': `url(${ASSET_URLS.ui.runnerAvatar})`,
  } as CSSProperties;

  return (
    <main className={styles.hub} style={layers}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.character} aria-hidden="true" />

      <header className={styles.header}>
        <h1 className={styles.logo}>
          <Link href="/">
            <strong>CYBERBASE</strong>
            <small>Explore · Fight · Own</small>
          </Link>
        </h1>
        <p className={styles.tagline}>A new world on <b>Base</b></p>
        <div className={styles.account}>
          <div className={styles.profile}>
            <span className={styles.avatar} aria-hidden="true" />
            <span>
              <strong>Neon Sentinel</strong>
              <small>Lv. 1</small>
            </span>
          </div>
          <WalletControl />
        </div>
      </header>

      <nav className={styles.nav} aria-label="Hub">
        <ul>
          {HUB_NAV.map((item) => (
            <li key={item.id} className={item.tab ? undefined : styles.wideOnly}>
              <NavEntry item={item} />
            </li>
          ))}
        </ul>
        <p className={styles.navSlogan}>More than a game.<br />A new reality.</p>
      </nav>

      <div className={styles.hero} aria-hidden="true">
        <p className={styles.slogan}>Humans build<br />better worlds</p>
      </div>

      <section className={styles.content} aria-label="Play and events">
        <div className={styles.playWrap}>
          <Link href="/base" className={styles.play}>
            <HubIcon name="play" />
            <span>
              <strong>Play</strong>
              <small>Enter the base</small>
            </span>
            <i aria-hidden="true"><HubIcon name="chevron" /></i>
          </Link>
        </div>
        <ul className={styles.cards}>
          {HUB_CARDS.map((card) => (
            <li key={card.id} className={styles[`area_${card.id}`]}>
              <CardEntry card={card} />
            </li>
          ))}
        </ul>
      </section>

      <footer className={styles.footer}>
        <span>Same players. A brighter tomorrow.</span>
        <span>v0.1.0 · Onchain <b>·</b> On Base</span>
      </footer>
    </main>
  );
}
