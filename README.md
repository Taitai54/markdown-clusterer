# Markdown Clusterer

An AI-powered desktop application for organizing and clustering markdown transcripts using semantic analysis. Built with Electron and React for cross-platform compatibility (Mac, Windows, Linux).

![Markdown Clusterer](https://img.shields.io/badge/Platform-Mac%20%7C%20Windows%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **AI-Powered Clustering**: Uses OpenAI's GPT models to analyze content and group similar documents
- **Drag-and-Drop Interface**: Intuitive GUI for managing and reorganizing files
- **Cross-Platform**: Works on macOS, Windows, and Linux
- **Manual Refinement**: Drag files between clusters to fine-tune organization
- **Rename Clusters**: Click cluster names to customize folder names
- **Batch Organization**: Automatically copies files into organized folder structure

## Screenshots

The application provides a clean, modern interface with:
- Drop zone for easy file import
- File preview cards with content snippets
- Color-coded cluster visualization
- Real-time drag-and-drop reorganization

## Prerequisites

- **Node.js** 18.x or higher
- **npm** or **pnpm** package manager
- **OpenAI API Key** (get one at [platform.openai.com](https://platform.openai.com))

## Installation

### Option 1: Run from Source (Recommended for Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/markdown-clusterer.git
   cd markdown-clusterer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm run dev
   ```

### Option 2: Build Standalone Application

1. **Clone and install** (same as above)

2. **Build for your platform**
   ```bash
   # For macOS
   npm run build:mac
   
   # For Windows
   npm run build:win
   
   # For Linux
   npm run build:linux
   ```

3. **Find the built application** in the `release/` directory

## Usage

### 1. Set Your API Key
When you first launch the app, you'll be prompted to enter your OpenAI API key. This key is stored locally and only used to communicate with OpenAI's servers.

### 2. Import Files
- **Select Folder**: Import all markdown files from a directory
- **Select Files**: Choose specific files to import
- **Drag & Drop**: Drop files directly onto the application window

Supported formats: `.md`, `.markdown`, `.txt`

### 3. Configure Clustering
- Adjust the number of clusters using the input field
- The app suggests an optimal number based on your file count

### 4. Run AI Clustering
Click "Cluster with AI" to analyze your files. The AI will:
- Read the content of each file
- Identify common themes and topics
- Group related files into clusters
- Generate descriptive cluster names

### 5. Refine Results
- **Drag files** between clusters to reorganize
- **Click cluster names** to rename them
- **Review** the organization before committing

### 6. Organize Files
1. Click "Select Output Folder" to choose a destination
2. Click "Organize Files" to copy files into cluster folders
3. Original files remain untouched; copies are created in the output folder

## Project Structure

```
markdown-clusterer/
├── electron/
│   ├── main.js          # Electron main process
│   └── preload.js       # Secure IPC bridge
├── src/
│   ├── components/      # React components
│   │   ├── ApiKeyModal.jsx
│   │   ├── ClusterView.jsx
│   │   ├── FileDropZone.jsx
│   │   ├── FileList.jsx
│   │   ├── Header.jsx
│   │   └── ProgressModal.jsx
│   ├── App.jsx          # Main application
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind CSS config
└── README.md            # This file
```

## Configuration

### Changing the AI Model

By default, the app uses `gpt-4o-mini` for cost-effective clustering. To use a different model, edit `electron/main.js`:

```javascript
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4o',  // or 'gpt-4-turbo', 'gpt-3.5-turbo', etc.
  // ...
});
```

### Adjusting Content Analysis

The app analyzes the first 1500 characters of each file. To change this, modify the `cluster-files` handler in `electron/main.js`:

```javascript
const preview = f.content.substring(0, 3000);  // Increase for better accuracy
```

## Troubleshooting

### "API key invalid" error
- Ensure your OpenAI API key is correct and has available credits
- Check that your API key has access to the GPT models

### Files not appearing
- Verify files have `.md`, `.markdown`, or `.txt` extensions
- Check file permissions

### Clustering seems inaccurate
- Try increasing the content preview length
- Adjust the number of clusters
- Use a more capable model (e.g., `gpt-4o`)

## Development

### Running in Development Mode
```bash
npm run dev
```
This starts both the Vite dev server and Electron with hot reload.

### Building for Production
```bash
npm run build
```

### Technology Stack
- **Electron** - Cross-platform desktop framework
- **React** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **OpenAI API** - AI-powered content analysis

## License

MIT License - feel free to use, modify, and distribute.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Powered by [OpenAI](https://openai.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
