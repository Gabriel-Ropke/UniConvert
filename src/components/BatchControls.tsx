import React, { useState } from 'react';
import { Settings, Edit3, RotateCcw, X, Maximize2, FileCode } from 'lucide-react';
import type { ConvertedFile } from '../types';

interface BatchControlsProps {
  files: ConvertedFile[];
  activeTab: string;
  onApplyBatchTarget: (category: string, ext: string) => void;
  onApplyBatchQuality: (category: string, quality: number) => void;
  onRenameFiles: (findText: string, replaceText: string) => void;
  onResetFilenames: (pattern: string) => void;
  onApplyImageResize: (scale?: number, width?: number, height?: number) => void;
  onApplyTextMode: (mode: 'none' | 'minify' | 'format') => void;
  isConverting: boolean;
}

const getTargetOptions = (category: string) => {
  switch (category) {
    case 'image':
      return ['webp', 'png', 'jpg', 'jpeg', 'bmp', 'ico', 'svg', 'tiff', 'gif'];
    case 'video':
      return ['webm', 'mp4', 'avi', 'mov', 'mkv'];
    case 'document':
      return ['pdf', 'html', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    case 'text':
      return ['txt', 'json', 'csv', 'xml', 'md', 'doc', 'docx', 'xls', 'xlsx', 'pdf', 'html'];
    case 'audio':
      return ['wav', 'mp3', 'ogg', 'aac', 'flac', 'm4a'];
    default:
      return [];
  }
};

// Custom Dropdown Select Component to replace standard native select tags
interface CustomSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ value, options, onChange, disabled, style, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={className || "format-select"}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          textAlign: 'left',
          width: '100%',
          paddingRight: '1.75rem'
        }}
      >
        <span>{selectedOption?.label}</span>
      </button>
      {isOpen && !disabled && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
            onClick={() => setIsOpen(false)} 
          />
          <div className="advanced-dropdown" style={{ top: '100%', left: 0, minWidth: '100%', marginTop: '4px', zIndex: 1000 }}>
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className="advanced-dropdown-item"
                style={{
                  fontWeight: opt.value === value ? 'bold' : 'normal',
                  backgroundColor: opt.value === value ? 'var(--bg-input)' : undefined
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const BatchControls: React.FC<BatchControlsProps> = ({
  files,
  activeTab,
  onApplyBatchTarget,
  onApplyBatchQuality,
  onRenameFiles,
  onResetFilenames,
  onApplyImageResize,
  onApplyTextMode,
  isConverting
}) => {
  const [batchQualityRecord, setBatchQualityRecord] = useState<Record<string, number>>({
    image: 90,
    video: 90,
    document: 90,
    text: 90,
    audio: 90
  });
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<'none' | 'replace' | 'reset' | 'resize' | 'textMode'>('none');
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [resetPattern, setResetPattern] = useState<string>('');
  const [resizeWidth, setResizeWidth] = useState<string>('');
  const [resizeScale, setResizeScale] = useState<string>('1.0');
  const [resizeDimension, setResizeDimension] = useState<'width' | 'height'>('width');
  const [textModeSetting, setTextModeSetting] = useState<'none' | 'minify' | 'format'>('none');

  // LocalStorage Renaming History States
  const [renameHistory, setRenameHistory] = useState<{ find: string; replace: string }[]>(() => {
    const saved = localStorage.getItem('rename_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [resetHistory, setResetHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('reset_history');
    return saved ? JSON.parse(saved) : [];
  });

  const categoriesPresent = Array.from(new Set(files.map(f => f.category)));

  // Dynamically filter categories based on the current active tab
  const categoriesToShow = activeTab === 'all'
    ? categoriesPresent
    : categoriesPresent.filter(cat => cat === activeTab);

  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    categoriesPresent.forEach(cat => {
      const opts = getTargetOptions(cat);
      if (opts.length > 0) initial[cat] = opts[0];
    });
    return initial;
  });

  const handleSelectChange = (category: string, val: string) => {
    setSelectedTargets(prev => ({
      ...prev,
      [category]: val
    }));
    onApplyBatchTarget(category, val);
    if (val === 'webp') {
      onApplyBatchQuality(category, batchQualityRecord[category] || 90);
    }
  };

  const handleRenameSubmit = () => {
    if (findText.trim() !== '') {
      onRenameFiles(findText, replaceText);
      const entry = { find: findText, replace: replaceText };
      const updated = [entry, ...renameHistory.filter(h => h.find !== findText)].slice(0, 5);
      setRenameHistory(updated);
      localStorage.setItem('rename_history', JSON.stringify(updated));
      setFindText('');
      setReplaceText('');
      setActiveAction('none');
    }
  };

  const handleResetSubmit = () => {
    onResetFilenames(resetPattern);
    if (resetPattern.trim() !== '') {
      const updated = [resetPattern, ...resetHistory.filter(h => h !== resetPattern)].slice(0, 5);
      setResetHistory(updated);
      localStorage.setItem('reset_history', JSON.stringify(updated));
    }
    setResetPattern('');
    setActiveAction('none');
  };

  const handleResizeSubmit = () => {
    const val = resizeWidth ? parseInt(resizeWidth) : undefined;
    const s = resizeScale ? parseFloat(resizeScale) : undefined;
    if (resizeDimension === 'width') {
      onApplyImageResize(s, val, undefined);
    } else {
      onApplyImageResize(s, undefined, val);
    }
    setResizeWidth('');
    setResizeScale('1.0');
    setActiveAction('none');
  };

  const handleTextModeSubmit = () => {
    onApplyTextMode(textModeSetting);
    setActiveAction('none');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className="batch-controls">
        {/* Batch Format selectors row - horizontal wrap, only wrap if it exceeds space */}
        <div className="batch-left" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', flex: 1 }}>
          {categoriesToShow.map(cat => {
            const options = getTargetOptions(cat);
            if (options.length === 0) return null;
            
            const currentTarget = selectedTargets[cat] || options[0];
            const selectOptions = options.map(opt => ({ value: opt, label: opt.toUpperCase() }));
            
            return (
              <div key={cat} className="batch-select-container">
                <span className="batch-select-label">
                  Convert all <strong style={{ textTransform: 'capitalize' }}>{cat}s</strong> to:
                </span>
                <CustomSelect
                  value={currentTarget}
                  options={selectOptions}
                  onChange={(val) => handleSelectChange(cat, val)}
                  disabled={isConverting}
                />
                
                {/* Global WebP quality slider */}
                {currentTarget === 'webp' && (
                  <div className="batch-quality-control" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.75rem' }}>
                    <span className="batch-select-label" style={{ fontSize: '0.85rem' }}>Quality:</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={batchQualityRecord[cat] || 90}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setBatchQualityRecord(prev => ({ ...prev, [cat]: val }));
                        onApplyBatchQuality(cat, val);
                      }}
                      className="quality-slider"
                      style={{ width: '100px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600, minWidth: '35px' }}>
                      {batchQualityRecord[cat] || 90}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Advanced Settings button placed on the right */}
        {categoriesToShow.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`btn btn-secondary ${showMenu || activeAction !== 'none' ? 'active' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem' }}
              title="Advanced batch settings"
            >
              <Settings className="w-4 h-4" />
              Advanced Settings
            </button>
            {showMenu && (
              <div className="advanced-dropdown" style={{ right: 0, left: 'auto' }}>
                <button
                  onClick={() => {
                    setActiveAction('replace');
                    setShowMenu(false);
                  }}
                  className="advanced-dropdown-item"
                >
                  <Edit3 className="w-4 h-4" />
                  Change archive name
                </button>
                <button
                  onClick={() => {
                    setActiveAction('reset');
                    setShowMenu(false);
                  }}
                  className="advanced-dropdown-item"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset archive name
                </button>
                {categoriesToShow.includes('image') && (
                  <button
                    onClick={() => {
                      setActiveAction('resize');
                      setShowMenu(false);
                    }}
                    className="advanced-dropdown-item"
                  >
                    <Maximize2 className="w-4 h-4" />
                    Resize images
                  </button>
                )}
                {(categoriesToShow.includes('text') || categoriesToShow.includes('document')) && (
                  <button
                    onClick={() => {
                      setActiveAction('textMode');
                      setShowMenu(false);
                    }}
                    className="advanced-dropdown-item"
                  >
                    <FileCode className="w-4 h-4" />
                    Minify / Format text
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 1. Change archive name panel */}
      {activeAction === 'replace' && (
        <div style={{ padding: '0 1.5rem 1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-page)' }}>
          <div className="advanced-panel">
            <div className="advanced-panel-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                Change Archive Name (Find & Replace)
              </div>
              <button onClick={() => setActiveAction('none')} className="btn-icon-only" style={{ padding: '0.25rem' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rename-inputs">
              <input
                type="text"
                placeholder="Find text to replace (e.g. Captura de tela)"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className="rename-input"
              />
              <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>→</span>
              <input
                type="text"
                placeholder="Replace with (leave empty to delete)"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="rename-input"
              />
              <button
                onClick={handleRenameSubmit}
                disabled={findText.trim() === ''}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Apply
              </button>
            </div>
            {renameHistory.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Quick templates:</span>
                {renameHistory.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setFindText(h.find);
                      setReplaceText(h.replace);
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '0.125rem 0.5rem', borderRadius: '4px', height: 'auto' }}
                  >
                    "{h.find}" → "{h.replace}"
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Reset archive name panel */}
      {activeAction === 'reset' && (
        <div style={{ padding: '0 1.5rem 1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-page)' }}>
          <div className="advanced-panel">
            <div className="advanced-panel-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                Reset Archive Name (Sequential Renamer)
              </div>
              <button onClick={() => setActiveAction('none')} className="btn-icon-only" style={{ padding: '0.25rem' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rename-inputs">
              <input
                type="text"
                placeholder="Pattern: e.g. pokemon-{number}_spr (leave empty for 1, 2, 3...)"
                value={resetPattern}
                onChange={(e) => setResetPattern(e.target.value)}
                className="rename-input"
                style={{ minWidth: '320px' }}
              />
              <button
                onClick={handleResetSubmit}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Apply Reset
              </button>
            </div>
            {resetHistory.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Quick templates:</span>
                {resetHistory.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setResetPattern(h)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '0.125rem 0.5rem', borderRadius: '4px', height: 'auto' }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              ℹ️ <strong>{`{number}`}</strong> will be replaced by 01, 02, 03... If omitted, it will be appended automatically (e.g. <code>pattern-01</code>). If left empty, it defaults to <code>1</code>, <code>2</code>, <code>3</code>...
            </div>
          </div>
        </div>
      )}

      {/* 3. Resize images panel */}
      {activeAction === 'resize' && (
        <div style={{ padding: '0 1.5rem 1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-page)' }}>
          <div className="advanced-panel">
            <div className="advanced-panel-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Maximize2 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                Resize Images in Batch
              </div>
              <button onClick={() => setActiveAction('none')} className="btn-icon-only" style={{ padding: '0.25rem' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rename-inputs" style={{ gap: '1rem' }}>
              <div className="batch-select-container">
                <span className="batch-select-label">Scale:</span>
                <CustomSelect
                  value={resizeScale}
                  options={[
                    { value: '1.0', label: 'Original Size (100%)' },
                    { value: '0.75', label: '75% of Original' },
                    { value: '0.5', label: '50% of Original' },
                    { value: '0.25', label: '25% of Original' }
                  ]}
                  onChange={(val) => setResizeScale(val)}
                />
              </div>
              
              <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>or</span>
              
              {/* Width / Height Selector Box */}
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.25rem', 
                backgroundColor: 'var(--bg-panel)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-md)', 
                padding: '0.25rem 0.5rem',
                minHeight: '38px'
              }}>
                <input
                  type="number"
                  placeholder={resizeDimension === 'width' ? "Width (px) e.g. 1920" : "Height (px) e.g. 1080"}
                  value={resizeWidth}
                  onChange={(e) => setResizeWidth(e.target.value)}
                  className="rename-input"
                  style={{ border: 'none', background: 'none', minWidth: '150px', padding: '0.25rem', outline: 'none', boxShadow: 'none' }}
                />
                <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.25rem' }} />
                <CustomSelect
                  value={resizeDimension}
                  options={[
                    { value: 'width', label: 'Width' },
                    { value: 'height', label: 'Height' }
                  ]}
                  onChange={(val) => setResizeDimension(val as 'width' | 'height')}
                  className="format-select-borderless"
                  style={{ minWidth: '85px' }}
                />
              </div>

              <button
                onClick={handleResizeSubmit}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Apply Resize
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              ℹ️ Resizing is applied client-side using Canvas rendering. Aspect ratio is preserved automatically.
            </div>
          </div>
        </div>
      )}

      {/* 4. Minify / Format text panel */}
      {activeAction === 'textMode' && (
        <div style={{ padding: '0 1.5rem 1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-page)' }}>
          <div className="advanced-panel">
            <div className="advanced-panel-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileCode className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                Minify or Pretty-Print Text & Code
              </div>
              <button onClick={() => setActiveAction('none')} className="btn-icon-only" style={{ padding: '0.25rem' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rename-inputs">
              <div className="batch-select-container">
                <span className="batch-select-label">Action:</span>
                <CustomSelect
                  value={textModeSetting}
                  options={[
                    { value: 'none', label: 'Original (No Modification)' },
                    { value: 'minify', label: 'Minify Data (Compress whitespaces)' },
                    { value: 'format', label: 'Format Data (Pretty-print JSON)' }
                  ]}
                  onChange={(val) => setTextModeSetting(val as any)}
                />
              </div>
              <button
                onClick={handleTextModeSubmit}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Apply Formatting
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              ℹ️ Applied to structured data files (JSON, CSV, HTML, XML, Markdown) before rendering. Minify strips formatting to reduce size, Beautify adds clean spacing.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
