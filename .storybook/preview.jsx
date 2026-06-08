import "../src/index.css";
import "../src/App.css";

/** @type { import('@storybook/react-webpack5').Preview } */
const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      description: "App theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "dark",
  },
  decorators: [
    (Story, { globals }) => {
      const theme = globals.theme || "dark";
      return (
        <div
          className={`theme-${theme}`}
          style={{
            background: "var(--bg-primary)",
            minHeight: "100vh",
            padding: "1rem",
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
