import type { Preview } from '@storybook/react-vite';
import { create } from 'storybook/theming';
// The studio renders the host's `FullGraph`; the host ships its styles (and
// the DejaVu Sans font) as one stylesheet on the `./style.css` subpath.
import '@theclearsky/react-blender-nodes/style.css';

const docsTheme = create({
  base: 'dark',
});

const preview: Preview = {
  parameters: {
    docs: {
      theme: docsTheme,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
