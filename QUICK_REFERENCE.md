# Quick Reference Card

## 🚨 Emergency Actions

### Exposed API Key
```bash
# 1. Revoke at: https://platform.openai.com/api-keys
# 2. Create new key
# 3. Update .env (never commit this file!)
```

### App Won't Start
```bash
# Check logs
npm run dev

# Clear cache
rm -rf node_modules
npm install

# Check Electron version
npm list electron
```

## 📁 File Guide

| File | Purpose | When to Use |
|------|---------|-------------|
| `REVIEW_SUMMARY.md` | Overview of findings | Start here |
| `QUICK_FIXES.md` | Immediate fixes with code | Apply critical fixes |
| `CODE_REVIEW.md` | Detailed analysis | Deep dive into issues |
| `IMPROVEMENTS_CHECKLIST.md` | Track progress | Daily/weekly planning |
| `.env.example` | Config template | Setup new environment |

## 🔧 Common Commands

### Development
```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Build for specific platform
npm run build:mac
npm run build:win
npm run build:linux
```

### Code Quality
```bash
# Lint code (after setup)
npm run lint

# Format code (after setup)
npm run format

# Run tests (after setup)
npm test
```

## 🐛 Common Issues & Solutions

### Issue: "API key invalid"
**Solution**: 
1. Check `.env` file exists
2. Verify key format: `sk-proj-...` or `sk-...`
3. Test key at platform.openai.com

### Issue: "Files not loading"
**Solution**:
1. Check file extensions: `.md`, `.markdown`, `.txt`
2. Verify file permissions
3. Check logs in app (⚙️ → View Logs)

### Issue: "Clustering fails"
**Solution**:
1. Verify API key is valid
2. Check internet connection
3. Reduce number of files (try with 5-10 first)
4. Check OpenAI API status

### Issue: "App crashes on startup"
**Solution**:
1. Check console for errors
2. Clear app data: Delete `~/Library/Application Support/markdown-clusterer` (Mac)
3. Reinstall dependencies: `rm -rf node_modules && npm install`

## 🎯 Quick Wins (30 min each)

1. **Add Error Boundary** → See QUICK_FIXES.md
2. **Fix FileDropZone prop** → See QUICK_FIXES.md
3. **Add .env.example** → ✅ Done!
4. **Extract constants** → See CODE_REVIEW.md
5. **Add loading states** → See CODE_REVIEW.md

## 📊 Project Stats

```
Components:     7
IPC Handlers:   12
Dependencies:   15
Dev Dependencies: 12
Lines of Code:  ~2000
```

## 🔐 Security Checklist

- [ ] API key revoked
- [ ] New API key created
- [ ] `.env` not committed
- [ ] Secure storage implemented
- [ ] Input validation added

## 🚀 Performance Tips

1. **Large file sets** (100+ files):
   - Use virtual scrolling
   - Increase batch size
   - Consider pagination

2. **Slow clustering**:
   - Reduce preview length
   - Use smaller embedding model
   - Process in smaller batches

3. **Memory issues**:
   - Limit file size (add validation)
   - Clear files between sessions
   - Monitor with DevTools

## 📱 Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open DevTools | `Cmd/Ctrl + Shift + I` |
| Reload App | `Cmd/Ctrl + R` |
| Quit | `Cmd/Ctrl + Q` |

## 🔍 Debugging

### Enable Debug Logs
```javascript
// In electron/main.js
logger.debug('Your debug message', { data });
```

### View Logs
1. Click ⚙️ in header
2. Select "View Logs"
3. Or "Open Log Folder"

### Common Log Locations
- **Mac**: `~/Library/Application Support/markdown-clusterer/`
- **Windows**: `%APPDATA%/markdown-clusterer/`
- **Linux**: `~/.config/markdown-clusterer/`

## 🎨 Customization

### Change Cluster Colors
Edit `src/components/ClusterView.jsx`:
```javascript
const clusterColors = [
  'from-blue-500/20 to-blue-700/20 border-blue-500/30',
  // Add your colors here
];
```

### Change AI Model
Edit `electron/main.js`:
```javascript
model: 'gpt-4o-mini', // Change to 'gpt-4o', 'gpt-4-turbo', etc.
```

### Adjust Preview Length
Edit `electron/main.js`:
```javascript
const preview = f.content.substring(0, 1500); // Change 1500
```

## 📞 Getting Help

1. **Check logs** (⚙️ → View Logs)
2. **Review error messages** carefully
3. **Search issues** in GitHub repo
4. **Check OpenAI status** page
5. **Verify API credits** remaining

## 🎓 Learning Path

### Week 1: Security & Stability
- [ ] Fix critical security issues
- [ ] Add error boundaries
- [ ] Implement secure storage

### Week 2: Code Quality
- [ ] Add TypeScript
- [ ] Set up linting
- [ ] Add unit tests

### Week 3: Performance
- [ ] Implement virtual scrolling
- [ ] Add memoization
- [ ] Optimize API calls

### Week 4: Polish
- [ ] Improve accessibility
- [ ] Add keyboard shortcuts
- [ ] Enhance UX

## 💡 Pro Tips

1. **Test with small datasets first** (5-10 files)
2. **Use AI hints** for better cluster names
3. **Rename clusters** before organizing
4. **Try different cluster counts** for best results
5. **Use copy mode** first, then move when satisfied
6. **Enable tag injection** for better organization

## 🔗 Useful Links

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Electron Docs](https://www.electronjs.org/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)

## 📝 Quick Notes Space

```
Date: ___________
Current Task: ___________
Blockers: ___________
Next Steps: ___________
```

---

**Keep this file handy for quick reference!** 📌
