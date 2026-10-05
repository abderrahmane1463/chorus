import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAND_TEMPLATES,
  brandingTokens,
  contrast,
  DEFAULT_BRANDING,
  readBranding,
} from '@/lib/branding/templates';
import { BRAND_TEMPLATE_IDS } from '@/types/branding';

const HEX = /^#[0-9a-f]{6}$/;

test('every template yields only six-digit colours', () => {
  // These values are written into a style sheet served to the audience, so
  // anything but a plain colour would be a way to inject into it.
  for (const template of BRAND_TEMPLATE_IDS) {
    for (const [name, value] of Object.entries(brandingTokens({ template, accent: null }))) {
      assert.match(value, HEX, `${template} ${name}`);
    }
  }
});

test('the event colour stands out from its page on every template, whatever was picked', () => {
  // Navy on a dark page, white on a light one: the cases a host does not
  // think about when typing their brand colour.
  for (const template of BRAND_TEMPLATE_IDS) {
    for (const accent of ['#000000', '#ffffff', '#0b1020', '#fbf8f3', '#db2777']) {
      const tokens = brandingTokens({ template, accent });
      const ratio = contrast(tokens['--primary'], BRAND_TEMPLATES[template].surfaces.background);
      assert.ok(ratio >= 3, `${template} with ${accent}: ${ratio.toFixed(2)}`);
    }
  }
});

test('text on a button in the event colour is readable', () => {
  for (const template of BRAND_TEMPLATE_IDS) {
    for (const accent of ['#16a394', '#eab308', '#2457e6', '#ffffff', '#000000']) {
      const tokens = brandingTokens({ template, accent });
      const ratio = contrast(tokens['--primary-foreground'], tokens['--primary']);
      assert.ok(ratio >= 3, `${template} with ${accent}: ${ratio.toFixed(2)}`);
    }
  }
});

test('a stored design is read defensively', () => {
  assert.equal(readBranding(null), null);
  assert.equal(readBranding('nonsense'), null);

  const read = readBranding({
    template: 'retired-template',
    accent: 'red; } body { display: none',
    logoId: '../../etc/passwd',
    partnerIds: ['not-an-id', '7b0e1d4e-6f0a-4c1e-9a52-1d3b2c4e5f60'],
    backgroundId: 42,
    logoPlate: 'yes',
  });

  assert.deepEqual(read, {
    ...DEFAULT_BRANDING,
    partnerIds: ['7b0e1d4e-6f0a-4c1e-9a52-1d3b2c4e5f60'],
  });
});

test('a colour is stored lowercase', () => {
  assert.equal(readBranding({ template: 'chorus', accent: '#DB2777' })?.accent, '#db2777');
});
