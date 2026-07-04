import React, { useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  FileCode, 
  Music, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Download, 
  Loader2,
  Play,
  Sparkles,
  Copy,
  Check
} from 'lucide-react';
import type { ConvertedFile } from '../types';

interface FileRowProps {
  item: ConvertedFile;
  onTargetChange: (id: string, ext: string) => void;
  onRemove: (id: string) => void;
  onConvert: (id: string) => void;
  onDownload: (id: string) => void;
  onQualityChange: (id: string, val: number) => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onRowClick?: () => void;
  onRowDoubleClick?: () => void;
  onEdit?: (file: ConvertedFile) => void;
  onRename?: (id: string, newName: string) => void;
}

const getFileIcon = (category: string) => {
  switch (category) {
    case 'image':
      return <ImageIcon className="w-5 h-5" />;
    case 'video':
      return <VideoIcon className="w-5 h-5" />;
    case 'document':
      return <FileText className="w-5 h-5" />;
    case 'text':
      return <FileCode className="w-5 h-5" />;
    case 'audio':
      return <Music className="w-5 h-5" />;
    default:
      return <FileText className="w-5 h-5" />;
  }
};

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
      return ['txt'];
  }
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Reusable CustomSelect Component
interface CustomSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, options, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="format-select"
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

export const FileRow: React.FC<FileRowProps> = ({
  item,
  onTargetChange,
  onRemove,
  onConvert,
  onDownload,
  onQualityChange,
  isSelected = false,
  isSelectionMode = false,
  onRowClick,
  onRowDoubleClick,
  onEdit,
  onRename
}) => {
  const options = getTargetOptions(item.category);
  const selectOptions = options.map(opt => ({ value: opt, label: opt.toUpperCase() }));

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(item.name);
  const [copied, setCopied] = useState(false);

  const handleSaveName = () => {
    setIsEditingName(false);
    if (editedName.trim() && editedName.trim() !== item.name) {
      onRename?.(item.id, editedName.trim());
    } else {
      setEditedName(item.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setEditedName(item.name);
    }
  };

  const handleCopyImage = async (blob: Blob) => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed: ", err);
      alert("Could not copy this format to clipboard directly. Please download the file instead.");
    }
  };

  const handleRowClick = () => {
    if (onRowClick) {
      onRowClick();
    }
  };

  return (
    <div 
      className={`file-row ${isSelected ? 'selected' : ''}`}
      onClick={handleRowClick}
      onDoubleClick={onRowDoubleClick}
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? 'var(--primary)' : undefined,
        boxShadow: isSelected ? '0 0 0 2px rgba(var(--primary-rgb), 0.15)' : undefined,
        backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.03)' : undefined,
        transition: 'all 0.15s ease-in-out'
      }}
    >
      {/* File Icon Column / Selection Checkbox */}
      <div className="file-icon">
        {isSelectionMode ? (
          <div className="selection-checkbox" style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
            backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}>
            {isSelected && '✓'}
          </div>
        ) : (
          getFileIcon(item.category)
        )}
      </div>

      {/* File Info */}
      <div className="file-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%', maxWidth: '280px' }}>
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={handleKeyDown}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--primary)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-main)',
                padding: '0.125rem 0.25rem',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                width: '100%',
                outline: 'none'
              }}
            />
          ) : (
            <div 
              className="file-name" 
              title="Click to rename" 
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.name}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.6, flexShrink: 0 }} title="Rename file">✏️</span>
            </div>
          )}
        </div>
        <div className="file-meta">
          {item.folderPath && (
            <span className="file-folder-badge" style={{
              backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
              color: 'var(--primary)',
              padding: '0.125rem 0.375rem',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              marginRight: '0.25rem'
            }}>
              📁 {item.folderPath}
            </span>
          )}
          <span>{formatSize(item.size)}</span>
          <span>•</span>
          <span className="file-format-badge">{item.extension}</span>
          {item.size > 100 * 1024 * 1024 && (
            <>
              <span>•</span>
              <span className="file-large-badge" style={{
                backgroundColor: 'rgba(14, 165, 233, 0.08)',
                color: 'var(--secondary, #0ea5e9)',
                padding: '0.125rem 0.375rem',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }} title="This file is large. The conversion will run entirely on your browser using your local device resources, which may take some time depending on your hardware.">
                ⏱️ Local conversion may take longer
              </span>
            </>
          )}
        </div>
      </div>

      {/* Target Format Selector */}
      <div 
        className="file-target" 
        style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="file-source-badge">{item.extension.toUpperCase()}</span>
          <ArrowRight className="arrow-icon w-4 h-4" />
          {item.status === 'idle' ? (
            <CustomSelect
              value={item.targetExtension}
              options={selectOptions}
              onChange={(val) => onTargetChange(item.id, val)}
            />
          ) : (
            <span className="file-format-badge">{item.targetExtension}</span>
          )}
        </div>
        {item.status === 'idle' && item.targetExtension === 'webp' && (
          <div className="quality-control" onClick={(e) => e.stopPropagation()}>
            <div className="quality-label-row">
              <span>Quality:</span>
              <span>{item.quality || 90}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={item.quality || 90}
              onChange={(e) => onQualityChange(item.id, parseInt(e.target.value))}
              className="quality-slider"
            />
          </div>
        )}
      </div>

      {/* Status Progress */}
      <div className="file-status-wrapper">
        {item.status === 'idle' && (
          <span className="status-badge idle">Ready</span>
        )}
        {item.status === 'converting' && (
          <>
            <span className="status-badge converting">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Converting...
            </span>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill converting" 
                style={{ width: `${item.progress}%` }}
              ></div>
            </div>
          </>
        )}
        {item.status === 'success' && (
          <div className="status-badge-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.125rem', margin: 'auto 0' }}>
            <div className="status-badge success" title="Completed successfully" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--success)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>Done</span>
            </div>
            {item.convertedBlob && (
              <span className="file-size-compare" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                {formatSize(item.size)} → {formatSize(item.convertedBlob.size)}
              </span>
            )}
          </div>
        )}
        {item.status === 'error' && (
          <>
            <span className="status-badge error" title={item.errorMessage}>
              <XCircle className="w-3.5 h-3.5" />
              Failed
            </span>
            <div className="progress-bar-container">
              <div className="progress-bar-fill error" style={{ width: '100%' }}></div>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="file-actions" onClick={(e) => isSelectionMode && e.stopPropagation()}>
        {isSelected && item.category === 'image' && onEdit && (
          <button
            onClick={() => onEdit(item)}
            className="btn-icon-only"
            style={{ color: 'var(--primary)', borderColor: 'rgba(79, 70, 229, 0.2)' }}
            title="Enhance Image Quality (Upscale & Sharpen)"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}
        {item.status === 'success' && (
          <button
            onClick={() => onDownload(item.id)}
            className="btn-icon-only"
            title="Download converted file"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        {item.status === 'success' && item.category === 'image' && item.convertedBlob && (
          <button
            onClick={() => handleCopyImage(item.convertedBlob!)}
            className="btn-icon-only"
            title="Copy image to clipboard (Ctrl+V ready)"
            style={{ color: copied ? 'var(--success)' : undefined }}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
        {item.status === 'idle' && (
          <button
            onClick={() => onConvert(item.id)}
            className="btn-icon-only"
            title="Convert file"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        {item.status !== 'converting' && (
          <button
            onClick={() => onRemove(item.id)}
            className="btn-icon-only danger"
            title="Remove file"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
