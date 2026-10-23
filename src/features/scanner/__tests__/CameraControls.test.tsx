import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { CameraCapture } from '../CameraCapture';

/**
 * The shutter sat right of centre.
 *
 * The control bar laid four buttons out with `space-between` - barcode,
 * library, shutter, by-hand - so the shutter was the third of four and
 * landed off the screen's centre line. On a camera screen the shutter is
 * the one control a thumb goes to without looking, and it being off centre
 * is immediately visible.
 *
 * It is now flanked by two groups of equal weight, so it stays centred
 * whatever is put beside it. That is what these tests pin: not the number
 * of buttons, which may change, but that the two sides balance.
 */

function noop() {}

async function renderControls() {
  await renderWithProviders(
    <CameraCapture
      onCaptured={noop}
      onPickFromLibrary={noop}
      onClose={noop}
      onAddByHand={noop}
      onScanBarcode={noop}
    />,
  );
}

/** The bar holding the shutter: the shutter's own parent. */
function controlBar() {
  const shutter = screen.getByLabelText('Take the photo');
  return shutter.parent;
}

describe('the camera controls', () => {
  it('puts the shutter between two groups, not in a row of four', async () => {
    await renderControls();

    const children = (controlBar()?.children ?? []).filter(
      (child) => typeof child !== 'string',
    );
    expect(children).toHaveLength(3);
  });

  it('gives the groups either side of it equal weight', async () => {
    await renderControls();

    const children = (controlBar()?.children ?? []).filter(
      (child) => typeof child !== 'string',
    ) as { props?: { style?: Parameters<typeof StyleSheet.flatten>[0] } }[];

    const left = StyleSheet.flatten(children[0]?.props?.style) as { flex?: number };
    const right = StyleSheet.flatten(children[2]?.props?.style) as { flex?: number };

    expect(left?.flex).toBe(1);
    expect(right?.flex).toBe(left?.flex);
  });

  it('still offers every control it had', async () => {
    await renderControls();

    expect(screen.getByLabelText('Take the photo')).toBeTruthy();
    expect(screen.getByLabelText("Scan a packet's barcode")).toBeTruthy();
    expect(screen.getByLabelText('Choose from your photos')).toBeTruthy();
    expect(screen.getByLabelText('Add a meal by hand')).toBeTruthy();
  });
});
