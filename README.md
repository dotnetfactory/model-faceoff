# Model Faceoff

<p align="center">
  <img src="assets/logo.png" alt="Model Faceoff" width="200">
</p>

<p align="center">
  Compare AI models from different providers side-by-side.
</p>

## Features

- **Side-by-side comparison** of up to 3 AI models simultaneously
- **Streaming responses** with real-time token display
- **Markdown rendering** for formatted AI responses
- **Conversation history** with search and replay
- **Usage tracking** with token counts and cost estimates
- **Model presets** to save your favorite model combinations
- **API logs** for debugging and cost monitoring
- **Auto-updates** via GitHub Releases
- **Cross-platform** - macOS, Windows, and Linux

## Download

**[Download from GitHub Releases](https://github.com/dotnetfactory/model-faceoff/releases)**

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `ModelFaceoff-x.x.x-arm64.dmg` |
| macOS (Intel) | `ModelFaceoff-x.x.x-x64.dmg` |
| Windows | `ModelFaceoff-x.x.x.Setup.exe` |
| Linux | `model-faceoff_x.x.x_amd64.deb` |

## Getting Started

1. Download and install Model Faceoff
2. Open Settings and enter your [OpenRouter API key](https://openrouter.ai/keys)
3. Click "Test Connection" to verify your key works
4. Select up to 3 models to compare
5. Type your prompt and click "Send to All"

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for current platform
npm run make

# Run tests
npm run test
```

## Configuration

Edit `app.config.ts` for app settings:

```typescript
export const config = {
  productName: 'Model Faceoff',
  executableName: 'model-faceoff',
  appBundleId: 'com.modelfaceoff.app',
  appDataFolder: 'ModelFaceoff',
  github: {
    owner: 'dotnetfactory',
    repo: 'model-faceoff',
    private: false,
  },
  autoUpdateEnabled: true,
};
```

## Tech Stack

- **Electron** - Desktop framework
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **better-sqlite3** - SQLite database
- **OpenRouter API** - AI model access

## Sponsored By

<a href="https://elitecoders.co">
  <img src="https://elitecoders-web.nyc3.cdn.digitaloceanspaces.com/wp-content/uploads/2023/12/logo_01.svg" alt="Elite Coders" height="40">
</a>

**[Elite Coders](https://www.elitecoders.co)** - Premium software development and consulting services.

---

## Author

Built by **[Emad Ibrahim](https://www.emadibrahim.com)**.

Website: [www.modelfaceoff.com](https://www.modelfaceoff.com)

## License

MIT
