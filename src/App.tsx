import { useState, useEffect, useRef } from 'react';
import { 
  FileUp, 
  Sun, 
  Moon, 
  Layers, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  FileText, 
  FileCode, 
  Music, 
  Info, 
  ShieldCheck, 
  Zap, 
  X, 
  AlertCircle,
  Download,
  Trash2,
  Play
} from 'lucide-react';
import JSZip from 'jszip';

import type { ConvertedFile } from './types';
import { FileRow } from './components/FileRow';
import { BatchControls, CustomSelect } from './components/BatchControls';
import { ImageEditModal } from './components/ImageEditModal';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { convertImage, convertAudioToWav, convertText, convertToPDF } from './utils/converters';

const getFileCategory = (ext: string): 'image' | 'video' | 'document' | 'text' | 'audio' => {
  const images = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'ico', 'tiff', 'svg'];
  const audios = ['wav', 'mp3', 'ogg', 'm4a', 'flac', 'aac', 'wma'];
  const videos = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', '3gp'];
  const texts = ['txt', 'json', 'csv', 'xml', 'md', 'js', 'ts', 'css', 'html'];
  const docs = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

  if (images.includes(ext)) return 'image';
  if (audios.includes(ext)) return 'audio';
  if (videos.includes(ext)) return 'video';
  if (texts.includes(ext)) return 'text';
  if (docs.includes(ext)) return 'document';
  return 'text'; // default fallback
};

const getDefaultTargetExtension = (category: string): string => {
  switch (category) {
    case 'image': return 'webp';
    case 'video': return 'webm';
    case 'document': return 'pdf';
    case 'text': return 'json';
    case 'audio': return 'wav';
    default: return 'txt';
  }
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const traverseDirectory = async (entry: any, path: string = ''): Promise<{ file: File; folderPath: string }[]> => {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file: File) => {
        resolve([{ file, folderPath: path }]);
      });
    });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    
    const readAllEntries = async (dirReader: any): Promise<any[]> => {
      const allEntries: any[] = [];
      const readBatch = (): Promise<any[]> => {
        return new Promise((resolve) => {
          dirReader.readEntries((entries: any[]) => {
            resolve(entries);
          });
        });
      };
      let batch = await readBatch();
      while (batch.length > 0) {
        allEntries.push(...batch);
        batch = await readBatch();
      }
      return allEntries;
    };
    
    const entries = await readAllEntries(reader);
    const newPath = path ? `${path}/${entry.name}` : entry.name;
    const results = await Promise.all(
      entries.map((childEntry) => traverseDirectory(childEntry, newPath))
    );
    return results.flat();
  }
  return [];
};

function App() {
  const [files, setFiles] = useState<ConvertedFile[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [selectedFolderDownload, setSelectedFolderDownload] = useState<string>('all');
  const [lifetimeStats, setLifetimeStats] = useState(() => {
    const saved = localStorage.getItem('lifetime_stats');
    return saved ? JSON.parse(saved) : { filesCount: 0, bytesSaved: 0 };
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [editingFile, setEditingFile] = useState<ConvertedFile | null>(null);
  const [previewingMedia, setPreviewingMedia] = useState<ConvertedFile | null>(null);

  const dragCounterRef = useRef<number>(0);

  const addFileToWorkspace = (file: File, folderPath?: string) => {
    if (folderPath) {
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `${folderPath}/${file.name}`,
        writable: true
      });
    }
    handleFilesAdded([file]);
  };

  const updateStats = (originalSize: number, convertedSize: number) => {
    const savings = originalSize - convertedSize;
    setLifetimeStats((prev: any) => {
      const next = {
        filesCount: prev.filesCount + 1,
        bytesSaved: prev.bytesSaved + (savings > 0 ? savings : 0)
      };
      localStorage.setItem('lifetime_stats', JSON.stringify(next));
      return next;
    });
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set theme on mount and change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  };

  // Clipboard Paste (Ctrl+V) listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            let finalFile = file;
            if (file.name === 'image.png' || !file.name) {
              const ext = file.type.split('/')[1] || 'png';
              const cleanName = `pasted_image_${Date.now()}.${ext}`;
              finalFile = new File([file], cleanName, { type: file.type });
            }
            pastedFiles.push(finalFile);
          }
        }
      }

      if (pastedFiles.length > 0) {
        handleFilesAdded(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  const handleFilesAdded = (rawFiles: FileList | File[]) => {
    const newFilesList: ConvertedFile[] = [];

    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      const nameParts = file.name.split('.');
      const ext = nameParts.pop()?.toLowerCase() || '';
      const category = getFileCategory(ext);

      newFilesList.push({
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(),
        file,
        name: file.name,
        size: file.size,
        category,
        extension: ext,
        targetExtension: getDefaultTargetExtension(category),
        status: 'idle',
        progress: 0,
        quality: 90
      });
    }

    setFiles(prev => [...prev, ...newFilesList]);
    showToast(`Added ${rawFiles.length} file(s) to the converter.`, 'info');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter") {
      dragCounterRef.current++;
      if (dragCounterRef.current > 0) {
        setDragActive(true);
      }
    } else if (e.type === "dragleave") {
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setDragActive(false);
      }
    } else if (e.type === "dragover") {
      setDragActive(true);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragActive(false);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const entries: any[] = [];
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) entries.push(entry);
        }
      }

      if (entries.length > 0) {
        showToast('Scanning folders and files...', 'info');
        const results = await Promise.all(entries.map(entry => traverseDirectory(entry)));
        const scannedFiles = results.flat();

        const newFilesList: ConvertedFile[] = scannedFiles.map(({ file, folderPath }) => {
          const nameParts = file.name.split('.');
          const ext = nameParts.pop()?.toLowerCase() || '';
          const category = getFileCategory(ext);
          return {
            id: Math.random().toString(36).substring(2, 9) + Date.now().toString(),
            file,
            name: file.name,
            size: file.size,
            category,
            extension: ext,
            targetExtension: getDefaultTargetExtension(category),
            status: 'idle',
            progress: 0,
            quality: 90,
            folderPath
          };
        });

        setFiles(prev => [...prev, ...newFilesList]);
        showToast(`Added ${scannedFiles.length} file(s) to the converter.`, 'info');
        return;
      }
    }
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (id: string) => {
    const fileItem = files.find(f => f.id === id);
    if (fileItem) {
      const confirmed = window.confirm(`Tem certeza que quer excluir o arquivo ${fileItem.name}?`);
      if (!confirmed) return;
    }
    setFiles(prev => prev.filter(f => f.id !== id));
    setSelectedFileIds(prev => prev.filter(x => x !== id));
  };

  const renameSingleFile = (id: string, newName: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    showToast('File renamed.', 'success');
  };

  const handleRowDoubleClick = (item: ConvertedFile) => {
    if (item.category === 'image') {
      setEditingFile(item);
    } else if (item.category === 'audio' || item.category === 'video') {
      setPreviewingMedia(item);
    }
  };

  const clearAllFiles = () => {
    setFiles([]);
    setSelectedFileIds([]);
    showToast('Workspace cleared.', 'info');
  };

  const clearCompletedFiles = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success'));
    showToast('Completed files cleared from workspace.', 'info');
  };

  const updateTargetExtension = (id: string, ext: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { 
      ...f, 
      targetExtension: ext,
      status: 'idle',
      progress: 0,
      convertedBlob: undefined,
      errorMessage: undefined
    } : f));
  };

  const updateQuality = (id: string, val: number) => {
    const isSelected = selectedFileIds.includes(id);
    setFiles(prev => prev.map(f => {
      const isCurrent = f.id === id;
      const isSelectedWebp = isSelected && selectedFileIds.includes(f.id) && f.targetExtension === 'webp';
      if (isCurrent || isSelectedWebp) {
        return { 
          ...f, 
          quality: val,
          status: 'idle',
          progress: 0,
          convertedBlob: undefined,
          errorMessage: undefined
        };
      }
      return f;
    }));
  };

  const applyBatchQuality = (category: string, quality: number) => {
    setFiles(prev => prev.map(f => {
      if (f.category === category && f.targetExtension === 'webp') {
        return {
          ...f,
          quality: quality,
          status: 'idle',
          progress: 0,
          convertedBlob: undefined,
          errorMessage: undefined
        };
      }
      return f;
    }));
  };

  const applyBatchTarget = (category: string, ext: string) => {
    setFiles(prev => prev.map(f => f.category === category ? { 
      ...f, 
      targetExtension: ext,
      status: 'idle',
      progress: 0,
      convertedBlob: undefined,
      errorMessage: undefined
    } : f));
    showToast(`Applied .${ext.toUpperCase()} format to all ${category}s.`, 'info');
  };

  const toggleSelectFile = (id: string) => {
    setSelectedFileIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };



  const clearSelection = () => {
    setSelectedFileIds([]);
  };

  const deleteSelectedFiles = () => {
    const confirmed = window.confirm(`Tem certeza que quer excluir os ${selectedFileIds.length} arquivos selecionados?`);
    if (!confirmed) return;
    setFiles(prev => prev.filter(f => !selectedFileIds.includes(f.id)));
    setSelectedFileIds([]);
    showToast('Selected files deleted.', 'info');
  };

  const renameFiles = (findText: string, replaceText: string) => {
    setFiles(prev => prev.map(f => {
      const nameParts = f.name.split('.');
      const ext = nameParts.pop() || '';
      const baseName = nameParts.join('.');
      const newBaseName = baseName.split(findText).join(replaceText);
      return { ...f, name: `${newBaseName}.${ext}` };
    }));
    showToast('Batch filename rename applied.', 'success');
  };

  const resetFilenames = (pattern: string) => {
    setFiles(prev => prev.map((f, index) => {
      const nameParts = f.name.split('.');
      const ext = nameParts.pop() || '';
      const numStr = String(index + 1).padStart(2, '0');
      let newBaseName = '';
      if (!pattern || pattern.trim() === '') {
        newBaseName = String(index + 1);
      } else {
        if (pattern.includes('{number}')) {
          newBaseName = pattern.split('{number}').join(numStr);
        } else {
          newBaseName = `${pattern}-${numStr}`;
        }
      }
      return { ...f, name: `${newBaseName}.${ext}` };
    }));
    showToast('Sequential filenames applied.', 'success');
  };

  const applyImageResize = (scale?: number, width?: number, height?: number) => {
    setFiles(prev => prev.map(f => {
      if (f.category === 'image') {
        return {
          ...f,
          resizeScale: scale,
          resizeWidth: width,
          resizeHeight: height
        };
      }
      return f;
    }));
    showToast('Image resize parameters applied in batch.', 'info');
  };

  const applyTextMode = (mode: 'none' | 'minify' | 'format') => {
    setFiles(prev => prev.map(f => {
      if (f.category === 'text' || f.category === 'document') {
        return {
          ...f,
          textMode: mode
        };
      }
      return f;
    }));
    showToast(`Text formatting mode set to: ${mode}.`, 'info');
  };

  // Convert a single file logic
  const executeConversion = async (item: ConvertedFile): Promise<Blob> => {
    // Check if source and target extensions are the same
    if (item.extension === item.targetExtension) {
      return item.file; // Output source file blob directly
    }

    // Video conversion is simulated to avoid browser memory collapse
    if (item.category === 'video') {
      return new Promise((resolve) => {
        let currentProgress = 0;
        const interval = setInterval(() => {
          currentProgress += 10;
          setFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: currentProgress } : f));
          if (currentProgress >= 100) {
            clearInterval(interval);
            // Simulate video export file
            resolve(new Blob([item.file], { type: `video/${item.targetExtension}` }));
          }
        }, 150);
      });
    }

    // Real browser side conversions
    if (item.category === 'image') {
      const q = item.quality !== undefined ? item.quality / 100 : 0.9;
      return await convertImage(item.file, item.targetExtension, q, item.resizeScale, item.resizeWidth, item.resizeHeight);
    }

    if (item.category === 'audio') {
      if (item.targetExtension === 'wav') {
        return await convertAudioToWav(item.file);
      } else {
        return new Blob([item.file], { type: 'audio/mpeg' });
      }
    }

    if (item.category === 'text' || item.category === 'document') {
      if (item.targetExtension === 'pdf') {
        return await convertToPDF(item.file);
      } else {
        return await convertText(item.file, item.targetExtension, item.textMode);
      }
    }

    throw new Error('Unsupported format combination');
  };

  const convertSingleFile = async (id: string) => {
    const item = files.find(f => f.id === id);
    if (!item || item.status === 'converting') return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'converting', progress: 10 } : f));

    try {
      const blob = await executeConversion({
        ...item,
        status: 'converting',
        progress: 10
      });
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'success', 
        progress: 100,
        convertedBlob: blob 
      } : f));
      updateStats(item.size, blob.size);
      showToast(`Successfully converted ${item.name}!`, 'success');
    } catch (err: any) {
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        progress: 100,
        errorMessage: err.message || 'Error occurred' 
      } : f));
      showToast(`Failed to convert ${item.name}.`, 'error');
    }
  };

  // Convert all files bulk operation (or selected files if selection mode is active)
  const convertAllFiles = async () => {
    const isSelectionActive = selectedFileIds.length > 0;
    const filesToConvert = files.filter(f => {
      const isIdle = f.status === 'idle';
      if (isSelectionActive) {
        return isIdle && selectedFileIds.includes(f.id);
      }
      return isIdle;
    });
    if (filesToConvert.length === 0) return;

    setIsConverting(true);
    showToast(`Converting ${filesToConvert.length} file(s)...`, 'info');

    // Run parallel conversions with a chunk size limit to avoid browser locking
    const chunkSize = 4;
    for (let i = 0; i < filesToConvert.length; i += chunkSize) {
      const chunk = filesToConvert.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (item) => {
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'converting', progress: 20 } : f));
        
        try {
          const blob = await executeConversion({
            ...item,
            status: 'converting',
            progress: 20
          });
          setFiles(prev => prev.map(f => f.id === item.id ? { 
            ...f, 
            status: 'success', 
            progress: 100, 
            convertedBlob: blob 
          } : f));
          updateStats(item.size, blob.size);
        } catch (err: any) {
          setFiles(prev => prev.map(f => f.id === item.id ? { 
            ...f, 
            status: 'error', 
            progress: 100, 
            errorMessage: err.message || 'Error occurred' 
          } : f));
        }
      }));
    }

    setIsConverting(false);
    showToast('Batch conversion complete!', 'success');
    if (isSelectionActive) {
      setSelectedFileIds([]); // Clear selection after successful convert
    }
  };

  const downloadSingleFile = (id: string) => {
    const item = files.find(f => f.id === id);
    if (!item || !item.convertedBlob) return;

    const url = URL.createObjectURL(item.convertedBlob);
    const link = document.createElement('a');
    const nameParts = item.name.split('.');
    nameParts.pop(); // remove old ext
    const baseName = nameParts.join('.');
    
    link.href = url;
    link.download = `${baseName}.${item.targetExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllAsZip = async (folderPath?: string) => {
    const isSelectionActive = selectedFileIds.length > 0;
    let convertedItems = files.filter(f => f.status === 'success' && f.convertedBlob);
    if (isSelectionActive) {
      convertedItems = convertedItems.filter(f => selectedFileIds.includes(f.id));
    } else if (folderPath) {
      convertedItems = convertedItems.filter(f => f.folderPath === folderPath);
    }
    if (convertedItems.length === 0) return;

    showToast('Creating ZIP archive...', 'info');
    const zip = new JSZip();

    convertedItems.forEach(item => {
      const nameParts = item.name.split('.');
      nameParts.pop();
      const baseName = nameParts.join('.');
      const finalFileName = `${baseName}.${item.targetExtension}`;
      
      if (!folderPath && item.folderPath) {
        zip.file(`${item.folderPath}/${finalFileName}`, item.convertedBlob!);
      } else {
        zip.file(finalFileName, item.convertedBlob!);
      }
    });

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      
      const zipName = folderPath 
        ? `${folderPath.replace(/[\/\\:]/g, '_')}_converted.zip`
        : `UniConvert_batch_downloads.zip`;
        
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('ZIP downloaded successfully!', 'success');
    } catch (e) {
      showToast('Failed to create ZIP package.', 'error');
    }
  };

  // Filtered files count and lists
  const countByCategory = (cat: string) => {
    if (cat === 'all') return files.length;
    return files.filter(f => f.category === cat).length;
  };

  const filteredFiles = files.filter(f => {
    if (activeTab === 'all') return true;
    return f.category === activeTab;
  });

  const selectAllVisibleFiles = () => {
    const visibleIds = filteredFiles.map(f => f.id);
    const allSelected = visibleIds.every(id => selectedFileIds.includes(id));
    if (allSelected) {
      setSelectedFileIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedFileIds(prev => {
        const next = [...prev];
        visibleIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  // Calculate global progress
  const completedConvertCount = files.filter(f => f.status === 'success').length;
  const errorConvertCount = files.filter(f => f.status === 'error').length;
  const totalCount = files.length;

  const totalFinished = completedConvertCount + errorConvertCount;
  const globalProgress = totalCount > 0 ? Math.round((totalFinished / totalCount) * 100) : 0;

  return (
    <div 
      className="app-container"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="drag-overlay">
          <FileUp className="drag-overlay-icon" />
          <h2 className="drag-overlay-title">Drop your files here!</h2>
          <p className="drag-overlay-subtitle">Supporting Images, Text, Documents, Audio and Videos</p>
        </div>
      )}
      {/* Header */}
      <header className="header">
        <div className="logo-section">
          <div className="logo-icon">
            <Layers className="w-8 h-8" />
          </div>
          <span className="logo-text">UniConvert</span>
          <span className="logo-badge">v1.2</span>
        </div>

        <div className="header-actions">
          <button 
            className="theme-toggle" 
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            aria-label="Toggle Light/Dark Theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        
        {/* Hero Area */}
        <section className="hero-section">
          <h1 className="hero-title">Universal File Converter</h1>
          <p className="hero-subtitle">
            Convert images, audio, documents, and text files. Clean, modern, 
            and processed 100% locally in your browser.
          </p>

          {lifetimeStats.filesCount > 0 && (
            <div className="stats-badges-container">
              <div className="stats-badge">
                <span className="stats-badge-val">{lifetimeStats.filesCount}</span>
                <span className="stats-badge-label">Files Converted</span>
              </div>
              <div className="stats-badge">
                <span className="stats-badge-val">{formatSize(lifetimeStats.bytesSaved)}</span>
                <span className="stats-badge-label">Space Saved</span>
              </div>
            </div>
          )}
        </section>

        {/* Drag Drop Area */}
        <div 
          className="dropzone"
          onClick={triggerFileInput}
          style={{ cursor: 'pointer' }}
        >
          <div className="dropzone-icon-container">
            <FileUp className="w-8 h-8" />
          </div>
          <h3 className="dropzone-title">Drag & drop files or folders here or click to browse</h3>
          <p className="dropzone-subtitle">Supports Images, Text, Documents, Audio and Video formats.</p>
          <div className="dropzone-limits">No file limits • Processed entirely in your browser</div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => e.target.files && handleFilesAdded(e.target.files)} 
            multiple 
            style={{ display: 'none' }}
          />
        </div>

        {/* Converter Workspace Panel */}
        {files.length > 0 && (
          <div className="workspace-panel">
            
            {/* Category Filter Tabs */}
            <div className="tabs-container">
              <button 
                className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All <span className="tab-badge">{countByCategory('all')}</span>
              </button>
              
              <button 
                className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`}
                onClick={() => setActiveTab('image')}
              >
                <ImageIcon className="w-4 h-4" />
                Images <span className="tab-badge">{countByCategory('image')}</span>
              </button>

              <button 
                className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
                onClick={() => setActiveTab('audio')}
              >
                <Music className="w-4 h-4" />
                Audio <span className="tab-badge">{countByCategory('audio')}</span>
              </button>

              <button 
                className={`tab-btn ${activeTab === 'document' ? 'active' : ''}`}
                onClick={() => setActiveTab('document')}
              >
                <FileText className="w-4 h-4" />
                Documents <span className="tab-badge">{countByCategory('document')}</span>
              </button>

              <button 
                className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTab('text')}
              >
                <FileCode className="w-4 h-4" />
                Text/Data <span className="tab-badge">{countByCategory('text')}</span>
              </button>

              <button 
                className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`}
                onClick={() => setActiveTab('video')}
              >
                <VideoIcon className="w-4 h-4" />
                Videos <span className="tab-badge">{countByCategory('video')}</span>
              </button>
            </div>

            {/* Batch Controls Component */}
            <BatchControls 
              files={files}
              activeTab={activeTab}
              onApplyBatchTarget={applyBatchTarget}
              onApplyBatchQuality={applyBatchQuality}
              onRenameFiles={renameFiles}
              onResetFilenames={resetFilenames}
              onApplyImageResize={applyImageResize}
              onApplyTextMode={applyTextMode}
              isConverting={isConverting}
            />

            {/* Workspace File List */}
            <div className="file-list">
              {filteredFiles.length > 0 ? (
                filteredFiles.map(item => (
                  <FileRow 
                    key={item.id}
                    item={item}
                    onTargetChange={updateTargetExtension}
                    onRemove={removeFile}
                    onConvert={convertSingleFile}
                    onDownload={downloadSingleFile}
                    onQualityChange={updateQuality}
                    isSelected={selectedFileIds.includes(item.id)}
                    isSelectionMode={selectedFileIds.length > 0}
                    onRowClick={() => toggleSelectFile(item.id)}
                    onRowDoubleClick={() => handleRowDoubleClick(item)}
                    onEdit={(file) => setEditingFile(file)}
                    onRename={renameSingleFile}
                  />
                ))
              ) : (
                <div className="empty-state">
                  <AlertCircle className="empty-state-icon" />
                  <p>No files uploaded under this category tab.</p>
                </div>
              )}
            </div>

            {/* Footer statistics / Global progress bar */}
            {/* Footer statistics / Global progress bar / Actions */}
            {(() => {
              const isSelectionActive = selectedFileIds.length > 0;
              
              const idleFilesCount = filteredFiles.filter(f => f.status === 'idle').length;
              const successFilesCount = filteredFiles.filter(f => f.status === 'success').length;
              const foldersPresent = Array.from(new Set(files.filter(f => f.folderPath).map(f => f.folderPath))) as string[];
              
              // Selected files stats
              const selectedFiles = filteredFiles.filter(f => selectedFileIds.includes(f.id));
              const idleSelectedCount = selectedFiles.filter(f => f.status === 'idle').length;
              const successSelectedCount = selectedFiles.filter(f => f.status === 'success' && f.convertedBlob).length;
              
              return (
                <div 
                  className={`workspace-footer ${isSelectionActive ? 'sticky-footer' : ''}`}
                  style={{
                    borderTop: isSelectionActive ? '2px solid var(--primary)' : undefined
                  }}
                >
                  {isSelectionActive ? (
                    /* SELECTION MODE FOOTER */
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9375rem' }}>
                          Selection Mode: {selectedFileIds.length} file(s) selected
                        </span>
                        <button
                          onClick={clearSelection}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={selectAllVisibleFiles}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        >
                          {filteredFiles.every(f => selectedFileIds.includes(f.id)) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {successSelectedCount > 0 && (
                          <button
                            onClick={() => downloadAllAsZip()}
                            className="btn btn-secondary"
                            title="Download selected converted files as a ZIP file"
                          >
                            <Download className="w-4 h-4" />
                            Download ZIP ({successSelectedCount})
                          </button>
                        )}
                        
                        <button
                          onClick={deleteSelectedFiles}
                          className="btn btn-danger"
                          title="Delete selected files"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Selected ({selectedFileIds.length})
                        </button>

                        <button
                          onClick={convertAllFiles}
                          disabled={isConverting || idleSelectedCount === 0}
                          className="btn btn-primary"
                          title="Convert selected idle files"
                        >
                          <Play className="w-4 h-4" />
                          Convert Selected ({idleSelectedCount})
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* STANDARD WORKSPACE FOOTER */
                    <>
                      {/* Row 1: Full Width Progress Bar */}
                      <div className="global-progress">
                        <span className="global-progress-label" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Progress ({completedConvertCount}/{totalCount} completed)
                        </span>
                        <div className="global-progress-bar">
                          <div 
                            className="global-progress-fill" 
                            style={{ width: `${globalProgress}%` }}
                          ></div>
                        </div>
                        <span className="global-progress-percent" style={{ fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                          {globalProgress}%
                        </span>
                      </div>

                      {/* Row 2: Stats (Left) and Action Buttons (Right) */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '1rem', marginTop: '0.25rem' }}>
                        {/* Size Comparison on the Left */}
                        <div>
                          {completedConvertCount > 0 && (() => {
                            const successFiles = files.filter(f => f.status === 'success' && f.convertedBlob);
                            const totalBeforeSize = successFiles.reduce((acc, f) => acc + f.size, 0);
                            const totalAfterSize = successFiles.reduce((acc, f) => acc + (f.convertedBlob?.size || 0), 0);
                            const sizeDifference = totalAfterSize - totalBeforeSize;
                            const isLighter = sizeDifference < 0;
                            const isHeavier = sizeDifference > 0;
                            
                            return (
                              <div className="footer-size-comparison" style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Total savings:</span>
                                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatSize(totalBeforeSize)}</span>
                                <span style={{ color: 'var(--text-muted)' }}>→</span>
                                <span style={{ 
                                  color: isLighter ? 'var(--success)' : isHeavier ? 'var(--error)' : 'var(--text-main)',
                                  fontFamily: 'var(--font-mono)'
                                }}>
                                  {formatSize(totalAfterSize)}
                                  {totalBeforeSize > 0 && (
                                    <span style={{ fontSize: '0.75rem', marginLeft: '0.35rem', fontWeight: 700 }}>
                                      ({isLighter ? '' : '+'}{Math.round((sizeDifference / totalBeforeSize) * 100)}%)
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Action Buttons on the Right */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          {successFilesCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {foldersPresent.length > 0 && (
                                <CustomSelect
                                  value={selectedFolderDownload}
                                  options={[
                                    { value: 'all', label: 'All Folders (ZIP)' },
                                    ...foldersPresent.map(f => ({ value: f, label: `📁 ${f}` }))
                                  ]}
                                  onChange={(val) => setSelectedFolderDownload(val)}
                                  style={{ height: '38px' }}
                                />
                              )}
                              <button
                                onClick={() => downloadAllAsZip(selectedFolderDownload === 'all' ? undefined : selectedFolderDownload)}
                                disabled={isConverting}
                                className="btn btn-secondary"
                                title="Download converted files as a ZIP file"
                              >
                                <Download className="w-4 h-4" />
                                Download {selectedFolderDownload === 'all' ? 'All' : 'Folder'} (ZIP)
                              </button>
                            </div>
                          )}
                          
                          {successFilesCount > 0 && (
                            <button
                              onClick={clearCompletedFiles}
                              disabled={isConverting}
                              className="btn btn-secondary"
                              style={{ borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--error)' }}
                              title="Remove only successfully converted files from the workspace"
                            >
                              <Trash2 className="w-4 h-4" />
                              Clear Completed
                            </button>
                          )}
                          
                          <button
                            onClick={clearAllFiles}
                            disabled={isConverting}
                            className="btn btn-danger"
                            title="Clear all files from the workspace"
                          >
                            <Trash2 className="w-4 h-4" />
                            Clear All
                          </button>

                          <button
                            onClick={convertAllFiles}
                            disabled={isConverting || idleFilesCount === 0}
                            className="btn btn-primary"
                            title="Start batch conversion of all ready files"
                          >
                            <Play className="w-4 h-4" />
                            Convert {idleFilesCount > 0 ? `${idleFilesCount} ` : ''}Files
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

          </div>
        )}

        {/* Info / Safety Banners */}
        <section className="info-banner">
          <div className="info-card">
            <ShieldCheck className="info-card-icon w-6 h-6" />
            <div>
              <h4 className="info-card-title">100% Private & Secure</h4>
              <p className="info-card-text">
                Your files never leave your device. All calculations, parsing, and rendering 
                are done fully in client-side JavaScript.
              </p>
            </div>
          </div>

          <div className="info-card">
            <Zap className="info-card-icon w-6 h-6" />
            <div>
              <h4 className="info-card-title">Fast Local Processing</h4>
              <p className="info-card-text">
                No server queues or upload bandwidth limits. Batch convert 100 images to WEBP 
                in seconds using native Canvas APIs.
              </p>
            </div>
          </div>

          <div className="info-card">
            <Info className="info-card-icon w-6 h-6" />
            <div>
              <h4 className="info-card-title">Rich Client Formats</h4>
              <p className="info-card-text">
                Convert JSON datasets to CSV spreadsheets, render Markdown source to HTML files, 
                and format structured text logs to PDFs.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>&copy; 2026 UniConvert Inc. Made for modern, clean, and instant conversions.</p>
      </footer>

      {editingFile && (
        <ImageEditModal 
          file={editingFile}
          onClose={() => setEditingFile(null)}
          onAddFileToWorkspace={addFileToWorkspace}
        />
      )}

      {previewingMedia && (
        <MediaPreviewModal 
          file={previewingMedia}
          onClose={() => setPreviewingMedia(null)}
        />
      )}

      {/* Notification Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          <div className="toast-content">{toast.message}</div>
          <button className="toast-close" onClick={() => setToast(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
