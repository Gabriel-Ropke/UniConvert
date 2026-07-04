import React, { useState, useEffect, useRef } from 'react';
import { X, Music, Video, Volume2, Info, Loader2 } from 'lucide-react';
import type { ConvertedFile } from '../types';

interface MediaPreviewModalProps {
  file: ConvertedFile;
  onClose: () => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  file,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'original' | 'converted'>(
    file.convertedBlob ? 'converted' : 'original'
  );
  
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [convertedUrl, setConvertedUrl] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Generate blob URLs
  useEffect(() => {
    let origUrl = '';
    let convUrl = '';
    
    if (file.file) {
      origUrl = URL.createObjectURL(file.file);
      setOriginalUrl(origUrl);
    }
    if (file.convertedBlob) {
      convUrl = URL.createObjectURL(file.convertedBlob);
      setConvertedUrl(convUrl);
    }

    return () => {
      if (origUrl) URL.revokeObjectURL(origUrl);
      if (convUrl) URL.revokeObjectURL(convUrl);
    };
  }, [file]);

  const activeUrl = activeTab === 'converted' ? convertedUrl : originalUrl;
  const isVideo = file.category === 'video';

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="media-preview-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(12px)',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div className="media-preview-modal" style={{
        width: '100%',
        maxWidth: '750px',
        backgroundColor: 'var(--bg-panel)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255,255,255,0.01)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              {isVideo ? <Video className="w-5 h-5" /> : <Music className="w-5 h-5" />}
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Media Player Preview
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn-icon-only"
            style={{ padding: '0.5rem', borderRadius: '50%' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        {file.convertedBlob && (
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-page)',
            borderBottom: '1px solid var(--border-color)',
            padding: '0.25rem'
          }}>
            <button
              onClick={() => setActiveTab('original')}
              style={{
                flex: 1,
                padding: '0.65rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'original' ? 'var(--bg-panel)' : 'transparent',
                color: activeTab === 'original' ? 'var(--primary)' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              Original File ({formatSize(file.size)})
            </button>
            <button
              onClick={() => setActiveTab('converted')}
              style={{
                flex: 1,
                padding: '0.65rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'converted' ? 'var(--bg-panel)' : 'transparent',
                color: activeTab === 'converted' ? 'var(--primary)' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              Converted Result ({formatSize(file.convertedBlob.size)})
            </button>
          </div>
        )}

        {/* Player Viewport */}
        <div style={{
          backgroundColor: '#090d16',
          padding: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '280px',
          position: 'relative'
        }}>
          {activeUrl ? (
            isVideo ? (
              <video
                ref={videoRef}
                key={activeUrl}
                src={activeUrl}
                controls
                autoPlay
                style={{
                  maxWidth: '100%',
                  maxHeight: '360px',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '2rem' }}>
                {/* Audio Visual Disc Animation */}
                <div style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-panel)',
                  border: '3px solid var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(79, 70, 229, 0.3)',
                  animation: 'spin 6s linear infinite',
                  color: 'var(--primary)'
                }}>
                  <Volume2 className="w-10 h-10" />
                </div>
                
                {/* Custom Audio Element styling */}
                <audio
                  ref={audioRef}
                  key={activeUrl}
                  src={activeUrl}
                  controls
                  autoPlay
                  style={{
                    width: '100%',
                    maxWidth: '450px',
                    borderRadius: 'var(--radius-md)'
                  }}
                />
              </div>
            )
          ) : (
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading media streams...
            </div>
          )}
        </div>

        {/* Info panel */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'rgba(255,255,255,0.01)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          <Info className="w-4 h-4 text-indigo-500" style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span>
            {file.convertedBlob 
              ? `Reviewing the converted file quality. The conversion was completed entirely in your browser browser-sandbox.`
              : `Previewing original file before conversion. Double-click any rich media file to launch this preview modal.`}
          </span>
        </div>
      </div>
    </div>
  );
};
