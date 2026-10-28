import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

const LOGO = '/pg-logo.png';

// ── FRONT: High-Resolution PG UTSAV 2026 VIP Greeting Card ──
export function GuestCardFront({ guest, isHighRes = false, forDownload = false, print = false }) {
  const scale = isHighRes ? 2 : 1;
  const cardStyle = {
    width: 320 * scale,
    height: 202 * scale,
    boxSizing: 'border-box',
    borderRadius: 12 * scale,
    overflow: 'hidden',
    border: `${2 * scale}px solid #7B1FA2`, // Matching Royal Purple Border
    display: 'inline-flex',
    boxShadow: (forDownload || print) ? 'none' : '0 8px 24px rgba(123, 31, 162, 0.35)',
    position: 'relative',
    background: '#1A002C',
    verticalAlign: 'top',
  };

  return (
    <div style={cardStyle}>
      <img
        src="/guest_card_front.jpg"
        alt="PG Utsav 2026 VIP Guest Greeting"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  );
}

// ── BACK: Premium VIP Guest Card with #EBEDE3 Background & Royal Purple Border ──
export function GuestCardBack({ guest, isHighRes = false, forDownload = false, print = false }) {
  // Inside QR text: When scanned, displays Name, Unit, and their Lucky Number
  const qrText =
`GUEST NAME: ${guest.name || ''}
UNIT: ${guest.unit || 'PGTL'}
LUCKY NUMBER: ${guest.serialNo || ''}`;

  const scale = isHighRes ? 2 : 1;

  const cardStyle = {
    width: 320 * scale,
    height: 202 * scale,
    boxSizing: 'border-box',
    padding: `${10 * scale}px ${14 * scale}px`,
    border: `${2 * scale}px solid #7B1FA2`, // Royal Purple Border as requested
    borderRadius: 12 * scale,
    background: '#EBEDE3', // Requested #EBEDE3 Background Colour
    color: '#0f172a',
    display: 'inline-flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: (forDownload || print) ? 'none' : '0 8px 24px rgba(123, 31, 162, 0.25)',
    fontFamily: 'Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
    verticalAlign: 'top',
  };

  return (
    <div style={cardStyle}>
      {/* Subtle Inner Decorative Border */}
      <div
        style={{
          position: 'absolute',
          inset: 4 * scale,
          border: `${1 * scale}px solid rgba(123, 31, 162, 0.22)`,
          borderRadius: 8 * scale,
          pointerEvents: 'none',
        }}
      />

      {/* Top Header with Celebration Crackers / Fireworks Design */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `${1 * scale}px solid rgba(123, 31, 162, 0.22)`,
          paddingBottom: 4 * scale,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <img
          src={LOGO}
          alt="PG Logo"
          style={{
            height: 24 * scale,
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
          }}
        />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div
            style={{
              fontSize: 11 * scale,
              fontWeight: 900,
              color: '#581c87', // Royal Purple
              letterSpacing: 0.8 * scale,
              lineHeight: 1.15,
            }}
          >
            PG FORTUNE FIESTA 2026
          </div>
          <div
            style={{
              fontSize: 8 * scale,
              color: '#475569',
              fontWeight: 700,
              marginTop: 1 * scale,
              letterSpacing: 0.5 * scale,
            }}
          >
            ✦ Honored VIP Special Invitee ✦
          </div>
        </div>

        {/* Celebration Crackers & Fireworks Icon Design */}
        <div
          style={{
            fontSize: 16 * scale,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 2 * scale,
          }}
          title="Celebration Crackers"
        >
          <span>🎆</span>
          <span style={{ fontSize: 11 * scale }}>✨</span>
        </div>
      </div>

      {/* Middle Content: Scannable QR Code (Left) + VIP PASS & Details (Right) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12 * scale,
          margin: `${4 * scale}px 0`,
          width: '100%',
          flex: 1,
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Scannable QR Code in Clean White Container with Purple Border */}
        <div
          style={{
            flexShrink: 0,
            background: '#ffffff',
            padding: 5 * scale,
            borderRadius: 6 * scale,
            border: `${1.5 * scale}px solid #7B1FA2`,
            boxShadow: '0 2px 6px rgba(123, 31, 162, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <QRCodeSVG value={qrText} size={68 * scale} level="M" includeMargin={false} />
        </div>

        {/* Guest Details List: VIP PASS directly above Name, then Name & Unit, then Lucky No */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 3.5 * scale,
            textAlign: 'left',
            justifyContent: 'center',
          }}
        >
          {/* Prominent VIP PASS Badge directly above Name */}
          <div style={{ marginBottom: 1 * scale, display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)',
                color: '#FFD700',
                fontWeight: 900,
                fontSize: 9 * scale,
                letterSpacing: 1.2 * scale,
                paddingTop: `${0.8 * scale}px`,
                paddingBottom: `${3.5 * scale}px`,
                paddingLeft: `${8 * scale}px`,
                paddingRight: `${8 * scale}px`,
                borderRadius: 4 * scale,
                textTransform: 'uppercase',
                gap: 4 * scale,
                boxShadow: (forDownload || print) ? 'none' : '0 2px 6px rgba(123, 31, 162, 0.3)',
                lineHeight: 1,
              }}
            >
              <span>★</span> VIP PASS <span>★</span>
            </span>
          </div>

          {/* Guest Name - Clear, Bold & High Contrast on #EBEDE3 */}
          <div
            style={{
              fontSize: 11.5 * scale,
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.3,
            }}
          >
            <span style={{ color: '#581c87', fontWeight: 800 }}>NAME: </span>
            <span>{guest.name}</span>
          </div>

          {/* Guest Unit Only */}
          <div
            style={{
              fontSize: 10 * scale,
              color: '#0f172a',
              fontWeight: 800,
              lineHeight: 1.3,
            }}
          >
            <span style={{ color: '#581c87', fontWeight: 800 }}>UNIT: </span>
            <span>{guest.unit || 'PGTL'}</span>
          </div>

          {/* Lucky Number Tag with Balanced Vertical Background Centering */}
          <div style={{ marginTop: 2 * scale, display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9 * scale,
                fontWeight: 900,
                color: '#ffffff',
                background: '#7B1FA2', // Royal Purple Pill
                border: `${1 * scale}px solid #581c87`,
                paddingTop: `${0.8 * scale}px`,
                paddingBottom: `${3.5 * scale}px`,
                paddingLeft: `${8 * scale}px`,
                paddingRight: `${8 * scale}px`,
                borderRadius: 4 * scale,
                letterSpacing: 0.5 * scale,
                lineHeight: 1,
                boxShadow: `0 ${1 * scale}px ${2 * scale}px rgba(0,0,0,0.15)`,
              }}
            >
              LUCKY NO: #{guest.serialNo}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Footer with Celebration Sparkles & Crackers */}
      <div
        style={{
          width: '100%',
          textAlign: 'center',
          borderTop: `${1 * scale}px solid rgba(123, 31, 162, 0.22)`,
          paddingTop: 3 * scale,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontSize: 7.5 * scale,
            color: '#581c87',
            fontWeight: 700,
            letterSpacing: 0.6 * scale,
          }}
        >
          ✨ 🎆 PG Group • Grand Diwali Fortune Fiesta 2026 🎇 ✨
        </div>
      </div>
    </div>
  );
}

export default function GuestCardsViewer({ guests = [] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {guests.map((g) => (
        <div key={g._id || g.serialNo} style={{ display: 'flex', gap: 10 }}>
          <GuestCardFront guest={g} />
          <GuestCardBack guest={g} />
        </div>
      ))}
    </div>
  );
}
